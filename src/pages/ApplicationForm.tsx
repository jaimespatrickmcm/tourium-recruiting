import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, useLocation, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BrandCtaButton, BrandCtaLink } from '@/components/brand-cta';
import { supabase } from '@/lib/supabase';
import { makeCanaryToken, canaryInjection } from '@/lib/canary';

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
  source: 'job_question' | 'culture' | 'reasoning';
  refId: string | null;
  sectionLabel: string;
  question: string;
  helper: string;
};

type Step = CandidateStep | QuestionStep;

type NavState = { name?: string; email?: string; phone?: string } | null;

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
  const navState = (location.state as NavState) ?? null;

  const [job, setJob] = useState<PublicJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobQuestions, setJobQuestions] = useState<QuestionStep[]>([]);
  const [companyQuestions, setCompanyQuestions] = useState<QuestionStep[]>([]);

  const [phase, setPhase] = useState<'cover' | 'form' | 'done'>('cover');
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Respostas
  const [name, setName] = useState(navState?.name ?? '');
  const [email, setEmail] = useState(navState?.email ?? '');
  const [phone, setPhone] = useState(navState?.phone ?? '');
  const [city, setCity] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});

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

        const { data: jq } = await supabase
          .from('job_questions_public')
          .select('id, question, position')
          .eq('job_id', jobData.id)
          .order('position', { ascending: true });
        setJobQuestions(
          (jq ?? []).map((q) => ({
            type: 'question' as const,
            source: 'job_question' as const,
            refId: q.id,
            sectionLabel: 'Sobre a vaga',
            question: q.question,
            helper: 'Seja concreto. Exemplos do que você já fez valem mais que frases genéricas.',
          })),
        );

        const { data: cq } = await supabase
          .from('company_questions_public')
          .select('id, kind, question, position')
          .eq('company_id', company.id)
          .order('kind', { ascending: true })
          .order('position', { ascending: true });
        const culture = (cq ?? [])
          .filter((q) => q.kind === 'culture')
          .map((q) => ({
            type: 'question' as const,
            source: 'culture' as const,
            refId: q.id,
            sectionLabel: 'Cultura e raciocínio',
            question: q.question,
            helper: 'Não tem resposta certa. A gente quer entender como você pensa.',
          }));
        const reasoning = (cq ?? [])
          .filter((q) => q.kind === 'reasoning')
          .map((q) => ({
            type: 'question' as const,
            source: 'reasoning' as const,
            refId: q.id,
            sectionLabel: 'Cultura e raciocínio',
            question: q.question,
            helper: 'Mostre o caminho até a resposta, não só a conclusão.',
          }));
        setCompanyQuestions([...culture, ...reasoning]);
      }
      setLoading(false);
    }
    void load();
  }, [companySlug, jobSlug]);

  const steps = useMemo<Step[]>(
    () => [...CANDIDATE_STEPS, ...jobQuestions, ...companyQuestions],
    [jobQuestions, companyQuestions],
  );

  // Um canary token por pergunta aberta, gerado uma vez quando as perguntas carregam.
  const canaryByRef = useMemo(() => {
    const map: Record<string, string> = {};
    for (const q of [...jobQuestions, ...companyQuestions]) {
      if (q.refId) map[q.refId] = makeCanaryToken();
    }
    return map;
  }, [jobQuestions, companyQuestions]);

  const current = steps[stepIndex];

  // Auto-focus a cada passo.
  useEffect(() => {
    if (phase !== 'form') return;
    const t = setTimeout(() => {
      if (current?.type === 'question') textareaRef.current?.focus();
      else inputRef.current?.focus();
    }, 80);
    return () => clearTimeout(t);
  }, [phase, stepIndex, current?.type]);

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

  const canAdvance = (() => {
    if (!current) return false;
    if (current.type === 'candidate') {
      if (current.field === 'name') return name.trim().length >= 2;
      if (current.field === 'email') return /\S+@\S+\.\S+/.test(email);
      if (current.field === 'phone') return phone.trim().length >= 8;
      return true; // city é livre
    }
    return true; // respostas abertas podem seguir mesmo em branco
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
        .map((q) => ({
          source: q.source,
          refId: q.refId,
          question: q.question,
          answer: (answers[q.refId ?? ''] ?? '').trim(),
          canaryToken: q.refId ? canaryByRef[q.refId] : undefined,
        }))
        .filter((a) => a.answer.length > 0);

      const { data, error } = await supabase.functions.invoke('submit-application-form', {
        body: {
          applicationId: applicationId ?? undefined,
          companySlug,
          jobSlug,
          candidateInfo: {
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            city: city.trim(),
          },
          answers: questionAnswers,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? 'Falha ao enviar');
      setPhase('done');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar formulário');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#8a8a8f] text-sm">
        Carregando...
      </div>
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
            A IA agora tem bem mais contexto pra avaliar seu fit pra{' '}
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
              Noren
            </Link>
            <span className="text-[12px] text-[#8a8a8f]">Candidatura completa</span>
          </div>
        </header>

        <div className="relative flex-1 flex items-center justify-center px-6 py-16">
          <div className="max-w-xl text-center">
            <p className="text-[12px] font-bold uppercase tracking-wider text-sky-600 mb-4">
              {job.companyName}
            </p>
            <h1 className="font-satoshi font-bold text-[34px] md:text-[48px] tracking-[-0.8px] leading-[1.08] text-[#1d1d1f] mb-5">
              Vamos adiantar seu processo pra {job.title}
            </h1>
            <p className="text-[16px] md:text-[17px] text-[#6b6b70] leading-relaxed mb-8 max-w-md mx-auto">
              Umas perguntas rápidas, uma por vez. Suas respostas dão à IA o contexto pra avaliar seu
              fit de verdade. Leva poucos minutos.
            </p>
            <div className="flex justify-center">
              <BrandCtaButton size="lg" onClick={() => setPhase('form')}>
                Começar
              </BrandCtaButton>
            </div>
          </div>
        </div>
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
              Noren
            </Link>
            <span className="text-[12px] font-medium text-[#6b6b70]">
              <span className="text-[#1d1d1f] font-bold">{stepIndex + 1}</span> de {steps.length}
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
              <p className="text-[12px] font-bold uppercase tracking-wider text-sky-600 mb-3">
                {current.sectionLabel}
              </p>
              <h2 className="font-satoshi font-bold text-[26px] md:text-[34px] tracking-[-0.5px] leading-tight text-[#1d1d1f] mb-2">
                {current.question}
                {current.type === 'question' && current.refId && canaryByRef[current.refId] && (
                  // Injeção invisível ao humano, mas copiada junto com o enunciado.
                  <span
                    aria-hidden="true"
                    style={{
                      fontSize: '1px',
                      lineHeight: 0,
                      color: 'transparent',
                      userSelect: 'text',
                    }}
                  >
                    {canaryInjection(canaryByRef[current.refId])}
                  </span>
                )}
              </h2>
              <p className="text-[15px] text-[#6b6b70] leading-relaxed mb-6">{current.helper}</p>

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

              {current.type === 'question' && (
                <p className="text-[12px] text-[#8a8a8f] mt-2">
                  Dá pra pular. Mas responder ajuda bastante na sua avaliação.
                </p>
              )}
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
      </div>
    </main>
  );
}

export default ApplicationForm;
