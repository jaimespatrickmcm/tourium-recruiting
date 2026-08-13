import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { BrandCtaButton } from '@/components/brand-cta';
import { PageShell, EmptyState } from '@/components/page-shell';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/hooks/use-company';
import {
  useCollaborators,
  formatDatePtBR,
  scoreTone,
  type CollaboratorWithOverall,
} from '@/hooks/use-collaborators';
import { cn } from '@/lib/utils';

type StatusFilter = 'ativo' | 'desligado' | 'todos';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ativo', label: 'Ativos' },
  { value: 'desligado', label: 'Desligados' },
  { value: 'todos', label: 'Todos' },
];

export function Team() {
  const { collaborators, loading, refetch } = useCollaborators();
  const [filter, setFilter] = useState<StatusFilter>('ativo');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered =
    filter === 'todos' ? collaborators : collaborators.filter((c) => c.status === filter);
  const activeCount = collaborators.filter((c) => c.status === 'ativo').length;

  return (
    <PageShell
      width="wide"
      eyebrow="Time"
      title={
        activeCount > 0
          ? `${activeCount} ${activeCount === 1 ? 'pessoa' : 'pessoas'} no time`
          : 'Time'
      }
      description="Quem você contrata continua aqui: scout card, avaliações e plano de desenvolvimento de cada pessoa."
      action={
        <BrandCtaButton onClick={() => setDialogOpen(true)} showArrow={false}>
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          Adicionar colaborador
        </BrandCtaButton>
      }
    >
      {/* Filtro por status: some quando nao ha ninguem, pra nao competir com o
          estado vazio nem sugerir que existe conteudo escondido atras dele. */}
      {collaborators.length > 0 && (
        <div className="mb-6 flex items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={cn(
                'inline-flex h-9 items-center rounded-full border px-3.5 text-footnote font-semibold',
                'transition-colors duration-200 ease-standard',
                filter === f.value
                  ? 'border-ink bg-ink text-white'
                  : 'border-line-soft bg-surface text-ink-muted hover:border-line hover:text-ink',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-label="Carregando time"
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="surface-card h-[136px] animate-pulse" />
          ))}
        </div>
      ) : collaborators.length === 0 ? (
        <EmptyTeam onAdd={() => setDialogOpen(true)} />
      ) : filtered.length === 0 ? (
        <div className="surface-card px-6 py-12 text-center">
          <p className="text-callout text-ink-muted">Nenhum colaborador com esse status.</p>
          <button
            type="button"
            onClick={() => setFilter('todos')}
            className="mt-3 text-footnote font-semibold text-brand transition-colors hover:text-brand-hover"
          >
            Ver todos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CollaboratorCard key={c.id} collaborator={c} />
          ))}
        </div>
      )}

      <AddCollaboratorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => {
          setDialogOpen(false);
          void refetch();
        }}
      />
    </PageShell>
  );
}

function CollaboratorCard({ collaborator: c }: { collaborator: CollaboratorWithOverall }) {
  return (
    <Link to={`/app/time/${c.id}`} className="surface-card-interactive block p-5">
      <div className="flex items-start gap-3">
        <span className="icon-tile h-12 w-12 shrink-0 font-satoshi text-title-3 font-bold">
          {c.full_name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-satoshi text-callout font-bold text-ink">{c.full_name}</p>
          {c.role_title && <p className="truncate text-footnote text-ink-muted">{c.role_title}</p>}
          <p className="mt-0.5 text-caption text-ink-subtle">desde {formatDatePtBR(c.hired_at)}</p>
        </div>
        {c.overall !== null && (
          <div className="shrink-0 text-right">
            <p
              className={cn(
                'font-satoshi text-title-2 font-bold tabular-nums',
                scoreTone(c.overall),
              )}
            >
              {c.overall}
            </p>
            <p className="text-eyebrow font-bold uppercase text-ink-subtle">Geral</p>
          </div>
        )}
      </div>
      <div className="mt-4">
        <StatusChip status={c.status} />
      </div>
    </Link>
  );
}

function StatusChip({ status }: { status: 'ativo' | 'desligado' }) {
  return status === 'ativo' ? (
    <span className="inline-flex items-center rounded-full bg-positive-tint px-2.5 py-1 text-eyebrow font-bold uppercase text-positive">
      Ativo
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-canvas px-2.5 py-1 text-eyebrow font-bold uppercase text-ink-subtle">
      Desligado
    </span>
  );
}

function EmptyTeam({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={<Users className="h-7 w-7" strokeWidth={1.75} />}
      title="Ninguém no time ainda"
      description="Marque um candidato como contratado no pipeline de uma vaga e ele entra aqui automaticamente, já com o scout card da análise inicial."
      action={<BrandCtaButton onClick={onAdd}>Adicionar colaborador</BrandCtaButton>}
      hint="Adicione manualmente quem já estava no time antes do Noren."
    />
  );
}

function AddCollaboratorDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { company } = useCompany();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [hiredAt, setHiredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!company) {
      toast.error('Empresa não carregada ainda. Tenta de novo em instantes.');
      return;
    }
    if (!fullName.trim() || !email.trim()) {
      toast.error('Nome e email são obrigatórios.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('collaborators').insert({
      company_id: company.id,
      full_name: fullName.trim(),
      email: email.trim(),
      role_title: roleTitle.trim() || null,
      hired_at: hiredAt,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message ?? 'Erro ao adicionar colaborador');
      return;
    }
    toast.success('Colaborador adicionado.');
    setFullName('');
    setEmail('');
    setRoleTitle('');
    setHiredAt(new Date().toISOString().slice(0, 10));
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-card bg-white sm:rounded-card overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-satoshi font-bold text-[22px] tracking-[-0.3px] text-ink">
            Adicionar colaborador
          </DialogTitle>
          <DialogDescription className="text-callout text-ink-muted">
            Pra quem já está no time e não passou pelo pipeline. As avaliações começam do zero.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="collab-name" className="text-footnote font-semibold text-ink">
              Nome completo
            </Label>
            <Input
              id="collab-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Maria Silva"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="collab-email" className="text-footnote font-semibold text-ink">
              Email
            </Label>
            <Input
              id="collab-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria@empresa.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="collab-role" className="text-footnote font-semibold text-ink">
              Cargo
            </Label>
            <Input
              id="collab-role"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Product Designer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="collab-hired" className="text-footnote font-semibold text-ink">
              Data de contratação
            </Label>
            <Input
              id="collab-hired"
              type="date"
              value={hiredAt}
              onChange={(e) => setHiredAt(e.target.value)}
              required
            />
          </div>
          <div className="pt-2">
            <BrandCtaButton type="submit" disabled={saving} className="w-full justify-center">
              {saving ? 'Adicionando...' : 'Adicionar'}
            </BrandCtaButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default Team;
