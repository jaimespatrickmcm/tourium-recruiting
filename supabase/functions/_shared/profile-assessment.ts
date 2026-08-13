// ATENÇÃO: arquivo duplicado em src/lib e supabase/functions/_shared. Editar os dois juntos.
//
// Módulo de dados + pontuação do teste de perfil comportamental da Noren.
// Conteúdo transcrito verbatim da planilha "Análise de Perfil" (Simples! Gestão):
// - DISC: 26 questões, ranking 1-4 por opção (aba Questionário / Análise de Respostas DISC)
// - Big Five: 44 itens Likert 1-5 (aba Análise de Respostas BigFive)
// - Grit: 10 itens Likert 1-5 (aba Análise de Respostas GRIT)
// TypeScript puro: sem imports, sem APIs de browser/Deno. Compartilhado entre front e Edge Functions.

export type AssessmentMethod = 'disc' | 'bigfive' | 'grit';

export type DiscProfileKey = 'executor' | 'comunicador' | 'planejador' | 'analista';

export type BigFiveDimension =
  | 'abertura'
  | 'conscienciosidade'
  | 'extroversao'
  | 'amabilidade'
  | 'estabilidade';

export const METHOD_INFO: Record<
  AssessmentMethod,
  { label: string; shortDescription: string; questionCount: number; minutes: string }
> = {
  disc: {
    label: 'DISC',
    shortDescription:
      'Mapeia seu estilo de comportamento no dia a dia em 4 perfis. Em cada pergunta, você ordena as opções da que mais tem a ver com você até a que menos tem.',
    questionCount: 26,
    minutes: 'uns 8 minutos',
  },
  bigfive: {
    label: 'Big Five',
    shortDescription:
      'Olha pra 5 traços da sua personalidade, como organização, sociabilidade e abertura pra coisas novas. É só dizer o quanto concorda com cada frase.',
    questionCount: 44,
    minutes: 'uns 5 minutos',
  },
  grit: {
    label: 'Garra (Grit)',
    shortDescription:
      'Mede sua persistência e paixão por objetivos de longo prazo. São poucas frases pra você dizer o quanto cada uma parece com você.',
    questionCount: 10,
    minutes: 'uns 2 minutos',
  },
};

