// Roteiro da entrevista, usado AO VIVO durante a conversa.
//
// A etapa de entrevista era a unica sem fonte de dado no produto: o que
// acontecia na conversa ficava na cabeca de quem entrevistou, entao a trilha do
// candidato mostrava "entrevista ainda nao avaliada" e nao havia como comparar
// duas entrevistas.
//
// Tudo aqui e desenhado pra ser usado com uma pessoa do outro lado da tela:
// salva sozinho enquanto digita, nao tem botao de enviar (esquecer de clicar
// custaria a entrevista inteira) e nao tem passo a passo, porque conversa nao
// segue ordem e o entrevistador precisa pular pra pergunta que a pessoa acabou
// de puxar sozinha.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type InterviewQuestion = {
  id: string;
  position: number;
  kind: string;
  question: string;
  followups: string[] | null;
  area: string | null;
  guidance: string | null;
};

const AREA_LABEL: Record<string, string> = {
  cultura: 'Cultura',
  execucao: 'Execução',
  comunicacao: 'Comunicação',
  raciocinio: 'Raciocínio',
  motivacao: 'Motivação',
  potencial: 'Potencial',
};

// Espera curta o suficiente pra nao perder anotacao se a aba fechar, longa o
// bastante pra nao mandar uma escrita por tecla digitada.
const AUTOSAVE_MS = 1200;

export function InterviewGuide({
  applicationId,
  companyId,
}: {
  applicationId: string;
  companyId: string;
}) {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const timers = useRef<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    async function load() {
      const [{ data: qs }, { data: ns }] = await Promise.all([
        supabase
          .from('interview_questions')
          .select('id, position, kind, question, followups, area, guidance')
          .eq('company_id', companyId)
          .order('position'),
        supabase
          .from('interview_notes')
          .select('question_id, note')
          .eq('application_id', applicationId),
      ]);
      if (!alive) return;
      setQuestions((qs ?? []) as InterviewQuestion[]);
      const map: Record<string, string> = {};
      for (const n of ns ?? []) {
        if (n.question_id) map[n.question_id] = n.note ?? '';
      }
      setNotes(map);
      setLoading(false);
    }
    void load();
    return () => {
      alive = false;
    };
  }, [applicationId, companyId]);

  // Limpa timers pendentes na desmontagem, senao trocar de candidato no meio da
  // digitacao gravaria a anotacao na candidatura errada.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      Object.values(pending).forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const persist = useCallback(
    async (q: InterviewQuestion, value: string) => {
      setSaving((prev) => ({ ...prev, [q.id]: true }));
      const { error } = await supabase.from('interview_notes').upsert(
        {
          application_id: applicationId,
          company_id: companyId,
          question_id: q.id,
          question_snapshot: q.question,
          area: q.area,
          note: value,
        },
        { onConflict: 'application_id,question_id' },
      );
      setSaving((prev) => ({ ...prev, [q.id]: false }));
      if (!error) setSavedAt((prev) => ({ ...prev, [q.id]: Date.now() }));
    },
    [applicationId, companyId],
  );

  function onChange(q: InterviewQuestion, value: string) {
    setNotes((prev) => ({ ...prev, [q.id]: value }));
    window.clearTimeout(timers.current[q.id]);
    timers.current[q.id] = window.setTimeout(() => void persist(q, value), AUTOSAVE_MS);
  }

  function onBlur(q: InterviewQuestion) {
    window.clearTimeout(timers.current[q.id]);
    void persist(q, notes[q.id] ?? '');
  }

  if (loading) {
    return <p className="text-caption text-ink-subtle">Carregando roteiro...</p>;
  }
  if (questions.length === 0) {
    return (
      <p className="text-caption text-ink-muted">
        Nenhum roteiro configurado ainda para esta empresa.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {questions.map((q, i) => {
        const isMoment = q.kind === 'momento';
        const followups = Array.isArray(q.followups) ? q.followups : [];
        return (
          <div
            key={q.id}
            className={cn(
              'rounded-tile border px-4 py-3.5',
              isMoment ? 'border-line-soft bg-canvas' : 'border-line-soft bg-surface',
            )}
          >
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-eyebrow font-bold uppercase text-ink-subtle">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                className={cn(
                  'flex-1 text-callout leading-snug',
                  isMoment ? 'font-medium text-ink-muted' : 'font-semibold text-ink',
                )}
              >
                {q.question}
              </span>
              {q.area && (
                <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-eyebrow font-bold uppercase text-ink-subtle">
                  {AREA_LABEL[q.area] ?? q.area}
                </span>
              )}
            </div>

            {followups.length > 0 && (
              <ul className="mb-2 flex flex-col gap-0.5">
                {followups.map((f) => (
                  <li key={f} className="text-footnote text-ink-muted">
                    ↳ {f}
                  </li>
                ))}
              </ul>
            )}

            {q.guidance && (
              <p className="mb-2.5 text-caption leading-snug text-ink-subtle">{q.guidance}</p>
            )}

            {/* Momento nao tem campo: e batida de conversa, nao pergunta. Campo
                vazio ali faria o entrevistador achar que esqueceu de preencher. */}
            {!isMoment && (
              <>
                <Textarea
                  value={notes[q.id] ?? ''}
                  onChange={(e) => onChange(q, e.target.value)}
                  onBlur={() => onBlur(q)}
                  placeholder="O que ela respondeu. Escreve solto, dá pra arrumar depois."
                  rows={3}
                  className="rounded-tile border-line-soft text-footnote leading-relaxed"
                />
                <div className="mt-1 flex h-4 items-center gap-1 text-caption text-ink-subtle">
                  {saving[q.id] ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      salvando
                    </>
                  ) : savedAt[q.id] ? (
                    <>
                      <Check className="h-3 w-3 text-positive" aria-hidden />
                      salvo
                    </>
                  ) : null}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
