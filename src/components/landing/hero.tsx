import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Users, Shield } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 md:pt-36 pb-16 md:pb-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.10),transparent_60%)]" />

      <div className="relative max-w-5xl mx-auto text-center px-5 flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-max mx-auto holo-gradient rounded-full p-[1.5px] mb-8"
        >
          <div className="bg-white rounded-full px-4 py-1.5">
            <span className="holo-gradient-text text-[13px] font-semibold tracking-wide">
              Gestão de pessoas com IA, de ponta a ponta
            </span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="font-satoshi font-black text-[40px] sm:text-[56px] md:text-[68px] leading-[1.08] tracking-[-0.8px] text-[#1d1d1f] max-w-4xl mx-auto"
        >
          Corte até <span className="holo-gradient-text">80%</span> do trabalho de gestão de pessoas, do recrutamento em diante.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="mt-7 text-[17px] md:text-[20px] text-[#6b6b70] leading-[1.5] max-w-2xl mx-auto font-medium"
        >
          A Noren analisa cada candidato sozinha, pontua por área, move o
          processo seletivo com um clique e acompanha a evolução de quem você
          contratou. Você toma a decisão. O processo anda sem você empurrar.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-center justify-center gap-3 mt-10"
        >
          <Link
            to="/signup"
            className="holo-gradient rounded-full inline-flex items-center gap-2 pl-6 pr-3 py-3 text-white font-semibold text-[16px] hover:opacity-95 transition-opacity shadow-lg shadow-sky-500/30"
          >
            Criar conta grátis
            <span className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </span>
          </Link>
          <a
            href="#como-funciona"
            className="inline-flex items-center rounded-full border border-gray-200 bg-white px-6 py-3.5 text-[16px] font-semibold text-[#1d1d1f] hover:bg-gray-50 transition-colors"
          >
            Ver como funciona
          </a>
        </motion.div>
      </div>

      <div className="relative mt-16 md:mt-20 max-w-5xl mx-auto px-5">
        <DashboardMockup />
      </div>

      <div className="relative mt-10 max-w-5xl mx-auto px-5 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3 bg-white border border-gray-200 rounded-full pl-3 pr-5 py-2 shadow-md"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[13px] text-[#6b6b70] font-medium">
            Em design partners. Trial gratuito enquanto está em v1.
          </span>
        </motion.div>
      </div>
    </section>
  );
}

