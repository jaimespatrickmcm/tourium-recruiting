import { useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Pencil, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { BenefitsPicker } from '@/components/benefits-picker';
import { DnaSymbol } from '@/components/dna-symbol';
import { parseBenefits } from '@/lib/benefits';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/hooks/use-company';

const CULTURE_MIN = 80;

type SectionId = 'sobre' | 'cultura' | 'beneficios';

export function Dna() {
  const { company, loading, refetch } = useCompany();
  const [open, setOpen] = useState<SectionId | null>(null);

  if (loading) {
    return <div className="p-8 text-[#8a8a8f] text-sm">Carregando...</div>;
  }
  if (!company) {
    return <div className="p-8 text-[#6b6b70]">Empresa não encontrada.</div>;
  }

  const description = company.description?.trim() ?? '';
  const culture = (company.dna_document?.culture ?? '').trim();
  const benefits = parseBenefits(company.dna_document);
  const dnaCompleted = !!company.dna_completed_at && culture.length >= CULTURE_MIN;

  function toggle(id: SectionId) {
    setOpen((current) => (current === id ? null : id));
  }

  async function persist(patch: Record<string, unknown>) {
    if (!company) return false;
    const { error } = await supabase
      .from('companies')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq('id', company.id);
    if (error) {
      toast.error(`Não deu pra salvar: ${error.message}`);
      return false;
    }
    await refetch();
    return true;
  }

  function mergeDna(extra: Record<string, unknown>) {
    return { ...(company?.dna_document ?? {}), ...extra };
  }

  return (
    <div className="relative min-h-screen bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.07),transparent_70%)]" />

      <div className="relative max-w-3xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-3">
            DNA da empresa
          </p>
          <h1 className="font-satoshi font-bold text-[36px] md:text-[44px] tracking-[-0.7px] leading-[1.1] text-[#1d1d1f]">
            {company.name}
          </h1>
          <div className="mt-3 flex items-center gap-2">
            {dnaCompleted ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1">
                <CheckCircle2 className="h-3 w-3" />
                DNA configurado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-3 py-1">
                <AlertCircle className="h-3 w-3" />
                DNA pendente
              </span>
            )}
          </div>
        </div>

        {/* Intro */}
        <div className="mb-6 bg-white rounded-[28px] border border-gray-200 shadow-[0_10px_40px_-15px_rgba(15,15,30,0.08)] p-7 flex items-center gap-6">
          <div className="flex-shrink-0">
            <DnaSymbol size={88} />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-2.5 rounded-full bg-sky-50 border border-sky-200">
              <Sparkles className="h-3 w-3 text-sky-600" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                Contexto ativo
              </span>
            </div>
            <p className="text-[15px] text-[#6b6b70] leading-relaxed">
              Tudo que você escreve aqui entra na avaliação de cada candidato. Quanto mais
              específico, menos genérica fica a análise.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <SobreSection
            open={open === 'sobre'}
            onToggle={() => toggle('sobre')}
            description={description}
            onSave={(next) => persist({ description: next })}
          />

          <CulturaSection
            open={open === 'cultura'}
            onToggle={() => toggle('cultura')}
            culture={culture}
            onSave={(next) =>
              persist({
                dna_document: mergeDna({ culture: next }),
                dna_completed_at:
                  next.trim().length >= CULTURE_MIN
                    ? (company.dna_completed_at ?? new Date().toISOString())
                    : null,
              })
            }
          />

          <BeneficiosSection
            open={open === 'beneficios'}
            onToggle={() => toggle('beneficios')}
            benefits={benefits}
            onSave={(next) => persist({ dna_document: mergeDna({ benefits: next }) })}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- shell */

function SectionShell({
  title,
  helper,
  status,
  statusTone = 'muted',
  open,
  onToggle,
  children,
}: {
  title: string;
  helper: string;
  status: string;
  statusTone?: 'muted' | 'ok';
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-gray-200 bg-white overflow-hidden shadow-[0_10px_40px_-15px_rgba(15,15,30,0.08)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-4 px-7 py-5 text-left transition-colors hover:bg-gray-50/60"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="font-satoshi font-bold text-[17px] tracking-[-0.2px] text-[#1d1d1f]">
              {title}
            </span>
            {open ? (
              <ChevronUp className="h-4 w-4 text-[#8a8a8f]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#8a8a8f]" />
            )}
          </span>
          <span className="block text-[13px] text-[#6b6b70] mt-1">{helper}</span>
        </span>
        <span
          className={cn(
            'flex-shrink-0 mt-1 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider',
            statusTone === 'ok'
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
              : 'border-gray-200 bg-gray-50 text-[#8a8a8f]',
          )}
        >
          {status}
        </span>
      </button>

      {open && <div className="px-7 pb-7 pt-1 border-t border-gray-100">{children}</div>}
    </div>
  );
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-[#1d1d1f] transition-colors hover:border-gray-400"
    >
      <Pencil className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function EditActions({
  saving,
  disabled,
  onSave,
  onCancel,
}: {
  saving: boolean;
  disabled?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 flex items-center gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={saving || disabled}
        className="holo-gradient inline-flex items-center rounded-full px-5 py-2 text-[13px] font-semibold text-white shadow-lg shadow-sky-500/30 transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="rounded-full border border-gray-200 bg-white px-4 py-2 text-[13px] font-semibold text-[#6b6b70] transition-colors hover:border-gray-400 hover:text-[#1d1d1f] disabled:opacity-50"
      >
        Cancelar
      </button>
    </div>
  );
}

/* -------------------------------------------------------------- seções */

function SobreSection({
  open,
  onToggle,
  description,
  onSave,
}: {
  open: boolean;
  onToggle: () => void;
  description: string;
  onSave: (next: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft(description);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    const ok = await onSave(draft.trim());
    setSaving(false);
    if (!ok) return;
    setEditing(false);
    toast.success('Sobre a empresa salvo.');
  }

  return (
    <SectionShell
      title="Sobre a empresa"
      helper="O que vocês fazem e como o negócio funciona."
      status={description ? 'preenchido' : 'vazio'}
      statusTone={description ? 'ok' : 'muted'}
      open={open}
      onToggle={onToggle}
    >
      {editing ? (
        <div className="pt-4">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            placeholder="Ex.: Plataforma de logística pra e-commerce. Vendemos pra operações que despacham mais de 5 mil pedidos por mês. Time de 40 pessoas, produto e engenharia juntos no mesmo squad."
            className="rounded-xl border-gray-200 text-[15px] leading-relaxed resize-none"
          />
          <EditActions
            saving={saving}
            onSave={() => void save()}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="pt-4">
          {description ? (
            <p className="text-[15px] text-[#1d1d1f] leading-[1.7] whitespace-pre-wrap">
              {description}
            </p>
          ) : (
            <p className="text-[14px] text-[#6b6b70] leading-relaxed">
              Conta em poucas linhas o que a empresa faz. Ajuda o candidato a entender onde está
              entrando.
            </p>
          )}
          <div className="mt-4">
            <EditButton label={description ? 'Editar' : 'Preencher'} onClick={startEdit} />
          </div>
        </div>
      )}
    </SectionShell>
  );
}

function CulturaSection({
  open,
  onToggle,
  culture,
  onSave,
}: {
  open: boolean;
  onToggle: () => void;
  culture: string;
  onSave: (next: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(culture);
  const [saving, setSaving] = useState(false);

  const valid = draft.trim().length >= CULTURE_MIN;

  function startEdit() {
    setDraft(culture);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    const ok = await onSave(draft.trim());
    setSaving(false);
    if (!ok) return;
    setEditing(false);
    toast.success('Cultura salva.');
  }

  return (
    <SectionShell
      title="Cultura"
      helper="Como o time trabalha, decide e o que valoriza no dia a dia."
      status={culture.length >= CULTURE_MIN ? 'preenchido' : 'vazio'}
      statusTone={culture.length >= CULTURE_MIN ? 'ok' : 'muted'}
      open={open}
      onToggle={onToggle}
    >
      {editing ? (
        <div className="pt-4">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            placeholder="Ex.: Async first, decisões pelos times sem aprovar tudo. Quem performa bem assume o problema sem esperar prioridade vir de cima. Quem precisa de tudo escrito e aprovado pra agir não engrena aqui."
            className="rounded-xl border-gray-200 text-[15px] leading-relaxed resize-none"
          />
          <p
            className={cn(
              'text-[11px] mt-1.5',
              valid ? 'text-emerald-600' : 'text-[#8a8a8f]',
            )}
          >
            {draft.trim().length} caracteres, mínimo {CULTURE_MIN}
          </p>
          <EditActions
            saving={saving}
            disabled={!valid}
            onSave={() => void save()}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="pt-4">
          {culture ? (
            <p className="text-[15px] text-[#1d1d1f] leading-[1.7] whitespace-pre-wrap">{culture}</p>
          ) : (
            <p className="text-[14px] text-[#6b6b70] leading-relaxed">
              Descreve o ritmo, a autonomia e quem costuma engrenar por aí. É a parte que mais muda
              a qualidade da análise.
            </p>
          )}
          <div className="mt-4">
            <EditButton label={culture ? 'Editar' : 'Preencher'} onClick={startEdit} />
          </div>
        </div>
      )}
    </SectionShell>
  );
}

function BeneficiosSection({
  open,
  onToggle,
  benefits,
  onSave,
}: {
  open: boolean;
  onToggle: () => void;
  benefits: string[];
  onSave: (next: string[]) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(benefits);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft(benefits);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (!ok) return;
    setEditing(false);
    toast.success('Benefícios salvos.');
  }

  return (
    <SectionShell
      title="Benefícios"
      helper="O que a empresa oferece. Cada vaga escolhe se mostra ou não."
      status={benefits.length > 0 ? `${benefits.length} ativos` : 'vazio'}
      statusTone={benefits.length > 0 ? 'ok' : 'muted'}
      open={open}
      onToggle={onToggle}
    >
      {editing ? (
        <div className="pt-4">
          <BenefitsPicker value={draft} onChange={setDraft} />
          <EditActions
            saving={saving}
            onSave={() => void save()}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="pt-4">
          {benefits.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {benefits.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[13px] font-medium text-sky-800"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-[#6b6b70] leading-relaxed">
              Escolhe os benefícios da lista ou escreve os seus. Leva menos de um minuto.
            </p>
          )}
          <div className="mt-4">
            <EditButton label={benefits.length > 0 ? 'Editar' : 'Preencher'} onClick={startEdit} />
          </div>
        </div>
      )}
    </SectionShell>
  );
}

export default Dna;
