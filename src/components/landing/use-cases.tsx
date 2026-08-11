import { Reveal } from './reveal';

const cases = [
  { label: 'Founder que contrata sem RH', color: '#0284C7' },
  { label: 'Head of people começando do zero', color: '#0EA5E9' },
  { label: 'Gestor acompanhando o time', color: '#06B6D4' },
  { label: 'Primeira contratação', color: '#0891B2' },
  { label: 'Startup early-stage', color: '#38BDF8' },
  { label: 'Scale-up tech', color: '#0284C7' },
  { label: 'SaaS B2B', color: '#0EA5E9' },
  { label: 'Fintech', color: '#06B6D4' },
  { label: 'Squad crescendo rápido', color: '#0891B2' },
  { label: 'Equipe remota', color: '#38BDF8' },
  { label: 'Avaliação de desempenho', color: '#0284C7' },
  { label: 'Plano de desenvolvimento', color: '#0EA5E9' },
];

export function UseCases() {
  return (
    <section className="w-full py-20 md:py-28 px-5">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="font-satoshi font-bold text-[32px] md:text-[48px] leading-[1.1] tracking-[-0.6px] text-[#1d1d1f] max-w-3xl mx-auto">
          Feita pra quem carrega o processo de gente nas costas
        </h2>
        <p className="mt-5 text-[17px] md:text-[19px] text-[#6b6b70] leading-[1.5] max-w-2xl mx-auto font-medium">
          Founder que precisa contratar sem virar recrutador. Head of people
          montando processo do zero. Gestor que quer ver a evolução do time sem
          abrir planilha.
        </p>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3 max-w-3xl mx-auto">
          {cases.map((c, i) => (
            <Reveal
              key={c.label}
              delay={i * 40}
              variant="scale"
              as="span"
              className="inline-block bg-white border border-gray-200 rounded-full px-5 py-2.5 text-[14px] font-semibold shadow-sm"
            >
              <span style={{ color: c.color }}>{c.label}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default UseCases;
