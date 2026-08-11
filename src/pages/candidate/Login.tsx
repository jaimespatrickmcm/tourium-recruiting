import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Linkedin } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export function CandidateLogin() {
  const [loading, setLoading] = useState(false);

  async function signInWithLinkedIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: {
        redirectTo: `${window.location.origin}/candidato/perfil`,
      },
    });
    if (error) {
      setLoading(false);
      toast.error(`Erro: ${error.message}`);
    }
    // On success, browser redirects to LinkedIn
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold">
            Noren
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-8">
          <h1 className="text-2xl font-bold mb-2">Entrar como candidato</h1>
          <p className="text-sm text-gray-600 mb-6">
            Acesse com sua conta do LinkedIn pra ver suas aplicações e candidatar-se a vagas.
          </p>

          <button
            type="button"
            onClick={signInWithLinkedIn}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-3 h-12 rounded-lg bg-[#0A66C2] text-white font-semibold text-[15px] hover:bg-[#0A66C2]/90 transition-colors disabled:opacity-50"
          >
            <Linkedin className="h-5 w-5" fill="currentColor" strokeWidth={0} />
            {loading ? 'Redirecionando...' : 'Continuar com LinkedIn'}
          </button>

          <p className="text-xs text-gray-500 mt-6 text-center">
            Você é uma empresa contratando?{' '}
            <Link to="/login" className="text-gray-900 font-semibold hover:underline">
              Entrar como empresa
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default CandidateLogin;
