import { Sparkles, MessageSquare, Layers, Shield, type LucideIcon } from 'lucide-react';
import { Reveal } from './reveal';

type Pillar = {
  title: string;
  body: string;
  Icon: LucideIcon;
  color: string;
};

const pillars: Pillar[] = [
  {
    title: 'Chega de contratar no feeling',
    body: 'A análise cita a SUA cultura e a SUA vaga. Não é um score genérico de currículo.',
    Icon: Sparkles,
    color: '#0284C7',
  },
  {
    title: 'Scout card, não planilha',
    body: 'Pontuação por área, estilo card de jogador. A avaliação continua viva depois da contratação.',
    Icon: MessageSquare,
    color: '#0EA5E9',
  },
  {
    title: 'Uma linha do tempo por pessoa',
    body: 'Da candidatura à promoção, cada etapa, avaliação e meta fica registrada no mesmo lugar.',
    Icon: Layers,
    color: '#06B6D4',
  },
  {
    title: 'A pessoa também vê o caminho',
    body: 'O candidato acompanha em que etapa está. O colaborador vê pra onde está evoluindo.',
    Icon: Shield,
    color: '#38BDF8',
  },
];

export function Pillars() {
  return (
    <section id="produto" className="w-full py-20 md:py-28 px-5">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="font-satoshi font-bold text-[32px] md:text-[48px] leading-[1.1] tracking-[-0.6px] text-ink max-w-3xl mx-auto">
          O que muda quando a Noren entra
        </h2>
        <p className="mt-5 text-[17px] md:text-[19px] text-ink-muted leading-[1.5] max-w-2xl mx-auto font-medium">
          ATS clássico cuida da vaga e para na contratação. A Noren cuida do
          ciclo inteiro: análise com o seu contexto, processo que anda com um
          clique e evolução registrada depois que a pessoa entra.
        </p>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          {pillars.map((p, i) => (
            <Reveal
              key={p.title}
              delay={i * 80}
              className="bg-white rounded-card border border-line-soft p-7 hover:shadow-md transition-shadow"
            >
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center mb-5"
                style={{ backgroundColor: `${p.color}14` }}
              >
                <p.Icon className="h-5 w-5" style={{ color: p.color }} strokeWidth={2.2} />
              </div>
              <h3 className="font-satoshi font-bold text-[20px] text-ink">{p.title}</h3>
              <p className="mt-2 text-callout text-ink-muted leading-[1.5]">{p.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Pillars;