function DashboardMockup() {
  return (
    <div className="relative">
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 top-10 h-[80%] rounded-[40px] blur-3xl"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 50%, rgba(14,165,233,0.20), rgba(56,189,248,0.14) 55%, transparent 80%)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0.7, 0.9] }}
        transition={{ duration: 6, delay: 0.35, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-3xl rounded-[28px] bg-white border border-gray-200 shadow-[0_30px_80px_-20px_rgba(15,15,30,0.18)] p-5 md:p-7"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[#8a8a8f] font-medium">
            <Sparkles className="h-3.5 w-3.5 text-sky-500" />
            noren.app/acme
          </div>
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">Ao vivo</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <MiniStat label="Vagas ativas" value="8" delta="+2 esta semana" delay={0.6} />
          <MiniStat label="Candidatos" value="247" delta="+38 hoje" delay={0.7} />
          <MiniStat label="Match cultural" value="73%" delta="média top 10" delay={0.8} />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] font-semibold text-[#1d1d1f]">Distribuição de scores, últimos 30 dias</span>
            <span className="text-[12px] text-[#8a8a8f] font-medium">8 vagas ativas</span>
          </div>
          <DistributionChart />
        </div>
      </motion.div>

      <FloatingCard
        className="hidden lg:flex absolute -left-6 top-24 lg:-left-10"
        icon={<Sparkles className="h-4 w-4 text-sky-600" />}
        bg="bg-sky-100"
        title="DNA versionado"
        subtitle="cultura como contexto"
        delay={0.95}
      />
      <FloatingCard
        className="hidden lg:flex absolute -right-6 top-44 lg:-right-10"
        icon={<Users className="h-4 w-4 text-cyan-600" />}
        bg="bg-gradient-to-br from-cyan-100 to-sky-100"
        title="Cada análise explicada"
        subtitle="reasoning, não caixa preta"
        delay={1.05}
      />
      <FloatingCard
        className="hidden lg:flex absolute -left-4 -bottom-6 lg:-left-8"
        icon={<Shield className="h-4 w-4 text-blue-600" />}
        bg="bg-blue-100"
        title="LGPD por default"
        subtitle="consent + retenção + audit"
        delay={1.15}
      />

      <div className="lg:hidden mt-5 grid grid-cols-1 gap-3 px-2">
        <MobileStat icon={<Sparkles className="h-4 w-4 text-sky-600" />} bg="bg-sky-100" title="DNA versionado" subtitle="cultura como contexto" />
        <MobileStat icon={<Users className="h-4 w-4 text-cyan-600" />} bg="bg-gradient-to-br from-cyan-100 to-sky-100" title="Cada análise explicada" subtitle="reasoning, não caixa preta" />
        <MobileStat icon={<Shield className="h-4 w-4 text-blue-600" />} bg="bg-blue-100" title="LGPD por default" subtitle="consent + retenção + audit" />
      </div>
    </div>
  );
}

function MiniStat({ label, value, delta, delay }: { label: string; value: string; delta: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-gray-100 bg-white p-3"
    >
      <p className="text-[11px] text-[#8a8a8f] font-medium uppercase tracking-wide">{label}</p>
      <p className="text-[20px] md:text-[22px] font-bold text-[#1d1d1f] mt-1 leading-none">{value}</p>
      <p className="text-[11px] text-emerald-600 font-semibold mt-1.5">{delta}</p>
    </motion.div>
  );
}

function DistributionChart() {
  // Simulates score distribution: low / medium / high candidate buckets
  const buckets = [
    { range: '0-40', count: 8 },
    { range: '40-50', count: 18 },
    { range: '50-60', count: 32 },
    { range: '60-70', count: 58 },
    { range: '70-80', count: 72 },
    { range: '80-90', count: 42 },
    { range: '90-100', count: 17 },
  ];
  const max = Math.max(...buckets.map((b) => b.count));

  return (
    <div className="flex items-end justify-between gap-2 h-32">
      {buckets.map((b, i) => {
        const height = (b.count / max) * 100;
        const isHigh = i >= buckets.length - 2;
        return (
          <motion.div
            key={b.range}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: `${height}%`, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.9 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            className={`flex-1 rounded-t-md ${isHigh ? 'holo-gradient' : 'bg-gray-200'}`}
            title={`${b.range}: ${b.count} candidatos`}
          />
        );
      })}
    </div>
  );
}

function FloatingCard({
  className = '',
  icon,
  bg,
  title,
  subtitle,
  delay,
}: {
  className?: string;
  icon: React.ReactNode;
  bg: string;
  title: string;
  subtitle: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`items-center gap-3 bg-white border border-gray-200 rounded-2xl pl-2.5 pr-4 py-2.5 shadow-[0_10px_30px_-10px_rgba(15,15,30,0.18)] ${className}`}
    >
      <motion.div
        className={`h-9 w-9 rounded-xl ${bg} flex items-center justify-center`}
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 3.5, delay, repeat: Infinity, ease: 'easeInOut' }}
      >
        {icon}
      </motion.div>
      <div className="text-left">
        <p className="text-[13px] font-semibold text-[#1d1d1f] leading-tight">{title}</p>
        <p className="text-[11px] text-[#8a8a8f] leading-tight mt-0.5">{subtitle}</p>
      </div>
    </motion.div>
  );
}

function MobileStat({ icon, bg, title, subtitle }: { icon: React.ReactNode; bg: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-3 py-2.5">
      <div className={`h-9 w-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div className="text-left">
        <p className="text-[13px] font-semibold text-[#1d1d1f] leading-tight">{title}</p>
        <p className="text-[11px] text-[#8a8a8f] leading-tight mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

export default Hero;
