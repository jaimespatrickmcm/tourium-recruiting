import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { BrandCtaButton, BrandCtaLink } from '@/components/brand-cta';
import { invokeEdge } from '@/lib/functions';
import {
  METHOD_INFO,
  DISC_QUESTIONS,
  BIGFIVE_ITEMS,
  GRIT_ITEMS,
  LIKERT_LABELS,
  DISC_PROFILE_CONTENT,
  BIGFIVE_DIMENSION_INFO,
  type AssessmentMethod,
  type DiscResult,
  type BigFiveResult,
  type GritResult,
  type BigFiveDimension,
  type DiscProfileKey,
} from '@/lib/profile-assessment';

type NavState = { email?: string } | null;

type Phase = 'intro' | 'test' | 'method-done' | 'done';

type MethodResult =
  | { method: 'disc'; result: DiscResult }
  | { method: 'bigfive'; result: BigFiveResult }
  | { method: 'grit'; result: GritResult };

const ALL_METHODS: AssessmentMethod[] = ['disc', 'bigfive', 'grit'];

function questionCount(method: AssessmentMethod): number {
  if (method === 'disc') return DISC_QUESTIONS.length;
  if (method === 'bigfive') return BIGFIVE_ITEMS.length;
  return GRIT_ITEMS.length;
}

