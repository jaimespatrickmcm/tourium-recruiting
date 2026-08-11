import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    q: 'A IA decide por mim?',
    a: 'Não. Ela analisa cada candidato, pontua em 5 áreas e mostra o raciocínio por trás de cada nota. Avançar, entrevistar ou contratar é sempre decisão sua. A Noren tira o trabalho de triagem, não tira o seu julgamento.',
  },
  {
    q: 'Como a IA sabe o que minha empresa valoriza?',
    a: 'Pelo DNA que você configura no primeiro acesso. Você descreve cultura, valores e perfil ideal uma vez, e esse contexto entra em toda análise, do primeiro candidato ao plano de desenvolvimento de quem já está dentro.',
  },
  {
    q: 'O candidato vê a nota?',
    a: 'O candidato acompanha em que etapa do processo está. O scout card é do time. Depois da contratação, ele vira a ferramenta de evolução da própria pessoa, com metas e avaliações que ela acompanha.',
  },
  {
    q: 'Funciona pra empresa de que tamanho?',
    a: 'Feita pra times de 50 a 300 pessoas, mas funciona antes disso também. Se você contrata e avalia gente sem um RH estruturado, o produto foi pensado pro seu problema.',
  },
  {
    q: 'Quanto tempo leva pra configurar a empresa?',
    a: 'O DNA leva 15 a 20 minutos no primeiro acesso. São 7 perguntas abertas. Você pode pausar e voltar pelo magic link no email, sem perder progresso.',
  },
  {
    q: 'Posso editar o DNA depois?',
    a: 'Sim. Quando você edita, fica uma nova versão. Análises antigas mantêm a versão do DNA que estava ativa quando foram feitas, com badge "Analisado sob DNA v2". Re-análise com a versão nova é opcional e manual, pra você controlar o custo de IA.',
  },
  {
    q: 'O candidato pode trapacear respondendo com IA?',
    a: 'A IA da Noren tem detector de resposta gerada por IA em cada texto longo. A flag vai pra você junto com a nota, transparente. A gente não bloqueia o candidato sem ele saber, mas você vê e decide o peso disso na avaliação.',
  },
  {
    q: 'Custa quanto?',
    a: 'Durante a fase de design partners, gratuito. Pricing pós-v1 deve ficar em torno de R$ 499/mês + R$ 99 por vaga ativa, mas a gente ajusta conforme o custo real de operação. Sem cobrança por candidato analisado.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button
        className="w-full flex items-start justify-between gap-4 p-5 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="text-[15px] md:text-[16px] font-semibold text-[#1d1d1f] leading-[1.4] flex-grow">
          {q}
        </span>
        <span className="h-8 w-8 rounded-full bg-[#1d1d1f] flex items-center justify-center flex-shrink-0 mt-0.5">
          {open ? <Minus className="h-4 w-4 text-white" /> : <Plus className="h-4 w-4 text-white" />}
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 pr-16">
          <p className="text-[14px] md:text-[15px] text-[#6b6b70] leading-[1.6]">{a}</p>
        </div>
      )}
    </div>
  );
}

export function Faq() {
  return (
    <section id="faq" className="w-full py-20 md:py-28 px-5">
      <div className="max-w-3xl mx-auto">
        <h2 className="font-satoshi font-bold text-[32px] md:text-[48px] leading-[1.1] tracking-[-0.6px] text-center text-[#1d1d1f] mb-12">
          FAQ
        </h2>

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <FAQItem key={i} q={f.q} a={f.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Faq;