// 26 questões DISC, verbatim da planilha. Opções na ordem A, B, C, D.
// Mapeamento de perfil por opção conforme a aba "Análise de Respostas DISC"
// (e = executor, c = comunicador, p = planejador, a = analista).
export const DISC_QUESTIONS: {
  question: string;
  options: { text: string; profile: DiscProfileKey }[];
}[] = [
  {
    question:
      'Em um restaurante. Estou esperando uma mesa e o garçom me diz que em 10 minutos terei uma mesa, porém passam 20 minutos:',
    options: [
      {
        text: 'Me aborreço e digo ao garçom que já se passou o dobro do tempo, e lhe informo que se demorar muito irei embora e eles perderão um cliente',
        profile: 'executor',
      },
      { text: 'Não me dou conta pois estou envolvido em uma conversa.', profile: 'comunicador' },
      {
        text: 'Não me fixo ao tempo, ainda que eu saiba do atraso, não falo nada.',
        profile: 'planejador',
      },
      {
        text: 'Informo ao Garçom exatamente a hora que cheguei e exatamente o tempo que passou e peço que por favor me diga com exatidão quanto tempo ainda falta para que eu possa tomar uma decisão.',
        profile: 'analista',
      },
    ],
  },
  {
    question: 'Tenho muita fome e pressa. O garçom me traz um prato que eu não pedi:',
    options: [
      { text: 'Digo de maneira direta que este não foi o prato que pedi.', profile: 'analista' },
      {
        text: 'Chamo o garçom e converso com ele explicando que este não era o prato que eu havia pedido.',
        profile: 'comunicador',
      },
      { text: 'Fico calado e aceito o prato que me trouxeram.', profile: 'planejador' },
      {
        text: 'Me incomodo e pergunto ao garçom de uma forma aborrecida se ele estava prestando atenção quando fiz meu pedido?',
        profile: 'executor',
      },
    ],
  },
  {
    question: 'Em uma reunião de amigos:',
    options: [
      {
        text: 'Eu gosto de convencer aos demais de minhas opiniões e gosto de falar sobre temas relacionados com meu trabalho.',
        profile: 'executor',
      },
      {
        text: 'Escuto as pessoas. As pessoas me procuram pois sou um excelente ouvinte. Escuto as pessoas com atenção.',
        profile: 'planejador',
      },
      {
        text: 'Falo muito e conto bastante piadas. Geralmente falo mais do que escuto.',
        profile: 'comunicador',
      },
      {
        text: 'Observo e analiso as pessoas, porém dou minha opinião. Todavia só dou minha opinião quando conheço o tema e quando o faço sou preciso.',
        profile: 'analista',
      },
    ],
  },
  {
    question: 'Meus companheiros de trabalho me descrevem como alguém:',
    options: [
      { text: 'Tranquilo, Paciente, Amável.', profile: 'planejador' },
      { text: 'Social, Alegre, Gosta de Conversar.', profile: 'comunicador' },
      { text: 'Enérgico, Forte, Agressivo.', profile: 'executor' },
      { text: 'Concreto, Disciplinado, Metódico.', profile: 'analista' },
    ],
  },
  {
    question: 'Em uma discussão:',
    options: [
      {
        text: 'Trato de dizer que não é para tanto, pois discutir me aborrece.',
        profile: 'comunicador',
      },
      {
        text: 'Busco ter a razão e não paro até que consiga. Gosto de discutir.',
        profile: 'executor',
      },
      {
        text: 'Odeio agressões, concordo com o que esta sendo dito para não precisar argumentar.',
        profile: 'planejador',
      },
      {
        text: 'Me baseio nos fatos e busco comprovar meu ponto de vista de uma forma fundamentada e também espero que os demais hajam assim.',
        profile: 'analista',
      },
    ],
  },
  {
    question: 'O que realmente me emociona na vida:',
    options: [
      { text: 'Os desafios, As novidades, Arriscar.', profile: 'executor' },
      { text: 'As surpresas, A diversão, O jogo.', profile: 'comunicador' },
      { text: 'A doçura, O carinho, Aceitação', profile: 'planejador' },
      { text: 'Aprender, Sabedoria, Conhecimento', profile: 'analista' },
    ],
  },
  {
    question: 'Se alguém me agride:',
    options: [
      { text: 'Fico calado e não demonstro o que sinto.', profile: 'planejador' },
      {
        text: 'Escapo da situação ou pergunto a outra pessoa se ela é louca.',
        profile: 'comunicador',
      },
      {
        text: 'Devolvo a agressão pois necessito demonstrar minha insatisfação de imediato. Da mesma forma que me incomodo rapidamente me tranquilizo.',
        profile: 'executor',
      },
      {
        text: 'Me angustio, me privo e me resguardo, porém tento descobrir por que isso aconteceu. Demora algum tempo para que passe minha insatisfação com o acontecido.',
        profile: 'analista',
      },
    ],
  },
  {
    question: 'Quando vou as compras',
    options: [
      { text: 'Busco ofertas, os descontos me fascinam.', profile: 'executor' },
      {
        text: 'Me divirto indo as compras. Gosto de comprar presentes, dizem que sou um comprador compulsivo.',
        profile: 'comunicador',
      },
      {
        text: 'Sei o que quero e não gasto meu dinheiro se não encontro. Sou muito definido.',
        profile: 'analista',
      },
      { text: 'Sou indeciso, me dá muito trabalho decidir e escolher.', profile: 'planejador' },
    ],
  },
  {
    question: 'Que frase te descreve melhor:',
    options: [
      {
        text: 'Sou tranquilo e passivo, gosto das pessoas que são fáceis de conviver e que não me agridam. As pessoas me perguntam se nunca me aborreço.',
        profile: 'planejador',
      },
      {
        text: 'Sou alegre e jovial. Se vejo alguém triste procuro levar alegria a está pessoa. As pessoas me perguntam se nunca me deprimo.',
        profile: 'comunicador',
      },
      {
        text: 'Sou ativo e enérgico, gosto de fazer várias coisas ao mesmo tempo, as pessoas perguntam se não me canso.',
        profile: 'executor',
      },
      {
        text: 'Sou analítico e observador, gosto de resolver problemas que me exijam pensar e de encontrar soluções. As pessoas me dizem que sou muito responsável e apreensivo.',
        profile: 'analista',
      },
    ],
  },
  {
    question: 'Quando estou trabalhando em equipe sou:',
    options: [
      {
        text: 'O que organiza a parte estratégica com finalidade de conseguir uma maior probabilidade de êxito.',
        profile: 'analista',
      },
      {
        text: 'O que anima o ambiente fazendo com que todos tenham vontade.',
        profile: 'comunicador',
      },
      { text: 'O que manda e organiza.', profile: 'executor' },
      { text: 'O que apóia com propósito de se ter uma equipe unida.', profile: 'planejador' },
    ],
  },
  {
    question: 'Meus irmãos e as pessoas que me rodeiam , dizem que meus piores defeitos são:',
    options: [
      { text: 'Ser teimoso e quadrado', profile: 'analista' },
      { text: 'Ser agressivo e temperamental.', profile: 'executor' },
      { text: 'Ser submisso e lento.', profile: 'planejador' },
      { text: 'Ser distraído e desorganizado.', profile: 'comunicador' },
    ],
  },
  {
    question: 'Alguma de minhas qualidades são:',
    options: [
      { text: 'Ser Determinado e seguro.', profile: 'executor' },
      { text: 'Ser Adaptado e pacífico.', profile: 'planejador' },
      { text: 'Ser Otimista e alegre.', profile: 'comunicador' },
      { text: 'Ser Cumpridor e estável', profile: 'analista' },
    ],
  },
  {
    question: 'Estou caminhando e esbarro com algum desconhecido:',
    options: [
      { text: 'Dou um passo ao lado e sem falar sigo meu caminho.', profile: 'analista' },
      { text: 'Dou um sorriso e sigo em frente.', profile: 'comunicador' },
      {
        text: 'Espero que a pessoa saia do meu caminho para poder seguir adiante.',
        profile: 'executor',
      },
      { text: 'Peço que me desculpe e sigo em frente.', profile: 'planejador' },
    ],
  },
  {
    question: 'No trabalho me sobressaio em:',
    options: [
      { text: 'Na tomada de decisões rapidamente.', profile: 'executor' },
      { text: 'Nas relações públicas', profile: 'comunicador' },
      { text: 'Na capacidade de me adaptar a equipes', profile: 'planejador' },
      { text: 'Na segurança de ter qualidade e pontualidade.', profile: 'analista' },
    ],
  },
  {
    question: 'Meus defeitos no trabalho são:',
    options: [
      { text: 'Não gosto de delegar, prefiro trabalhar sozinho.', profile: 'analista' },
      { text: 'Não gosto que me digam o que fazer.', profile: 'executor' },
      { text: 'Trabalho mais sobre baixa pressão.', profile: 'planejador' },
      { text: 'Desordenado e esquecido e as vezes impontual.', profile: 'comunicador' },
    ],
  },
  {
    question: 'Minha mãe diz que quando criança eu era:',
    options: [
      { text: 'Obediente e tranquilo.', profile: 'planejador' },
      { text: 'Mandão e exigente.', profile: 'executor' },
      { text: 'Alegre e conversava com todo mundo.', profile: 'comunicador' },
      { text: 'Bem arrumado e eu não gostava de me sujar.', profile: 'analista' },
    ],
  },
  {
    question: 'Ao me expressar:',
    options: [
      { text: 'Falo as coisas de maneira diplomática.', profile: 'analista' },
      { text: 'Quase não expresso o que sinto.', profile: 'planejador' },
      { text: 'Falo de maneira indireta para não magoar.', profile: 'comunicador' },
      { text: 'Falo as coisas como são.', profile: 'executor' },
    ],
  },
  {
    question: 'A emoção que demonstro com mais frequência é:',
    options: [
      { text: 'Medo.', profile: 'analista' },
      { text: 'Otimismo', profile: 'comunicador' },
      { text: 'Não demonstro emoção.', profile: 'planejador' },
      { text: 'Irritação.', profile: 'executor' },
    ],
  },
  {
    question: 'Os professores me reconheciam por que:',
    options: [
      {
        text: 'Discutia muito e gostava de demonstrar tudo que eu sabia.',
        profile: 'executor',
      },
      { text: 'Bom estudante e bastante analítico.', profile: 'analista' },
      { text: 'Não interrompia e ficava calado.', profile: 'planejador' },
      { text: 'Era muito amigável e gostava de conversar.', profile: 'comunicador' },
    ],
  },
  {
    question: 'Características que mais te descrevem:',
    options: [
      { text: 'Auto-suficiente e ambicioso.', profile: 'executor' },
      { text: 'Preciso e exato.', profile: 'analista' },
      { text: 'Cooperativo e adaptável.', profile: 'planejador' },
      { text: 'Despreocupado e popular.', profile: 'comunicador' },
    ],
  },
  {
    question: 'Características que mais te descrevem:',
    options: [
      { text: 'Reservado e educado.', profile: 'analista' },
      { text: 'Amigo e conversador.', profile: 'comunicador' },
      { text: 'Tolerante e flexível.', profile: 'planejador' },
      { text: 'Valente e ousado.', profile: 'executor' },
    ],
  },
  {
    question: 'Características que mais te descrevem:',
    options: [
      { text: 'Obstinado, determinação para me defender.', profile: 'executor' },
      { text: 'Confiante, acredito nas pessoas.', profile: 'comunicador' },
      { text: 'Prudente, gosto de refletir bem sobre as coisas.', profile: 'analista' },
      { text: 'Pronto a servir, gosto de ajudar aos demais.', profile: 'planejador' },
    ],
  },
  {
    question: 'Características que mais te descrevem:',
    options: [
      { text: 'Brincalhão, chama a atenção das pessoas.', profile: 'comunicador' },
      { text: 'Empreendedor, força de vontade.', profile: 'executor' },
      { text: 'Generoso, se adapta aos demais.', profile: 'planejador' },
      { text: 'Cuidadoso, cautela ao tomar decisões.', profile: 'analista' },
    ],
  },
  {
    question: 'Características que mais te descrevem:',
    options: [
      { text: 'Calmo, faz o que te pedem.', profile: 'planejador' },
      { text: 'Envolvente, motiva aos demais.', profile: 'comunicador' },
      { text: 'Atrevido, crê em si próprio.', profile: 'executor' },
      { text: 'Disciplinado, organizado e limpo.', profile: 'analista' },
    ],
  },
  {
    question: 'Características que mais te descrevem:',
    options: [
      { text: 'Culto, busca ter conhecimento.', profile: 'analista' },
      { text: 'Animado, alma da festa.', profile: 'comunicador' },
      { text: 'Harmonioso, aberto a sugestões.', profile: 'planejador' },
      { text: 'Confrontante, gosta de argumentar.', profile: 'executor' },
    ],
  },
  {
    question: 'Características que mais te descrevem:',
    options: [
      { text: 'Humilde, compassivo (condolente) com as pessoas.', profile: 'planejador' },
      { text: 'Carismático, atrai as pessoas, desinibido.', profile: 'comunicador' },
      { text: 'Tem atitude, persuasivo, convincente.', profile: 'executor' },
      { text: 'Sistemático, cético, precavido.', profile: 'analista' },
    ],
  },
];

