import { useCallback, useEffect, useState } from 'react';
import { LogOut, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { CollaboratorDevelopmentPanel } from '@/components/people/collaborator-development-panel';
import { useAuth } from '@/hooks/use-auth';
import { invokeEdge } from '@/lib/functions';
import { supabase } from '@/lib/supabase';

export function EmployeeDevelopment() {
  const { user, signOut } = useAuth();
  const [collaboratorId, setCollaboratorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    // O convite pode já estar ativo. Nesse caso a Edge Function responde com
    // erro, mas a consulta RLS abaixo ainda encontra o vínculo válido.
    const activation = await invokeEdge<{ ok: boolean }>('invite-collaborator-access', {
      action: 'activate',
    });

    const { data: collaborator, error: collaboratorError } = await supabase
      .from('collaborators')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('access_status', 'active')
      .eq('status', 'ativo')
      .is('employment_ended_at', null)
      .maybeSingle();

    if (collaboratorError) {
      console.error('[EmployeeDevelopment] collaborator lookup failed:', collaboratorError);
    }

    if (!collaborator) {
      setCollaboratorId(null);
      setError(
        activation.error?.message ??
          'Seu acesso ainda não está disponível. Confirme que entrou com o e-mail do convite.',
      );
      setLoading(false);
      return;
    }

    setCollaboratorId(collaborator.id);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível sair. Tente de novo.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas canvas-tint">
      <header className="border-b border-line-soft bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="font-satoshi text-xl font-bold tracking-[-0.5px] text-ink">Noren</p>
            <p className="truncate text-caption text-ink-muted">Meu desenvolvimento</p>
          </div>

          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 text-footnote font-semibold text-ink transition-colors duration-200 hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            <span>{signingOut ? 'Saindo...' : 'Sair'}</span>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        {loading ? (
          <div
            className="surface-card flex min-h-56 items-center justify-center px-6 text-center"
            role="status"
            aria-live="polite"
          >
            <div>
              <RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin text-brand" aria-hidden />
              <p className="text-callout font-medium text-ink">Preparando seu espaço...</p>
              <p className="mt-1 text-footnote text-ink-muted">Isso costuma levar poucos segundos.</p>
            </div>
          </div>
        ) : error || !collaboratorId ? (
          <section className="surface-card mx-auto max-w-xl p-6 text-center sm:p-8" aria-labelledby="access-title">
            <h1 id="access-title" className="font-satoshi text-title-2 font-bold text-ink">
              Não conseguimos abrir seu espaço
            </h1>
            <p className="mx-auto mt-3 max-w-md text-body leading-relaxed text-ink-muted">
              {error ?? 'Seu vínculo não foi encontrado.'}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-6 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-brand px-5 text-callout font-semibold text-white transition-colors duration-200 hover:bg-brand-hover"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Tentar novamente
            </button>
          </section>
        ) : (
          <CollaboratorDevelopmentPanel collaboratorId={collaboratorId} mode="self" />
        )}
      </main>
    </div>
  );
}

export default EmployeeDevelopment;
