// ScoutCard: o card de scout da Noren (estilo card de jogador de futebol).
// Radar por área + score geral + evolução no tempo. Usado no detalhe do
// candidato (análise da IA), no perfil do colaborador e no portal da pessoa.

import { areaLabel } from '@/lib/scout-areas';
import { cn } from '@/lib/utils';

export type ScoutCardDimension = { area: string; score: number };
export type ScoutCardHistoryPoint = { label: string; overall: number };

export type ScoutCardProps = {
  name: string;
  subtitle?: string | null;
  photoUrl?: string | null;
  overall: number;
  dimensions: ScoutCardDimension[];
  history?: ScoutCardHistoryPoint[];
  badge?: string | null;
  compact?: boolean;
  className?: string;
  /** Áreas ainda sem avaliação nesta etapa (ex.: "aguardando fit cultural"). */
  pending?: { area: string; note: string }[];
};

const RADAR_SIZE = 220;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 78;
const LABEL_RADIUS = RADAR_RADIUS + 20;

function polar(index: number, total: number, radius: number): [number, number] {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  return [RADAR_CENTER + radius * Math.cos(angle), RADAR_CENTER + radius * Math.sin(angle)];
}

function polygonPoints(scores: number[], radius: number): string {
  return scores
    .map((score, i) => {
      const [x, y] = polar(i, scores.length, (score / 100) * radius);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function scoreTone(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-sky-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-500';
}

export function ScoutCard({
  name,
  subtitle,
  photoUrl,
  overall,
  dimensions,
  history,
  badge,
  compact = false,
  className,
  pending,
}: ScoutCardProps) {
  const n = dimensions.length;
  const gridLevels = [1 / 3, 2 / 3, 1];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-[0_20px_60px_-20px_rgba(15,15,30,0.15)]',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 holo-gradient" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[180px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.08),transparent_65%)]" />

      {/* Header: identidade + score geral */}
      <div className="relative flex items-center gap-4 px-6 pt-6 pb-4">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-14 w-14 rounded-2xl object-cover border border-gray-200"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 border border-sky-100 font-satoshi font-bold text-[20px] text-sky-700">
            {name.trim().charAt(0).toUpperCase() || '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-satoshi font-bold text-[18px] tracking-[-0.3px] text-[#1d1d1f]">
            {name}
          </p>
          {subtitle && <p className="truncate text-[13px] text-[#6b6b70]">{subtitle}</p>}
          {badge && (
            <span className="mt-1 inline-flex rounded-full bg-sky-50 border border-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
              {badge}
            </span>
          )}
        </div>
        <div className="text-right">
          <p className={cn('font-satoshi font-bold text-[40px] leading-none tracking-[-1px]', scoreTone(overall))}>
            {overall}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a8a8f]">Geral</p>
        </div>
      </div>

      {/* Radar */}
      {n >= 3 && (
        <div className="relative flex justify-center px-6">
          <svg
            viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
            className="w-full max-w-[260px]"
            role="img"
            aria-label={`Radar de pontuações de ${name}`}
          >
            {gridLevels.map((level) => (
              <polygon
                key={level}
                points={polygonPoints(Array(n).fill(level * 100), RADAR_RADIUS)}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={1}
              />
            ))}
            {dimensions.map((_, i) => {
              const [x, y] = polar(i, n, RADAR_RADIUS);
              return (
                <line
                  key={i}
                  x1={RADAR_CENTER}
                  y1={RADAR_CENTER}
                  x2={x}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                />
              );
            })}
            <polygon
              points={polygonPoints(dimensions.map((d) => d.score), RADAR_RADIUS)}
              fill="rgba(14,165,233,0.18)"
              stroke="#0ea5e9"
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {dimensions.map((d, i) => {
              const [x, y] = polar(i, n, (d.score / 100) * RADAR_RADIUS);
              return <circle key={d.area} cx={x} cy={y} r={3} fill="#0ea5e9" />;
            })}
            {dimensions.map((d, i) => {
              const [x, y] = polar(i, n, LABEL_RADIUS);
              return (
                <text
                  key={d.area}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-[#6b6b70] text-[9px] font-semibold"
                >
                  {areaLabel(d.area)}
                </text>
              );
            })}
          </svg>
        </div>
      )}

      {/* Barras por área */}
      {!compact && (
        <div className="relative space-y-2.5 px-6 pt-4">
          {dimensions.map((d) => (
            <div key={d.area} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-[12px] font-medium text-[#6b6b70]">
                {areaLabel(d.area)}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full holo-gradient transition-all duration-500"
                  style={{ width: `${d.score}%` }}
                />
              </div>
              <span className={cn('w-8 shrink-0 text-right text-[12px] font-bold', scoreTone(d.score))}>
                {d.score}
              </span>
            </div>
          ))}
          {pending?.map((p) => (
            <div key={p.area} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-[12px] font-medium text-[#b0b0b5]">
                {areaLabel(p.area)}
              </span>
              <span className="flex-1 text-[11px] italic text-[#b0b0b5]">{p.note}</span>
            </div>
          ))}
        </div>
      )}

      {/* Evolução */}
      {history && history.length >= 2 && (
        <div className="relative mx-6 mt-5 border-t border-gray-100 pt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8a8a8f]">
            Evolução
          </p>
          <svg viewBox="0 0 240 48" className="h-12 w-full" role="img" aria-label="Evolução do score geral">
            <polyline
              points={history
                .map((p, i) => {
                  const x = history.length === 1 ? 0 : (i / (history.length - 1)) * 232 + 4;
                  const y = 44 - (p.overall / 100) * 40;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(' ')}
              fill="none"
              stroke="#0ea5e9"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {history.map((p, i) => {
              const x = history.length === 1 ? 0 : (i / (history.length - 1)) * 232 + 4;
              const y = 44 - (p.overall / 100) * 40;
              return <circle key={i} cx={x} cy={y} r={2.5} fill="#0ea5e9" />;
            })}
          </svg>
          <div className="flex justify-between text-[10px] text-[#8a8a8f]">
            <span>{history[0].label}</span>
            <span>{history[history.length - 1].label}</span>
          </div>
        </div>
      )}

      <div className="pb-6" />
    </div>
  );
}

export default ScoutCard;