// 44 itens Big Five (BFI), verbatim da aba "Análise de Respostas BigFive".
// reversed = true nos itens marcados com "6" na coluna Calculo Perfil da planilha
// (itens 2, 4, 6, 8, 12, 14, 18, 19, 21, 23, 27, 29, 31, 35, 37, 39, 41, 43; 1-indexados).
export const BIGFIVE_ITEMS: { text: string; dimension: BigFiveDimension; reversed: boolean }[] = [
  { text: 'É conversador, comunicativo', dimension: 'extroversao', reversed: false },
  { text: 'Tende a ser crítico com os outros', dimension: 'amabilidade', reversed: true },
  { text: 'É minucioso e detalhista no trabalho', dimension: 'conscienciosidade', reversed: false },
  { text: 'É depressivo, triste', dimension: 'estabilidade', reversed: true },
  { text: 'É original, tem sempre novas ideias', dimension: 'abertura', reversed: false },
  { text: 'É reservado', dimension: 'extroversao', reversed: true },
  { text: 'É prestativo e ajuda os outros', dimension: 'amabilidade', reversed: false },
  { text: 'Pode ser um tanto descuidado', dimension: 'conscienciosidade', reversed: true },
  { text: 'É relaxado, controla bem o stress', dimension: 'estabilidade', reversed: false },
  { text: 'É curioso sobre muitas coisas diferentes', dimension: 'abertura', reversed: false },
  { text: 'É cheio de energia', dimension: 'extroversao', reversed: false },
  {
    text: 'Começa discussões, disputas, com os outros',
    dimension: 'amabilidade',
    reversed: true,
  },
  { text: 'É um trabalhador de confiança', dimension: 'conscienciosidade', reversed: false },
  { text: 'Fica tenso com frequência', dimension: 'estabilidade', reversed: true },
  {
    text: 'É engenhoso, alguém que gosta de analisar profundamente as coisas',
    dimension: 'abertura',
    reversed: false,
  },
  { text: 'Gera muito entusiasmo', dimension: 'extroversao', reversed: false },
  {
    text: 'Tem capacidade de perdoar, perdoa facilmente',
    dimension: 'amabilidade',
    reversed: false,
  },
  { text: 'Tende a ser desorganizado', dimension: 'conscienciosidade', reversed: true },
  { text: 'Preocupa-se muito com tudo', dimension: 'estabilidade', reversed: true },
  { text: 'Tem uma imaginação fértil', dimension: 'abertura', reversed: false },
  { text: 'Tende a ser quieto, calado', dimension: 'extroversao', reversed: true },
  { text: 'É geralmente confiável', dimension: 'amabilidade', reversed: false },
  { text: 'Tende a ser preguiçoso', dimension: 'conscienciosidade', reversed: true },
  {
    text: 'É emocionalmente estável, não se altera facilmente',
    dimension: 'estabilidade',
    reversed: false,
  },
  { text: 'É inventivo, criativo', dimension: 'abertura', reversed: false },
  {
    text: 'É assertivo, não teme expressar o que sente',
    dimension: 'extroversao',
    reversed: false,
  },
  { text: 'Às vezes é frio e distante', dimension: 'amabilidade', reversed: true },
  {
    text: 'Insiste até concluir a tarefa ou o trabalho',
    dimension: 'conscienciosidade',
    reversed: false,
  },
  {
    text: 'É temperamental, muda de humor facilmente',
    dimension: 'estabilidade',
    reversed: true,
  },
  { text: 'Valoriza o artístico, o estético', dimension: 'abertura', reversed: false },
  { text: 'É, às vezes, tímido e inibido', dimension: 'extroversao', reversed: true },
  {
    text: 'É amável, tem consideração pelos outros',
    dimension: 'amabilidade',
    reversed: false,
  },
  { text: 'Faz as coisas com eficiência', dimension: 'conscienciosidade', reversed: false },
  {
    text: 'Mantém-se calmo nas situações de tensão',
    dimension: 'estabilidade',
    reversed: false,
  },
  { text: 'Prefere trabalho rotineiro', dimension: 'abertura', reversed: true },
  { text: 'É sociável, extrovertido', dimension: 'extroversao', reversed: false },
  {
    text: 'É, às vezes, rude (grosseiro) com os outros',
    dimension: 'amabilidade',
    reversed: true,
  },
  { text: 'Faz planos e segue-os à risca', dimension: 'conscienciosidade', reversed: false },
  { text: 'Fica nervoso facilmente', dimension: 'estabilidade', reversed: true },
  { text: 'Gosta de refletir, brincar com as ideias', dimension: 'abertura', reversed: false },
  { text: 'Tem poucos interesses artísticos', dimension: 'abertura', reversed: true },
  { text: 'Gosta de cooperar com os outros', dimension: 'amabilidade', reversed: false },
  { text: 'É facilmente distraído', dimension: 'conscienciosidade', reversed: true },
  {
    text: 'É sofisticado em artes, música ou literatura',
    dimension: 'abertura',
    reversed: false,
  },
];

