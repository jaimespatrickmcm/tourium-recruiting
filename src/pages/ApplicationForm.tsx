import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, useLocation, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BrandCtaButton, BrandCtaLink } from '@/components/brand-cta';
import { supabase } from '@/lib/supabase';
import { invokeEdge } from '@/lib/functions';
import { makeCanaryToken, canaryInjection } from '@/lib/canary';
import { parseOptions } from '@/hooks/use-questions';
import type { QuestionFormat, QuestionKind } from '@/types/database';

type PublicJob = {
  id: string;
  slug: string;
  title: string;
  status: string;
  companyName: string;
};

type CandidateField = 'name' | 'email' | 'phone' | 'city';

type CandidateStep = {
  type: 'candidate';
  field: CandidateField;
  sectionLabel: string;
  question: string;
  helper: string;
  placeholder: string;
  inputType: string;
};

type QuestionStep = {
  type: 'question';
  source: 'job_question' | QuestionKind;
  refId: string | null;
  sectionLabel: string;
  question: string;
  helper: string;
  required: boolean;
  format: QuestionFormat;
  options: string[];
};

type Step = CandidateStep | QuestionStep;

// Helper visível abaixo do enunciado, por formato. Nas abertas cada seção tem
// o seu texto; nos outros formatos a instrução do input é mais útil.
function helperFor(format: QuestionFormat, openHelper: string): string {
  if (format === 'number') return 'Pode responder só com o número.';
  if (format === 'single_select') return 'Escolha uma opção.';
  if (format === 'multi_select') return 'Pode marcar mais de uma opção.';
  return openHelper;
}

const OPTION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Categorias das perguntas da empresa, na ordem em que aparecem no form.
// `profile` entra logo depois dos dados de contato (mesma seção "Sobre você");
// cultura, curiosidade e raciocínio vêm depois das perguntas da vaga.
const KIND_STEPS: Record<
  QuestionKind,
  { order: number; sectionLabel: string; openHelper: string }
> = {
  profile: {
    order: 0,
    sectionLabel: 'Sobre você',
    openHelper: 'Sem resposta certa. É pra gente te conhecer melhor.',
  },
  culture: {
    order: 1,
    sectionLabel: 'Cultura',
    openHelper: 'Não tem resposta certa. A gente quer entender como você pensa.',
  },
  curiosity: {
    order: 2,
    sectionLabel: 'Curiosidade',
    openHelper: 'Responde do jeito que vier. A gente quer saber o que te move.',
  },
  reasoning: {
    order: 3,
    sectionLabel: 'Raciocínio lógico',
    openHelper: 'Mostre o caminho até a resposta, não só a conclusão.',
  },
};

function isQuestionKind(value: string): value is QuestionKind {
  return value === 'profile' || value === 'culture' || value === 'reasoning' || value === 'curiosity';
}

// Seleção sem pelo menos 2 opções não tem o que clicar: vira pergunta aberta
// em vez de travar o candidato num passo obrigatório sem saída.
function effectiveFormat(format: QuestionFormat, options: string[]): QuestionFormat {
  if ((format === 'single_select' || format === 'multi_select') && options.length < 2) {
    return 'text';
  }
  return format;
}

type NavState = { name?: string; email?: string; phone?: string } | null;

// Rascunho local. O formulário é longo (dezenas de perguntas), então perder tudo
// num F5, numa aba fechada sem querer ou numa queda de conexão significa perder
// o candidato. Guarda no aparelho a cada mudança e restaura ao voltar.
type FormDraft = {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  answers?: Record<string, string>;
  selections?: Record<string, string[]>;
  stepIndex?: number;
  savedAt?: number;
};

// Rascunho velho quase sempre é de outro processo seletivo. Depois disso, some.
const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function draftKey(companySlug?: string, jobSlug?: string, applicationId?: string | null): string {
  return `noren:form:${companySlug ?? ''}:${jobSlug ?? ''}:${applicationId ?? 'anon'}`;
}

function readDraft(key: string): FormDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FormDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    // Modo privado, cota cheia ou JSON corrompido: segue sem rascunho.
    return null;
  }
}

