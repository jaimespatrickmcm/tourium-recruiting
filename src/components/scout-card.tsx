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
  /**
   * Sem moldura: usar quando o card já está dentro de outra superfície.
   * No detalhe do candidato, a versão com borda + sombra + faixa de gradiente
   * criava caixa dentro de caixa — a origem visual do "poluído".
   */
  flat?: boolean;
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
  if (score >= 75) return 'text-positive';
  if (score >= 60) return 'text-brand';
  if (score >= 45) return 'text-warning';
  return 'text-critical';
}

function scoreFill(score: number): string {
  if (score >= 75) return 'bg-positive';
  if (score >= 60) return 'bg-brand';
  if (score >= 45) return 'bg-warning';
  return 'bg-critical';
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
  flat = false,
}: ScoutCardProps) {
  const n = dimensions.length;
  const gridLevels = [1 / 3, 2 / 3, 1];

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        flat ? 'bg-transparent' : 'rounded-card border border-line-soft bg-surface shadow-e2',
        className,
      )}
    >
      {!flat && (
        <div className="canvas-tint pointer-events-none absolute inset-x-0 top-0 h-[180px]" />
      )}

      {/* Header: identidade + score geral */}
      <div className={cn('relative flex items-center gap-4', flat ? 'pb-4' : 'px-6 pb-4 pt-6')}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-14 w-14 rounded-tile border border-line-soft object-cover"
          />
        ) : (
          <span className="icon-tile h-14 w-14 font-satoshi text-title-3 font-bold">
            {name.trim().charAt(0).toUpperCase() || '?'}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-satoshi text-title-3 font-bold text-ink">{name}</p>
          {subtitle && <p className="truncate text-footnote text-ink-muted">{subtitle}</p>}
          {badge && (
            <span className="mt-1.5 inline-flex rounded-full bg-brand-tint px-2.5 py-0.5 text-eyebrow font-bold uppercase text-brand">
              {badge}
            </span>
          )}
        </div>
        <div className="text-right">
          <p
            className={cn(
              'font-satoshi text-display font-bold leading-none tabular-nums',
              scoreTone(overall),
            )}
          >
            {overall}
          </p>
          <p className="mt-1 text-eyebrow font-bold uppercase text-ink-subtle">Geral</p>
        </div>
      </div>

      {/* Radar */}
      {n >= 3 && (
        <div className={cn('relative flex justify-center', !flat && 'px-6')}>
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
                  className="fill-ink-muted text-[9px] font-semibold"
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
        <div className={cn('relative space-y-3 pt-4', !flat && 'px-6')}>
          {dimensions.map((d) => (
            <div key={d.area} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-caption font-medium text-ink-muted">
                {areaLabel(d.area)}
              </span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className={cn('h-full rounded-full', scoreFill(d.score))}
                  style={{ width: `${d.score}%` }}
                />
              </div>
              <span
                className={cn(
                  'w-7 shrink-0 text-right text-caption font-bold tabular-nums',
                  scoreTone(d.score),
                )}
              >
                {d.score}
              </span>
            </div>
          ))}
          {pending?.map((p) => (
            <div key={p.area} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-caption font-medium text-ink-subtle">
                {areaLabel(p.area)}
              </span>
              <span className="flex-1 text-caption italic text-ink-subtle">{p.note}</span>
            </div>
          ))}
        </div>
      )}

      {/* Evolução */}
      {history && history.length >= 2 && (
        <div className={cn('relative mt-5 border-t border-line-soft pt-4', !flat && 'mx-6')}>
          <p className="mb-2 text-eyebrow font-bold uppercase text-ink-subtle">Evolução</p>
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
          <div className="flex justify-between text-eyebrow text-ink-subtle">
            <span>{history[0].label}</span>
            <span>{history[history.length - 1].label}</span>
          </div>
        </div>
      )}

      {!flat && <div className="pb-6" />}
    </div>
  );
}

export default ScoutCard;
