// Minha jornada: portal do colaborador. Scout card com scores por área,
// plano de desenvolvimento read-only e timeline (contratação, avaliações,
// metas concluídas). Mobile-first.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useCandidate } from '@/hooks/use-candidate';
import { ScoutCard, type ScoutCardHistoryPoint } from '@/components/scout-card';
import { SCOUT_AREAS } from '@/lib/scout-areas';
import { cn } from '@/lib/utils';
import type { CollaboratorStatus, GoalStatus } from '@/types/database';

type CollaboratorRow = {
  id: string;
  company_id: string;
  full_name: string;
  role_title: string | null;
  hired_at: string;
  status: CollaboratorStatus;
};

type ScoreRow = {
  area: string;
  score: number;
  recorded_at: string;
};

type GoalRow = {
  id: string;
  title: string;
  description: string | null;
  area: string | null;
  status: GoalStatus;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
};

type TimelineItem = {
  date: string;
  text: string;
  tone: 'sky' | 'emerald' | 'gray';
};

const GOAL_STATUS: Record<GoalStatus, { label: string; chip: string }> = {
  em_andamento: { label: 'Em andamento', chip: 'bg-sky-50 border-sky-100 text-sky-800' },
  concluida: { label: 'Concluída', chip: 'bg-emerald-50 border-emerald-100 text-emerald-800' },
  pausada: { label: 'Pausada', chip: 'bg-gray-100 border-gray-200 text-gray-600' },
};

function shortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function CandidateJourney() {
  const { user, loading: authLoading } = useAuth();
  const { candidate } = useCandidate();
  const [collaborator, setCollaborator] = useState<CollaboratorRow | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const { data: collabData, error: collabError } = await supabase
      .from('collaborators')
      .select('id, company_id, full_name, role_title, hired_at, status')
      .eq('candidate_id', user.id)
      .order('hired_at', { ascending: false });

    if (collabError) {
      setError('Não conseguimos carregar sua jornada agora.');
      setLoading(false);
      return;
    }

    const rows = (collabData ?? []) as CollaboratorRow[];
    const current = rows.find((c) => c.status === 'ativo') ?? rows[0] ?? null;
    setCollaborator(current);

    if (!current) {
      setLoading(false);
      return;
    }

    const [scoresRes, goalsRes, companyRes] = await Promise.all([
      supabase
        .from('collaborator_scores')
        .select('area, score, recorded_at')
        .eq('collaborator_id', current.id)
        .order('recorded_at', { ascending: true }),
      supabase
        .from('development_goals')
        .select('id, title, description, area, status, due_date, completed_at, created_at')
        .eq('collaborator_id', current.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('company_public_profiles')
        .select('id, name')
        .in('id', [current.company_id]),
    ]);

    setScores((scoresRes.data ?? []) as ScoreRow[]);
    setGoals((goalsRes.data ?? []) as GoalRow[]);
    setCompanyName(companyRes.data?.[0]?.name ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void fetchAll();
  }, [authLoading, fetchAll]);

  if (authLoading || loading) {
    return <div className="text-sm text-[#6b6b70]">Carregando...</div>;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[#1d1d1f]">{error}</p>
        <button
          type="button"
          onClick={() => void fetchAll()}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (!collaborator) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-satoshi text-2xl font-bold text-[#1d1d1f] mb-1">Minha jornada</h1>
          <p className="text-sm text-[#6b6b70]">Sua evolução profissional dentro das empresas.</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-[#6b6b70]">
            Sua jornada começa no dia em que uma empresa que usa a Noren te contratar. A partir
            daí, suas avaliações e seu plano de desenvolvimento ficam disponíveis aqui.
          </p>
        </div>
      </div>
    );
  }

  // Score mais recente por área (na ordem canônica das áreas)
  const latestByArea = new Map<string, number>();
  for (const s of scores) latestByArea.set(s.area, s.score);
  const dimensions = SCOUT_AREAS.filter((a) => latestByArea.has(a.key)).map((a) => ({
    area: a.key,
    score: latestByArea.get(a.key)!,
  }));
  const overall =
    dimensions.length > 0
      ? Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length)
      : null;

  // Histórico: batches agrupados pela data de recorded_at, ponto = média do batch
  const batches = new Map<string, number[]>();
  for (const s of scores) {
    const key = s.recorded_at.slice(0, 10);
    const batch = batches.get(key);
    if (batch) batch.push(s.score);
    else batches.set(key, [s.score]);
  }
  const history: ScoutCardHistoryPoint[] = [...batches.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      label: shortDate(date),
      overall: Math.round(values.reduce((sum, v) => sum + v, 0) / values.length),
    }));

  // Timeline: contratação + avaliações + metas concluídas, mais recente primeiro
  const timeline: TimelineItem[] = [
    {
      date: collaborator.hired_at,
      text: collaborator.role_title
        ? `Contratação como ${collaborator.role_title}`
        : 'Contratação',
      tone: 'sky' as const,
    },
    ...[...batches.entries()].map(([date, values]) => ({
      date,
      text: `Avaliação registrada (geral ${Math.round(
        values.reduce((sum, v) => sum + v, 0) / values.length,
      )})`,
      tone: 'gray' as const,
    })),
    ...goals
      .filter((g) => g.completed_at)
      .map((g) => ({
        date: g.completed_at!,
        text: `Meta concluída: ${g.title}`,
        tone: 'emerald' as const,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const subtitle = [collaborator.role_title, companyName].filter(Boolean).join(' · ') || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-satoshi text-2xl font-bold text-[#1d1d1f] mb-1">Minha jornada</h1>
        <p className="text-sm text-[#6b6b70]">
          {companyName
            ? `Sua evolução na ${companyName}, na visão de quem acompanha seu trabalho.`
            : 'Sua evolução profissional, na visão de quem acompanha seu trabalho.'}
        </p>
      </div>

      {dimensions.length > 0 && overall !== null ? (
        <ScoutCard
          name={collaborator.full_name}
          subtitle={subtitle}
          photoUrl={candidate?.picture_url ?? null}
          overall={overall}
          dimensions={dimensions}
          history={history}
          badge={collaborator.status === 'ativo' ? 'Ativo' : null}
          className="max-w-md mx-auto sm:mx-0"
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-sm text-[#6b6b70]">
            Ainda não há avaliações registradas. Assim que a primeira for feita, seu scout card
            aparece aqui com seus scores por área.
          </p>
        </div>
      )}

      {/* Plano de desenvolvimento */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
        <h2 className="font-satoshi font-bold text-[17px] text-[#1d1d1f] mb-4">
          Plano de desenvolvimento
        </h2>
        {goals.length === 0 ? (
          <p className="text-sm text-[#6b6b70]">Nenhuma meta cadastrada por enquanto.</p>
        ) : (
          <ul className="space-y-3">
            {goals.map((goal) => (
              <li key={goal.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-[#1d1d1f]">{goal.title}</p>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                      GOAL_STATUS[goal.status].chip,
                    )}
                  >
                    {GOAL_STATUS[goal.status].label}
                  </span>
                </div>
                {goal.description && (
                  <p className="text-[13px] text-[#6b6b70] mt-1 leading-relaxed">
                    {goal.description}
                  </p>
                )}
                {(goal.due_date || goal.completed_at) && (
                  <p className="text-[12px] text-[#8a8a8f] mt-1.5">
                    {goal.completed_at
                      ? `Concluída em ${fullDate(goal.completed_at)}`
                      : `Prazo: ${fullDate(goal.due_date!)}`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
        <h2 className="font-satoshi font-bold text-[17px] text-[#1d1d1f] mb-4">Linha do tempo</h2>
        <ol className="space-y-3">
          {timeline.map((item, i) => (
            <li key={`${item.date}-${i}`} className="flex items-baseline gap-3">
              <span
                className={cn(
                  'h-2 w-2 rounded-full shrink-0 translate-y-[-1px]',
                  item.tone === 'sky' && 'bg-sky-500',
                  item.tone === 'emerald' && 'bg-emerald-500',
                  item.tone === 'gray' && 'bg-gray-300',
                )}
              />
              <span className="text-sm text-[#1d1d1f]">{item.text}</span>
              <span className="ml-auto shrink-0 text-[12px] text-[#8a8a8f]">
                {fullDate(item.date)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default CandidateJourney;
