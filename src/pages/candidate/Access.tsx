// Acesso do candidato por token (sem OAuth). Duas entradas:
// 1) ?token=... na URL: guarda o token e entra na área.
// 2) e-mail: pede acesso via request-candidate-access e, se achar candidatura,
//    guarda o token retornado e entra na área.
// Mobile-first.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCandidateToken } from '@/hooks/use-candidate-token';

// Formulário de acesso reutilizável. Usado nesta página e no shell da área
// (TokenArea) quando ainda não há token.
export function AccessForm({ onAccess }: { onAccess: (token: string) => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());

  async function requestAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!emailValid || loading) return;
    setLoading(true);
    setNotFound(false);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('request-candidate-access', {
        body: { email: email.trim().toLowerCase() },
      });
      if (fnError) throw fnError;
      if (!data?.ok) {
        setError(data?.error ?? 'Não conseguimos verificar agora. Tente de novo.');
        return;
      }
      if (!data.found) {
        setNotFound(true);
        return;
      }
      onAccess(data.token as string);
    } catch {
      setError('Não conseguimos verificar agora. Tente de novo em instantes.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={requestAccess} className="space-y-4">
      <div>
        <label htmlFor="access-email" className="block text-sm font-semibold text-ink mb-1.5">
          Seu e-mail
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="access-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setNotFound(false);
              setError(null);
            }}
            placeholder="voce@email.com"
            className="w-full h-12 rounded-lg border border-line-soft bg-white pl-10 pr-3 text-callout outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </div>
        <p className="mt-1.5 text-caption text-ink-subtle">
          Use o mesmo e-mail com que você se candidatou.
        </p>
      </div>

      {notFound && (
        <div className="rounded-tile bg-amber-50 border border-amber-100 px-4 py-3">
          <p className="text-footnote text-amber-900 leading-relaxed">
            Não achamos candidaturas com esse e-mail. Confira se digitou certo, ou candidate-se pela
            página de carreiras de uma empresa que usa a Noren.
          </p>
        </div>
      )}

      {error && <p className="text-footnote text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!emailValid || loading}
        className="w-full h-12 rounded-lg holo-gradient text-white font-semibold text-callout transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Verificando...' : 'Ver minhas candidaturas'}
      </button>
    </form>
  );
}

export function CandidateAccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setToken } = useCandidateToken();
  const tokenParam = params.get('token');

  // Se veio token na URL, guarda e entra na área.
  useEffect(() => {
    if (tokenParam) {
      setToken(tokenParam);
      navigate('/candidato', { replace: true });
    }
  }, [tokenParam, setToken, navigate]);

  function handleAccess(token: string) {
    setToken(token);
    navigate('/candidato', { replace: true });
  }

  if (tokenParam) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white px-4">
        <p className="text-sm text-ink-muted">Entrando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold">
            Noren
          </Link>
        </div>

        <div className="bg-white rounded-card border border-line-soft shadow-md p-6 sm:p-8">
          <h1 className="text-2xl font-bold mb-2 text-ink">Sua área de candidato</h1>
          <p className="text-sm text-ink-muted mb-6">
            Informe seu e-mail pra ver o andamento das suas candidaturas, sua jornada e seu perfil.
            Sem senha, sem complicação.
          </p>

          <AccessForm onAccess={handleAccess} />
        </div>

        <p className="text-xs text-ink-subtle mt-6 text-center">
          Você é uma empresa contratando?{' '}
          <Link to="/login" className="text-gray-900 font-semibold hover:underline">
            Entrar como empresa
          </Link>
        </p>
      </div>
    </main>
  );
}

export default CandidateAccess;