// 10 itens Grit, verbatim da aba "Análise de Respostas GRIT".
// NOTA sobre reversão: a planilha original NÃO marca nenhum item do Grit como reverso
// (soma direta das respostas). Decisão de produto da Noren: corrigir a pontuação seguindo
// a Grit Scale original da Angela Duckworth, em que os itens de consistência de interesse
// (ímpares: 1, 3, 5, 7, 9) são pontuados de forma reversa. Sem isso, frases como
// "Novas idéias e projetos às vezes me distraem dos anteriores" somariam a favor da garra,
// o que inverte o sentido da escala.
export const GRIT_ITEMS: { text: string; reversed: boolean }[] = [
  { text: 'Novas idéias e projetos às vezes me distraem dos anteriores.', reversed: true },
  { text: 'Os contratempos não me desanimam. Eu não desisto facilmente.', reversed: false },
  { text: 'Costumo definir uma meta, mas depois escolho buscar outra.', reversed: true },
  { text: 'Sou um trabalhador esforçado.', reversed: false },
  {
    text: 'Tenho dificuldade em manter meu foco em projetos que levam mais do que alguns meses para serem concluídos.',
    reversed: true,
  },
  { text: 'Eu termino tudo o que começo.', reversed: false },
  { text: 'Meus interesses mudam de ano para ano.', reversed: true },
  { text: 'Eu sou diligente. Eu nunca desisto.', reversed: false },
  {
    text: 'Estou obcecado por uma certa ideia ou projeto há pouco tempo, mas depois perdi o interesse.',
    reversed: true,
  },
  { text: 'Superei contratempos para vencer um desafio importante.', reversed: false },
];

