import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { BrandCtaButton } from '@/components/brand-cta';
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
    <div className="relative min-h-screen bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.05),transparent_70%)]" />

      <div className="relative max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-3">
              Time
            </p>
            <h1 className="font-satoshi font-bold text-[36px] md:text-[44px] tracking-[-0.7px] leading-[1.1] text-[#1d1d1f]">
              {activeCount > 0
                ? `${activeCount} ${activeCount === 1 ? 'pessoa' : 'pessoas'} no time`
                : 'Seu time'}
            </h1>
            <p className="text-[16px] text-[#6b6b70] mt-3 max-w-xl leading-relaxed">
              Quem você contrata continua aqui: scout card, avaliações e plano de desenvolvimento
              de cada pessoa.
            </p>
          </div>
          <BrandCtaButton onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Adicionar colaborador
          </BrandCtaButton>
        </div>

        {/* Filtro por status */}
        <div className="flex items-center gap-2 mb-8">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors border',
                filter === f.value
                  ? 'bg-[#1d1d1f] text-white border-[#1d1d1f]'
                  : 'bg-white text-[#6b6b70] border-gray-200 hover:border-gray-400',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-[#8a8a8f] text-sm">Carregando...</div>
        ) : collaborators.length === 0 ? (
          <EmptyTeam onAdd={() => setDialogOpen(true)} />
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-[24px] border border-gray-200 p-10 text-center">
            <p className="text-[15px] text-[#6b6b70]">Nenhum colaborador com esse status.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <CollaboratorCard key={c.id} collaborator={c} />
            ))}
          </div>
        )}
      </div>

      <AddCollaboratorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => {
          setDialogOpen(false);
          void refetch();
        }}
      />
    </div>
  );
}

function CollaboratorCard({ collaborator: c }: { collaborator: CollaboratorWithOverall }) {
  return (
    <Link
      to={`/app/time/${c.id}`}
      className="relative block bg-white rounded-[24px] border border-gray-200 p-5 hover:border-gray-400 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 border border-sky-100 font-satoshi font-bold text-[18px] text-sky-700">
          {c.full_name.trim().charAt(0).toUpperCase() || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-satoshi font-bold text-[16px] tracking-[-0.2px] text-[#1d1d1f]">
            {c.full_name}
          </p>
          {c.role_title && <p className="truncate text-[13px] text-[#6b6b70]">{c.role_title}</p>}
          <p className="text-[12px] text-[#8a8a8f] mt-0.5">desde {formatDatePtBR(c.hired_at)}</p>
        </div>
        {c.overall !== null && (
          <div className="text-right shrink-0">
            <p
              className={cn(
                'font-satoshi font-bold text-[26px] leading-none tracking-[-0.5px]',
                scoreTone(c.overall),
              )}
            >
              {c.overall}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#8a8a8f]">Geral</p>
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
    <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
      Ativo
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#6b6b70]">
      Desligado
    </span>
  );
}

function EmptyTeam({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-white rounded-[24px] border border-gray-200 shadow-[0_10px_40px_-15px_rgba(15,15,30,0.08)] p-12 text-center">
      <div className="inline-flex h-14 w-14 rounded-2xl holo-gradient items-center justify-center mb-5">
        <Users className="h-7 w-7 text-white" strokeWidth={2} />
      </div>
      <h2 className="font-satoshi font-bold text-[22px] tracking-[-0.3px] text-[#1d1d1f] mb-2">
        Ninguém no time ainda
      </h2>
      <p className="text-[15px] text-[#6b6b70] leading-relaxed mb-6 max-w-md mx-auto">
        Quando você contratar alguém pelo pipeline de uma vaga, a pessoa aparece aqui com o scout
        card da análise inicial. Também dá pra adicionar alguém manualmente.
      </p>
      <BrandCtaButton onClick={onAdd}>Adicionar colaborador</BrandCtaButton>
    </div>
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
      <DialogContent className="rounded-[24px] bg-white sm:rounded-[24px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-satoshi font-bold text-[22px] tracking-[-0.3px] text-[#1d1d1f]">
            Adicionar colaborador
          </DialogTitle>
          <DialogDescription className="text-[14px] text-[#6b6b70]">
            Pra quem já está no time e não passou pelo pipeline. As avaliações começam do zero.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="collab-name" className="text-[13px] font-semibold text-[#1d1d1f]">
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
            <Label htmlFor="collab-email" className="text-[13px] font-semibold text-[#1d1d1f]">
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
            <Label htmlFor="collab-role" className="text-[13px] font-semibold text-[#1d1d1f]">
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
            <Label htmlFor="collab-hired" className="text-[13px] font-semibold text-[#1d1d1f]">
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