function draftHasAnswers(draft: FormDraft | null): boolean {
  if (!draft) return false;
  const texts = Object.values(draft.answers ?? {}).some((v) => (v ?? '').trim().length > 0);
  const picks = Object.values(draft.selections ?? {}).some((v) => (v ?? []).length > 0);
  return texts || picks;
}

const CANDIDATE_STEPS: CandidateStep[] = [
  {
    type: 'candidate',
    field: 'name',
    sectionLabel: 'Sobre você',
    question: 'Como você se chama?',
    helper: 'Nome completo, do jeito que aparece nos seus documentos.',
    placeholder: 'Maria Silva',
    inputType: 'text',
  },
  {
    type: 'candidate',
    field: 'email',
    sectionLabel: 'Sobre você',
    question: 'Qual o seu melhor email?',
    helper: 'É por aqui que a equipe fala com você.',
    placeholder: 'voce@email.com',
    inputType: 'email',
  },
  {
    type: 'candidate',
    field: 'phone',
    sectionLabel: 'Sobre você',
    question: 'Qual o seu telefone?',
    helper: 'Pra combinar uma conversa rápida quando fizer sentido.',
    placeholder: '(11) 99999-9999',
    inputType: 'tel',
  },
  {
    type: 'candidate',
    field: 'city',
    sectionLabel: 'Sobre você',
    question: 'Onde você mora hoje?',
    helper: 'Cidade e estado ajudam a equipe a pensar no formato de trabalho.',
    placeholder: 'São Paulo, SP',
    inputType: 'text',
  },
];