export const LIKERT_LABELS: string[] = [
  'Discordo totalmente',
  'Discordo',
  'Neutro',
  'Concordo',
  'Concordo totalmente',
];

// Conteúdo por perfil DISC, verbatim da planilha:
// headline = "Frase" da ficha técnica de cada perfil;
// description = linha DESCRIÇÃO do quadro comparativo;
// forcas = "Vantagens ou Forças" ou "VALOR NA EQUIPE" (o quadro mais completo de cada perfil);
// sobPressao = linha SOB PRESSÃO; ambienteIdeal = linha AMBIENTE IDEAL.
export const DISC_PROFILE_CONTENT: Record<
  DiscProfileKey,
  {
    name: string;
    sigla: string;
    disc: string;
    headline: string;
    description: string[];
    forcas: string[];
    sobPressao: string[];
    ambienteIdeal: string[];
  }
> = {
  executor: {
    name: 'Executor',
    sigla: 'E',
    disc: 'D',
    headline: 'Fazer e impulsionar o mundo',
    description: [
      'Aventureiro',
      'Competitivo',
      'Ousado',
      'Decidido',
      'Direto',
      'Inovador',
      'Persistente',
      'Resolve problemas',
      'Foco nos resultados',
      'Com iniciativa',
    ],
    forcas: [
      'Coordenador',
      'Previdente',
      'Voltado para o desafio',
      'Tem iniciativa',
      'Inovador',
    ],
    sobPressao: ['Exigente', 'Nervoso', 'Agressivo', 'Egoísta'],
    ambienteIdeal: [
      'Livre de controle, supervisão e detalhes',
      'Um ambiente inovador e direcionado para o futuro',
      'Debate para expressar idéias e pontos de vista',
      'Um trabalho que não seja rotineiro',
      'Trabalho com desafios e oportunidades',
    ],
  },
  comunicador: {
    name: 'Comunicador',
    sigla: 'C',
    disc: 'I',
    headline: 'A inspiração e a alegria do mundo',
    description: [
      'Encantador',
      'Confidente',
      'Convincente',
      'Entusiasta',
      'Inspirador',
      'Otimista',
      'Persuasivo',
      'Popular',
      'Sociável',
      'Confiante',
    ],
    forcas: [
      'Brincalhão e Divertido - Busca alegria em tudo que faz.',
      'Otimista - Energia positiva. Vê o lado positivo de tudo até das piores situações.',
      'Entusiasta - Dificilmente se deprime. Não dão tanta seriedade as coisas.',
      'Despreocupado - "Para que se preocupar? De todas as formas tudo vai dar certo."',
      'Efusivo - Gritam, saltam, esperneiam e aplaudem quando ganham um prêmio.',
    ],
    sobPressao: ['Se auto-promove', 'Muito otimista', 'Falante', 'Pouco realista'],
    ambienteIdeal: [
      'Contato constante com as pessoas',
      'Livre de controle e detalhes',
      'Liberdade de movimento',
      'Debate para ouvir idéias',
      'Supervisor democrático com o quem se associar',
    ],
  },
  planejador: {
    name: 'Planejador',
    sigla: 'P',
    disc: 'S',
    headline: 'A paz e a tranquilidade do mundo',
    description: [
      'Amável',
      'Amigável',
      'Sabe escutar',
      'Paciente',
      'Descontraído',
      'Sincero',
      'Estável',
      'Consciente',
      'Jogador de equipe',
      'Compreensivo',
    ],
    forcas: [
      'Joga em equipe',
      'Trabalha para um líder e por uma causa',
      'Paciente e enérgico',
      'Lógico, analisa',
      'Orientado para o serviço',
    ],
    sobPressao: ['Reservado', 'Despreocupado', 'Indeciso', 'Inflexível'],
    ambienteIdeal: [
      'Ambiente estável e previsível',
      'Ambiente que lhe permita mudar',
      'Relações de trabalho duradouras',
      'Pouco conflito entre as pessoas',
      'Liberdade de normas de restrição',
    ],
  },
  analista: {
    name: 'Analista',
    sigla: 'A',
    disc: 'C',
    headline: 'Estrategistas e filósofos da vida',
    description: [
      'Exato',
      'Analítico',
      'Consciente',
      'Cortês',
      'Diplomático',
      'Procura realizações',
      'Padrões altos',
      'Maduro',
      'Paciente',
      'Preciso',
    ],
    forcas: [
      'Mantém padrões altos',
      'Consciente e consistente',
      'Define, esclarece, obtém a informação e a põe à prova',
      'Objetivo "estar ancorado na realidade"',
      'Compreensivo, resolve problemas',
    ],
    sobPressao: ['Pessimista', 'Difícil de agradar', 'Meticuloso', 'Muito crítico'],
    ambienteIdeal: [
      'Onde é necessário pensamento crítico',
      'Cargo técnico ou em uma área especializada',
      'Relação estreita com um grupo pequeno',
      'Ambiente de trabalho familiar',
      'Escritório ou área de trabalho privada',
    ],
  },
};

