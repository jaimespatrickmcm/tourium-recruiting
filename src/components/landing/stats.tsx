import { Reveal } from './reveal';

// Honest v1 promises, not invented social proof.
const stats = [
  { value: 'até 80%', label: 'menos trabalho manual no processo' },
  { value: '5 áreas', label: 'pontuadas em cada análise' },
  { value: '1 clique', label: 'pra mover uma etapa do processo' },
  { value: '0 planilhas', label: 'pra avaliar e desenvolver gente' },
];

export function Stats() {
  return (
    <section id="numeros" className="w-full py-20 md:py-28 px-5">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="font-satoshi font-bold text-[28px] md:text-[40px] leading-[1.2] tracking-[-0.4px] text-[#1d1d1f] max-w-3xl mx-auto">
          O que a Noren promete entregar.
        </h2>
        <p className="mt-4 text-[15px] md:text-[16px] text-[#8a8a8f] max-w-2xl mx-auto">
          Números reais do v1. Sem KPI inflado, sem "10x ROI" sem lastro.
        </p>

        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-10">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 90} variant="scale" className="text-center">
              <p className="holo-gradient-text font-satoshi font-black text-[44px] md:text-[60px] leading-none tracking-[-0.8px]">
                {s.value}
              </p>
              <p className="mt-3 text-[14px] md:text-[15px] text-[#6b6b70] font-medium">
                {s.label}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Stats;
