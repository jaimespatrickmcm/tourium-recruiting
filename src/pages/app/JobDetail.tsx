import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  ArrowLeft,
  ArrowRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  XCircle,
  FileText,
  Linkedin,
  Trash2,
  Sparkles,
  Loader2,
  Pencil,
  ChevronDown,
  ChevronUp,
  Lock,
  MessageCircle,
  Copy,
  Check,
  Users,
  TrendingUp,
  Compass,
  Upload,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { ProfileAssessmentCard } from '@/components/profile-assessment-card';
import { invokeEdge } from '@/lib/functions';
import { useCompany } from '@/hooks/use-company';
import { useAuth } from '@/hooks/use-auth';
import {
  useApplications,
  analysisIsPending,
  type ApplicationWithAnalysis,
  type ApplicationAnalysis,
} from '@/hooks/use-applications';
import {
  parseDimensions,
  parseStageDimensions,
  overallFromDimensions,
  areaLabel,
  SCOUT_AREAS,
  type StageDimension,
} from '@/lib/scout-areas';
import {
  parseEvidencePoints,
  parseQuestionScores,
  parseCvFeedback,
  parsePotentialBreakdown,
  parseLeadershipSignal,
  LEADERSHIP_LEVEL_LABELS,
  LEADERSHIP_INTENT_LABELS,
  type EvidencePoint,
  type QuestionScore,
  type CvFeedback,
  type PotentialComponent,
  type LeadershipSignal,
} from '@/lib/evidence-points';
import { ScoutCard } from '@/components/scout-card';
import { BrandCtaButton } from '@/components/brand-cta';
import { EmptyState } from '@/components/page-shell';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { parseDescriptionSections, DescriptionBody } from '@/lib/job-description';
import { cn } from '@/lib/utils';
import type {
  ApplicationStatus,
  ApplicationEventType,
  AnswerSource,
  HighlightType,
  JobRequirements,
} from '@/types/database';

type Job = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  highlight_question: string | null;
  highlight_type: HighlightType | null;
  requirements: JobRequirements | null;
  show_benefits: boolean;
};

type AppEvent = {
  id: string;
  type: ApplicationEventType;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
};

// Resposta do candidato no formulário, como ela foi gravada em application_answers.
type AppAnswer = {
  id: string;
  source: AnswerSource;
  ref_id: string | null;
  question_snapshot: string;
  answer: string | null;
  created_at: string;
};

// Ordem de leitura das seções de resposta: começa pela vaga, termina nos dados.
const ANSWER_SOURCE_ORDER: AnswerSource[] = [
  'job_question',
  'profile',
  'culture',
  'curiosity',
  'reasoning',
  'candidate_info',
];

const ANSWER_SOURCE_LABELS: Record<AnswerSource, string> = {
  job_question: 'Técnica',
  profile: 'Sobre o candidato',
  culture: 'Cultura',
  curiosity: 'Curiosidade',
  reasoning: 'Raciocínio lógico',
  candidate_info: 'Dados',
};

// -----------------------------------------------------------------------------
// Sistema de tom
// -----------------------------------------------------------------------------
// Antes existiam cinco mapas de cor independentes (stageChipColors, recColors,
// VERDICT_COLORS, questionScoreTone, scoreBand.chip), somando seis matizes —
// esmeralda, ceu, ambar, rosa, violeta e indigo — cada um com sua tripla
// bg/text/border. O painel virava um vitral: nada tinha peso porque tudo
// gritava junto.
//
// Agora sao quatro tons semanticos + neutro, e uma regra: cor comunica
// julgamento (bom / atencao / ruim), nunca categoria. Etapa e categoria, entao
// etapa e neutra — exceto os estados terminais, que sao o desfecho.

type Tone = 'positive' | 'brand' | 'warning' | 'critical' | 'neutral';

const TONE_CHIP: Record<Tone, string> = {
  positive: 'bg-positive-tint text-positive',
  brand: 'bg-brand-tint text-brand',
  warning: 'bg-warning-tint text-warning',
  critical: 'bg-critical-tint text-critical',
  neutral: 'bg-canvas text-ink-muted',
};

const TONE_TEXT: Record<Tone, string> = {
  positive: 'text-positive',
  brand: 'text-brand',
  warning: 'text-warning',
  critical: 'text-critical',
  neutral: 'text-ink',
};

const TONE_FILL: Record<Tone, string> = {
  positive: 'bg-positive',
  brand: 'bg-brand',
  warning: 'bg-warning',
  critical: 'bg-critical',
  neutral: 'bg-ink-subtle',
};

/** Faixa de nota → tom. Fonte unica pra score geral, fit da etapa e nota por pergunta. */
/**
 * Cor da nota. Três estados, porque a decisão tem três estados: segue,
 * investiga, corta. Os cortes 60 e 40 são os MESMOS de verdictFromScore no edge
 * function analyze-candidate e os mesmos de scoreBand. Se mexer num, mexe nos
 * três.
 *
 * O âmbar saiu da faixa do meio de propósito. Âmbar lê como alerta, e a faixa
 * do meio não é alerta: é "vale investigar antes de decidir", que é um estado
 * normal de triagem. Pintar de amarelo um 58 fazia um candidato mediano parecer
 * um problema.
 */
function toneForScore(score: number): Tone {
  if (score >= 60) return 'positive';
  if (score >= 40) return 'brand';
  return 'critical';
}

