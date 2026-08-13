import { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  DISC_PROFILE_CONTENT,
  BIGFIVE_DIMENSION_INFO,
  type AssessmentMethod,
  type DiscResult,
  type BigFiveResult,
  type GritResult,
  type BigFiveDimension,
  type DiscProfileKey,
} from '@/lib/profile-assessment';

type Row = { method: AssessmentMethod; result: unknown; created_at: string };

/**
 * Resultado da análise de perfil comportamental do candidato (DISC, Big Five,
 * Garra), pro recrutador. Lê via RLS: só aparece se o email tiver candidatura
 * na empresa do usuário logado. Renderiza nada se o candidato não fez o teste.
 */
export function ProfileAssessmentCard({ email }: { email: string }) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from('profile_assessments')
        .select('method, result, created_at')
        .ilike('email', email)
        .order('created_at', { ascending: false });
      if (!active) return;
      // Mais recente por método
      const seen = new Set<string>();
      const latest: Row[] = [];
      for (const r of (data as Row[] | null) ?? []) {
        if (seen.has(r.method)) continue;
        seen.add(r.method);
        latest.push(r);
      }
      setRows(latest);
    }
    void load();
    return () => {
      active = false;
    };
  }, [email]);

  if (rows.length === 0) return null;

  const disc = rows.find((r) => r.method === 'disc')?.result as DiscResult | undefined;
  const bigfive = rows.find((r) => r.method === 'bigfive')?.result as BigFiveResult | undefined;
  const grit = rows.find((r) => r.method === 'grit')?.result as GritResult | undefined;

  return (
    <div className="rounded-card border border-line-soft bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="h-4 w-4 text-sky-600" />
        <p className="text-caption font-bold uppercase tracking-wider text-ink-subtle">
          Análise de perfil comportamental
        </p>
      </div>

      {disc && (
        <div className="mb-3">
          <p className="text-callout text-ink">
            <span className="font-semibold">DISC:</span>{' '}
            {DISC_PROFILE_CONTENT[disc.primary].name} predominante (
            {disc.pair.map((p: DiscProfileKey) => DISC_PROFILE_CONTENT[p].sigla).join('')})
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {(Object.keys(disc.percents) as DiscProfileKey[])
              .sort((a, b) => disc.points[b] - disc.points[a])
              .map((p) => (
                <span key={p} className="text-caption text-ink-muted">
                  {DISC_PROFILE_CONTENT[p].sigla} {disc.percents[p].toFixed(0)}%
                </span>
              ))}
          </div>
        </div>
      )}

      {bigfive && (
        <div className="mb-3">
          <p className="text-footnote font-semibold text-ink mb-1">Big Five</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {(Object.keys(bigfive.means) as BigFiveDimension[]).map((dim) => (
              <span key={dim} className="text-caption text-ink-muted">
                {BIGFIVE_DIMENSION_INFO[dim].label}: {bigfive.means[dim].toFixed(1)}
              </span>
            ))}
          </div>
        </div>
      )}

      {grit && (
        <p className="text-callout text-ink">
          <span className="font-semibold">Garra:</span> {grit.garraPct}%
        </p>
      )}
    </div>
  );
}

export default ProfileAssessmentCard;