export function ProfileAssessment() {
  const location = useLocation();
  const navState = (location.state as NavState) ?? null;

  const [phase, setPhase] = useState<Phase>('intro');
  const [email, setEmail] = useState(navState?.email ?? '');
  const [consent, setConsent] = useState(false);
  const [plan, setPlan] = useState<AssessmentMethod[]>([]);
  const [planIndex, setPlanIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<MethodResult[]>([]);

  // Respostas: DISC guarda, por questão, o rank (4..1) de cada opção na ordem
  // A-D (0 = ainda sem rank). Likert guarda 1-5 por item.
  const [discAnswers, setDiscAnswers] = useState<number[][]>(() =>
    DISC_QUESTIONS.map(() => [0, 0, 0, 0]),
  );
  const [likertAnswers, setLikertAnswers] = useState<Record<'bigfive' | 'grit', number[]>>({
    bigfive: Array(BIGFIVE_ITEMS.length).fill(0),
    grit: Array(GRIT_ITEMS.length).fill(0),
  });

  const method = plan[planIndex];
  const total = method ? questionCount(method) : 0;
  const emailValid = /\S+@\S+\.\S+/.test(email);

  const answered = useMemo(() => {
    if (!method) return 0;
    if (method === 'disc') return discAnswers.filter((q) => q.every((r) => r > 0)).length;
    return likertAnswers[method].filter((v) => v > 0).length;
  }, [method, discAnswers, likertAnswers]);

  function startPlan(methods: AssessmentMethod[]) {
    if (!emailValid) {
      toast.error('Preenche seu email primeiro: é pra onde vai o resultado.');
      return;
    }
    if (!consent) {
      toast.error('Falta concordar com o uso do resultado no seu perfil.');
      return;
    }
    setPlan(methods);
    setPlanIndex(0);
    setQuestionIndex(0);
    setPhase('test');
  }

  function rankOption(optionIndex: number) {
    const current = discAnswers[questionIndex];
    if (current[optionIndex] > 0) return;
    const used = current.filter((r) => r > 0).length;
    const nextRank = 4 - used; // 1º toque = 4 (mais se identifica) ... último = 1
    const updated = discAnswers.map((q, i) =>
      i === questionIndex ? q.map((r, oi) => (oi === optionIndex ? nextRank : r)) : q,
    );
    setDiscAnswers(updated);
    if (updated[questionIndex].every((r) => r > 0)) {
      window.setTimeout(() => advance(), 350);
    }
  }

  function resetQuestion() {
    setDiscAnswers((prev) => prev.map((q, i) => (i === questionIndex ? [0, 0, 0, 0] : q)));
  }

  function answerLikert(value: number) {
    if (method !== 'bigfive' && method !== 'grit') return;
    setLikertAnswers((prev) => ({
      ...prev,
      [method]: prev[method].map((v, i) => (i === questionIndex ? value : v)),
    }));
    window.setTimeout(() => advance(), 200);
  }

  function advance() {
    if (questionIndex + 1 < total) {
      setQuestionIndex((i) => i + 1);
      return;
    }
    void submitMethod();
  }

  function goBack() {
    if (questionIndex > 0) {
      setQuestionIndex((i) => i - 1);
      return;
    }
    setPhase('intro');
  }

  async function submitMethod() {
    if (!method || submitting) return;
    setSubmitting(true);
    try {
      const answers = method === 'disc' ? discAnswers : likertAnswers[method];
      const { data, error } = await invokeEdge<{ ok?: boolean; result?: unknown; error?: string }>(
        'submit-profile-assessment',
        { email: email.trim().toLowerCase(), method, answers, consent: true },
      );
      if (error) throw error;
      if (!data?.ok || !data.result) throw new Error(data?.error ?? 'Não deu pra salvar o teste');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setResults((prev) => [...prev, { method, result: data.result as any } as MethodResult]);
      setPhase('method-done');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não deu pra enviar. Tenta de novo.');
    } finally {
      setSubmitting(false);
    }
  }

  function continuePlan() {
    if (planIndex + 1 < plan.length) {
      setPlanIndex((i) => i + 1);
      setQuestionIndex(0);
      setPhase('test');
      return;
    }
    setPhase('done');
  }

  const lastResult = results[results.length - 1];

  // ---------- Intro ----------
  if (phase === 'intro') {
    return (
      <main className="relative min-h-screen bg-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.10),transparent_60%)]" />
        <div className="relative max-w-2xl mx-auto px-6 py-14 md:py-20">
          <p className="text-caption font-bold uppercase tracking-wider text-sky-600 mb-4">Noren</p>
          <h1 className="font-satoshi font-bold text-[32px] md:text-[42px] tracking-[-0.7px] leading-[1.1] text-ink mb-4">
            Sua análise de perfil comportamental
          </h1>
          <p className="text-body text-ink-muted leading-relaxed mb-8 max-w-lg">
            Três métodos usados no mundo todo (DISC, Big Five e Garra), só com perguntas de marcar.
            O resultado chega no seu email e fica vinculado ao seu perfil de candidato. Dá pra fazer
            um método de cada vez ou o completo de uma vez.
          </p>

          <div className="max-w-md mb-6">
            <label className="block text-caption font-semibold text-ink mb-1.5">
              Seu email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              className="h-12 rounded-tile border-line-soft text-body"
            />
            <p className="text-caption text-ink-subtle mt-1.5">
              Use o mesmo email da sua candidatura: é ele que liga o resultado ao seu perfil.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setConsent((v) => !v)}
            aria-pressed={consent}
            className="mb-8 flex items-start gap-3 text-left max-w-lg"
          >
            <span
              className={
                'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors ' +
                (consent ? 'border-sky-500 bg-sky-500' : 'border-line bg-white')
              }
            >
              {consent && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
            </span>
            <span className="text-footnote text-ink-muted leading-relaxed">
              Concordo que meu resultado fique vinculado ao meu perfil na Noren e visível pras
              empresas em que eu me candidatar.
            </span>
          </button>

          <div className="space-y-3 mb-8">
            {ALL_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => startPlan([m])}
                className="group w-full text-left rounded-card border border-line-soft bg-white p-4 flex items-start gap-4 hover:border-sky-300 hover:bg-sky-50/30 transition-colors"
              >
                <span className="flex-1 min-w-0">
                  <span className="block font-satoshi font-bold text-body tracking-[-0.2px] text-ink">
                    {METHOD_INFO[m].label}
                    <span className="ml-2 text-caption font-semibold text-ink-subtle">
                      {METHOD_INFO[m].minutes}
                    </span>
                  </span>
                  <span className="block text-footnote text-ink-muted leading-relaxed mt-0.5">
                    {METHOD_INFO[m].shortDescription}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="flex justify-start">
            <BrandCtaButton size="lg" onClick={() => startPlan(ALL_METHODS)}>
              <Sparkles className="h-4 w-4 mr-1" />
              Fazer a análise completa (uns 15 minutos)
            </BrandCtaButton>
          </div>
        </div>
      </main>
    );
  }

  // ---------- Done ----------
  if (phase === 'done') {
    return (
      <main className="relative min-h-screen bg-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.10),transparent_60%)]" />
        <div className="relative max-w-2xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex h-16 w-16 rounded-card holo-gradient items-center justify-center mb-6">
            <CheckCircle2 className="h-8 w-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="font-satoshi font-bold text-[36px] tracking-[-0.6px] text-ink mb-3">
            Análise concluída
          </h1>
          <p className="text-body text-ink-muted max-w-md mx-auto mb-8">
            O resultado completo foi pro seu email e já está vinculado ao seu perfil. Quando quiser,
            volte aqui pra fazer os métodos que faltam.
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

  // ---------- Resultado do método ----------
  if (phase === 'method-done' && lastResult) {
    const hasNext = planIndex + 1 < plan.length;
    return (
      <main className="relative min-h-screen bg-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.08),transparent_60%)]" />
        <div className="relative max-w-2xl mx-auto px-6 py-14">
          <p className="text-caption font-bold uppercase tracking-wider text-sky-600 mb-3">
            Resultado: {METHOD_INFO[lastResult.method].label}
          </p>
          <MethodResultView data={lastResult} />
          <p className="text-footnote text-ink-subtle mt-6">
            Esse resultado também foi pro seu email e ficou salvo no seu perfil.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {hasNext ? (
              <>
                <BrandCtaButton size="default" onClick={continuePlan}>
                  Continuar: {METHOD_INFO[plan[planIndex + 1]].label}
                </BrandCtaButton>
                <button
                  type="button"
                  onClick={() => setPhase('done')}
                  className="text-footnote font-semibold text-ink-muted hover:text-ink transition-colors"
                >
                  Parar por aqui
                </button>
              </>
            ) : (
              <BrandCtaButton size="default" onClick={continuePlan}>
                Concluir
              </BrandCtaButton>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ---------- Teste ----------
  const progress = total > 0 ? (answered / total) * 100 : 0;
  const discCurrent = method === 'disc' ? discAnswers[questionIndex] : null;

  return (
    <main className="relative min-h-screen bg-white flex flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.07),transparent_60%)]" />

      <div className="relative px-6 pt-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Link to="/" className="font-satoshi font-bold text-body tracking-[-0.3px] text-ink">
              Noren
            </Link>
            <span className="text-caption font-medium text-ink-muted">
              {METHOD_INFO[method].label}
              {plan.length > 1 && (
                <span className="text-[#a8a8ad]"> · parte {planIndex + 1} de {plan.length}</span>
              )}
            </span>
          </div>
          <div className="h-1 bg-surface-sunken rounded-full overflow-hidden" role="progressbar">
            <div
              className="h-full holo-gradient rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="relative flex-1 flex items-start md:items-center justify-center px-6 py-10 md:py-14">
        <div className="w-full max-w-2xl" key={`${method}-${questionIndex}`}>
          {method === 'disc' && discCurrent ? (
            <div>
              <h2 className="font-satoshi font-semibold text-[19px] md:text-[23px] tracking-[-0.2px] leading-[1.35] text-ink mb-2.5">
                {DISC_QUESTIONS[questionIndex].question}
              </h2>
              <p className="text-callout text-ink-subtle leading-relaxed mb-6">
                Toque nas opções na ordem: primeiro a que MAIS combina com você, por último a que
                MENOS combina.
              </p>
              <div className="space-y-2 max-w-xl">
                {DISC_QUESTIONS[questionIndex].options.map((opt, oi) => {
                  const rank = discCurrent[oi];
                  const selected = rank > 0;
                  return (
                    <button
                      key={oi}
                      type="button"
                      onClick={() => rankOption(oi)}
                      className={`w-full flex items-center gap-3 rounded-tile border px-4 py-3 text-left text-callout leading-relaxed transition-colors ${
                        selected
                          ? 'border-sky-400 bg-sky-50 text-ink'
                          : 'border-line-soft bg-white text-ink hover:border-sky-200 hover:bg-sky-50/40'
                      }`}
                    >
                      <span
                        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-caption font-bold ${
                          selected
                            ? 'border-sky-400 bg-sky-600 text-white'
                            : 'border-line bg-canvas text-[#a8a8ad]'
                        }`}
                      >
                        {selected ? 5 - rank : '·'}
                      </span>
                      <span className="flex-1">{opt.text}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={resetQuestion}
                className="mt-3 text-caption font-semibold text-ink-subtle hover:text-ink transition-colors"
              >
                Refazer essa questão
              </button>
            </div>
          ) : (
            <div>
              <h2 className="font-satoshi font-semibold text-[19px] md:text-[23px] tracking-[-0.2px] leading-[1.35] text-ink mb-2.5">
                {method === 'bigfive'
                  ? `Vejo-me como alguém que... ${BIGFIVE_ITEMS[questionIndex].text.charAt(0).toLowerCase()}${BIGFIVE_ITEMS[questionIndex].text.slice(1)}`
                  : GRIT_ITEMS[questionIndex].text}
              </h2>
              <p className="text-callout text-ink-subtle leading-relaxed mb-6">
                O quanto isso te descreve?
              </p>
              <div className="space-y-2 max-w-md">
                {LIKERT_LABELS.map((label, li) => {
                  const value = li + 1;
                  const current =
                    method === 'bigfive' || method === 'grit'
                      ? likertAnswers[method][questionIndex]
                      : 0;
                  const selected = current === value;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => answerLikert(value)}
                      className={`w-full flex items-center gap-3 rounded-tile border px-4 py-3 text-left text-callout transition-colors ${
                        selected
                          ? 'border-sky-400 bg-sky-50 text-ink'
                          : 'border-line-soft bg-white text-ink hover:border-sky-200 hover:bg-sky-50/40'
                      }`}
                    >
                      <span
                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-caption font-bold ${
                          selected
                            ? 'border-sky-400 bg-sky-600 text-white'
                            : 'border-line bg-canvas text-ink-muted'
                        }`}
                      >
                        {value}
                      </span>
                      <span className="flex-1">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative border-t border-line-soft bg-white/70 backdrop-blur">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 text-footnote font-medium text-ink-muted hover:text-ink transition-colors disabled:opacity-30 px-2 py-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <span className="text-caption text-[#a8a8ad]">
            {submitting ? 'Enviando...' : 'Responda pra avançar'}
          </span>
        </div>
      </div>
    </main>
  );
}

function MethodResultView({ data }: { data: MethodResult }) {
  if (data.method === 'disc') {
    const primary = DISC_PROFILE_CONTENT[data.result.primary];
    const pairNames = data.result.pair
      .map((p: DiscProfileKey) => DISC_PROFILE_CONTENT[p].name)
      .join(' e ');
    return (
      <div>
        <h1 className="font-satoshi font-bold text-[30px] md:text-[38px] tracking-[-0.6px] text-ink mb-2">
          Perfil {primary.name}
        </h1>
        <p className="text-callout text-ink-muted mb-1">{primary.headline}</p>
        <p className="text-callout text-ink-subtle mb-6">Sua dupla principal: {pairNames}.</p>
        <div className="flex flex-wrap gap-1.5 mb-6">
          {primary.description.map((d) => (
            <span
              key={d}
              className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-caption text-sky-800"
            >
              {d}
            </span>
          ))}
        </div>
        <div className="space-y-2 max-w-md">
          {(Object.keys(data.result.percents) as DiscProfileKey[])
            .sort((a, b) => data.result.points[b] - data.result.points[a])
            .map((p) => (
              <div key={p} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-footnote font-semibold text-ink">
                  {DISC_PROFILE_CONTENT[p].name}
                </span>
                <div className="flex-1 h-2 bg-surface-sunken rounded-full overflow-hidden">
                  <div
                    className="h-full holo-gradient rounded-full"
                    style={{ width: `${data.result.percents[p]}%` }}
                  />
                </div>
                <span className="w-12 text-right text-caption text-ink-muted">
                  {data.result.percents[p].toFixed(0)}%
                </span>
              </div>
            ))}
        </div>
      </div>
    );
  }

  if (data.method === 'bigfive') {
    return (
      <div>
        <h1 className="font-satoshi font-bold text-[30px] md:text-[38px] tracking-[-0.6px] text-ink mb-6">
          Seus cinco traços
        </h1>
        <div className="space-y-4 max-w-md">
          {(Object.keys(data.result.means) as BigFiveDimension[]).map((dim) => (
            <div key={dim}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-footnote font-semibold text-ink">
                  {BIGFIVE_DIMENSION_INFO[dim].label}
                </span>
                <span className="text-caption text-ink-muted">
                  {data.result.means[dim].toFixed(2)} de 5
                </span>
              </div>
              <div className="h-2 bg-surface-sunken rounded-full overflow-hidden">
                <div
                  className="h-full holo-gradient rounded-full"
                  style={{ width: `${(data.result.means[dim] / 5) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-satoshi font-bold text-[30px] md:text-[38px] tracking-[-0.6px] text-ink mb-3">
        {data.result.garraPct}% de garra
      </h1>
      <p className="text-callout text-ink-muted max-w-md leading-relaxed">
        Esse número reflete o quanto você combina paixão e perseverança em objetivos de longo prazo,
        no seu momento atual. Garra se desenvolve: dá pra refazer o teste daqui um tempo.
      </p>
    </div>
  );
}

export default ProfileAssessment;
