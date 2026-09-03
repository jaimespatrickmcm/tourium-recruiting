import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock3,
  Mail,
  Send,
  Trash2,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { CollaboratorDevelopmentPanel } from '@/components/people/collaborator-development-panel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDatePtBR } from '@/hooks/use-collaborators';
import { invokeEdge } from '@/lib/functions';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Collaborator = Database['public']['Tables']['collaborators']['Row'];

const ACCESS_STATUS = {
  active: {
    label: 'Acesso ativo',
    className: 'border-positive/20 bg-positive-tint text-positive',
    icon: CheckCircle2,
  },
  pending: {
    label: 'Confirmação pendente',
    className: 'border-warning/20 bg-warning-tint text-warning',
    icon: Clock3,
  },
  revoked: {
    label: 'Acesso revogado',
    className: 'border-line-soft bg-surface-sunken text-ink-muted',
    icon: Ban,
  },
} as const;

export function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [collaborator, setCollaborator] = useState<Collaborator | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [accessEmail, setAccessEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('collaborators')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[TeamDetail] fetch error:', error);
      toast.error('Não conseguimos carregar esta pessoa.');
      setLoading(false);
      return;
    }

    if (!data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setCollaborator(data);
    setAccessEmail(data.pending_corporate_email ?? data.corporate_email ?? data.email);
    setNotFound(false);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleStatus() {
    if (!collaborator || updatingStatus) return;

    const endingEmployment = collaborator.status === 'ativo';
    const confirmed = window.confirm(
      endingEmployment
        ? `Desligar ${collaborator.full_name}? O acesso corporativo será revogado e o histórico continuará salvo.`
        : `Reativar ${collaborator.full_name}? O acesso continuará revogado até você enviar um novo convite.`,
    );
    if (!confirmed) return;

    setUpdatingStatus(true);
    try {
      if (endingEmployment) {
        const { error } = await invokeEdge('revoke-collaborator-access', {
          collaboratorId: collaborator.id,
          endEmployment: true,
        });
        if (error) throw error;
        toast.success('Pessoa desligada e acesso revogado.');
      } else {
        const { error } = await supabase
          .from('collaborators')
          .update({ status: 'ativo', employment_ended_at: null })
          .eq('id', collaborator.id);
        if (error) throw error;
        toast.success('Pessoa reativada. Envie um novo convite para liberar o acesso.');
      }
      await load();
    } catch (statusError) {
      toast.error(
        statusError instanceof Error
          ? statusError.message
          : 'Não conseguimos atualizar o vínculo.',
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function inviteAccess(event: FormEvent) {
    event.preventDefault();
    if (!collaborator || inviting) return;

    const corporateEmail = accessEmail.trim().toLowerCase();
    if (!corporateEmail) {
      toast.error('Informe o e-mail corporativo.');
      return;
    }

    setInviting(true);
    const { error } = await invokeEdge('invite-collaborator-access', {
      action: 'invite',
      collaboratorId: collaborator.id,
      corporateEmail,
    });
    setInviting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Convite enviado para ${corporateEmail}.`);
    await load();
  }

  async function revokeAccess() {
    if (!collaborator || revoking) return;

    const confirmed = window.confirm(
      `Revogar o acesso de ${collaborator.full_name}? O vínculo e o histórico serão preservados.`,
    );
    if (!confirmed) return;

    setRevoking(true);
    const { error } = await invokeEdge('revoke-collaborator-access', {
      collaboratorId: collaborator.id,
      endEmployment: false,
    });
    setRevoking(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Acesso corporativo revogado.');
    await load();
  }

  async function deleteCollaborator() {
    if (!collaborator || deleting) return;

    const name = collaborator.full_name;
    setDeleting(true);
    const { error } = await invokeEdge('delete-collaborator', {
      collaboratorId: collaborator.id,
    });

    if (error) {
      toast.error(error.message || 'Não conseguimos excluir esta pessoa.');
      setDeleting(false);
      return;
    }

    toast.success(`${name} saiu do time.`);
    navigate('/app/time');
  }

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-canvas px-4 text-footnote text-ink-muted"
        role="status"
        aria-live="polite"
      >
        Carregando pessoa...
      </div>
    );
  }

  if (notFound || !collaborator) {
    return (
      <main className="min-h-screen bg-canvas px-4 py-12 sm:px-6">
        <div className="surface-card mx-auto max-w-lg p-6 text-center sm:p-8">
          <h1 className="font-satoshi text-title-2 font-bold text-ink">Pessoa não encontrada</h1>
          <p className="mt-2 text-body text-ink-muted">
            O vínculo pode ter sido removido ou não pertencer à sua empresa.
          </p>
          <Link
            to="/app/time"
            className="mt-6 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-brand px-5 text-callout font-semibold text-white transition-colors duration-200 hover:bg-brand-hover"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar pro time
          </Link>
        </div>
      </main>
    );
  }

  const statusConfig = ACCESS_STATUS[collaborator.access_status];
  const AccessIcon = statusConfig.icon;
  const displayedEmail = collaborator.pending_corporate_email ?? collaborator.corporate_email;
  const isActiveEmployee = collaborator.status === 'ativo' && !collaborator.employment_ended_at;

  return (
    <main className="min-h-screen bg-canvas canvas-tint">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <header className="mb-8">
          <Link
            to="/app/time"
            className="mb-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-2 text-footnote font-semibold text-ink-muted transition-colors duration-200 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Time
          </Link>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words font-satoshi text-title-1 font-bold text-ink">
                  {collaborator.full_name}
                </h1>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-caption font-semibold ${
                    collaborator.status === 'ativo'
                      ? 'border-positive/20 bg-positive-tint text-positive'
                      : 'border-line-soft bg-surface-sunken text-ink-muted'
                  }`}
                >
                  {collaborator.status === 'ativo' ? 'Ativo' : 'Desligado'}
                </span>
              </div>
              <p className="mt-2 text-callout text-ink-muted">
                {collaborator.role_title ? `${collaborator.role_title}, ` : ''}
                no time desde {formatDatePtBR(collaborator.hired_at)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void toggleStatus()}
              disabled={updatingStatus}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 self-start rounded-full border border-line bg-surface px-4 text-footnote font-semibold text-ink transition-colors duration-200 hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
            >
              {collaborator.status === 'ativo' ? (
                <UserMinus className="h-4 w-4" aria-hidden />
              ) : (
                <UserPlus className="h-4 w-4" aria-hidden />
              )}
              {updatingStatus
                ? 'Atualizando...'
                : collaborator.status === 'ativo'
                  ? 'Desligar'
                  : 'Reativar'}
            </button>
          </div>
        </header>

        <section
          className="surface-card mb-8 p-5 sm:p-6"
          aria-labelledby="corporate-access-title"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="icon-tile h-10 w-10">
                  <Mail className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2
                    id="corporate-access-title"
                    className="font-satoshi text-title-3 font-bold text-ink"
                  >
                    Acesso da pessoa
                  </h2>
                  <span
                    className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption font-semibold ${statusConfig.className}`}
                  >
                    <AccessIcon className="h-3.5 w-3.5" aria-hidden />
                    {statusConfig.label}
                  </span>
                </div>
              </div>

              <p className="mt-4 max-w-2xl text-footnote leading-relaxed text-ink-muted">
                {collaborator.access_status === 'active'
                  ? `${displayedEmail ?? 'O e-mail confirmado'} pode entrar na área pessoal e acompanhar os próprios dados.`
                  : collaborator.access_status === 'pending'
                    ? `O convite foi enviado para ${displayedEmail ?? 'o e-mail informado'} e aguarda confirmação.`
                    : 'O acesso está bloqueado. Envie um novo convite quando quiser liberar a área pessoal.'}
              </p>
            </div>

            {collaborator.access_status !== 'revoked' && (
              <button
                type="button"
                onClick={() => void revokeAccess()}
                disabled={revoking}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-critical/30 bg-surface px-4 text-footnote font-semibold text-critical transition-colors duration-200 hover:bg-critical-tint disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Ban className="h-4 w-4" aria-hidden />
                {revoking ? 'Revogando...' : 'Revogar acesso'}
              </button>
            )}
          </div>

          <form onSubmit={inviteAccess} className="mt-6 border-t border-line-soft pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Label htmlFor="corporate-email" className="text-footnote font-semibold text-ink">
                  E-mail corporativo
                </Label>
                <Input
                  id="corporate-email"
                  type="email"
                  value={accessEmail}
                  onChange={(event) => setAccessEmail(event.target.value)}
                  disabled={!isActiveEmployee || inviting}
                  autoComplete="email"
                  placeholder="nome@empresa.com.br"
                  className="mt-1.5 min-h-11"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={!isActiveEmployee || inviting}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-brand px-5 text-callout font-semibold text-white transition-colors duration-200 hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden />
                {inviting
                  ? 'Enviando...'
                  : collaborator.access_status === 'pending'
                    ? 'Reenviar convite'
                    : collaborator.access_status === 'active'
                      ? 'Trocar e-mail'
                      : 'Enviar convite'}
              </button>
            </div>
            {!isActiveEmployee && (
              <p className="mt-2 text-caption text-ink-muted">
                Reative a pessoa antes de enviar um novo convite.
              </p>
            )}
          </form>
        </section>

        <CollaboratorDevelopmentPanel collaboratorId={collaborator.id} mode="admin" />

        <section
          className="mt-10 border-t border-line-soft pt-6"
          aria-labelledby="delete-person-title"
        >
          {confirmDelete ? (
            <div className="rounded-card border border-critical/20 bg-critical-tint p-5 sm:p-6">
              <h2 id="delete-person-title" className="text-callout font-semibold text-ink">
                Excluir {collaborator.full_name} de vez?
              </h2>
              <p className="mt-1 max-w-2xl text-footnote leading-relaxed text-ink-muted">
                Isso apaga a pessoa, as avaliações e as metas. A candidatura de origem continua no pipeline. Não dá pra desfazer.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void deleteCollaborator()}
                  disabled={deleting}
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-critical px-5 text-footnote font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {deleting ? 'Excluindo...' : 'Excluir de vez'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-5 text-footnote font-semibold text-ink-muted transition-colors duration-200 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              id="delete-person-title"
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-2 text-caption font-semibold text-ink-subtle transition-colors duration-200 hover:text-critical"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Excluir do time
            </button>
          )}
        </section>
      </div>
    </main>
  );
}

export default TeamDetail;