// Polos de cada fator, do quadro "FATORES DO MÉTODO BIGFIVE" da planilha.
export const BIGFIVE_DIMENSION_INFO: Record<
  BigFiveDimension,
  { label: string; high: string; low: string }
> = {
  abertura: {
    label: 'Abertura a experiências',
    high: 'Criativo, curioso, sensível artisticamente, independente, imaginativo',
    low: 'Convencional, conservador, prefere coisas familiares, conformista',
  },
  conscienciosidade: {
    label: 'Conscienciosidade',
    high: 'Responsável, organizado, confiável, persistente, cuidadoso, disciplinado',
    low: 'Distraído, desorganizado, pouco confiável, descuidado',
  },
  extroversao: {
    label: 'Extroversão',
    high: 'Agregador, assertivo, sociável, falador, expansivo',
    low: 'Reservado, tímido, quieto, sóbrio',
  },
  amabilidade: {
    label: 'Amabilidade',
    high: 'Cooperativo, receptivo, confiável, solidário, gentil, grato',
    low: 'Frio, desagradável, confrontador, crítico, não amistoso',
  },
  estabilidade: {
    label: 'Estabilidade emocional',
    high: 'Calmo, autoconfiante, seguro, estável',
    low: 'Nervoso, ansioso, deprimido, inseguro, tenso',
  },
};

