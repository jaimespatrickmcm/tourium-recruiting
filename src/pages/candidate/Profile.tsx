import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Linkedin } from 'lucide-react';
import { useCandidate } from '@/hooks/use-candidate';

export function CandidateProfile() {
  const { candidate, loading, error, update, refetch } = useCandidate();
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [about, setAbout] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!candidate) return;
    setLinkedinUrl(candidate.linkedin_url ?? '');
    setAbout(candidate.about ?? '');
  }, [candidate]);

  if (loading) {
    return <div className="text-gray-500 text-sm">Carregando...</div>;
  }
  if (!candidate) {
    return (
      <div className="space-y-3">
        <div className="text-gray-900 font-semibold">Não foi possível carregar seu perfil.</div>
        {error && (
          <p className="text-sm text-gray-600">Algo deu errado por aqui. Vale tentar de novo.</p>
        )}
        <button
          type="button"
          onClick={() => void refetch()}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  async function save() {
    setSaving(true);
    const { error } = await update({ linkedin_url: linkedinUrl || null, about: about || null });
    setSaving(false);
    if (error) {
      toast.error(`Erro: ${error}`);
      return;
    }
    toast.success('Perfil salvo.');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Seu perfil</h1>
        <p className="text-sm text-gray-600">
          Dados do LinkedIn que importamos + campos pra completar.
        </p>
      </div>

      {/* Identity from LinkedIn */}
      <div className="bg-white rounded-tile border border-line-soft p-6">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
          Vindo do LinkedIn
        </p>
        <div className="flex items-center gap-4">
          {candidate.picture_url ? (
            <img
              src={candidate.picture_url}
              alt={candidate.full_name ?? candidate.email}
              className="h-16 w-16 rounded-full border border-line-soft"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-surface-sunken flex items-center justify-center text-lg font-bold text-gray-400">
              {(candidate.full_name ?? candidate.email)[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold">{candidate.full_name ?? '(sem nome)'}</p>
            <p className="text-sm text-gray-600">{candidate.email}</p>
          </div>
        </div>
      </div>

      {/* Editable */}
      <div className="bg-white rounded-tile border border-line-soft p-6 space-y-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          Complete o perfil
        </p>

        <div>
          <label className="block text-sm font-semibold mb-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Linkedin className="h-4 w-4 text-[#0A66C2]" />
              URL do seu LinkedIn
            </span>
          </label>
          <input
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://www.linkedin.com/in/seu-nome/"
            className="w-full h-10 px-3 rounded-lg border border-line text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            HR usa esse link pra ver seu perfil completo. Cola a URL exata do seu LinkedIn.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1.5">Sobre você</label>
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="O que você faz, anos de experiência, o que te move profissionalmente. Texto curto, autêntico."
            rows={5}
            className="w-full px-3 py-2 rounded-lg border border-line text-sm leading-relaxed resize-none"
          />
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-5 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar perfil'}
        </button>
      </div>

      <div className="bg-surface-sunken rounded-tile p-4 text-xs text-gray-600">
        <strong>Próximas waves:</strong> upload de CV (extração automática), lista de aplicações,
        respostas a perguntas customizadas por vaga.
      </div>
    </div>
  );
}

export default CandidateProfile;
