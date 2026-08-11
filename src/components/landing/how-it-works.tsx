import { motion, useReducedMotion } from 'framer-motion';
import { FileText, BarChart3, TrendingUp } from 'lucide-react';

function StepMockup({ step }: { step: number }) {
  if (step === 1) {
    // DNA Wizard preview: open-ended question + emerging tags
    return (
      <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </div>
        <p className="text-[11px] font-bold text-[#8a8a8f] uppercase tracking-wider mb-3">
          Step 4 de 7: Perfil ideal
        </p>
        <p className="text-[14px] text-[#1d1d1f] font-medium leading-relaxed mb-4">
          Descreva alguém que performou muito bem nos últimos 12 meses.
        </p>
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <p className="text-[13px] text-[#6b6b70] leading-relaxed italic">
            "Pessoa que aceitou ownership de áreas inteiras sem precisar de aprovação
            constante. Tomava decisão com 70% dos dados..."
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { tag: 'ownership', color: '#0284C7', delay: 0.4 },
            { tag: 'velocidade', color: '#0EA5E9', delay: 0.6 },
            { tag: 'tomada de decisão', color: '#06B6D4', delay: 0.8 },
          ].map((t) => (
            <motion.span
              key={t.tag}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.45, delay: t.delay, ease: [0.22, 1, 0.36, 1] }}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full border"
              style={{ color: t.color, borderColor: `${t.color}44`, backgroundColor: `${t.color}0d` }}
            >
              {t.tag}
            </motion.span>
          ))}
        </div>
      </div>
    );
  }

  if (step === 2) {
    // Ranking: candidates arrive analyzed and scored
    const candidates = [
      { name: 'Maria Silva', score: 92, tag: 'strong_hire', color: '#0284C7' },
      { name: 'João Almeida', score: 84, tag: 'hire', color: '#0EA5E9' },
      { name: 'Pedro Costa', score: 71, tag: 'hire', color: '#06B6D4' },
      { name: 'Ana Souza', score: 58, tag: 'maybe', color: '#38BDF8' },
    ];
    return (
      <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[13px] font-semibold text-[#1d1d1f]">Ranking da vaga Senior Eng</span>
          <span className="text-[11px] text-emerald-600 font-semibold">4 candidatos</span>
        </div>
        <div className="space-y-2">
          {candidates.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50"
            >
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                style={{ backgroundColor: c.color }}
              >
                {c.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <span className="text-[13px] text-[#1d1d1f] font-medium flex-grow truncate">{c.name}</span>
              <span className="text-[12px] font-bold text-[#1d1d1f]">{c.score}/100</span>
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ color: c.color, backgroundColor: `${c.color}14` }}
              >
                {c.tag}
              </span>
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4, delay: 0.7 }}
          className="mt-3 flex items-center gap-2 text-[11px] text-[#8a8a8f]"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>Nota em 5 áreas, com o raciocínio citando o seu DNA</span>
        </motion.div>
      </div>
    );
  }

  // Step 3: scout card with per-area scores
  const areas = [
    { area: 'Cultura', score: 88, color: '#0284C7' },
    { area: 'Execução', score: 76, color: '#0EA5E9' },
    { area: 'Comunicação', score: 82, color: '#06B6D4' },
    { area: 'Motivação', score: 91, color: '#0891B2' },
    { area: 'Potencial', score: 85, color: '#38BDF8' },
  ];
  return (
    <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm p-6 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-bold text-[#8a8a8f] uppercase tracking-wider">
          Scout card: Maria Silva
        </span>
        <span className="flex-grow h-[1px] bg-gray-100" />
        <TrendingUp className="h-3.5 w-3.5 text-sky-500" />
      </div>
      {areas.map((it, i) => (
        <motion.div
          key={it.area}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.45, delay: 0.18 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3"
        >
          <span
            className="text-[12px] font-bold flex-shrink-0 w-24"
            style={{ color: it.color }}
          >
            {it.area}
          </span>
          <div className="flex-grow h-7 rounded-lg bg-gray-50 relative overflow-hidden">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, delay: 0.22 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              style={{
                originX: 0,
                width: `${it.score}%`,
                backgroundColor: it.color,
                opacity: 0.85,
              }}
              className="absolute inset-y-0 left-0 rounded-lg"
            />
            <span className="relative z-10 flex items-center h-full px-3 text-[11px] font-bold text-[#1d1d1f]">
              {it.score}
            </span>
          </div>
        </motion.div>
      ))}
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.4, delay: 0.7 }}
        className="pt-1 text-[11px] text-[#8a8a8f]"
      >
        Metas e avaliações no mesmo card, antes e depois da contratação
      </motion.p>
    </div>
  );
}

const steps = [
  {
    num: '01',
    title: 'Configure o DNA da empresa',
    body: 'Você descreve sua cultura uma vez. A IA usa esse contexto em toda análise, do primeiro candidato ao plano de desenvolvimento.',
    icon: FileText,
  },
  {
    num: '02',
    title: 'Publique a vaga e deixe a triagem com a IA',
    body: 'Cada candidatura chega analisada e pontuada em 5 áreas: cultura, execução, comunicação, motivação e potencial. Nada de pilha de currículo.',
    icon: BarChart3,
  },
  {
    num: '03',
    title: 'Conduza o processo e acompanhe a evolução',
    body: 'Avance etapas com um clique. Quem você contrata ganha um scout card que registra a evolução da pessoa, com metas e avaliações no mesmo lugar.',
    icon: TrendingUp,
  },
];

export function HowItWorks() {
  const reduce = useReducedMotion();

  return (
    <section id="como-funciona" className="w-full py-16 md:py-28 px-4 md:px-5 bg-white">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-satoshi font-bold text-[32px] md:text-[48px] leading-[1.1] tracking-[-0.6px] text-center text-[#1d1d1f] mb-20">
          Como a Noren funciona
        </h2>

        <div className="relative pl-8 md:pl-10">
          <motion.div
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, amount: 0.05 }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ originY: 0 }}
            className="absolute left-0 top-3 bottom-3 w-[2px] holo-gradient rounded-full"
            aria-hidden="true"
          />

          <div className="space-y-20 md:space-y-28">
            {steps.map((step, idx) => {
              const fromRight = idx % 2 === 0;
              return (
                <div
                  key={step.num}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center"
                >
                  <motion.div
                    initial={reduce ? { opacity: 0 } : { opacity: 0, x: -32 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="flex items-baseline gap-4">
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true, amount: 0.4 }}
                        transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                        className="font-satoshi font-bold text-[36px] md:text-[48px] text-[#1d1d1f] tracking-[-0.6px] leading-none"
                      >
                        {step.num}
                      </motion.span>
                      <h3 className="font-satoshi font-bold text-[22px] md:text-[28px] text-[#1d1d1f] tracking-[-0.2px]">
                        {step.title}
                      </h3>
                    </div>
                    <p className="mt-4 text-[16px] md:text-[17px] text-[#6b6b70] leading-[1.55] max-w-md">
                      {step.body}
                    </p>
                  </motion.div>

                  <motion.div
                    initial={
                      reduce ? { opacity: 0 } : { opacity: 0, x: fromRight ? 48 : -48, scale: 0.96 }
                    }
                    whileInView={{ opacity: 1, x: 0, scale: 1 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <StepMockup step={idx + 1} />
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;
