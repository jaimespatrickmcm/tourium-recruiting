-- Resposta por áudio: a pessoa grava, a gente transcreve e o texto vai pro campo.
-- O áudio NÃO é guardado em lugar nenhum: voz identifica pessoa, e guardar
-- aumentaria a superfície de LGPD sem necessidade, já que o que é avaliado é a
-- transcrição.
--
-- Por que registrar o modo: a análise pontua "comunicação" por clareza e
-- estrutura da ESCRITA. Fala transcrita não tem pontuação, tem repetição e
-- recomeço. Sem saber que a resposta foi falada, quem grava levaria nota baixa
-- por não escrever bem um texto que nunca escreveu.
--
-- Efeito colateral conhecido, registrado aqui de propósito: o token canário
-- (texto invisível no enunciado, que aparece colado quando a pessoa joga a
-- pergunta numa IA) só pega quem copia e cola. Quem responde por áudio nunca
-- dispara o canário, nem quando lê em voz alta um texto gerado por IA. Áudio
-- aumenta o atrito pra usar IA, mas não é prova de que não usou, e o sistema
-- não deve tratar como prova.

alter table public.application_answers
  add column if not exists input_mode text not null default 'typed'
  check (input_mode in ('typed', 'audio'));

comment on column public.application_answers.input_mode is
  'Como a resposta foi produzida: typed (digitada) ou audio (falada e transcrita). A análise usa isso pra não cobrar estrutura de texto escrito de quem falou. O áudio em si nunca é armazenado.';
