// Descrição de vaga: parser de markdown leve + render.
// A descrição é gerada em seções ("## Título"), e o candidato lê cada uma
// separada. Aqui a gente quebra o texto em seções e renderiza negrito, bullets
// e parágrafos. Não vale trazer uma lib de markdown inteira pra isso.

import type { ReactNode } from 'react';

export type DescriptionSection = { title: string | null; body: string };

// Aceita "## Titulo" (formato atual) e "**Titulo**" sozinho na linha (formato
// antigo, das vagas criadas antes). Assim descrição velha também fica bonita.
function sectionTitle(line: string): string | null {
  const trimmed = line.trim();
  const heading = trimmed.match(/^#{1,3}\s+(.+?)\s*$/);
  if (heading) return heading[1].replace(/\*/g, '').trim();
  const boldOnly = trimmed.match(/^\*\*(.+?)\*\*:?$/);
  if (boldOnly) return boldOnly[1].trim();
  return null;
}

export function parseDescriptionSections(raw: string): DescriptionSection[] {
  const lines = (raw ?? '').replace(/\r\n/g, '\n').split('\n');
  const sections: DescriptionSection[] = [];
  let current: DescriptionSection = { title: null, body: '' };

  for (const line of lines) {
    const title = sectionTitle(line);
    if (title) {
      if (current.title || current.body.trim()) sections.push(current);
      current = { title, body: '' };
    } else {
      current.body += `${line}\n`;
    }
  }
  if (current.title || current.body.trim()) sections.push(current);

  return sections
    .map((s) => ({ title: s.title, body: s.body.trim() }))
    .filter((s) => s.title || s.body);
}

// Negrito inline (**assim**). Sem regex exótica: divide na marcação e alterna.
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((chunk, i) =>
    i % 2 === 1 ? (
      <strong key={`${keyPrefix}-b${i}`} className="font-semibold text-ink">
        {chunk}
      </strong>
    ) : (
      <span key={`${keyPrefix}-t${i}`}>{chunk}</span>
    ),
  );
}

// Corpo de uma seção: agrupa bullets em <ul> e o resto em parágrafos.
export function DescriptionBody({ body }: { body: string }) {
  const lines = body.split('\n');
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let paragraph: string[] = [];

  const flushBullets = (key: string) => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={key} className="space-y-2 my-3">
        {bullets.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-callout leading-[1.65] text-[#4a4a52]">
            <span className="mt-[9px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-400" />
            <span>{renderInline(item, `${key}-${i}`)}</span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  // Preserva a quebra de linha do original. Descrição escrita à mão costuma ter
  // um item por linha sem hífen; juntar tudo num parágrafo embola o texto.
  const flushParagraph = (key: string) => {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={key} className="my-3 text-callout leading-[1.7] text-[#4a4a52]">
        {paragraph.map((line, i) => (
          <span key={`${key}-l${i}`}>
            {i > 0 && <br />}
            {renderInline(line, `${key}-${i}`)}
          </span>
        ))}
      </p>,
    );
    paragraph = [];
  };

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) {
      flushBullets(`ul-${i}`);
      flushParagraph(`p-${i}`);
      return;
    }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      flushParagraph(`p-${i}`);
      bullets.push(bullet[1]);
    } else {
      flushBullets(`ul-${i}`);
      paragraph.push(line);
    }
  });
  flushBullets('ul-end');
  flushParagraph('p-end');

  return <>{blocks}</>;
}
