// Edge Function: map-candidate-skills
//
// Mapeia o que o candidato SABE FAZER, com a evidência de onde isso apareceu.
//
// Até aqui skill só existia depois da contratação: generate-development-plan
// registra as do colaborador, e a aba de skills é preenchimento manual. Do lado
// do candidato não havia nada, então tudo que o processo descobriu sobre a
// pessoa se perdia entre a análise e a contratação, e no primeiro dia o gestor
// começava do zero.
//
// Roda sob demanda, e é RE-RODÁVEL de propósito: a cada etapa nova (formulário
// respondido, entrevista registrada) o mapa fica mais completo, e cada etapa
// grava a própria linha. Skill declarada no currículo e confirmada na entrevista
// é sinal diferente de skill declarada e nunca mais mencionada, e isso só
// aparece se as etapas não se sobrescreverem.
//
// Autorização: recrutador logado, da empresa dona da candidatura.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callOpenAI, openaiCostCents, OpenAIError } from '../_shared/openai.ts';

const MODEL = 'gpt-5';
const MAX_SKILLS_PER_SOURCE = 12;
const KINDS = ['hard', 'soft'];
const SOURCES = ['cv', 'form', 'interview'];

type Payload = { applicationId?: string };

type SkillOut = {
  name: string;
  kind: string;
  source: string;
  level: number | null;
  evidence: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildPrompt(args: {
  jobTitle: string;
  requirements: string | null;
  catalog: string[];
  resumeText: string | null;
  answersBlock: string | null;
  interviewBlock: string | null;
}): string {
  return `Você mapeia o que uma pessoa SABE FAZER, a partir das evidências que um processo seletivo produziu.

VAGA: ${args.jobTitle}
${args.requirements ? `Requisitos internos da vaga:\n${args.requirements}\n` : ''}
CATÁLOGO DE SKILLS QUE A EMPRESA JÁ USA:
${args.catalog.length > 0 ? args.catalog.map((s) => `- ${s}`).join('\n') : '(catálogo vazio)'}
Quando a evidência corresponder a uma skill do catálogo, use EXATAMENTE o nome do catálogo. Isso é o que permite comparar pessoas entre si e carregar a skill pra dentro da empresa depois. Só invente nome novo quando a evidência não couber em nenhuma das existentes.

FONTES DISPONÍVEIS
${args.resumeText ? `--- CURRÍCULO (source: "cv") ---\n${args.resumeText}\n` : '(sem currículo)'}
${args.answersBlock ? `--- RESPOSTAS DO FORMULÁRIO (source: "form") ---\n${args.answersBlock}\n` : '(sem formulário respondido)'}
${args.interviewBlock ? `--- ANOTAÇÕES DA ENTREVISTA (source: "interview") ---\n${args.interviewBlock}\n` : '(sem entrevista registrada)'}

REGRAS
1. Cada skill sai de UMA fonte. Se a mesma skill aparece no currículo e na entrevista, emita DUAS entradas, uma por fonte, cada uma com a evidência daquela fonte. É assim que se vê o que foi só declarado e o que foi confirmado depois.
2. EVIDÊNCIA OBRIGATÓRIA, e ela cita o que a pessoa fez ou disse, não a sua conclusão. "Montou o FAQ e a base de conhecimento do suporte a partir dos chamados repetidos" é evidência. "Tem perfil analítico" não é, e skill sem evidência não deve ser emitida.
3. hard é o que se verifica: ferramenta, técnica, idioma, método, formação. soft é comportamento observável no trabalho: como argumenta, como organiza, como lida com prazo, com conflito e com erro.
4. NÍVEL de 1 a 5, e seja honesto com a diferença entre estágios. Currículo mostra o que a pessoa DECLARA (raramente passa de 3 sozinho). Formulário e entrevista mostram como ela pensa e o que ela de fato fez. 5 é reservado pra evidência forte e específica, com escala ou resultado.
5. Não infira skill a partir de cargo ou empresa. "Trabalhou numa agência" não é evidência de nada específico.
6. No máximo ${MAX_SKILLS_PER_SOURCE} skills por fonte. Prefira menos e bem sustentadas: a lista existe pra decidir, e lista inflada não ajuda ninguém.
7. Português do Brasil. Nomes de ferramenta ficam como são (Figma, Photoshop, Excel).

OUTPUT: somente JSON, nada antes ou depois.
{
  "skills": [
    { "name": "<nome>", "kind": "hard" | "soft", "source": "cv" | "form" | "interview", "level": <1-5>, "evidence": "<o que sustenta, citando o que a pessoa fez ou disse>" }
  ]
}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return jsonResponse({ error: 'Sem autorização' }, 401);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400);
  }
  const applicationId = (payload.applicationId ?? '').trim();
  if (!applicationId) return jsonResponse({ error: 'applicationId obrigatório' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !apiKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: 'JWT inválido' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userRow } = await admin
    .from('users')
    .select('company_id')
    .eq('id', userData.user.id)
    .maybeSingle();
  const companyId = userRow?.company_id;
  if (!companyId) return jsonResponse({ error: 'Usuário sem empresa vinculada' }, 403);

  const { data: app } = await admin
    .from('applications')
    .select('id, company_id, job_id, resume_path')
    .eq('id', applicationId)
    .maybeSingle();
  if (!app) return jsonResponse({ error: 'Candidatura não encontrada' }, 404);
  if (app.company_id !== companyId) {
    return jsonResponse({ error: 'Candidatura não pertence à empresa' }, 403);
  }

  const [jobRes, answersRes, notesRes, catalogRes] = await Promise.all([
    admin.from('jobs').select('title, requirements').eq('id', app.job_id).maybeSingle(),
    admin
      .from('application_answers')
      .select('question_snapshot, answer')
      .eq('application_id', applicationId),
    admin
      .from('interview_notes')
      .select('question_snapshot, note')
      .eq('application_id', applicationId),
    admin.from('skills').select('name').eq('company_id', companyId).eq('active', true),
  ]);

  // Currículo: o texto já extraído pela análise, pra não reprocessar o arquivo.
  const { data: analysis } = await admin
    .from('ai_analyses')
    .select('cv_observations')
    .eq('application_id', applicationId)
    .maybeSingle();

  const answers = (answersRes.data ?? []).filter((a) => (a.answer ?? '').trim().length > 0);
  const notes = (notesRes.data ?? []).filter((n) => (n.note ?? '').trim().length > 0);

  const answersBlock =
    answers.length > 0
      ? answers.map((a) => `P: ${a.question_snapshot}\nR: ${a.answer}`).join('\n\n')
      : null;
  const interviewBlock =
    notes.length > 0
      ? notes.map((n) => `P: ${n.question_snapshot}\nAnotação: ${n.note}`).join('\n\n')
      : null;
  const resumeText = analysis?.cv_observations ?? null;

  if (!answersBlock && !interviewBlock && !resumeText) {
    return jsonResponse({ error: 'Ainda não há material para mapear skills.' }, 422);
  }

  const prompt = buildPrompt({
    jobTitle: jobRes.data?.title ?? '',
    requirements: jobRes.data?.requirements ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    catalog: (catalogRes.data ?? []).map((s: any) => String(s.name)),
    resumeText,
    answersBlock,
    interviewBlock,
  });

  let raw: string;
  let costCents = 0;
  try {
    const { text, usage } = await callOpenAI({
      apiKey,
      model: MODEL,
      prompt,
      maxTokens: 4000,
      jsonMode: true,
    });
    raw = text;
    costCents = openaiCostCents(usage);
  } catch (err) {
    const status = err instanceof OpenAIError ? err.status : 500;
    console.error('[map-candidate-skills] openai:', err);
    return jsonResponse({ error: 'A análise de skills falhou. Tente de novo.' }, status);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any;
  try {
    parsed = JSON.parse(raw.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim());
  } catch {
    return jsonResponse({ error: 'Retorno inválido da análise.' }, 502);
  }

  const catalogByName = new Map<string, string>();
  {
    const { data: full } = await admin
      .from('skills')
      .select('id, name')
      .eq('company_id', companyId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of (full ?? []) as any[]) {
      catalogByName.set(String(s.name).trim().toLowerCase(), s.id);
    }
  }

  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const raw of (Array.isArray(parsed?.skills) ? parsed.skills : []) as SkillOut[]) {
    const name = String(raw?.name ?? '').trim();
    const kind = String(raw?.kind ?? '').trim();
    const source = String(raw?.source ?? '').trim();
    const evidence = String(raw?.evidence ?? '').trim();
    if (!name || !KINDS.includes(kind) || !SOURCES.includes(source)) continue;
    // Evidência é o que separa mapa de chute: sem ela a linha não entra.
    if (!evidence) continue;
    const dedupe = `${name.toLowerCase()}|${source}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const lvl = Number(raw?.level);
    rows.push({
      application_id: applicationId,
      company_id: companyId,
      skill_id: catalogByName.get(name.toLowerCase()) ?? null,
      name,
      kind,
      source,
      level: Number.isFinite(lvl) ? Math.max(1, Math.min(5, Math.round(lvl))) : null,
      evidence,
    });
  }

  if (rows.length > 0) {
    const { error } = await admin
      .from('candidate_skills')
      .upsert(rows, { onConflict: 'application_id,name,source' });
    if (error) {
      console.error('[map-candidate-skills] upsert:', error.message);
      return jsonResponse({ error: 'Não deu pra salvar as skills.' }, 500);
    }
  }

  return jsonResponse({ ok: true, mapped: rows.length, costCents });
});
