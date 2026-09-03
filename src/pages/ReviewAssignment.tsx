import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, ClipboardCheck, LoaderCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { Database, Json } from '@/types/database';

type Assignment = Pick<
  Database['public']['Tables']['review_assignments']['Row'],
  'id' | 'evaluator_user_id' | 'status' | 'submitted_at'
>;
type Review = Database['public']['Functions']['get_review_assignment_context']['Returns'][number];
type Dimension = Database['public']['Tables']['review_dimensions']['Row'];
type Response = Database['public']['Tables']['review_responses']['Row'];
type ResponseItem = Database['public']['Tables']['review_response_items']['Row'];
type Answer = { score: string; comment: string };

export function ReviewAssignment() {
  const [params] = useSearchParams();
  const assignmentId = params.get('assignment');
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [response, setResponse] = useState<Response | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [overallComment, setOverallComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!assignmentId || !user) {
      setError('Este convite não tem uma avaliação válida.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [assignmentResult, contextResult] = await Promise.all([
        supabase
          .from('review_assignments')
          .select('id, evaluator_user_id, status, submitted_at')
          .eq('id', assignmentId)
          .maybeSingle(),
        supabase
          .rpc('get_review_assignment_context', { target_assignment_id: assignmentId })
          .maybeSingle(),
      ]);
      if (assignmentResult.error) throw assignmentResult.error;
      if (contextResult.error) throw contextResult.error;
      if (!assignmentResult.data || assignmentResult.data.evaluator_user_id !== user.id) {
        throw new Error('Esta avaliação não está atribuída à sua conta.');
      }
      if (!contextResult.data) throw new Error('A avaliação não está mais disponível.');

      const currentAssignment = assignmentResult.data;
      const reviewContext = contextResult.data;
      const [dimensionsResult, responseResult] = await Promise.all([
        supabase.from('review_dimensions').select('*').eq('review_id', reviewContext.id).order('position'),
        supabase.from('review_responses').select('*').eq('assignment_id', currentAssignment.id).maybeSingle(),
      ]);
      if (dimensionsResult.error) throw dimensionsResult.error;
      if (responseResult.error) throw responseResult.error;

      let responseItems: ResponseItem[] = [];
      if (responseResult.data) {
        const itemsResult = await supabase
          .from('review_response_items')
          .select('*')
          .eq('response_id', responseResult.data.id);
        if (itemsResult.error) throw itemsResult.error;
        responseItems = itemsResult.data ?? [];
      }

      const itemByDimension = new Map(responseItems.map((item) => [item.dimension_id, item]));
      setAssignment(currentAssignment);
      setReview(reviewContext);
      setDimensions(dimensionsResult.data ?? []);
      setResponse(responseResult.data);
      setOverallComment(responseResult.data?.overall_comment ?? '');
      setAnswers(
        Object.fromEntries(
          (dimensionsResult.data ?? []).map((dimension) => {
            const item = itemByDimension.get(dimension.id);
            return [dimension.id, { score: item ? String(item.score) : '', comment: item?.comment ?? '' }];
          }),
        ),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a avaliação.');
    } finally {
      setLoading(false);
    }
  }, [assignmentId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!assignment || dimensions.length === 0) return;
    const items = dimensions.map((dimension) => ({
      dimension_id: dimension.id,
      score: Number(answers[dimension.id]?.score),
      comment: answers[dimension.id]?.comment.trim() || null,
    }));
    if (items.some((item) => !Number.isFinite(item.score) || item.score < 0 || item.score > 100)) {
      toast.error('Todas as notas precisam estar entre 0 e 100.');
      return;
    }
    setSubmitting(true);
    const result = await supabase.rpc('submit_review_response', {
      target_assignment_id: assignment.id,
      response_items: items as unknown as Json,
      response_comment: overallComment.trim() || null,
    });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error.message ?? 'Não foi possível enviar a avaliação.');
      return;
    }
    toast.success('Avaliação enviada.');
    await load();
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-canvas px-4" role="status"><LoaderCircle className="h-6 w-6 animate-spin text-brand" aria-hidden="true" /><span className="ml-3 text-callout text-ink-muted">Carregando avaliação...</span></main>;
  }

  if (error || !assignment || !review) {
    return <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12"><div className="surface-card w-full max-w-lg p-6 text-center"><ClipboardCheck className="mx-auto h-7 w-7 text-ink-subtle" aria-hidden="true" /><h1 className="mt-4 text-title-2 font-bold text-ink">Avaliação indisponível</h1><p className="mt-2 text-body text-ink-muted">{error ?? 'Não foi possível abrir este convite.'}</p><Link to="/" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-control border border-line px-4 text-callout font-semibold text-ink transition-colors hover:border-brand">Voltar ao início</Link></div></main>;
  }

  const submitted = assignment.status === 'submitted' || Boolean(response?.submitted_at);
  const reviewOpen = review.status === 'open';
  return (
    <main className="min-h-screen bg-canvas px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl min-w-0">
        <Link to="/" className="inline-flex min-h-11 items-center text-title-3 font-bold text-ink">Noren</Link>
        <header className="mt-5 surface-card p-6 sm:p-8">
          <div className="icon-tile h-11 w-11"><ClipboardCheck className="h-5 w-5" aria-hidden="true" /></div>
          <p className="mt-5 text-eyebrow font-bold uppercase text-brand">Avaliação identificada</p>
          <h1 className="mt-2 break-words text-title-1 font-bold text-ink">{review.title}</h1>
          <p className="mt-3 max-w-2xl text-body text-ink-muted">Sua resposta fica vinculada ao seu e-mail. Leia cada critério com calma e registre o contexto que ajuda a entender sua nota.</p>
        </header>

        {dimensions.length === 0 ? <div className="mt-5 rounded-card border border-warning/20 bg-warning-tint p-6"><p className="text-callout font-semibold text-ink">A avaliação ainda não tem critérios.</p><p className="mt-1 text-footnote text-ink-muted">Peça para quem enviou o convite adicionar as dimensões antes de responder.</p></div> : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            {dimensions.map((dimension, index) => {
              const answer = answers[dimension.id] ?? { score: '', comment: '' };
              return <section key={dimension.id} className="surface-card min-w-0 p-5 sm:p-6"><div className="flex min-w-0 gap-3"><span className="icon-tile h-9 w-9 shrink-0 text-footnote font-bold">{index + 1}</span><div className="min-w-0"><h2 className="break-words text-title-3 font-bold text-ink">{dimension.name}</h2>{dimension.description && <p className="mt-1 break-words text-footnote text-ink-muted">{dimension.description}</p>}</div></div><div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-[160px_minmax(0,1fr)]"><div><Label htmlFor={`score-${dimension.id}`} className="mb-2 block text-footnote font-semibold text-ink">Nota de 0 a 100</Label><Input id={`score-${dimension.id}`} type="number" min={0} max={100} step="0.01" className="min-h-11" value={answer.score} onChange={(event) => setAnswers((current) => ({ ...current, [dimension.id]: { ...answer, score: event.target.value } }))} disabled={submitted || !reviewOpen} required /></div><div><Label htmlFor={`comment-${dimension.id}`} className="mb-2 block text-footnote font-semibold text-ink">Comentário (opcional)</Label><Textarea id={`comment-${dimension.id}`} value={answer.comment} onChange={(event) => setAnswers((current) => ({ ...current, [dimension.id]: { ...answer, comment: event.target.value } }))} disabled={submitted || !reviewOpen} placeholder="Que situação ajuda a explicar esta nota?" /></div></div></section>;
            })}
            <section className="surface-card p-5 sm:p-6"><Label htmlFor="review-overall-comment" className="mb-2 block text-footnote font-semibold text-ink">Comentário geral (opcional)</Label><Textarea id="review-overall-comment" value={overallComment} onChange={(event) => setOverallComment(event.target.value)} disabled={submitted || !reviewOpen} placeholder="Deixe uma síntese da sua avaliação" rows={4} />{submitted ? <div className="mt-5 flex items-center gap-2 rounded-tile bg-positive-tint p-4 text-callout font-semibold text-positive" role="status"><CheckCircle2 className="h-5 w-5" aria-hidden="true" />Sua resposta foi enviada.</div> : reviewOpen ? <Button type="submit" className="mt-5 min-h-11 cursor-pointer" disabled={submitting}>{submitting ? 'Enviando...' : 'Enviar avaliação'}</Button> : <div className="mt-5 rounded-tile bg-warning-tint p-4 text-callout font-semibold text-warning" role="status">Esta avaliação foi encerrada e não aceita novas respostas.</div>}</section>
          </form>
        )}
      </div>
    </main>
  );
}

export default ReviewAssignment;