// Respostas DISC: 26 sub-arrays de 4 números, um por opção (A, B, C, D), cada sub-array
// é uma permutação de {1,2,3,4} (4 = mais se identifica, 1 = menos se identifica).
export type DiscAnswers = number[][];

// Respostas Likert: array de inteiros de 1 a 5, na ordem dos itens.
export type LikertAnswers = number[];

export type DiscResult = {
  points: Record<DiscProfileKey, number>;
  percents: Record<DiscProfileKey, number>;
  primary: DiscProfileKey;
  pair: [DiscProfileKey, DiscProfileKey];
};

export type BigFiveResult = {
  means: Record<BigFiveDimension, number>;
};

export type GritResult = {
  total: number;
  index: number;
  garraPct: number;
};

const DISC_PROFILE_ORDER: DiscProfileKey[] = ['executor', 'comunicador', 'planejador', 'analista'];

// Total máximo de pontos DISC: 26 questões x (1+2+3+4) = 260.
const DISC_TOTAL_POINTS = 260;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function validateDiscAnswers(a: unknown): a is DiscAnswers {
  if (!Array.isArray(a) || a.length !== DISC_QUESTIONS.length) return false;
  for (const row of a) {
    if (!Array.isArray(row) || row.length !== 4) return false;
    const sorted = row
      .map((v) => (typeof v === 'number' ? v : NaN))
      .slice()
      .sort((x, y) => x - y);
    if (sorted[0] !== 1 || sorted[1] !== 2 || sorted[2] !== 3 || sorted[3] !== 4) return false;
  }
  return true;
}