export function ApplicationForm() {
  const { companySlug, jobSlug } = useParams<{ companySlug: string; jobSlug: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const applicationId = searchParams.get('app');
  const accessToken = searchParams.get('t');
  const navState = (location.state as NavState) ?? null;

  const [job, setJob] = useState<PublicJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [jobQuestions, setJobQuestions] = useState<QuestionStep[]>([]);
  const [companyQuestions, setCompanyQuestions] = useState<QuestionStep[]>([]);

  const storageKey = draftKey(companySlug, jobSlug, applicationId);
  // Lido uma vez, na montagem, pra semear os campos abaixo.
  const [initialDraft] = useState<FormDraft | null>(() => readDraft(storageKey));
  const restoredDraft = draftHasAnswers(initialDraft);

  const [phase, setPhase] = useState<'cover' | 'form' | 'done'>('cover');
  const [stepIndex, setStepIndex] = useState(initialDraft?.stepIndex ?? 0);
  const [submitting, setSubmitting] = useState(false);

  // Respostas
  const [name, setName] = useState(initialDraft?.name || navState?.name || '');
  const [email, setEmail] = useState(initialDraft?.email || navState?.email || '');
  const [phone, setPhone] = useState(initialDraft?.phone || navState?.phone || '');
  const [city, setCity] = useState(initialDraft?.city ?? '');
  const [answers, setAnswers] = useState<Record<string, string>>(initialDraft?.answers ?? {});
  // Respostas das perguntas de seleção, por refId. single_select guarda array
  // de 1 item; multi_select guarda todas as opções marcadas.
  const [selections, setSelections] = useState<Record<string, string[]>>(
    initialDraft?.selections ?? {},
  );
  // Campos do candidato que já chegaram preenchidos (via link individual). Esses
  // passos somem do formulário pra encurtar o caminho até as perguntas.
  const [prefilledFields, setPrefilledFields] = useState<Set<CandidateField>>(() => new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function load() {
      if (!companySlug || !jobSlug) return;
      const { data: company } = await supabase
        .from('company_public_profiles')
        .select('id, slug, name, description')
        .eq('slug', companySlug)
        .maybeSingle();
      if (!company) {
        setLoading(false);
        return;
      }
      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, slug, title, status')
        .eq('company_id', company.id)
        .eq('slug', jobSlug)
        .maybeSingle();
      if (jobData) {
        setJob({
          id: jobData.id,
          slug: jobData.slug,
          title: jobData.title,
          status: jobData.status,
          companyName: company.name,
        });

        const { data: jq, error: jqError } = await supabase
          .from('job_questions_public')
          .select('id, question, position, required, format, options')
          .eq('job_id', jobData.id)
          .order('position', { ascending: true });
        setJobQuestions(
          (jq ?? []).map((q) => {
            const options = parseOptions(q.options) ?? [];
            const format = effectiveFormat(q.format, options);
            return {
              type: 'question' as const,
              source: 'job_question' as const,
              refId: q.id,
              sectionLabel: 'Sobre a vaga',
              question: q.question,
              helper: helperFor(
                format,
                'Seja concreto. Exemplos do que você já fez valem mais que frases genéricas.',
              ),
              required: q.required,
              format,
              options,
            };
          }),
        );

        const { data: cq, error: cqError } = await supabase
          .from('company_questions_public')
          .select('id, kind, question, position, required, format, options')
          .eq('company_id', company.id)
          .order('kind', { ascending: true })
          .order('position', { ascending: true });
        // Sem as perguntas, o form viraria só os dados de contato e a candidatura
        // chegaria vazia sem ninguém perceber. Melhor travar com erro visível.
        if (jqError || cqError) {
          console.error('[ApplicationForm] falha ao carregar perguntas:', jqError ?? cqError);
          setLoadError(true);
          setLoading(false);
          return;
        }
        const companySteps: QuestionStep[] = (cq ?? [])
          .filter((q) => isQuestionKind(q.kind))
          .sort(
            (a, b) =>
              KIND_STEPS[a.kind as QuestionKind].order - KIND_STEPS[b.kind as QuestionKind].order ||
              a.position - b.position,
          )
          .map((q) => {
            const kind = q.kind as QuestionKind;
            const options = parseOptions(q.options) ?? [];
            const format = effectiveFormat(q.format, options);
            return {
              type: 'question' as const,
              source: kind,
              refId: q.id,
              sectionLabel: KIND_STEPS[kind].sectionLabel,
              question: q.question,
              helper: helperFor(format, KIND_STEPS[kind].openHelper),
              required: q.required,
              format,
              options,
            };
          });
        setCompanyQuestions(companySteps);
      }
      setLoading(false);
    }
    void load();
  }, [companySlug, jobSlug]);

  // Link individual: com app + token, buscamos os dados já conhecidos do
  // candidato e pré-preenchemos. Os passos preenchidos somem do formulário.
  useEffect(() => {
    if (!applicationId || !accessToken) return;
    let active = true;
    async function prefill() {
      const { data } = await invokeEdge<{
        name: string | null;
        email: string | null;
        phone: string | null;
        city: string | null;
      }>('application-prefill', { applicationId, token: accessToken });
      if (!active || !data) return;

      const filled = new Set<CandidateField>();
      const name = (data.name ?? '').trim();
      const email = (data.email ?? '').trim();
      const phone = (data.phone ?? '').trim();
      const city = (data.city ?? '').trim();
      // O que a pessoa já digitou (rascunho) vale mais que o dado do servidor:
      // se ela corrigiu o telefone, a correção não pode ser desfeita ao voltar.
      if (name) {
        setName((prev) => (prev.trim() ? prev : name));
        filled.add('name');
      }
      if (email) {
        setEmail((prev) => (prev.trim() ? prev : email));
        filled.add('email');
      }
      if (phone) {
        setPhone((prev) => (prev.trim() ? prev : phone));
        filled.add('phone');
      }
      if (city) {
        setCity((prev) => (prev.trim() ? prev : city));
        filled.add('city');
      }
      setPrefilledFields(filled);
    }
    void prefill();
    return () => {
      active = false;
    };
  }, [applicationId, accessToken]);

  // Auto-save: grava a cada mudança. Não guarda enquanto envia nem depois de
  // enviado, pra não ressuscitar um rascunho de candidatura já concluída.
  useEffect(() => {
    if (phase === 'done' || submitting) return;
    try {
      const draft: FormDraft = {
        name,
        email,
        phone,
        city,
        answers,
        selections,
        stepIndex,
        savedAt: Date.now(),
      };
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      // Sem espaço ou modo privado: o formulário continua funcionando normal.
    }
  }, [name, email, phone, city, answers, selections, stepIndex, phase, submitting, storageKey]);

  const candidateSteps = useMemo<CandidateStep[]>(
    () => CANDIDATE_STEPS.filter((step) => !prefilledFields.has(step.field)),
    [prefilledFields],
  );

  // Sobre o candidato (profile) cola nos dados de contato; o resto vem depois
  // das perguntas da vaga: contato -> perfil -> vaga -> cultura -> curiosidade -> raciocínio.
  const steps = useMemo<Step[]>(() => {
    const profile = companyQuestions.filter((q) => q.source === 'profile');
    const rest = companyQuestions.filter((q) => q.source !== 'profile');
    return [...candidateSteps, ...profile, ...jobQuestions, ...rest];
  }, [candidateSteps, jobQuestions, companyQuestions]);

  // Um canary token por pergunta aberta, gerado uma vez quando as perguntas
  // carregam. Só faz sentido em resposta digitada: seleção e número não têm
  // texto pra carregar a injeção junto.
  const canaryByRef = useMemo(() => {
    const map: Record<string, string> = {};
    for (const q of [...jobQuestions, ...companyQuestions]) {
      if (q.refId && q.format === 'text') map[q.refId] = makeCanaryToken();
    }
    return map;
  }, [jobQuestions, companyQuestions]);

  // O rascunho pode ter sido salvo quando o formulário tinha outro tamanho (a
  // empresa mexeu nas perguntas). Sem isso, o candidato voltaria pra um passo
  // que não existe mais e cairia numa tela vazia.
  useEffect(() => {
    if (steps.length > 0 && stepIndex > steps.length - 1) {
      setStepIndex(steps.length - 1);
    }
  }, [steps.length, stepIndex]);

  const current = steps[stepIndex];

  // Auto-focus a cada passo. Perguntas de seleção não têm campo pra focar.
  useEffect(() => {
    if (phase !== 'form') return;
    const t = setTimeout(() => {
      if (current?.type === 'question') {
        if (current.format === 'text') textareaRef.current?.focus();
        else if (current.format === 'number') inputRef.current?.focus();
      } else {
        inputRef.current?.focus();
      }
    }, 80);
    return () => clearTimeout(t);
  }, [phase, stepIndex, current]);

  function candidateValue(field: CandidateField): string {
    if (field === 'name') return name;
    if (field === 'email') return email;
    if (field === 'phone') return phone;
    return city;
  }

  function setCandidateValue(field: CandidateField, value: string) {
    if (field === 'name') setName(value);
    else if (field === 'email') setEmail(value);
    else if (field === 'phone') setPhone(value);
    else setCity(value);
  }

  function toggleOption(step: QuestionStep, option: string) {
    const key = step.refId ?? '';
    setSelections((prev) => {
      const cur = prev[key] ?? [];
      if (step.format === 'single_select') {
        return { ...prev, [key]: cur[0] === option ? [] : [option] };
      }
      return {
        ...prev,
        [key]: cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option],
      };
    });
  }

  const canAdvance = (() => {
    if (!current) return false;
    if (current.type === 'candidate') {
      if (current.field === 'name') return name.trim().length >= 2;
      if (current.field === 'email') return /\S+@\S+\.\S+/.test(email);
      if (current.field === 'phone') return phone.trim().length >= 8;
      return true; // city é livre
    }
    // Obrigatória bloqueia quando vazia. Opcional segue mesmo em branco.
    if (!current.required) return true;
    if (current.format === 'single_select' || current.format === 'multi_select') {
      return (selections[current.refId ?? ''] ?? []).length > 0;
    }
    return (answers[current.refId ?? ''] ?? '').trim().length > 0;
  })();

  const isLastStep = stepIndex === steps.length - 1;

  function goNext() {
    if (!canAdvance) return;
    if (isLastStep) {
      void submit();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function goBack() {
    if (stepIndex === 0) {
      setPhase('cover');
      return;
    }
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function submit() {
    if (!companySlug || !jobSlug) return;
    setSubmitting(true);
    try {
      const questionAnswers = [...jobQuestions, ...companyQuestions]
        .map((q) => {
          const isSelect = q.format === 'single_select' || q.format === 'multi_select';
          const answer = isSelect
            ? (selections[q.refId ?? ''] ?? []).join('; ')
            : (answers[q.refId ?? ''] ?? '').trim();
          return {
            source: q.source,
            refId: q.refId,
            question: q.question,
            answer,
            canaryToken: q.refId ? canaryByRef[q.refId] : undefined,
          };
        })
        .filter((a) => a.answer.length > 0);

      const { error } = await invokeEdge('submit-application-form', {
        applicationId: applicationId ?? undefined,
        token: accessToken ?? undefined,
        companySlug,
        jobSlug,
        candidateInfo: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          city: city.trim(),
        },
        answers: questionAnswers,
      });
      if (error) throw error;
      // Enviado: o rascunho cumpriu o papel e sai de cena.
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Ignora: não enviar o formulário por causa disso seria pior.
      }
      setPhase('done');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar formulário');
    } finally {
      setSubmitting(false);
    }
  }

  // O formulário é por convite: chega por email quando o candidato avança de
  // etapa, sempre com link individual (app + token). Sem convite, explica o
  // fluxo em vez de abrir o form.
  if (!loading && job && (!applicationId || !accessToken)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-md text-center">
          <h1 className="font-satoshi font-bold text-[28px] tracking-[-0.4px] text-[#1d1d1f] mb-3">
            Esse formulário chega por convite
          </h1>
          <p className="text-[15px] text-[#6b6b70] mb-8">
            Quando você avança no processo da {job.companyName}, a gente te manda um link individual
            por email pra responder essas perguntas. Confere sua caixa de entrada, ou candidate-se
            primeiro na página da vaga.
          </p>
          <div className="flex justify-center">
            <BrandCtaLink to={`/careers/${companySlug}/${jobSlug}`} size="default">
              Ver a vaga
            </BrandCtaLink>
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#8a8a8f] text-sm">
        Carregando...
      </div>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-md text-center">
          <h1 className="font-satoshi font-bold text-[28px] tracking-[-0.4px] text-[#1d1d1f] mb-3">
            Não conseguimos carregar o formulário
          </h1>
          <p className="text-[15px] text-[#6b6b70]">
            Deu um problema ao buscar as perguntas. Recarregue a página em instantes. Se continuar,
            volte pelo link que você recebeu.
          </p>
        </div>
      </main>
    );
  }

  if (!job || job.status !== 'active') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-md text-center">
          <h1 className="font-satoshi font-bold text-[28px] tracking-[-0.4px] text-[#1d1d1f] mb-3">
            Vaga não encontrada
          </h1>
          <p className="text-[15px] text-[#6b6b70]">
            Essa vaga não existe ou não está mais aceitando candidaturas.
          </p>
        </div>
      </main>
    );
  }

  // Tela final
  if (phase === 'done') {
    return (
      <main className="relative min-h-screen bg-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.10),transparent_60%)]" />
        <div className="relative max-w-2xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex h-16 w-16 rounded-2xl holo-gradient items-center justify-center mb-6">
            <CheckCircle2 className="h-8 w-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="font-satoshi font-bold text-[36px] tracking-[-0.6px] text-[#1d1d1f] mb-3">
            Tudo certo
          </h1>
          <p className="text-[16px] text-[#6b6b70] max-w-md mx-auto mb-8">
            Suas respostas chegaram na <strong className="text-[#1d1d1f]">{job.companyName}</strong>.
            O time agora tem bem mais contexto pra avaliar seu fit pra{' '}
            <strong className="text-[#1d1d1f]">{job.title}</strong>.
          </p>
          <div className="flex justify-center">
            <BrandCtaLink to="/candidato" size="default">
              Ver meu perfil
            </BrandCtaLink>
          </div>
        </div>
      </main>
    );
  }

  // Tela de capa
  if (phase === 'cover') {
    return (
      <main className="relative min-h-screen bg-white flex flex-col">
        <div className="pointer-events-none absolute inset-0 holo-gradient opacity-[0.08]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.14),transparent_65%)]" />

        <header className="relative border-b border-gray-100 bg-white/60 backdrop-blur">
          <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
            <Link
              to={`/careers/${companySlug}/${jobSlug}`}
              className="font-satoshi font-bold text-[20px] tracking-[-0.4px] text-[#1d1d1f]"
            >
              {job.companyName}
            </Link>
          </div>
        </header>

        <div className="relative flex-1 flex items-center justify-center px-6 py-16">
          <div className="max-w-xl text-center">
            <p className="text-[12px] font-bold uppercase tracking-wider text-sky-600 mb-4">
              {job.companyName}
            </p>
            <h1 className="font-satoshi font-bold text-[34px] md:text-[48px] tracking-[-0.8px] leading-[1.08] text-[#1d1d1f] mb-5">
              {restoredDraft
                ? 'Suas respostas estão salvas'
                : `Você avançou no processo pra ${job.title}`}
            </h1>
            <p className="text-[16px] md:text-[17px] text-[#6b6b70] leading-relaxed mb-8 max-w-md mx-auto">
              {restoredDraft
                ? 'Você já tinha começado por aqui. Guardamos tudo neste aparelho, é só continuar de onde parou.'
                : 'Agora o time quer te conhecer de verdade. São perguntas na tela, uma por vez, no seu ritmo. Reserve uns 15 minutos num lugar tranquilo.'}
            </p>
            <div className="flex justify-center">
              <BrandCtaButton size="lg" onClick={() => setPhase('form')}>
                {restoredDraft ? 'Continuar' : 'Começar'}
              </BrandCtaButton>
            </div>
          </div>
        </div>
        <PoweredByNoren />
      </main>
    );
  }

  const progress = steps.length > 0 ? ((stepIndex + 1) / steps.length) * 100 : 100;

  return (
    <main className="relative min-h-screen bg-white flex flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.07),transparent_60%)]" />

      {/* Progress */}
      <div className="relative px-6 pt-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Link
              to={`/careers/${companySlug}/${jobSlug}`}
              className="font-satoshi font-bold text-[16px] tracking-[-0.3px] text-[#1d1d1f]"
            >
              {job.companyName}
            </Link>
            <span className="flex items-center gap-3">
              <span className="hidden sm:inline text-[12px] text-[#a8a8ad]">
                Respostas salvas neste aparelho
              </span>
              <span className="text-[12px] font-medium text-[#6b6b70]">
                <span className="text-[#1d1d1f] font-bold">{stepIndex + 1}</span> de {steps.length}
              </span>
            </span>
          </div>
          <div
            className="h-1 bg-gray-100 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={stepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={steps.length}
          >
            <div
              className="h-full holo-gradient rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step */}
      <div className="relative flex-1 flex items-start md:items-center justify-center px-6 py-10 md:py-14">
        <div className="w-full max-w-2xl">
          {current && (
            <div key={stepIndex}>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-sky-600">
                  {current.sectionLabel}
                </p>
                {current.type === 'question' && current.required && (
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    Obrigatória
                  </span>
                )}
              </div>
              <h2 className="font-satoshi font-semibold text-[19px] md:text-[23px] tracking-[-0.2px] leading-[1.35] text-[#1d1d1f] mb-2.5 max-w-xl">
                <QuestionText
                  text={current.question}
                  token={
                    current.type === 'question' && current.refId
                      ? canaryByRef[current.refId]
                      : undefined
                  }
                />
              </h2>
              <p className="text-[14px] text-[#8a8a8f] leading-relaxed mb-6 max-w-lg">
                {current.helper}
              </p>

              {current.type === 'candidate' ? (
                <Input
                  ref={inputRef}
                  type={current.inputType}
                  value={candidateValue(current.field)}
                  onChange={(e) => setCandidateValue(current.field, e.target.value)}
                  placeholder={current.placeholder}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canAdvance) {
                      e.preventDefault();
                      goNext();
                    }
                  }}
                  className="h-12 rounded-xl border-gray-200 text-[16px]"
                />
              ) : current.format === 'number' ? (
                // type="text" de propósito: type="number" briga com "5.000",
                // vírgula decimal e "R$ " colado, e silenciosamente guarda ''.
                <Input
                  ref={inputRef}
                  type="text"
                  inputMode="decimal"
                  value={answers[current.refId ?? ''] ?? ''}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [current.refId ?? '']: e.target.value }))
                  }
                  placeholder="0"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canAdvance) {
                      e.preventDefault();
                      goNext();
                    }
                  }}
                  className="h-12 rounded-xl border-gray-200 text-[16px] max-w-xs"
                />
              ) : current.format === 'single_select' || current.format === 'multi_select' ? (
                <div
                  className="space-y-2 max-w-md"
                  role={current.format === 'single_select' ? 'radiogroup' : 'group'}
                >
                  {current.options.map((option, oi) => {
                    const selected = (selections[current.refId ?? ''] ?? []).includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        role={current.format === 'single_select' ? 'radio' : 'checkbox'}
                        aria-checked={selected}
                        onClick={() => toggleOption(current, option)}
                        className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] transition-colors ${
                          selected
                            ? 'border-sky-400 bg-sky-50 text-[#1d1d1f]'
                            : 'border-gray-200 bg-white text-[#1d1d1f] hover:border-sky-200 hover:bg-sky-50/40'
                        }`}
                      >
                        <span
                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold ${
                            selected
                              ? 'border-sky-400 bg-sky-600 text-white'
                              : 'border-gray-300 bg-gray-50 text-[#6b6b70]'
                          }`}
                        >
                          {OPTION_LETTERS[oi] ?? '#'}
                        </span>
                        <span className="flex-1">{option}</span>
                        {selected && <CheckCircle2 className="h-4 w-4 text-sky-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Textarea
                  ref={textareaRef}
                  value={answers[current.refId ?? ''] ?? ''}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [current.refId ?? '']: e.target.value }))
                  }
                  placeholder="Escreva sua resposta aqui."
                  rows={7}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      goNext();
                    }
                  }}
                  className="rounded-xl border-gray-200 text-[15px] leading-relaxed resize-none"
                />
              )}

              {current.type === 'question' &&
                (current.required ? (
                  <p className="text-[12px] text-amber-700 mt-2">
                    Essa é obrigatória pra seguir.
                  </p>
                ) : (
                  <p className="text-[12px] text-[#8a8a8f] mt-2">
                    Dá pra pular. Mas responder ajuda bastante na sua avaliação.
                  </p>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer nav */}
      <div className="relative border-t border-gray-100 bg-white/70 backdrop-blur">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6b6b70] hover:text-[#1d1d1f] transition-colors disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>

          <BrandCtaButton size="sm" onClick={goNext} disabled={!canAdvance || submitting}>
            {isLastStep ? (submitting ? 'Enviando...' : 'Enviar') : 'Continuar'}
          </BrandCtaButton>
        </div>
        <PoweredByNoren />
      </div>
    </main>
  );
}

