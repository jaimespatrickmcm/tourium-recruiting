import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  Linkedin,
  FileText,
  Upload,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { BrandCtaButton } from '@/components/brand-cta';
import { supabase } from '@/lib/supabase';
import { invokeEdge } from '@/lib/functions';
import { useAuth } from '@/hooks/use-auth';
import { useCandidate } from '@/hooks/use-candidate';
import { parseDescriptionSections, DescriptionBody } from '@/lib/job-description';
import type { HighlightType } from '@/types/database';

type PublicJob = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  highlight_question: string | null;
  highlight_type: HighlightType | null;
  company: { slug: string; name: string; description: string | null } | null;
};

export function PublicCareer() {
  const { companySlug, jobSlug } = useParams<{ companySlug: string; jobSlug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { candidate } = useCandidate();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  // Wizard state
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [highlightAnswer, setHighlightAnswer] = useState('');
  const [resumePath, setResumePath] = useState<string | null>(null);
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  // Honeypot anti-bot: humano nunca vê nem preenche esse campo.
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoggedCandidate = Boolean(user && candidate);
  const hasHighlight = Boolean(job?.highlight_question);
  // Passos: identidade (só deslogado), telefone, currículo+linkedin e, se a vaga
  // tiver, a pergunta de destaque como último passo.
  const phoneStepIndex = isLoggedCandidate ? 1 : 2;
  const resumeStepIndex = isLoggedCandidate ? 2 : 3;
  const highlightStepIndex = resumeStepIndex + 1;
  const TOTAL_STEPS = resumeStepIndex + (hasHighlight ? 1 : 0);

  // Pre-fill from candidate
  useEffect(() => {
    if (candidate) {
      setName(candidate.full_name ?? '');
      setEmail(candidate.email);
    }
  }, [candidate]);

  // Focus on step change
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    async function load() {
      if (!companySlug || !jobSlug) return;
      // View pública (bypassa RLS de companies e expõe só os campos públicos)
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
        .select('id, slug, title, description, status, highlight_question, highlight_type')
        .eq('company_id', company.id)
        .eq('slug', jobSlug)
        .maybeSingle();
      if (jobData) {
        setJob({
          ...jobData,
          company: { slug: company.slug, name: company.name, description: company.description },
        });
      }
      setLoading(false);
    }
    void load();
  }, [companySlug, jobSlug]);

  async function handleResumeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset pra permitir re-selecionar o mesmo arquivo depois.
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Por enquanto só aceitamos PDF. Converta e tente de novo.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('O arquivo passa de 10MB. Envie um PDF mais leve.');
      return;
    }
    if (!companySlug || !jobSlug) return;
    setUploadingResume(true);
    try {
      const { data, error } = await invokeEdge<{ path: string; token: string }>(
        'create-resume-upload',
        { companySlug, jobSlug },
      );
      if (error) throw error;
      if (!data?.path || !data.token) {
        throw new Error('Não deu pra preparar o upload');
      }
      const { error: upErr } = await supabase.storage
        .from('resumes')
        .uploadToSignedUrl(data.path, data.token, file);
      if (upErr) throw upErr;
      setResumePath(data.path);
      setResumeFileName(file.name);
      toast.success('Currículo enviado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não deu pra enviar o currículo. Tente de novo.');
    } finally {
      setUploadingResume(false);
    }
  }

  async function submit() {
    if (!companySlug || !jobSlug) return;
    setSubmitting(true);
    try {
      const { data, error } = await invokeEdge<{ applicationId?: string }>('submit-application', {
        companySlug,
        jobSlug,
        candidateName: name,
        candidateEmail: email,
        candidatePhone: phone || undefined,
        candidateId: candidate?.id,
        resumePath: resumePath ?? undefined,
        linkedinUrl: linkedinUrl.trim() || undefined,
        highlightAnswer: highlightAnswer.trim() || undefined,
        website: website || undefined,
      });
      if (error) throw error;
      setApplicationId(data?.applicationId ?? null);
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar candidatura');
    } finally {
      setSubmitting(false);
    }
  }

  const identityValid = name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email);
  const phoneValid = phone.trim().length >= 8;
  const resumeValid = Boolean(resumePath);
  const highlightValid = highlightAnswer.trim().length > 0;

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

  if (submitted) {
    return (
      <main className="relative min-h-screen bg-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.10),transparent_60%)]" />
        <div className="relative max-w-2xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex h-16 w-16 rounded-2xl holo-gradient items-center justify-center mb-6">
            <CheckCircle2 className="h-8 w-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="font-satoshi font-bold text-[36px] tracking-[-0.6px] text-[#1d1d1f] mb-3">
            Candidatura enviada
          </h1>
          <p className="text-[16px] text-[#6b6b70] max-w-md mx-auto mb-8">
            Recebemos sua aplicação pra <strong className="text-[#1d1d1f]">{job.title}</strong> na{' '}
            <strong className="text-[#1d1d1f]">{job.company?.name}</strong>. O time já vai começar a
            avaliar seu fit e entra em contato se houver match.
          </p>

          <div className="max-w-md mx-auto rounded-[20px] border border-sky-100 bg-sky-50/50 p-5 text-left mb-6">
            <p className="font-satoshi font-bold text-[16px] text-[#1d1d1f] mb-1.5">
              Quer sair na frente?
            </p>
            <p className="text-[14px] text-[#6b6b70] leading-relaxed">
              Responder agora umas perguntas rápidas sobre você e a vaga dá muito mais contexto pro
              time. Sua avaliação fica mais completa e mais justa, e você não fica esperando a equipe
              pedir isso depois. Leva poucos minutos.
            </p>
            <div className="mt-4">
              <BrandCtaButton
                size="default"
                onClick={() =>
                  navigate(
                    `/careers/${companySlug}/${jobSlug}/form${
                      applicationId ? `?app=${applicationId}` : ''
                    }`,
                    { state: { name, email, phone } },
                  )
                }
              >
                Adiantar meu processo
              </BrandCtaButton>
            </div>
          </div>

          <div className="text-[13px] text-[#8a8a8f]">
            Ou{' '}
            <Link to="/candidato" className="font-semibold text-[#1d1d1f] underline hover:no-underline">
              acesse seu perfil
            </Link>{' '}
            pra acompanhar em que etapa você está.
          </div>
        </div>
      </main>
    );
  }

  // Step content
  const renderStep = () => {
    // Identity step (only if not logged in)
    if (!isLoggedCandidate && step === 1) {
      return (
        <div>
          <h2 className="font-satoshi font-bold text-[26px] md:text-[30px] tracking-[-0.5px] leading-tight text-[#1d1d1f] mb-2">
            Como podemos te chamar?
          </h2>
          <p className="text-[15px] text-[#6b6b70] leading-relaxed mb-6">
            Seu nome e email pra gente entrar em contato. Você também pode entrar com LinkedIn pra
            agilizar.
          </p>

          <Link
            to="/candidato/login"
            className="mb-6 inline-flex w-full items-center justify-center gap-2.5 h-11 rounded-xl bg-[#0A66C2] text-white font-semibold text-[14px] hover:bg-[#0A66C2]/90 transition-colors"
          >
            <Linkedin className="h-4 w-4" fill="currentColor" strokeWidth={0} />
            Entrar com LinkedIn
          </Link>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[11px] uppercase tracking-wider text-[#8a8a8f] font-semibold">
                ou preencha
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-[#1d1d1f] mb-1.5">
                Seu nome
              </label>
              <Input
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Maria Silva"
                className="h-11 rounded-xl border-gray-200 text-[15px]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#1d1d1f] mb-1.5">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && identityValid) {
                    e.preventDefault();
                    setStep(2);
                  }
                }}
                className="h-11 rounded-xl border-gray-200 text-[15px]"
              />
            </div>
          </div>
        </div>
      );
    }

    // Phone step
    if (step === phoneStepIndex) {
      return (
        <div>
          <h2 className="font-satoshi font-bold text-[26px] md:text-[30px] tracking-[-0.5px] leading-tight text-[#1d1d1f] mb-2">
            Qual telefone a gente pode usar?
          </h2>
          <p className="text-[15px] text-[#6b6b70] leading-relaxed mb-6">
            Precisamos do seu telefone pra marcar uma conversa rápida quando avançar. É mais ágil que
            email.
          </p>
          {isLoggedCandidate && candidate && (
            <div className="mb-6 inline-flex items-center gap-2.5 bg-sky-50 border border-sky-100 rounded-full px-3 py-1.5 text-[12px] text-sky-900">
              {candidate.picture_url && (
                <img
                  src={candidate.picture_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-5 w-5 rounded-full"
                />
              )}
              <span>
                Aplicando como <strong>{candidate.full_name ?? candidate.email}</strong>
              </span>
            </div>
          )}
          <Input
            ref={inputRef}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && phoneValid) {
                e.preventDefault();
                setStep(phoneStepIndex + 1);
              }
            }}
            className="h-12 rounded-xl border-gray-200 text-[16px]"
          />
        </div>
      );
    }

    // Currículo + LinkedIn step (obrigatório o currículo)
    if (step === resumeStepIndex) {
      return (
        <div>
          <h2 className="font-satoshi font-bold text-[26px] md:text-[30px] tracking-[-0.5px] leading-tight text-[#1d1d1f] mb-2">
            Manda seu currículo
          </h2>
          <p className="text-[15px] text-[#6b6b70] leading-relaxed mb-6">
            É o currículo que o time lê pra avaliar seu fit pra essa vaga, por isso ele é
            obrigatório. PDF de até 10MB.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleResumeFile}
            className="hidden"
          />

          {resumePath ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
              <FileText className="h-5 w-5 flex-shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[#1d1d1f]">{resumeFileName}</p>
                <p className="text-[12px] text-emerald-700">Currículo enviado</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingResume}
                className="flex-shrink-0 text-[13px] font-semibold text-[#6b6b70] transition-colors hover:text-[#1d1d1f] disabled:opacity-50"
              >
                Trocar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingResume}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-4 py-6 text-[14px] font-semibold text-[#1d1d1f] transition-colors hover:border-gray-400 hover:bg-gray-50 disabled:opacity-60"
            >
              {uploadingResume ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Escolher PDF
                </>
              )}
            </button>
          )}

          <div className="mt-6">
            <label className="mb-1.5 block text-[12px] font-semibold text-[#1d1d1f]">LinkedIn</label>
            <Input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/voce"
              className="h-11 rounded-xl border-gray-200 text-[15px]"
            />
            <p className="mt-1.5 text-[12px] text-[#8a8a8f]">
              Opcional. Ajuda a equipe a te conhecer melhor.
            </p>
          </div>
        </div>
      );
    }

    // Highlight step (só existe se a vaga tiver pergunta de destaque; sempre o último)
    if (hasHighlight && job.highlight_question) {
      return (
        <div>
          <h2 className="font-satoshi font-bold text-[26px] md:text-[30px] tracking-[-0.5px] leading-tight text-[#1d1d1f] mb-2">
            Uma última pergunta
          </h2>
          <p className="text-[15px] text-[#1d1d1f] leading-relaxed mb-6 font-semibold">
            {job.highlight_question}
          </p>

          {job.highlight_type === 'yes_no' ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setHighlightAnswer('sim')}
                className={
                  'rounded-xl border px-4 py-3 text-[15px] font-semibold transition-colors ' +
                  (highlightAnswer === 'sim'
                    ? 'border-sky-500 bg-sky-50/60 text-[#1d1d1f]'
                    : 'border-gray-200 text-[#6b6b70] hover:border-gray-300')
                }
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => setHighlightAnswer('nao')}
                className={
                  'rounded-xl border px-4 py-3 text-[15px] font-semibold transition-colors ' +
                  (highlightAnswer === 'nao'
                    ? 'border-sky-500 bg-sky-50/60 text-[#1d1d1f]'
                    : 'border-gray-200 text-[#6b6b70] hover:border-gray-300')
                }
              >
                Não
              </button>
            </div>
          ) : (
            <Input
              ref={inputRef}
              value={highlightAnswer}
              onChange={(e) => setHighlightAnswer(e.target.value)}
              placeholder="Sua resposta"
              className="h-12 rounded-xl border-gray-200 text-[16px]"
            />
          )}
        </div>
      );
    }

    return null;
  };

  const isLastStep = step === TOTAL_STEPS;
  const canAdvance = (() => {
    if (!isLoggedCandidate && step === 1) return identityValid;
    if (step === phoneStepIndex) return phoneValid; // phone obrigatório
    if (step === resumeStepIndex) return resumeValid; // currículo obrigatório
    if (step === highlightStepIndex) return highlightValid; // resposta obrigatória
    return true;
  })();

  return (
    <main className="relative min-h-screen bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.08),transparent_60%)]" />

      {/* Header */}
      <header className="relative border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/" className="font-satoshi font-bold text-[20px] tracking-[-0.4px] text-[#1d1d1f]">
            Noren
          </Link>
          <span className="text-[12px] text-[#8a8a8f]">Career page</span>
        </div>
      </header>

      <div className="relative max-w-3xl mx-auto px-6 py-10 md:py-14 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12">
        {/* Job description */}
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-3">
            {job.company?.name}
          </p>
          <h1 className="font-satoshi font-bold text-[36px] md:text-[40px] tracking-[-0.7px] leading-[1.1] text-[#1d1d1f] mb-6">
            {job.title}
          </h1>
          {job.company?.description && (
            <p className="text-[15px] text-[#6b6b70] leading-relaxed mb-6 italic">
              {job.company.description}
            </p>
          )}
          {job.description && <JobDescription description={job.description} />}
        </div>

        {/* Wizard */}
        <div>
          <div className="bg-white rounded-[24px] border border-gray-200 shadow-[0_20px_60px_-20px_rgba(15,15,30,0.12)] overflow-hidden lg:sticky lg:top-8">
            {/* Wizard header */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a8a8f]">
                  Candidatar
                </p>
                <p className="text-[12px] font-medium text-[#6b6b70]">
                  Passo <span className="text-[#1d1d1f] font-bold">{step}</span> de {TOTAL_STEPS}
                </p>
              </div>
              <div
                className="h-1 bg-gray-100 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={step}
                aria-valuemin={1}
                aria-valuemax={TOTAL_STEPS}
              >
                <div
                  className="h-full holo-gradient rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                />
              </div>
            </div>

            {/* Step content */}
            <div className="px-6 py-6">
              {renderStep()}
              <input
                type="text"
                name="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden"
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <button
                type="button"
                onClick={() => step > 1 && setStep(step - 1)}
                disabled={step === 1 || submitting}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6b6b70] hover:text-[#1d1d1f] transition-colors disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>

              {isLastStep ? (
                <BrandCtaButton size="sm" onClick={submit} disabled={!canAdvance || submitting}>
                  {submitting ? 'Enviando...' : 'Enviar'}
                  <CheckCircle2 className="h-4 w-4 ml-1" />
                </BrandCtaButton>
              ) : (
                <BrandCtaButton
                  size="sm"
                  onClick={() => setStep(step + 1)}
                  disabled={!canAdvance}
                >
                  Continuar
                </BrandCtaButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// Descrição da vaga em seções expansíveis. A primeira abre por padrão (o
// candidato precisa entender a vaga sem clicar em nada); as outras ficam
// recolhidas pra ele abrir o que interessa.
function JobDescription({ description }: { description: string }) {
  const sections = parseDescriptionSections(description);
  const [openIndexes, setOpenIndexes] = useState<number[]>([0]);

  // Descrição sem seções (texto corrido): renderiza direto, sem dropdown.
  if (sections.length <= 1) {
    return (
      <div className="max-w-none">
        <DescriptionBody body={sections[0]?.body ?? description} />
      </div>
    );
  }

  function toggle(index: number) {
    setOpenIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  }

  return (
    <div className="divide-y divide-gray-200 border-y border-gray-200">
      {sections.map((section, i) => {
        const open = openIndexes.includes(i);
        if (!section.title) {
          return (
            <div key={i} className="py-4">
              <DescriptionBody body={section.body} />
            </div>
          );
        }
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 py-4 text-left group"
            >
              <span className="font-satoshi font-bold text-[16px] tracking-[-0.2px] text-[#1d1d1f]">
                {section.title}
              </span>
              <ChevronDown
                className={
                  'h-4 w-4 flex-shrink-0 text-[#8a8a8f] transition-transform duration-200 group-hover:text-[#1d1d1f] ' +
                  (open ? 'rotate-180' : '')
                }
              />
            </button>
            {open && (
              <div className="pb-5 -mt-1">
                <DescriptionBody body={section.body} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PublicCareer;