/** Chip padrao: pilula sem borda. A borda era ruido — o tint ja separa do fundo. */
function Chip({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-eyebrow font-bold uppercase',
        TONE_CHIP[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// Uma pergunta do formulário. Fechada mostra o enunciado, a categoria e a nota;
// aberta revela a resposta do candidato e, quando existe, o porquê da nota.
// A categoria fica visível fechada porque quem lê precisa saber de que tipo é a
// pergunta pra julgar se a nota faz sentido. É metadado, entao vem neutra: a
// nota continua sendo o elemento com peso.
function AnswerRow({
  question,
  category,
  answer,
  score,
  unscored,
  open,
  onToggle,
}: {
  question: string;
  category: string;
  answer: string | null;
  score: QuestionScore | undefined;
  // Pergunta de coleta de dado (salário, regime, anos de experiência, origem da
  // vaga). Sem isso a linha aparecia sem nota e sem explicação, e quem lê ficava
  // sem saber se a IA esqueceu ou se aquilo não vale nota mesmo.
  unscored: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors duration-200 hover:bg-canvas"
      >
        <span className="min-w-0 flex-1 text-callout font-semibold text-ink">{question}</span>
        <span className="flex shrink-0 items-center gap-2 pt-0.5">
          <span className="whitespace-nowrap rounded-full border border-line-soft bg-canvas px-2 py-0.5 text-caption text-ink-muted">
            {category}
          </span>
          {score ? (
            <span
              className={cn(
                'text-callout font-bold tabular-nums',
                TONE_TEXT[toneForScore(score.score)],
              )}
            >
              {score.score}
            </span>
          ) : unscored ? (
            <span className="whitespace-nowrap text-caption text-ink-subtle">não pontua</span>
          ) : null}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-ink-subtle transition-transform duration-200',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </span>
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          <p className="whitespace-pre-wrap text-callout text-ink">{answer}</p>

          {score && score.rationale.length > 0 && (
            <p className="border-l-2 border-line-soft pl-3 text-footnote text-ink-muted">
              <span className="font-semibold text-ink-subtle">Por que essa nota: </span>
              {score.rationale}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Etapas que têm um link pra mandar pro candidato, e o texto do botão. Etapa
// fora daqui (proposta, contratado, reprovado) não tem link, então o botão nem
// aparece em vez de aparecer e copiar vazio.
const STAGE_LINK_LABEL: Partial<Record<ApplicationStatus, string>> = {
  triagem: 'Copiar link do formulário',
  fit_cultural: 'Copiar link do formulário',
  entrevista: 'Copiar link da agenda',
};

// Versão atual do pipeline de análise. Tem que bater com
// ANALYSIS_PIPELINE_VERSION no edge function analyze-candidate: é a comparação
// que diz quais análises ficaram pra trás depois de uma mudança de régua.
const CURRENT_PIPELINE_VERSION = 2;

// Quantas re-análises rodam ao mesmo tempo. Cada uma leva 60-90s, então
// sequencial faria 45 candidatos levarem quase uma hora. Três em paralelo cabe
// no limite da edge function sem derrubar a fila.
const REANALYZE_CONCURRENCY = 3;

// Custo médio observado por análise em ai_analyses.cost_cents. Serve pra avisar
// antes de gastar, não pra cobrar: é estimativa, e está dito como tal na tela.
const CENTS_PER_ANALYSIS = 8;

// Retorno da edge function notify-stage-change: o que rolou de comunicação com o
// candidato depois da virada de etapa.
type StageComms = {
  toStatus: string;
  formUrl: string | null;
  schedulingUrl: string | null;
  whatsappUrl: string | null;
  emailSent: boolean;
};

const STAGE_ORDER: ApplicationStatus[] = [
  'triagem',
  'fit_cultural',
  'entrevista',
  'proposta',
  'contratado',
  'reprovado',
];

const stageLabels: Record<ApplicationStatus, string> = {
  triagem: 'Triagem',
  fit_cultural: 'Fit cultural',
  entrevista: 'Entrevista',
  proposta: 'Proposta',
  contratado: 'Contratado',
  reprovado: 'Reprovado',
};

// Etapa e categoria, nao julgamento: so os estados terminais carregam tom.
// O resto e neutro — a posicao no funil ja e comunicada pelo texto.
const stageTone: Record<ApplicationStatus, Tone> = {
  triagem: 'neutral',
  fit_cultural: 'neutral',
  entrevista: 'neutral',
  proposta: 'brand',
  contratado: 'positive',
  reprovado: 'neutral',
};

const NEXT_STAGE: Partial<Record<ApplicationStatus, ApplicationStatus>> = {
  triagem: 'fit_cultural',
  fit_cultural: 'entrevista',
  entrevista: 'proposta',
};

// `recommendation` (strong_hire / hire / maybe / no_hire) saiu da tela inteira.
// Era o modelo decidindo contratação por conta própria, e aparecia ao lado do
// fit da etapa dizendo o contrário dele: "Avançar" na decisão da etapa e "Não
// contratar" no scout, na mesma tela. Nenhuma etapa antes da entrevista decide
// contratação; quem decide se a pessoa segue é o `stage_verdict`, calculado.

const STUCK_ANALYSIS_MS = 2 * 60 * 1000;

const AREA_LABELS: Record<string, string> = {
  cultura: 'Cultura',
  execucao: 'Execução',
  comunicacao: 'Comunicação',
  motivacao: 'Motivação',
  potencial: 'Potencial',
};

type ScoreBand = { label: string; hint: string };

// Dá referência à nota crua: uma faixa nomeada + o que ela significa no processo.
/**
 * Escala do scout. Cinco faixas, e cada uma cabe INTEIRA dentro de um veredito:
 * os cortes 60 e 40 são fronteira de faixa e fronteira de veredito ao mesmo
 * tempo. Sem isso um mesmo rótulo apareceria ora com "Avançar" ora com
 * "Avaliar melhor", que foi o tipo de contradição que a gente passou o dia
 * caçando.
 *
 * De onde vêm os cortes, em três âncoras que se confirmam:
 *
 * 1. A MATEMÁTICA DA RÉGUA. As rubricas cadastradas dizem "0-30 fraco, 40-60
 *    ok, 70-85 forte, 90-100 topo", e a nota é a MÉDIA de ~20 delas. Quem
 *    responde "ok" em tudo tira 50; quem responde "forte" em tudo tira 77.
 *    Ninguém é forte em vinte perguntas seguidas, então 80 é praticamente teto
 *    e 90+ não existe na prática. Uma escala 0-100 lida como prova de escola
 *    faz um 58 parecer nota vermelha quando ele é, de fato, um bom candidato.
 *
 * 2. A DISTRIBUIÇÃO REAL dos 49 candidatos analisados: 12% em 80+, 39% entre
 *    60 e 79, 27% entre 50 e 59, 8% entre 40 e 49, 14% abaixo de 40. O topo
 *    fica raro de verdade e o meio fica povoado, que é o que se espera de uma
 *    escala honesta.
 *
 * 3. A LEITURA DE QUEM RECRUTA: a Thais tira 58-61 e é candidata que emprega em
 *    várias empresas. Uma escala que a chama de fraca está errada sobre o
 *    mundo, não sobre ela.
 *
 * Cuidado ao mexer: os números de currículo e os de formulário podem não estar
 * na mesma escala (a mediana de currículo é 65 e a de formulário parece mais
 * baixa). Com poucas análises de formulário ainda não dá pra calibrar as duas
 * separado. Quando houver ~20, vale medir de novo antes de mudar os cortes.
 */
const SCORE_SCALE: { min: number; label: string; hint: string }[] = [
  { min: 80, label: 'Excepcional', hint: 'Raro. Forte em quase tudo que a vaga pede.' },
  { min: 60, label: 'Muito bom', hint: 'Acima do que a vaga pede na maioria dos pontos.' },
  { min: 50, label: 'Bom', hint: 'Entrega o que a vaga pede, com pontos ainda em aberto.' },
  { min: 40, label: 'Parcial', hint: 'Atende em parte. As lacunas são reais.' },
  { min: 0, label: 'Abaixo', hint: 'Distante do que a vaga pede neste momento.' },
];

function scoreBand(score: number): ScoreBand {
  const found = SCORE_SCALE.find((b) => score >= b.min) ?? SCORE_SCALE[SCORE_SCALE.length - 1];
  return { label: found.label, hint: found.hint };
}

/**
 * Legenda da escala, atrás do ícone de informação ao lado da nota. Existe
 * porque uma nota de 0 a 100 sem legenda é lida como prova de escola, e aí um
 * 58 vira "vermelho" na cabeça de quem lê, mesmo sendo um bom candidato.
 */
function ScaleLegend({ current }: { current: string }) {
  return (
    <div className="mt-3 rounded-card border border-line-soft bg-canvas p-4">
      <p className="mb-2.5 text-footnote text-ink-muted">
        A nota é a média das perguntas, e cada pergunta é julgada por uma régua onde uma resposta
        forte vale entre 70 e 85. Como ninguém responde forte a tudo, 80 já é quase teto: entre os
        49 candidatos analisados até agora, só 12% passaram disso.
      </p>
      <ul className="space-y-1">
        {SCORE_SCALE.map((b, i) => {
          const next = i === 0 ? 100 : SCORE_SCALE[i - 1].min - 1;
          const active = b.label === current;
          return (
            <li
              key={b.label}
              className={cn(
                'flex gap-2.5 rounded-control px-2 py-1 text-caption',
                active ? 'bg-surface font-semibold text-ink' : 'text-ink-muted',
              )}
            >
              <span className="w-16 shrink-0 tabular-nums">
                {b.min} a {next}
              </span>
              <span className="w-24 shrink-0">{b.label}</span>
              <span className="min-w-0 flex-1">{b.hint}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const VERDICT_LABELS: Record<string, string> = {
  avancar: 'Avançar',
  // O candidato segue no processo, o time só precisa investigar antes de cravar.
  avaliar_melhor: 'Avaliar melhor',
  cortar: 'Cortar',
  // Análises antigas gravaram 'segurar', que dizia pouco sobre o que fazer.
  segurar: 'Avaliar melhor',
};
// Mesma lógica de toneForScore: "avaliar melhor" não é alerta, é uma etapa
// normal do processo. Âmbar aqui fazia parecer que havia algo errado com o
// candidato quando a única coisa que havia era uma pergunta em aberto.
const VERDICT_TONE: Record<string, Tone> = {
  avancar: 'positive',
  avaliar_melhor: 'brand',
  cortar: 'critical',
  segurar: 'brand',
};
const EVIDENCE_STAGE_LABELS: Record<string, string> = {
  cv: 'Baseado só no currículo',
  form: 'Com respostas do formulário',
};

// Decisão da etapa: o fit calibrado ao estágio (só CV vs com formulário), com
// veredito de avançar, avaliar melhor ou cortar, e comparação no mesmo estágio.
// Diferente do scout geral (5 áreas), que fica logo abaixo.
function StageDecision({
  analysis,
  dims,
  cohortStageScores,
}: {
  analysis: ApplicationAnalysis;
  dims: { area: string; score: number }[];
  cohortStageScores: number[];
}) {
  const stageScore = analysis.stage_score ?? analysis.score ?? 0;
  const verdict = analysis.stage_verdict ?? null;
  const stage = analysis.evidence_stage ?? null;
  const band = scoreBand(stageScore);
  const sorted = [...dims].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const total = cohortStageScores.length;
  const rank = 1 + cohortStageScores.filter((s) => s > stageScore).length;
  const average =
    total > 0 ? Math.round(cohortStageScores.reduce((sum, s) => sum + s, 0) / total) : stageScore;

  const tone = toneForScore(stageScore);
  const verdictTone = verdict ? (VERDICT_TONE[verdict] ?? 'neutral') : tone;
  const [scaleOpen, setScaleOpen] = useState(false);

  // Hierarquia deliberada, de cima pra baixo:
  //   1. o numero e o veredito — a decisao, legivel a um metro de distancia
  //   2. uma frase de justificativa
  //   3. forte / atencao / posicao relativa — apoio, em corpo pequeno
  // Antes os tres niveis tinham o mesmo peso visual e o olho nao sabia onde
  // pousar. Sem caixa em volta: este bloco ja esta dentro do card do candidato,
  // e caixa dentro de caixa era a origem da poluicao.
  return (
    <div className="mb-6">
      <div className="mb-4 flex items-start gap-5">
        <div className="shrink-0">
          <p
            className={cn(
              'font-satoshi text-[56px] font-bold leading-none tracking-[-0.05em] tabular-nums',
              TONE_TEXT[tone],
            )}
          >
            {stageScore}
          </p>
          <p className="mt-1.5 text-eyebrow font-bold uppercase text-ink-subtle">Fit da etapa</p>
        </div>

        <div className="min-w-0 flex-1 pt-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {verdict && <Chip tone={verdictTone}>{VERDICT_LABELS[verdict] ?? verdict}</Chip>}
            <Chip tone="neutral">{band.label}</Chip>
            <button
              type="button"
              onClick={() => setScaleOpen((v) => !v)}
              aria-expanded={scaleOpen}
              aria-label="O que essa nota significa"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-canvas hover:text-ink"
            >
              <Info className="h-3.5 w-3.5" aria-hidden />
            </button>
            {stage && (
              <span className="text-caption text-ink-subtle">
                {EVIDENCE_STAGE_LABELS[stage] ?? stage}
              </span>
            )}
          </div>
          <p className="text-callout text-ink">{analysis.stage_note || band.hint}</p>

          {scaleOpen && <ScaleLegend current={band.label} />}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-ink-subtle">
        {strongest && (
          <span>
            Forte em{' '}
            <span className="font-semibold text-ink-muted">
              {AREA_LABELS[strongest.area] ?? strongest.area} ({strongest.score})
            </span>
          </span>
        )}
        {weakest && weakest !== strongest && (
          <span>
            Atenção em{' '}
            <span className="font-semibold text-ink-muted">
              {AREA_LABELS[weakest.area] ?? weakest.area} ({weakest.score})
            </span>
          </span>
        )}
        <span>
          {total > 1
            ? `${rank}º de ${total} nesta etapa · média ${average}`
            : 'Primeiro candidato nesta etapa'}
        </span>
      </div>
    </div>
  );
}

// Pontos fortes e pontos de atenção com a evidência que sustenta cada leitura.
// É o "por que" do score: fica logo abaixo da decisão da etapa pra o recrutador
// entender de onde saiu a nota antes de ver os gráficos. Análise antiga não tem
// esses dados e o bloco inteiro some.
function EvidencePoints({
  strengths,
  concerns,
}: {
  strengths: EvidencePoint[];
  concerns: EvidencePoint[];
}) {
  if (strengths.length === 0 && concerns.length === 0) return null;

  // Duas colunas no desktop: forte e atencao lado a lado se leem como um
  // balanco. Empilhados, como estavam, viravam duas listas soltas e o
  // recrutador tinha que rolar pra formar a comparacao na cabeca.
  return (
    <div className="mb-6 grid gap-6 border-t border-line-soft pt-6 sm:grid-cols-2">
      {strengths.length > 0 && (
        <section>
          <p className="mb-3 text-eyebrow font-bold uppercase text-ink-subtle">Pontos fortes</p>
          <ul className="space-y-3.5">
            {strengths.map((item, i) => (
              <li key={`forte-${i}`} className="flex gap-2.5">
                <span
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-positive"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-footnote font-semibold text-ink">{item.point}</p>
                  {item.evidence && (
                    <p className="mt-0.5 text-footnote text-ink-muted">{item.evidence}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {concerns.length > 0 && (
        <section>
          <p className="mb-1 text-eyebrow font-bold uppercase text-ink-subtle">
            Pontos de atenção
          </p>
          <p className="mb-3 text-caption text-ink-subtle">
            Não são vetos. São o que vale perguntar na entrevista.
          </p>
          <ul className="space-y-3.5">
            {concerns.map((item, i) => (
              <li key={`atencao-${i}`} className="flex gap-2.5">
                <span
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-footnote font-semibold text-ink">{item.point}</p>
                  {item.evidence && (
                    <p className="mt-0.5 text-footnote text-ink-muted">{item.evidence}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// Feedback do currículo como documento: o que ele já comunica bem e o que
// mudaria a leitura de quem abre o arquivo. Não é juízo sobre a pessoa, e o
// candidato vê o mesmo conteúdo na área dele.
function CvFeedbackBlock({ feedback }: { feedback: CvFeedback }) {
  return (
    <div className="mb-6 border-t border-line-soft pt-6">
      <p className="mb-1 flex items-center gap-2 text-eyebrow font-bold uppercase text-ink-subtle">
        <FileText className="h-3.5 w-3.5" aria-hidden />
        Currículo: o que dá pra melhorar
      </p>
      <p className="mb-4 text-caption text-ink-subtle">
        Leitura do currículo como documento, não do candidato. Esse mesmo texto fica visível pra
        ele na área do candidato.
      </p>

      {feedback.strengths.length > 0 && (
        <section className="mb-4">
          <p className="mb-2 text-footnote font-semibold text-ink">O que já funciona</p>
          <ul className="space-y-1.5">
            {feedback.strengths.map((item, i) => (
              <li key={`cv-forte-${i}`} className="flex gap-2.5">
                <span
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-positive"
                  aria-hidden
                />
                <span className="min-w-0 text-footnote text-ink-muted">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {feedback.improvements.length > 0 && (
        <section>
          <p className="mb-2 text-footnote font-semibold text-ink">O que ajustar</p>
          <ul className="space-y-3.5">
            {feedback.improvements.map((item, i) => (
              <li key={`cv-ajuste-${i}`} className="flex gap-2.5">
                <span
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-footnote font-semibold text-ink">{item.point}</p>
                  {item.why && (
                    <p className="mt-0.5 text-footnote text-ink-muted">{item.why}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const STAGE_SCOUT_TITLES: Record<string, string> = {
  cv: 'Leitura do currículo',
  form: 'Leitura do fit cultural',
};

// Scout da etapa: as dimensões específicas do estágio de evidência (currículo
// ou formulário), separadas do scout geral de 5 áreas que fica abaixo.
function StageScout({
  stageDims,
  evidenceStage,
}: {
  stageDims: StageDimension[];
  evidenceStage: string | null;
}) {
  const title = (evidenceStage && STAGE_SCOUT_TITLES[evidenceStage]) ?? 'Leitura da etapa';
  return (
    <div className="mb-6 border-t border-line-soft pt-6">
      <p className="mb-3.5 text-eyebrow font-bold uppercase text-ink-subtle">{title}</p>
      <div className="space-y-3">
        {stageDims.map((d) => (
          <div key={d.area} className="flex items-center gap-3" title={d.rationale ?? undefined}>
            <span className="w-28 shrink-0 text-caption font-medium text-ink-muted">
              {areaLabel(d.area)}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              {d.score !== null && (
                // Barra em cor solida do tom da faixa: o preenchimento ja diz
                // "quanto"; gradiente nele so acrescentava ruido.
                <div
                  className={cn('h-full rounded-full', TONE_FILL[toneForScore(d.score)])}
                  style={{ width: `${d.score}%` }}
                />
              )}
            </div>
            {d.score !== null ? (
              <span
                className={cn(
                  'w-7 shrink-0 text-right text-caption font-bold tabular-nums',
                  TONE_TEXT[toneForScore(d.score)],
                )}
              >
                {d.score}
              </span>
            ) : (
              <span className="shrink-0 text-caption italic text-ink-subtle">sem dados</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// De onde vem o potencial: os componentes por trás da nota de potencial.
// A linha de apoio existe porque potencial é fácil de ler errado. É projeção
// de crescimento, não retrato do nível atual, e por isso fica fora da nota da
// vaga.
function PotentialBreakdownBlock({ components }: { components: PotentialComponent[] }) {
  return (
    <div className="mb-6 border-t border-line-soft pt-6">
      <p className="mb-1 flex items-center gap-2 text-eyebrow font-bold uppercase text-ink-subtle">
        <TrendingUp className="h-3.5 w-3.5" aria-hidden />
        De onde vem o potencial
      </p>
      <p className="mb-4 text-caption text-ink-subtle">
        Potencial projeta o quanto a pessoa ainda cresce, não o nível de hoje. Por isso não entra
        na nota da vaga.
      </p>
      <div className="space-y-3">
        {components.map((c) => (
          <div key={c.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-footnote font-semibold text-ink">{c.label}</span>
              {c.score !== null ? (
                <span
                  className={cn(
                    'shrink-0 text-footnote font-bold tabular-nums',
                    TONE_TEXT[toneForScore(c.score)],
                  )}
                >
                  {c.score}
                </span>
              ) : (
                <span className="shrink-0 text-caption italic text-ink-subtle">sem dados</span>
              )}
            </div>
            {c.evidence && <p className="mt-0.5 text-footnote text-ink-muted">{c.evidence}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Sinal de liderança. Deliberadamente sem nota, sem barra e sem tom de
// sucesso ou erro: é informação, não veredito. Muita gente excelente não quer
// liderar, e mostrar isso como falha seria injusto. Capacidade (level) e
// interesse declarado (intent) ficam em linhas separadas justamente porque o
// caso mais útil é capacidade alta com interesse baixo: essa pessoa cresce
// como referência técnica, não empurrada pra gestão.
function LeadershipSignalBlock({ signal }: { signal: LeadershipSignal }) {
  const hasEvidence = signal.evidence.length > 0;
  const intentDeclared = signal.intent !== 'nao_declarado';
  // Sem sinal e sem evidência só vale a pena mostrar se a pessoa declarou
  // interesse. Fora isso o bloco não acrescenta nada e some.
  if (signal.level === 'sem' && !hasEvidence && !intentDeclared) return null;

  return (
    <div className="mb-6 border-t border-line-soft pt-6">
      <p className="mb-1 flex items-center gap-2 text-eyebrow font-bold uppercase text-ink-subtle">
        <Compass className="h-3.5 w-3.5" aria-hidden />
        Liderança
      </p>
      <p className="mb-4 text-caption text-ink-subtle">
        Leitura de contexto, não nota. Não entra em ranking nem em média.
      </p>

      <div className="rounded-card bg-canvas px-4 py-3">
        <p className="text-footnote text-ink">
          <span className="font-semibold">Sinal de liderança:</span>{' '}
          <span className="rounded-full bg-surface px-2 py-0.5 text-caption font-semibold text-ink-muted">
            {LEADERSHIP_LEVEL_LABELS[signal.level]}
          </span>
        </p>

        {hasEvidence && (
          <ul className="mt-2.5 space-y-1.5">
            {signal.evidence.map((item, i) => (
              <li key={`lideranca-${i}`} className="flex gap-2.5">
                <span
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-subtle"
                  aria-hidden
                />
                <span className="min-w-0 text-footnote text-ink-muted">{item}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 border-t border-line-soft pt-3 text-footnote text-ink">
          <span className="font-semibold">Interesse declarado:</span>{' '}
          {LEADERSHIP_INTENT_LABELS[signal.intent]}
        </p>
        {signal.intent_evidence && (
          <p className="mt-0.5 text-footnote text-ink-muted">{signal.intent_evidence}</p>
        )}
      </div>
    </div>
  );
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { company } = useCompany();
  const [job, setJob] = useState<Job | null>(null);
  const [jobLoading, setJobLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [batch, setBatch] = useState<{
    total: number;
    done: number;
    failed: number;
    running: boolean;
  } | null>(null);
  const [stageFilter, setStageFilter] = useState<'all' | ApplicationStatus>('all');

  const { applications, loading: appsLoading, refetch, patchApplication } = useApplications(id);

  useEffect(() => {
    async function loadJob() {
      if (!id) return;
      const { data } = await supabase
        .from('jobs')
        .select(
          'id, slug, title, description, status, created_at, highlight_question, highlight_type, requirements, show_benefits',
        )
        .eq('id', id)
        .maybeSingle<Job>();
      setJob(data);
      setJobLoading(false);
    }
    void loadJob();
  }, [id]);

  if (jobLoading || appsLoading) {
    return <div className="p-8 text-ink-subtle text-sm">Carregando...</div>;
  }
  if (!job) {
    return <div className="p-8 text-ink-muted">Vaga não encontrada.</div>;
  }

  const counts = STAGE_ORDER.reduce(
    (acc, s) => {
      acc[s] = applications.filter((a) => a.status === s).length;
      return acc;
    },
    {} as Record<ApplicationStatus, number>,
  );

  const filtered =
    stageFilter === 'all' ? applications : applications.filter((a) => a.status === stageFilter);

  const selected = applications.find((a) => a.id === selectedId) ?? null;

  // Referência relativa comparando só quem está no MESMO estágio de evidência
  // (não faz sentido comparar um fit de currículo com um já respondido).
  const selectedStage = selected?.ai_analysis?.evidence_stage ?? null;
  const cohortStageScores = applications
    .filter(
      (a) =>
        a.ai_analysis?.status === 'completed' &&
        (a.ai_analysis?.evidence_stage ?? null) === selectedStage &&
        typeof a.ai_analysis?.stage_score === 'number',
    )
    .map((a) => a.ai_analysis!.stage_score as number);

  // Análises feitas com régua antiga. Depois das mudanças de calibragem (nota
  // por pergunta, potencial calculado, campo de cadastro fora da média), a nota
  // velha e a nova não são comparáveis, então deixar as duas convivendo na
  // mesma lista faz o recrutador ordenar candidato por régua diferente.
  const outdated = applications.filter(
    (a) =>
      a.ai_analysis?.status === 'completed' &&
      (a.ai_analysis?.pipeline_version ?? 1) < CURRENT_PIPELINE_VERSION,
  );

  // Reprocessa em fila, com poucos ao mesmo tempo. Não dispara sozinho e não
  // recomeça do zero: quem já está na versão nova fica de fora, então rodar de
  // novo depois de uma falha só refaz o que faltou.
  async function reanalyzeOutdated() {
    const queue = [...outdated];
    if (queue.length === 0) return;
    setBatch({ total: queue.length, done: 0, failed: 0, running: true });

    let done = 0;
    let failed = 0;
    async function worker() {
      for (;;) {
        const next = queue.shift();
        if (!next) return;
        const { error } = await invokeEdge('analyze-candidate', { applicationId: next.id });
        if (error) failed += 1;
        done += 1;
        setBatch({ total: outdated.length, done, failed, running: true });
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(REANALYZE_CONCURRENCY, queue.length) }, () => worker()),
    );

    setBatch({ total: outdated.length, done, failed, running: false });
    await refetch();
    if (failed > 0) {
      toast.warning(
        `${done - failed} reprocessados, ${failed} falharam. Rode de novo pra tentar só os que faltaram.`,
      );
    } else {
      toast.success(`${done} candidatos reprocessados com a régua nova.`);
    }
  }

  return (
    <div className="relative min-h-screen bg-canvas">
      <div className="canvas-tint pointer-events-none absolute inset-x-0 top-0 h-[420px]" />

      <div className="relative mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <button
          onClick={() => navigate('/app/jobs')}
          className="mb-6 inline-flex items-center gap-2 text-footnote font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Vagas
        </button>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-3 text-eyebrow font-bold uppercase text-ink-subtle">Vaga</p>
            <h1 className="font-satoshi text-title-1 font-bold text-ink sm:text-display">
              {job.title}
            </h1>
            <p className="mt-3 text-footnote text-ink-subtle">
              {applications.length} candidato{applications.length === 1 ? '' : 's'} ·{' '}
              {job.status === 'active' ? 'Ativa' : job.status === 'paused' ? 'Pausada' : 'Encerrada'}
            </p>
          </div>
          {company && job.status === 'active' && (
            <a
              href={`/careers/${company.slug}/${job.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-full border border-line bg-surface px-4 text-footnote font-semibold text-ink transition-colors hover:bg-canvas"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Career page
            </a>
          )}
        </div>

        {/*
          Reestruturacao principal desta tela.

          Antes, "Descricao da vaga" e "Requisitos (interno)" eram duas sanfonas
          grandes empilhadas ACIMA da lista de candidatos. Elas empurravam o
          trabalho real pra baixo da dobra toda vez que o recrutador abria a
          vaga — e sao conteudo de setup, editado uma vez e revisitado raramente,
          exatamente como Empresa/DNA/Perguntas na nav.

          Agora sao duas abas irmas: Pipeline abre por padrao, Sobre a vaga
          guarda a configuracao. Mesmo principio da navegacao principal:
          operacao na frente, setup a um clique.
        */}
        {/* Barra de reprocessamento. Só aparece quando existe análise feita com
            régua antiga, e some sozinha quando não sobra nenhuma. Não dispara
            automático de propósito: reprocessar custa e sobrescreve a leitura
            atual, então quem decide é quem está olhando a tela. */}
        {outdated.length > 0 && (
          <div className="mb-6 flex flex-col gap-3 rounded-card border border-line-soft bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-callout font-semibold text-ink">
                {outdated.length} análise{outdated.length === 1 ? '' : 's'} com a régua antiga
              </p>
              <p className="mt-1 text-caption text-ink-muted">
                {batch?.running
                  ? `Reprocessando ${batch.done} de ${batch.total}. Pode deixar a aba aberta.`
                  : `Foram feitas antes da nota por pergunta e do potencial calculado, então não dá pra comparar com as novas. Custo estimado de US$ ${((outdated.length * CENTS_PER_ANALYSIS) / 100).toFixed(2)}.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void reanalyzeOutdated()}
              disabled={batch?.running}
              className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-full bg-ink px-4 text-footnote font-semibold text-surface transition-opacity hover:opacity-90 disabled:opacity-50 sm:self-auto"
            >
              {batch?.running ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              )}
              {batch?.running ? `${batch.done}/${batch.total}` : 'Reprocessar todos'}
            </button>
          </div>
        )}

        <Tabs defaultValue="pipeline">
          <TabsList className="mb-7 inline-flex h-auto gap-1 rounded-full bg-surface-sunken p-1">
            <TabsTrigger
              value="pipeline"
              className="gap-2 rounded-full px-4 py-2 text-footnote font-semibold text-ink-muted data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-e1"
            >
              Pipeline
              <span className="tabular-nums text-ink-subtle">{applications.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="vaga"
              className="rounded-full px-4 py-2 text-footnote font-semibold text-ink-muted data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-e1"
            >
              Sobre a vaga
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="mt-0">
            {applications.length === 0 ? (
              <EmptyState
                icon={<Users className="h-7 w-7" strokeWidth={1.75} />}
                title="Nenhum candidato ainda"
                description="Compartilhe a career page. Cada candidatura dispara a análise automaticamente."
                action={
                  company ? (
                    <code className="inline-block rounded-control bg-surface-sunken px-3 py-2 text-footnote text-ink">
                      {window.location.origin}/careers/{company.slug}/{job.slug}
                    </code>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="mb-5 flex flex-wrap gap-2">
                  <StagePill
                    label="Todas"
                    count={applications.length}
                    active={stageFilter === 'all'}
                    onClick={() => setStageFilter('all')}
                  />
                  {STAGE_ORDER.map((s) => (
                    <StagePill
                      key={s}
                      label={stageLabels[s]}
                      count={counts[s]}
                      active={stageFilter === s}
                      onClick={() => setStageFilter(s)}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
                  <div className="flex flex-col gap-2">
                    {filtered.length === 0 ? (
                      <div className="surface-card px-5 py-8 text-center">
                        <p className="text-footnote text-ink-muted">
                          Nenhum candidato nessa etapa.
                        </p>
                      </div>
                    ) : (
                      filtered.map((app) => (
                        <CandidateListItem
                          key={app.id}
                          app={app}
                          selected={selectedId === app.id}
                          onSelect={() => setSelectedId(app.id)}
                        />
                      ))
                    )}
                  </div>

                  <div>
                    {selected ? (
                      <CandidateDetail
                        key={selected.id}
                        app={selected}
                        jobTitle={job.title}
                        highlightQuestion={job.highlight_question}
                        highlightType={job.highlight_type}
                        cohortStageScores={cohortStageScores}
                        refetch={refetch}
                        patchApplication={patchApplication}
                        onDeleted={() => {
                          setSelectedId(null);
                          void refetch();
                        }}
                      />
                    ) : (
                      <div className="surface-card flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
                        <span className="icon-tile mb-4 h-12 w-12">
                          <Users className="h-5 w-5" strokeWidth={1.75} />
                        </span>
                        <p className="text-callout font-semibold text-ink">
                          Selecione um candidato
                        </p>
                        <p className="mt-1 text-footnote text-ink-muted">
                          A análise completa aparece aqui.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="vaga" className="mt-0">
            <DescriptionPanel
              job={job}
              onUpdate={(description) => setJob({ ...job, description })}
              onToggleBenefits={(show_benefits) => setJob({ ...job, show_benefits })}
            />
            <RequirementsPanel
              job={job}
              onUpdate={(requirements) => setJob({ ...job, requirements })}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/**
 * Item da lista de candidatos.
 *
 * Antes carregava, empilhado: nome, email, nota, chip de etapa, chip de
 * veredito, chip de recomendacao e chip de "IA suspeita" — ate quatro pilulas
 * coloridas embaixo do nome, cada uma com sua cor. Vinte candidatos na tela
 * viravam oitenta pilulas e o olho nao achava nada.
 *
 * Agora a nota e a ancora (grande, colorida pelo tom da faixa), o nome e
 * primario, o veredito e uma palavra sob a nota, e etapa/suspeita de IA sao
 * marcadores discretos. O email saiu: e informacao de contato, mora no detalhe,
 * nao ajuda a escolher quem abrir.
 */
function CandidateListItem({
  app,
  selected,
  onSelect,
}: {
  app: ApplicationWithAnalysis;
  selected: boolean;
  onSelect: () => void;
}) {
  const analysis = app.ai_analysis;
  const stageScore = analysis?.stage_score ?? analysis?.score ?? null;
  const verdict = analysis?.stage_verdict ?? null;
  const aStatus = analysis?.status;
  const isPending = analysisIsPending(app);
  const hasError = aStatus === 'error';
  const done = aStatus === 'completed' && stageScore !== null;
  const tone = done ? toneForScore(stageScore) : 'neutral';

  const verdictLabel = verdict ? (VERDICT_LABELS[verdict] ?? verdict) : null;
  const verdictTone: Tone = verdict ? (VERDICT_TONE[verdict] ?? 'neutral') : 'neutral';

  return (
    <button
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'w-full rounded-card border px-4 py-3.5 text-left transition-colors duration-200 ease-standard',
        selected ? 'border-ink bg-surface' : 'border-line-soft bg-surface hover:border-line',
      )}
    >
      <div className="flex items-center gap-3.5">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            <span className="truncate text-callout font-semibold text-ink">
              {app.candidate_name}
            </span>
            {app.ai_suspected && (
              <AlertCircle
                className="h-3.5 w-3.5 shrink-0 text-warning"
                aria-label="Suspeita de resposta gerada por IA"
              />
            )}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-caption text-ink-subtle">
            <span>{stageLabels[app.status]}</span>
            {isPending && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3 animate-pulse" aria-hidden />
                  analisando
                </span>
              </>
            )}
            {hasError && (
              <>
                <span aria-hidden>·</span>
                <span className="text-critical">erro na análise</span>
              </>
            )}
          </p>
        </div>

        {done && (
          <div className="shrink-0 text-right">
            <p
              className={cn(
                'font-satoshi text-title-2 font-bold leading-none tabular-nums',
                TONE_TEXT[tone],
              )}
            >
              {stageScore}
            </p>
            {verdictLabel && (
              <p className={cn('mt-1 text-eyebrow font-bold uppercase', TONE_TEXT[verdictTone])}>
                {verdictLabel}
              </p>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

function StagePill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  // Etapa sem ninguem fica esmaecida e nao clicavel: filtrar pra uma lista
  // vazia nunca e o que o recrutador queria, e a contagem ja diz isso.
  const empty = count === 0 && !active;
  return (
    <button
      onClick={onClick}
      disabled={empty}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-footnote font-semibold',
        'transition-colors duration-200 ease-standard',
        active
          ? 'border-ink bg-ink text-white'
          : empty
            ? 'cursor-not-allowed border-line-soft bg-surface text-ink-subtle opacity-50'
            : 'border-line-soft bg-surface text-ink-muted hover:border-line hover:text-ink',
      )}
    >
      {label}
      <span className={cn('tabular-nums', active ? 'text-white/60' : 'text-ink-subtle')}>
        {count}
      </span>
    </button>
  );
}

// Descrição da vaga: o que o candidato lê na career page. Dá pra editar na mão
// ou regerar com IA (a vaga já existe, então a criação não serve mais).
function DescriptionPanel({
  job,
  onUpdate,
  onToggleBenefits,
}: {
  job: Job;
  onUpdate: (description: string) => void;
  onToggleBenefits: (showBenefits: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [togglingBenefits, setTogglingBenefits] = useState(false);

  async function toggleBenefits() {
    const next = !job.show_benefits;
    setTogglingBenefits(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ show_benefits: next })
        .eq('id', job.id);
      if (error) throw error;
      onToggleBenefits(next);
      toast.success(next ? 'Benefícios aparecem nesta vaga.' : 'Benefícios ocultos nesta vaga.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não deu pra atualizar.');
    } finally {
      setTogglingBenefits(false);
    }
  }

  const description = job.description ?? '';
  const sections = parseDescriptionSections(description);

  async function save(next: string) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ description: next })
        .eq('id', job.id);
      if (error) throw error;
      onUpdate(next);
      setEditing(false);
      toast.success('Descrição salva.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não deu pra salvar a descrição.');
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    setGenerating(true);
    try {
      const { data, error } = await invokeEdge<{ description: string }>(
        'generate-job-description',
        { jobTitle: job.title },
      );
      if (error || !data?.description) {
        throw error ?? new Error('A IA não retornou a descrição.');
      }
      setDraft(data.description);
      setEditing(true);
      setOpen(true);
      toast.success('Descrição gerada. Revise e salve.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não deu pra gerar a descrição.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="surface-card mb-4 overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-line-soft bg-canvas px-5 py-4 sm:px-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 items-start gap-3 text-left"
        >
          <span className="icon-tile mt-0.5 h-8 w-8 shrink-0">
            <FileText className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="font-satoshi text-title-3 font-bold text-ink">
                Descrição da vaga
              </span>
              {open ? (
                <ChevronUp className="h-4 w-4 text-ink-subtle" aria-hidden />
              ) : (
                <ChevronDown className="h-4 w-4 text-ink-subtle" aria-hidden />
              )}
            </span>
            <span className="mt-0.5 block text-caption text-ink-muted">
              É o que o candidato lê na career page.
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {!editing && (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraft(description);
                  setEditing(true);
                  setOpen(true);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-footnote font-semibold text-ink transition-colors hover:bg-canvas"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Editar
              </button>
              <button
                type="button"
                onClick={() => void regenerate()}
                disabled={generating}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-footnote font-semibold text-ink transition-colors hover:bg-canvas disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                )}
                Regerar
              </button>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="px-6 py-5">
          {editing ? (
            <div>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={16}
                placeholder="Descrição da vaga em seções (## Título)."
                className="text-callout leading-relaxed"
              />
              <p className="mt-1.5 text-caption text-ink-subtle">
                Cada seção começa com "## Título" e vira um item expansível na career page.
                Bullets começam com hífen.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <BrandCtaButton size="sm" onClick={() => void save(draft)} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </BrandCtaButton>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="rounded-full px-4 py-2 text-footnote font-semibold text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : description ? (
            <div className="space-y-4">
              {sections.map((section, i) => (
                <div key={i}>
                  {section.title && (
                    <p className="font-satoshi font-bold text-callout text-ink mb-1">
                      {section.title}
                    </p>
                  )}
                  <DescriptionBody body={section.body} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-callout text-ink-muted leading-relaxed">
              Essa vaga ainda não tem descrição. Clique em Regerar pra a IA escrever uma, ou em
              Editar pra escrever na mão.
            </p>
          )}

          {!editing && (
            <button
              type="button"
              onClick={() => void toggleBenefits()}
              disabled={togglingBenefits}
              className="mt-5 flex w-full items-start gap-3 rounded-tile border border-line-soft p-3.5 text-left transition-colors hover:border-line disabled:opacity-50"
            >
              <span
                className={
                  'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors ' +
                  (job.show_benefits ? 'border-sky-500 bg-sky-500' : 'border-line bg-white')
                }
              >
                {job.show_benefits && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
              </span>
              <span>
                <span className="block text-footnote font-semibold text-ink">
                  Exibir os benefícios da empresa nesta vaga
                </span>
                <span className="block text-caption text-ink-muted mt-0.5">
                  Os benefícios são cadastrados no DNA da empresa e aparecem na career page.
                </span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const EMPTY_REQUIREMENTS: JobRequirements = {
  seniority: '',
  summary: '',
  location: '',
  must_have: [],
  nice_to_have: [],
  responsibilities: [],
  evaluation_focus: [],
  red_flags: [],
};

const REQ_ARRAY_FIELDS: { key: keyof JobRequirements; label: string }[] = [
  { key: 'must_have', label: 'Must-have' },
  { key: 'nice_to_have', label: 'Nice-to-have' },
  { key: 'responsibilities', label: 'Responsabilidades' },
  { key: 'evaluation_focus', label: 'Foco de avaliação' },
  { key: 'red_flags', label: 'Red flags' },
];

function RequirementsPanel({
  job,
  onUpdate,
}: {
  job: Job;
  onUpdate: (requirements: JobRequirements) => void;
}) {
  const requirements = job.requirements;
  // Nasce recolhido: é referência interna, o recrutador expande quando quer.
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<JobRequirements>(EMPTY_REQUIREMENTS);

  async function generate() {
    setGenerating(true);
    try {
      const { data, error } = await invokeEdge<{ requirements: JobRequirements }>(
        'generate-job-requirements',
        { jobId: job.id },
      );
      if (error || !data?.requirements) {
        throw error ?? new Error('A IA não retornou os requisitos.');
      }
      const { error: saveError } = await supabase
        .from('jobs')
        .update({ requirements: data.requirements })
        .eq('id', job.id);
      if (saveError) throw saveError;
      onUpdate(data.requirements);
      toast.success(requirements ? 'Requisitos regerados.' : 'Requisitos gerados.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não deu pra gerar os requisitos.');
    } finally {
      setGenerating(false);
    }
  }

  function startEdit() {
    setDraft(requirements ? { ...EMPTY_REQUIREMENTS, ...requirements } : EMPTY_REQUIREMENTS);
    setEditing(true);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    const cleaned: JobRequirements = {
      seniority: draft.seniority.trim(),
      summary: draft.summary.trim(),
      location: draft.location.trim(),
      must_have: draft.must_have,
      nice_to_have: draft.nice_to_have,
      responsibilities: draft.responsibilities,
      evaluation_focus: draft.evaluation_focus,
      red_flags: draft.red_flags,
    };
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ requirements: cleaned })
        .eq('id', job.id);
      if (error) throw error;
      onUpdate(cleaned);
      setEditing(false);
      toast.success('Requisitos salvos.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não deu pra salvar os requisitos.');
    } finally {
      setSaving(false);
    }
  }

  function textFor(key: keyof JobRequirements): string {
    const value = draft[key];
    return Array.isArray(value) ? value.join('\n') : '';
  }

  function setArray(key: keyof JobRequirements, raw: string) {
    const items = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    setDraft((prev) => ({ ...prev, [key]: items }));
  }

  return (
    <div className="surface-card mb-4 overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-line-soft bg-canvas px-5 py-4 sm:px-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 items-start gap-3 text-left"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-tile bg-ink text-white">
            <Lock className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="font-satoshi text-title-3 font-bold text-ink">
                Requisitos (interno)
              </span>
              {open ? (
                <ChevronUp className="h-4 w-4 text-ink-subtle" aria-hidden />
              ) : (
                <ChevronDown className="h-4 w-4 text-ink-subtle" aria-hidden />
              )}
            </span>
            <span className="mt-0.5 block text-caption text-ink-muted">
              O candidato nunca vê. Alimenta a geração das perguntas e a análise.
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {requirements && !editing && (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-footnote font-semibold text-ink transition-colors hover:bg-canvas"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Editar
            </button>
          )}
          {!editing && (
            <button
              type="button"
              onClick={() => void generate()}
              disabled={generating}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-footnote font-semibold text-ink transition-colors hover:bg-canvas disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              )}
              {requirements ? 'Regerar' : 'Gerar'}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="px-6 py-5">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-caption font-semibold text-ink">Nível</label>
                <input
                  value={draft.seniority}
                  onChange={(e) => setDraft((prev) => ({ ...prev, seniority: e.target.value }))}
                  placeholder="Ex.: Pleno, Sênior, Staff"
                  className="h-10 w-full rounded-tile border border-line-soft px-3 text-callout text-ink outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-caption font-semibold text-ink">
                  Local e modelo de trabalho
                </label>
                <input
                  value={draft.location}
                  onChange={(e) => setDraft((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="Ex.: Presencial em BH, Remoto, Híbrido em SP"
                  className="h-10 w-full rounded-tile border border-line-soft px-3 text-callout text-ink outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-caption font-semibold text-ink">Resumo</label>
                <Textarea
                  value={draft.summary}
                  onChange={(e) => setDraft((prev) => ({ ...prev, summary: e.target.value }))}
                  rows={3}
                  placeholder="Resumo do perfil ideal pra essa vaga."
                  className="text-callout"
                />
              </div>
              {REQ_ARRAY_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="mb-1.5 block text-caption font-semibold text-ink">
                    {field.label}
                    <span className="ml-2 font-normal text-ink-subtle">um item por linha</span>
                  </label>
                  <Textarea
                    value={textFor(field.key)}
                    onChange={(e) => setArray(field.key, e.target.value)}
                    rows={3}
                    className="text-callout"
                  />
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <BrandCtaButton size="sm" onClick={() => void save()} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </BrandCtaButton>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="rounded-full px-4 py-2 text-footnote font-semibold text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : requirements ? (
            <div className="space-y-5">
              {requirements.seniority && (
                <div>
                  <p className="text-eyebrow font-bold uppercase text-ink-subtle mb-2">
                    Nível
                  </p>
                  <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-caption font-semibold text-sky-700">
                    {requirements.seniority}
                  </span>
                </div>
              )}
              {requirements.location && (
                <div>
                  <p className="text-eyebrow font-bold uppercase text-ink-subtle mb-2">
                    Local e modelo
                  </p>
                  <span className="inline-flex items-center rounded-full border border-line-soft bg-canvas px-3 py-1 text-caption font-semibold text-ink">
                    {requirements.location}
                  </span>
                </div>
              )}
              {requirements.summary && (
                <div>
                  <p className="text-eyebrow font-bold uppercase text-ink-subtle mb-2">
                    Resumo
                  </p>
                  <p className="text-callout text-ink leading-relaxed whitespace-pre-wrap">
                    {requirements.summary}
                  </p>
                </div>
              )}
              {REQ_ARRAY_FIELDS.map((field) => {
                const items = requirements[field.key];
                if (!Array.isArray(items) || items.length === 0) return null;
                return (
                  <div key={field.key}>
                    <p className="text-eyebrow font-bold uppercase text-ink-subtle mb-2">
                      {field.label}
                    </p>
                    <ul className="space-y-1.5">
                      {items.map((item, i) => (
                        <li key={i} className="flex gap-2 text-callout text-ink leading-relaxed">
                          <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-300" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-callout text-ink-muted leading-relaxed">
              Ainda não há requisitos gerados pra essa vaga. Clique em Gerar pra montar o gabarito
              interno que orienta as perguntas e a análise.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CandidateDetail({
  app,
  jobTitle,
  highlightQuestion,
  highlightType,
  cohortStageScores,
  refetch,
  patchApplication,
  onDeleted,
}: {
  app: ApplicationWithAnalysis;
  jobTitle: string;
  highlightQuestion: string | null;
  highlightType: HighlightType | null;
  cohortStageScores: number[];
  refetch: () => Promise<void>;
  patchApplication: (id: string, patch: Partial<ApplicationWithAnalysis>) => void;
  onDeleted: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [answers, setAnswers] = useState<AppAnswer[]>([]);
  const [unscoredRefs, setUnscoredRefs] = useState<Set<string>>(new Set());
  const [answersLoading, setAnswersLoading] = useState(true);
  // Linhas abertas na aba Respostas. Tudo começa fechado: quem lê abre só o que
  // interessa.
  const [openAnswers, setOpenAnswers] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [loadingResume, setLoadingResume] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [comms, setComms] = useState<StageComms | null>(null);
  const [copiedForm, setCopiedForm] = useState(false);
  const [copiedStageLink, setCopiedStageLink] = useState(false);
  const [loadingStageLink, setLoadingStageLink] = useState(false);

  // Dispara a comunicação com o candidato (e-mail + link de WhatsApp) depois de
  // uma virada de etapa. Best-effort: nunca quebra a mudança de etapa. Se falhar,
  // loga e mostra um toast leve. O painel de comms usa o retorno.
  async function notifyStageChange(to: ApplicationStatus) {
    try {
      const { data, error } = await invokeEdge<StageComms>('notify-stage-change', {
        applicationId: app.id,
        toStatus: to,
        origin: window.location.origin,
      });
      if (error || !data) throw error ?? new Error('sem retorno');
      setComms(data);
    } catch (err) {
      console.error('[JobDetail] notify-stage-change error:', err);
      toast('Etapa atualizada. A notificação ao candidato não saiu agora.');
    }
  }

  // Pega o link da etapa atual SEM disparar e-mail. Gerar o link de novo por
  // "notificar de novo" mandaria outro e-mail pro candidato, que é justamente o
  // que já não chegou nele.
  async function copyStageLink() {
    setLoadingStageLink(true);
    try {
      const { data, error } = await invokeEdge<StageComms>('notify-stage-change', {
        applicationId: app.id,
        toStatus: app.status,
        origin: window.location.origin,
        linkOnly: true,
      });
      if (error || !data) throw error ?? new Error('sem retorno');
      const url = data.formUrl ?? data.schedulingUrl ?? null;
      if (!url) {
        toast.error('Ainda não há link pra esta etapa.');
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopiedStageLink(true);
      window.setTimeout(() => setCopiedStageLink(false), 2000);
    } catch {
      toast.error('Não deu pra gerar o link agora. Tente de novo.');
    } finally {
      setLoadingStageLink(false);
    }
  }

  async function copyFormLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedForm(true);
      window.setTimeout(() => setCopiedForm(false), 2000);
    } catch {
      toast.error('Não deu pra copiar o link. Copie manualmente.');
    }
  }

  async function deleteApplication() {
    setDeleting(true);
    try {
      const { error } = await invokeEdge('delete-application', { applicationId: app.id });
      if (error) throw error;
      toast.success('Candidato excluído. Pode reenviar a candidatura do zero.');
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não deu pra excluir o candidato.');
      setDeleting(false);
    }
  }

  // Anexar currículo: pede um destino assinado, sobe o arquivo direto pro
  // bucket e só então confirma o vínculo. Se o upload morrer no meio, o banco
  // não fica apontando pra arquivo que não existe.
  async function uploadResume(file: File) {
    if (file.type !== 'application/pdf') {
      toast.error('Só PDF por enquanto. A leitura do currículo não extrai texto de DOCX.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo acima de 10 MB.');
      return;
    }
    setUploadingResume(true);
    try {
      const prep = await invokeEdge<{ path: string; token: string }>('attach-resume', {
        applicationId: app.id,
        action: 'prepare',
      });
      if (prep.error || !prep.data) throw prep.error ?? new Error('Falha ao preparar o upload');

      const { error: upErr } = await supabase.storage
        .from('resumes')
        .uploadToSignedUrl(prep.data.path, prep.data.token, file, {
          contentType: 'application/pdf',
        });
      if (upErr) throw new Error(upErr.message);

      const confirm = await invokeEdge('attach-resume', {
        applicationId: app.id,
        action: 'confirm',
        path: prep.data.path,
      });
      if (confirm.error) throw confirm.error;
      await refetch();
      toast.success('Currículo anexado.', {
        // Não dispara sozinho: re-análise custa e sobrescreve a leitura atual.
        // Quem decide é quem está olhando a tela.
        action: { label: 'Re-analisar agora', onClick: () => void reanalyze() },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não deu pra anexar o currículo.');
    } finally {
      setUploadingResume(false);
    }
  }

  async function openResume() {
    setLoadingResume(true);
    try {
      const { data, error } = await supabase.functions.invoke('resume-url', {
        body: { applicationId: app.id },
      });
      if (error) throw error;
      if (!data?.ok || !data.url) throw new Error(data?.error ?? 'Falha ao gerar link');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Não deu pra abrir o currículo. Tente de novo.');
    } finally {
      setLoadingResume(false);
    }
  }

  const loadEvents = useCallback(async () => {
    const { data } = await supabase
      .from('application_events')
      .select('id, type, from_status, to_status, note, created_at')
      .eq('application_id', app.id)
      .order('created_at', { ascending: true });
    setEvents((data as AppEvent[]) ?? []);
  }, [app.id]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const loadAnswers = useCallback(async () => {
    setAnswersLoading(true);
    const { data, error } = await supabase
      .from('application_answers')
      .select('id, source, ref_id, question_snapshot, answer, created_at')
      .eq('application_id', app.id)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[JobDetail] answers load error:', error);
    }
    const rows = (data as AppAnswer[]) ?? [];
    setAnswers(rows);

    // Quais dessas perguntas são coleta de dado e ficam fora da nota. Vem do
    // banco em vez de regra por formato: "Com qual dessas pessoas você mais se
    // identifica?" também é múltipla escolha e pontua, "Qual regime de contrato
    // você prefere?" também é e não pontua. Só o cadastro sabe a diferença.
    const refIds = [...new Set(rows.map((r) => r.ref_id).filter(Boolean))] as string[];
    if (refIds.length > 0) {
      const [cq, jq] = await Promise.all([
        supabase.from('company_questions').select('id, scored').in('id', refIds),
        supabase.from('job_questions').select('id, scored').in('id', refIds),
      ]);
      const off = new Set<string>();
      for (const q of [...(cq.data ?? []), ...(jq.data ?? [])]) {
        if (q.scored === false) off.add(q.id);
      }
      setUnscoredRefs(off);
    } else {
      setUnscoredRefs(new Set());
    }

    setOpenAnswers(new Set());
    setAnswersLoading(false);
  }, [app.id]);

  const toggleAnswer = useCallback((id: string) => {
    setOpenAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    void loadAnswers();
  }, [loadAnswers]);

  async function applyStageChange(
    to: ApplicationStatus,
    opts?: { note?: string; eventType?: 'stage_change' | 'hired' },
  ): Promise<boolean> {
    const from = app.status;
    if (from === to) return false;
    patchApplication(app.id, { status: to });

    const { error: updError } = await supabase
      .from('applications')
      .update({ status: to })
      .eq('id', app.id);

    if (updError) {
      patchApplication(app.id, { status: from });
      toast.error('Não deu pra atualizar a etapa. Tente de novo.');
      return false;
    }

    // Nota interna vai num evento separado (type 'note'). A policy de leitura do
    // candidato só expõe stage_change sem nota, então a nota nunca vaza pra ele.
    const noteText = opts?.note?.trim() ? opts.note.trim() : null;
    const { error: evError } = await supabase.from('application_events').insert([
      {
        application_id: app.id,
        company_id: app.company_id,
        actor_id: user?.id ?? null,
        type: opts?.eventType ?? 'stage_change',
        from_status: from,
        to_status: to,
        note: null,
      },
      ...(noteText
        ? [
            {
              application_id: app.id,
              company_id: app.company_id,
              actor_id: user?.id ?? null,
              type: 'note' as const,
              from_status: null,
              to_status: null,
              note: noteText,
            },
          ]
        : []),
    ]);
    if (evError) {
      console.error('[JobDetail] event insert error:', evError);
    }
    void loadEvents();
    return true;
  }

  async function advance(to: ApplicationStatus) {
    setBusy(true);
    const ok = await applyStageChange(to);
    if (ok) {
      toast.success(`Movido pra ${stageLabels[to]}`);
      await notifyStageChange(to);
    }
    setBusy(false);
  }

  async function reject() {
    setBusy(true);
    const ok = await applyStageChange('reprovado', { note: rejectNote });
    if (ok) {
      toast('Candidato reprovado');
      setRejecting(false);
      setRejectNote('');
      await notifyStageChange('reprovado');
    }
    setBusy(false);
  }

  async function hire() {
    setBusy(true);
    const ok = await applyStageChange('contratado', { eventType: 'hired' });
    if (!ok) {
      setBusy(false);
      return;
    }
    await notifyStageChange('contratado');

    const { data: collab, error: colError } = await supabase
      .from('collaborators')
      .insert({
        company_id: app.company_id,
        candidate_id: app.candidate_id,
        application_id: app.id,
        full_name: app.candidate_name,
        email: app.candidate_email,
        role_title: jobTitle,
      })
      .select('id')
      .single();

    if (colError) {
      if (colError.code === '23505') {
        toast.info('Essa pessoa já está no time.');
      } else {
        console.error('[JobDetail] collaborator insert error:', colError);
        toast.error('Etapa atualizada, mas não deu pra adicionar a pessoa ao time.');
      }
    } else if (collab) {
      const dims = parseDimensions(app.ai_analysis?.dimensions);
      if (dims.length > 0) {
        const { error: scoreError } = await supabase.from('collaborator_scores').insert(
          dims.map((d) => ({
            collaborator_id: collab.id,
            company_id: app.company_id,
            area: d.area,
            score: d.score,
            source: 'analise_inicial' as const,
          })),
        );
        if (scoreError) {
          console.error('[JobDetail] collaborator_scores insert error:', scoreError);
        }
      }
      toast.success(`${app.candidate_name} agora faz parte do time!`, {
        action: { label: 'Ver time', onClick: () => navigate('/app/time') },
      });
    }
    setBusy(false);
  }

  async function reanalyze() {
    setBusy(true);
    const { error } = await supabase.functions.invoke('analyze-candidate', {
      body: { applicationId: app.id },
    });
    if (error) {
      toast.error('Não deu pra disparar a re-análise. Tente de novo.');
    } else {
      toast.success('Re-análise disparada. O resultado aparece aqui em instantes.');
      await refetch();
    }
    setBusy(false);
  }

  const analysis = app.ai_analysis;
  const aStatus = analysis?.status;
  const pendingAnalysis = analysisIsPending(app);
  const pendingSince = analysis?.ran_at ?? app.created_at;
  const stuckAnalysis =
    pendingAnalysis && Date.now() - new Date(pendingSince).getTime() > STUCK_ANALYSIS_MS;
  const dims = aStatus === 'completed' ? parseDimensions(analysis?.dimensions) : [];
  const stageDims =
    aStatus === 'completed' ? parseStageDimensions(analysis?.stage_dimensions) : [];
  // Evidência por trás da nota. Só existe em análises novas: as antigas voltam
  // vazias e o bloco não aparece.
  const strengths = aStatus === 'completed' ? parseEvidencePoints(analysis?.strengths) : [];
  const concerns = aStatus === 'completed' ? parseEvidencePoints(analysis?.concerns) : [];
  // Leitura do currículo como documento. Fica nulo quando não veio anexo e em
  // análises antigas, e nesse caso o bloco some.
  const cvFeedback = aStatus === 'completed' ? parseCvFeedback(analysis?.cv_feedback) : null;
  // Componentes por trás do potencial e sinal de liderança. Colunas novas: em
  // análises antigas voltam null e os dois blocos somem.
  const potentialBreakdown =
    aStatus === 'completed' ? parsePotentialBreakdown(analysis?.potential_breakdown) : null;
  const leadershipSignal =
    aStatus === 'completed' ? parseLeadershipSignal(analysis?.leadership_signal) : null;
  // Áreas gerais que a etapa atual ainda não consegue avaliar (ex.: cultura só
  // depois do formulário de fit). Mostradas como pendentes, nunca inventadas.
  const pendingAreas = SCOUT_AREAS.filter((a) => !dims.some((d) => d.area === a.key)).map(
    (a) => ({
      area: a.key,
      note: analysis?.evidence_stage === 'cv' ? 'aguardando fit cultural' : 'sem evidência',
    }),
  );

  const next = NEXT_STAGE[app.status];
  const isFinal = app.status === 'contratado' || app.status === 'reprovado';

  // Nota por pergunta, indexada pelo ref_id que casa com application_answers.
  // Análise antiga (ou sem question_scores) devolve mapa vazio e as respostas
  // aparecem sem nota, sem quebrar nada.
  const questionScoreByRef = new Map<string, QuestionScore>();
  for (const qs of parseQuestionScores(analysis?.question_scores)) {
    if (qs.ref_id) questionScoreByRef.set(qs.ref_id, qs);
  }

  // Respostas agrupadas por origem, na ordem de leitura. Grupo vazio some.
  const answerGroups = ANSWER_SOURCE_ORDER.map((source) => {
    const items = answers
      .filter((a) => a.source === source && (a.answer ?? '').trim().length > 0)
      .map((a) => ({
        ...a,
        score: a.ref_id ? questionScoreByRef.get(a.ref_id) : undefined,
      }));
    const scored = items.filter((i) => i.score);
    return {
      source,
      label: ANSWER_SOURCE_LABELS[source],
      items,
      scoredCount: scored.length,
      average:
        scored.length > 0
          ? Math.round(scored.reduce((sum, i) => sum + (i.score?.score ?? 0), 0) / scored.length)
          : null,
    };
  }).filter((group) => group.items.length > 0);
  const answersCount = answerGroups.reduce((total, group) => total + group.items.length, 0);

  // Média de cada categoria lado a lado. É o que mostra se a régua está
  // calibrada igual entre técnica, cultura e raciocínio, ou se uma delas está
  // sistematicamente mais dura que as outras. Análise antiga não tem nota por
  // pergunta: a lista fica vazia e o resumo some inteiro.
  const answerCategoryAverages = answerGroups.flatMap((group) =>
    group.average === null
      ? []
      : [
          {
            source: group.source,
            label: group.label,
            average: group.average,
            scoredCount: group.scoredCount,
          },
        ],
  );
  const hasAnswerContent = answersCount > 0 || Boolean(app.why_interested);

  const timeline: { key: string; label: string; date: string; note: string | null }[] = [
    {
      key: 'received',
      label: 'Candidatura recebida',
      date: app.created_at,
      note: null,
    },
    ...events.map((e) => ({
      key: e.id,
      label: eventLabel(e),
      date: e.created_at,
      note: e.note,
    })),
  ];

  return (
    // Card do candidato: uma superficie so, com secoes separadas por hairline.
    // Antes era um card grande contendo outros quatro cards com borda e fundo
    // proprios (decisao, evidencias, scout da etapa, scout geral) — caixa dentro
    // de caixa, cada uma repetindo padding e borda. A separacao agora e uma
    // linha de 1px, que e o suficiente e nao rouba espaco horizontal.
    <div className="surface-card sticky top-6 overflow-hidden">
      {/* Faixa de identidade: fica sobre o canvas rebaixado pra ancorar o topo
          do card sem precisar de sombra. */}
      <div className="border-b border-line-soft bg-canvas px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="icon-tile h-11 w-11 shrink-0 font-satoshi text-callout font-bold">
              {app.candidate_name.trim().charAt(0).toUpperCase() || '?'}
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-satoshi text-title-2 font-bold text-ink">
                {app.candidate_name}
              </h2>
              <p className="truncate text-footnote text-ink-subtle">{app.candidate_email}</p>
            </div>
          </div>
          <Chip tone={stageTone[app.status]} className="mt-1 shrink-0">
            {stageLabels[app.status]}
          </Chip>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* Anexar currículo pelo lado do recrutador. Quem chega por cadastro
              manual ou fast apply costuma vir sem arquivo, e sem arquivo a
              leitura de currículo fica vazia por falta de dado, não por falta
              de candidato. */}
          <input
            ref={resumeInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void uploadResume(file);
            }}
          />
          <button
            type="button"
            onClick={() => resumeInputRef.current?.click()}
            disabled={uploadingResume}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-footnote font-semibold text-ink transition-colors hover:bg-canvas disabled:opacity-50"
          >
            {uploadingResume ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-3.5 w-3.5" aria-hidden />
            )}
            {app.resume_path ? 'Trocar currículo' : 'Anexar currículo'}
          </button>
          {app.resume_path && (
              <button
                type="button"
                onClick={() => void openResume()}
                disabled={loadingResume}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-footnote font-semibold text-ink transition-colors hover:bg-canvas disabled:opacity-50"
              >
                {loadingResume ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                )}
                Currículo
              </button>
            )}
            {app.linkedin_url && (
              <a
                href={app.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-footnote font-semibold text-ink transition-colors hover:bg-canvas"
              >
                <Linkedin className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} aria-hidden />
                LinkedIn
              </a>
            )}
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        {/* Ações de etapa */}
        {isFinal ? (
          app.status === 'contratado' ? (
            <div className="mb-6 flex items-center gap-2.5 rounded-card bg-positive-tint px-4 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-positive" aria-hidden />
              <p className="flex-1 text-footnote font-medium text-positive">
                Contratado. Agora faz parte do time.
              </p>
              <button
                onClick={() => navigate('/app/time')}
                className="whitespace-nowrap text-footnote font-semibold text-positive underline-offset-2 hover:underline"
              >
                Ver time
              </button>
            </div>
          ) : (
            <div className="mb-6 flex items-center gap-2.5 rounded-card bg-canvas px-4 py-3">
              <XCircle className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
              <p className="text-footnote font-medium text-ink-muted">
                Candidato reprovado nessa vaga.
              </p>
            </div>
          )
        ) : (
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-2">
              {app.status === 'proposta' && (
                <BrandCtaButton size="sm" onClick={() => void hire()} disabled={busy}>
                  Contratar
                </BrandCtaButton>
              )}
              {next && (
                <button
                  onClick={() => void advance(next)}
                  disabled={busy}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-footnote font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Avançar pra {stageLabels[next]}
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                </button>
              )}
              {/* Reprovar e destrutivo mas reversivel, e nao e a acao esperada:
                  fica terciario, sem borda vermelha competindo com o CTA. */}
              <button
                onClick={() => setRejecting((v) => !v)}
                disabled={busy}
                className="inline-flex h-9 items-center rounded-full px-3.5 text-footnote font-semibold text-ink-muted transition-colors hover:text-critical disabled:cursor-not-allowed disabled:opacity-40"
              >
                Reprovar
              </button>
            </div>

            {rejecting && (
              <div className="mt-3 rounded-card bg-critical-tint p-4">
                <p className="mb-2 text-footnote font-semibold text-ink">
                  Quer registrar o motivo? (opcional)
                </p>
                <Textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Ex.: perfil distante do que a vaga pede agora."
                  rows={2}
                  className="mb-3 bg-surface text-footnote"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void reject()}
                    disabled={busy}
                    className="inline-flex h-9 items-center rounded-full bg-critical px-4 text-footnote font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-50"
                  >
                    Confirmar reprovação
                  </button>
                  <button
                    onClick={() => {
                      setRejecting(false);
                      setRejectNote('');
                    }}
                    disabled={busy}
                    className="inline-flex h-9 items-center rounded-full px-4 text-footnote font-semibold text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Link da etapa, disponível SEMPRE, não só logo depois da virada.
            O caso real é o candidato que não achou o e-mail (spam, endereço
            velho, caixa cheia): o recrutador precisa pegar o link e mandar no
            WhatsApp. Antes o link só existia no painel que aparecia por alguns
            instantes após mudar de etapa, então quem voltasse no card depois
            não tinha de onde tirar. */}
        {STAGE_LINK_LABEL[app.status] && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyStageLink()}
              disabled={loadingStageLink}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-footnote font-semibold text-ink transition-colors hover:bg-canvas disabled:opacity-50"
            >
              {loadingStageLink ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : copiedStageLink ? (
                <Check className="h-3.5 w-3.5 text-positive" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
              {copiedStageLink ? 'Link copiado' : STAGE_LINK_LABEL[app.status]}
            </button>
            <span className="text-caption text-ink-subtle">
              Pra mandar na mão se o candidato não achou o e-mail.
            </span>
          </div>
        )}

        {comms && comms.toStatus === app.status && (
          <div className="mb-6 rounded-card bg-canvas p-4">
            <p className="mb-2 text-eyebrow font-bold uppercase text-ink-subtle">
              Aviso ao candidato
            </p>
            <div className="flex items-center gap-2">
              {comms.emailSent ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-positive" aria-hidden />
                  <p className="text-footnote font-medium text-ink">E-mail enviado</p>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
                  <p className="text-footnote font-medium text-ink-muted">
                    E-mail ainda não configurado
                  </p>
                </>
              )}
            </div>
            {(comms.whatsappUrl || comms.formUrl) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {comms.whatsappUrl && (
                  <a
                    href={comms.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-footnote font-semibold text-ink transition-colors hover:bg-canvas"
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                    Enviar no WhatsApp
                  </a>
                )}
                {comms.formUrl && (
                  <button
                    type="button"
                    onClick={() => void copyFormLink(comms.formUrl!)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-footnote font-semibold text-ink transition-colors hover:bg-canvas"
                  >
                    {copiedForm ? (
                      <Check className="h-3.5 w-3.5 text-positive" aria-hidden />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {copiedForm ? 'Link copiado' : 'Copiar link do form'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {highlightQuestion && app.highlight_answer && (
          <div className="mb-6 rounded-card bg-canvas p-4">
            <p className="mb-1.5 text-eyebrow font-bold uppercase text-ink-subtle">
              Pergunta de destaque
            </p>
            <p className="mb-2 text-footnote text-ink-muted">{highlightQuestion}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-callout font-semibold text-ink">
                {formatHighlightAnswer(app.highlight_answer, highlightType)}
              </span>
              {app.highlight_matched === false && <Chip tone="warning">Fora do critério</Chip>}
              {app.highlight_matched === true && (
                <CheckCircle2
                  className="h-4 w-4 text-positive"
                  aria-label="Dentro do critério de destaque"
                />
              )}
            </div>
          </div>
        )}

        <Tabs defaultValue="analise" className="border-t border-line-soft pt-5">
          <TabsList className="mb-5 inline-flex h-auto gap-1 rounded-full bg-surface-sunken p-1">
            <TabsTrigger
              value="analise"
              className="rounded-full px-3.5 py-1.5 text-footnote font-semibold text-ink-muted data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-e1"
            >
              Análise
            </TabsTrigger>
            <TabsTrigger
              value="respostas"
              className="gap-1.5 rounded-full px-3.5 py-1.5 text-footnote font-semibold text-ink-muted data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-e1"
            >
              Respostas
              {answersCount > 0 && (
                <span className="tabular-nums text-ink-subtle">{answersCount}</span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="historico"
              className="rounded-full px-3.5 py-1.5 text-footnote font-semibold text-ink-muted data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-e1"
            >
              Histórico
            </TabsTrigger>
          </TabsList>

          {/*
            Ordem de leitura da analise, do julgamento pra evidencia:
              decisao da etapa (nota + veredito)  ← o que fazer
              pontos fortes / de atencao          ← por que
              leitura da etapa                    ← detalhe por dimensao
              scout geral (radar)                 ← panorama de longo prazo
              perfil comportamental               ← quando a pessoa fez o teste
              curriculo + racional                ← texto corrido, no fim
            Antes o racional e as observacoes do CV disputavam o topo com a
            decisao, e o recrutador lia paragrafo antes de saber o veredito.
          */}
          <TabsContent value="analise" className="mt-0">
            {pendingAnalysis ? (
              <div className="py-6 text-center">
                <p className="inline-flex items-center gap-2 text-callout text-ink-muted">
                  <Clock className="h-4 w-4 animate-pulse" aria-hidden />
                  Análise rodando. O resultado aparece aqui em instantes.
                </p>
                {stuckAnalysis && (
                  <div className="mt-4">
                    <button
                      onClick={() => void reanalyze()}
                      disabled={busy}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-footnote font-semibold text-ink transition-colors hover:bg-canvas disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                      Re-analisar
                    </button>
                  </div>
                )}
              </div>
            ) : aStatus === 'error' ? (
              <div className="rounded-card bg-critical-tint p-4">
                <p className="mb-1 text-footnote font-semibold text-critical">Erro na análise</p>
                <p className="mb-3 text-caption text-ink-muted">{analysis?.error_message}</p>
                <button
                  onClick={() => void reanalyze()}
                  disabled={busy}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-critical px-4 text-footnote font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Re-analisar
                </button>
              </div>
            ) : analysis ? (
              <div>
                <StageDecision
                  analysis={analysis}
                  dims={dims}
                  cohortStageScores={cohortStageScores}
                />
                <EvidencePoints strengths={strengths} concerns={concerns} />
                {stageDims.length > 0 && (
                  <StageScout stageDims={stageDims} evidenceStage={analysis.evidence_stage} />
                )}

                {dims.length > 0 && (
                  <div className="mb-6 border-t border-line-soft pt-6">
                    <p className="mb-4 text-eyebrow font-bold uppercase text-ink-subtle">
                      Scout geral
                    </p>
                    <ScoutCard
                      flat
                      name={app.candidate_name}
                      subtitle={jobTitle}
                      // Calculado das áreas aqui na tela, não lido do banco: as
                      // análises antigas guardam um número que o modelo
                      // escolheu solto e que não bate com as próprias barras.
                      // Assim o velho fica coerente sem precisar re-analisar.
                      overall={overallFromDimensions(dims) ?? analysis.score ?? 0}
                      dimensions={dims}
                      badge={null}
                      pending={pendingAreas.length > 0 ? pendingAreas : undefined}
                    />
                  </div>
                )}

                {potentialBreakdown && (
                  <PotentialBreakdownBlock components={potentialBreakdown} />
                )}

                {leadershipSignal && <LeadershipSignalBlock signal={leadershipSignal} />}

                {/* Perfil comportamental (DISC / Big Five / Garra). So aparece
                    se a pessoa fez o teste — o componente renderiza vazio
                    quando nao ha resultado, e o :empty tira o espaco. */}
                <div className="mb-6 empty:mb-0 empty:hidden">
                  <ProfileAssessmentCard email={app.candidate_email} />
                </div>

                {/* Sem currículo o bloco sumia da tela, e quem comparava dois
                    candidatos achava que a análise tinha falhado num deles.
                    Ausência de dado é informação: aparece dita. */}
                {(analysis.cv_observations || !app.resume_path) && (
                  <div className="mb-6 border-t border-line-soft pt-6">
                    <p className="mb-2 flex items-center gap-2 text-eyebrow font-bold uppercase text-ink-subtle">
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      O que o currículo mostra
                    </p>
                    <p className="whitespace-pre-wrap text-footnote text-ink-muted">
                      {analysis.cv_observations ||
                        'Este candidato não anexou currículo, então não há leitura de currículo aqui. As notas vieram só das respostas do formulário.'}
                    </p>
                  </div>
                )}

                {cvFeedback && <CvFeedbackBlock feedback={cvFeedback} />}

                {analysis.reasoning && (
                  <div className="border-t border-line-soft pt-6">
                    <p className="mb-2 text-eyebrow font-bold uppercase text-ink-subtle">
                      Racional completo
                    </p>
                    <p className="whitespace-pre-wrap text-footnote text-ink-muted">
                      {analysis.reasoning}
                    </p>
                  </div>
                )}

                {aStatus === 'completed' && (
                  <div className="mt-6 border-t border-line-soft pt-5">
                    <button
                      onClick={() => void reanalyze()}
                      disabled={busy}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-footnote font-semibold text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                      title="Roda a análise de novo usando os requisitos atuais da vaga"
                    >
                      <RefreshCw
                        className={cn('h-3.5 w-3.5', busy && 'animate-spin')}
                        aria-hidden
                      />
                      Re-analisar
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </TabsContent>

          {/* O que o candidato respondeu no formulário, na ordem de leitura */}
          <TabsContent value="respostas" className="mt-0">
            {answersLoading ? (
              <p className="text-footnote text-ink-subtle">Carregando respostas...</p>
            ) : !hasAnswerContent ? (
              <p className="text-callout text-ink-muted">
                Esse candidato ainda não preencheu o formulário.
              </p>
            ) : (
              <div className="space-y-6">
                {/* Régua por categoria. Faixa leve sobre o canvas, sem borda e
                    sem sombra: é referência de leitura, não mais um card. */}
                {answerCategoryAverages.length > 0 && (
                  <section className="rounded-card bg-canvas px-4 py-3">
                    <p className="mb-2 text-eyebrow font-bold uppercase text-ink-subtle">
                      Média por categoria
                    </p>
                    <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                      {answerCategoryAverages.map((cat) => (
                        <div
                          key={cat.source}
                          className="flex items-baseline justify-between gap-2"
                        >
                          <span className="truncate text-footnote text-ink-muted">{cat.label}</span>
                          <span className="flex shrink-0 items-baseline gap-1.5">
                            <span
                              className={cn(
                                'text-footnote font-bold tabular-nums',
                                TONE_TEXT[toneForScore(cat.average)],
                              )}
                            >
                              {cat.average}
                            </span>
                            <span className="text-caption text-ink-subtle">
                              ({cat.scoredCount} {cat.scoredCount === 1 ? 'pergunta' : 'perguntas'})
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {app.why_interested && (
                  <section>
                    <p className="mb-2 text-eyebrow font-bold uppercase text-ink-subtle">
                      Por que está interessado
                    </p>
                    <p className="whitespace-pre-wrap text-callout text-ink">
                      {app.why_interested}
                    </p>
                  </section>
                )}

                {answerGroups.map((group) => (
                  <section key={group.source}>
                    <div className="mb-2 flex items-baseline gap-2">
                      <p className="text-eyebrow font-bold uppercase text-ink-subtle">
                        {group.label}
                      </p>
                      {group.average !== null && (
                        <span className="text-caption text-ink-subtle">
                          <span aria-hidden>· </span>média{' '}
                          <span
                            className={cn(
                              'font-bold tabular-nums',
                              TONE_TEXT[toneForScore(group.average)],
                            )}
                          >
                            {group.average}
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="divide-y divide-line-soft rounded-card border border-line-soft">
                      {group.items.map((item) => (
                        <AnswerRow
                          key={item.id}
                          question={item.question_snapshot}
                          category={group.label}
                          answer={item.answer}
                          score={item.score}
                          unscored={item.ref_id ? unscoredRefs.has(item.ref_id) : false}
                          open={openAnswers.has(item.id)}
                          onToggle={() => toggleAnswer(item.id)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Linha do tempo */}
          <TabsContent value="historico" className="mt-0">
            <ol>
              {timeline.map((entry, i) => {
                const last = i === timeline.length - 1;
                return (
                  <li key={entry.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                          last ? 'bg-brand' : 'bg-line',
                        )}
                        aria-hidden
                      />
                      {!last && <span className="mt-1 w-px flex-1 bg-line-soft" aria-hidden />}
                    </div>
                    <div className={cn('min-w-0', last ? 'pb-0' : 'pb-5')}>
                      <p className="text-footnote font-semibold text-ink">{entry.label}</p>
                      <p className="mt-0.5 text-caption text-ink-subtle">
                        {formatEventDate(entry.date)}
                      </p>
                      {entry.note && (
                        <p className="mt-1.5 whitespace-pre-wrap text-footnote text-ink-muted">
                          {entry.note}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </TabsContent>
        </Tabs>

        {/* Zona de exclusão: reprocessar do zero nos testes */}
        <div className="mt-6 border-t border-line-soft pt-5">
          {confirmDelete ? (
            <div className="rounded-card bg-critical-tint p-4">
              <p className="mb-1 text-footnote font-semibold text-ink">
                Excluir esse candidato de vez?
              </p>
              <p className="mb-3 text-caption text-ink-muted">
                Apaga a candidatura, as respostas, a análise e o currículo. Não dá pra desfazer.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void deleteApplication()}
                  disabled={deleting}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-critical px-4 text-footnote font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {deleting ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Excluir de vez
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="inline-flex h-9 items-center rounded-full px-4 text-footnote font-semibold text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 text-caption font-medium text-ink-subtle transition-colors hover:text-critical"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Excluir candidato
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatHighlightAnswer(answer: string, type: HighlightType | null): string {
  if (type === 'yes_no') {
    if (answer === 'sim') return 'Sim';
    if (answer === 'nao') return 'Não';
  }
  return answer;
}

function eventLabel(e: AppEvent): string {
  if (e.type === 'hired') return 'Contratado';
  if (e.type === 'note') return 'Nota';
  const to = e.to_status as ApplicationStatus | null;
  if (to === 'reprovado') return 'Reprovado';
  if (to && stageLabels[to]) return `Movido pra ${stageLabels[to]}`;
  return 'Mudança de etapa';
}

export default JobDetail;