// Onde enfiar o canary: num espaço perto do meio do enunciado, nunca no fim.
// Assim, se o candidato copiar "até o ponto final", a injeção invisível vem junto.
function canarySplitIndex(text: string): number {
  if (text.length < 24) return Math.max(1, Math.floor(text.length / 2));
  const mid = Math.floor(text.length / 2);
  const forward = text.indexOf(' ', mid);
  if (forward !== -1) return forward;
  const back = text.lastIndexOf(' ', mid);
  return back > 0 ? back : Math.floor(text.length / 2);
}

// Enunciado com a palavra-canário invisível embutida NO MEIO do texto (não no fim).
// Estilo sr-only (absolute + clip): fora do fluxo da linha, então NÃO abre espaço
// visual nenhum, mas segue dentro da seleção (copiar leva junto). display:none e
// visibility:hidden não servem: o navegador não copia.
function QuestionText({ text, token }: { text: string; token?: string }) {
  if (!token) return <>{text}</>;
  const idx = canarySplitIndex(text);
  return (
    <>
      {text.slice(0, idx)}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
          userSelect: 'text',
        }}
      >
        {canaryInjection(token)}
      </span>
      {text.slice(idx)}
    </>
  );
}

function PoweredByNoren() {
  return (
    <div className="flex justify-center py-4">
      <span className="text-[11px] text-[#a8a8ad]">
        Powered by <span className="font-semibold text-[#8a8a8f]">Noren</span>
      </span>
    </div>
  );
}

export default ApplicationForm;
