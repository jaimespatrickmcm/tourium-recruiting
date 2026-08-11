import { motion } from 'framer-motion';

// Double helix DNA symbol with subtle rotation.
// Pure SVG, no external deps. Brand color: sky + cyan.

export function DnaSymbol({ size = 120 }: { size?: number }) {
  const NUM_PAIRS = 10;
  const W = 100;
  const H = 160;

  const pairs = Array.from({ length: NUM_PAIRS }).map((_, i) => {
    const t = i / (NUM_PAIRS - 1);
    const y = 10 + t * (H - 20);
    const phase = t * Math.PI * 3; // 1.5 full rotations along the strand
    const offset = Math.sin(phase) * 28;
    return {
      i,
      y,
      x1: W / 2 - offset,
      x2: W / 2 + offset,
      visible: Math.abs(Math.sin(phase)) > 0.2,
    };
  });

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size * (H / W) }}
      aria-hidden
    >
      {/* Glow behind */}
      <motion.div
        className="absolute inset-0 holo-gradient rounded-full blur-3xl"
        animate={{ opacity: [0.25, 0.45, 0.25] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.svg
        viewBox={`0 0 ${W} ${H}`}
        className="relative w-full h-full"
        style={{ filter: 'drop-shadow(0 6px 20px rgba(14,165,233,0.25))' }}
        animate={{ rotateY: [0, 360] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
      >
        <defs>
          <linearGradient id="strandLeft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A5F3FC" />
            <stop offset="50%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <linearGradient id="strandRight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="50%" stopColor="#0EA5E9" />
            <stop offset="100%" stopColor="#7DD3FC" />
          </linearGradient>
        </defs>

        {/* Connecting rungs */}
        {pairs.map((p) =>
          p.visible ? (
            <line
              key={`rung-${p.i}`}
              x1={p.x1}
              y1={p.y}
              x2={p.x2}
              y2={p.y}
              stroke="#0EA5E9"
              strokeWidth={1.5}
              strokeOpacity={0.45}
            />
          ) : null,
        )}

        {/* Left strand */}
        <path
          d={pairs.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x1} ${p.y}`).join(' ')}
          stroke="url(#strandLeft)"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Right strand */}
        <path
          d={pairs.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x2} ${p.y}`).join(' ')}
          stroke="url(#strandRight)"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Nucleotide nodes */}
        {pairs.map((p) => (
          <g key={`nodes-${p.i}`}>
            <circle cx={p.x1} cy={p.y} r={3} fill="#0284C7" />
            <circle cx={p.x2} cy={p.y} r={3} fill="#38BDF8" />
          </g>
        ))}
      </motion.svg>
    </div>
  );
}

export default DnaSymbol;