export function validateLikertAnswers(a: unknown, count: number): a is LikertAnswers {
  if (!Array.isArray(a) || a.length !== count) return false;
  return a.every(
    (v) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5,
  );
}

// Soma o rank (1-4) que a pessoa deu a cada opção no perfil correspondente.
// percents = pontos / 260, em %, com 2 casas (ex.: 27.31).
// Desempate na ordenação: executor > comunicador > planejador > analista.
export function scoreDisc(a: DiscAnswers): DiscResult {
  const points: Record<DiscProfileKey, number> = {
    executor: 0,
    comunicador: 0,
    planejador: 0,
    analista: 0,
  };

  for (let q = 0; q < DISC_QUESTIONS.length; q++) {
    const options = DISC_QUESTIONS[q].options;
    for (let o = 0; o < options.length; o++) {
      points[options[o].profile] += a[q][o];
    }
  }

  const percents: Record<DiscProfileKey, number> = {
    executor: round2((points.executor / DISC_TOTAL_POINTS) * 100),
    comunicador: round2((points.comunicador / DISC_TOTAL_POINTS) * 100),
    planejador: round2((points.planejador / DISC_TOTAL_POINTS) * 100),
    analista: round2((points.analista / DISC_TOTAL_POINTS) * 100),
  };

  const ranked = DISC_PROFILE_ORDER.slice().sort((x, y) => {
    if (points[y] !== points[x]) return points[y] - points[x];
    return DISC_PROFILE_ORDER.indexOf(x) - DISC_PROFILE_ORDER.indexOf(y);
  });

  return {
    points,
    percents,
    primary: ranked[0],
    pair: [ranked[0], ranked[1]],
  };
}

// Score do item = resposta, ou 6 - resposta se o item é reverso.
// means por dimensão = soma dos scores / quantidade de itens da dimensão (2 casas).
export function scoreBigFive(a: LikertAnswers): BigFiveResult {
  const sums: Record<BigFiveDimension, number> = {
    abertura: 0,
    conscienciosidade: 0,
    extroversao: 0,
    amabilidade: 0,
    estabilidade: 0,
  };
  const counts: Record<BigFiveDimension, number> = {
    abertura: 0,
    conscienciosidade: 0,
    extroversao: 0,
    amabilidade: 0,
    estabilidade: 0,
  };

  for (let i = 0; i < BIGFIVE_ITEMS.length; i++) {
    const item = BIGFIVE_ITEMS[i];
    const score = item.reversed ? 6 - a[i] : a[i];
    sums[item.dimension] += score;
    counts[item.dimension] += 1;
  }

  return {
    means: {
      abertura: round2(sums.abertura / counts.abertura),
      conscienciosidade: round2(sums.conscienciosidade / counts.conscienciosidade),
      extroversao: round2(sums.extroversao / counts.extroversao),
      amabilidade: round2(sums.amabilidade / counts.amabilidade),
      estabilidade: round2(sums.estabilidade / counts.estabilidade),
    },
  };
}

// Score do item = resposta, ou 6 - resposta se reverso. total = soma dos 10 scores.
// index = total / 10 (2 casas). garraPct segue a tabela de pisos da planilha
// (Indice GARRA -> % GARRA).
export function scoreGrit(a: LikertAnswers): GritResult {
  let total = 0;
  for (let i = 0; i < GRIT_ITEMS.length; i++) {
    total += GRIT_ITEMS[i].reversed ? 6 - a[i] : a[i];
  }

  const index = round2(total / GRIT_ITEMS.length);

  let garraPct: number;
  if (index >= 4.9) garraPct = 99;
  else if (index >= 4.7) garraPct = 95;
  else if (index >= 4.5) garraPct = 90;
  else if (index >= 4.3) garraPct = 80;
  else if (index >= 4.1) garraPct = 70;
  else if (index >= 3.9) garraPct = 60;
  else if (index >= 3.8) garraPct = 50;
  else if (index >= 3.5) garraPct = 40;
  else if (index >= 3.3) garraPct = 30;
  else if (index >= 3.0) garraPct = 20;
  else garraPct = 10;

  return { total, index, garraPct };
}
