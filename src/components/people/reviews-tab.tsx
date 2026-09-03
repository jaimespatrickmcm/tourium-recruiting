import { useMemo, useState, type FormEvent } from 'react';
import { Award, CalendarCheck, CheckCircle2, MessageSquareText, Plus, Send, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, SectionCard, StatusPill, formatDate, selectClass, submitClass, todayLocal } from '@/components/people/shared';
import type { ReturnTypeOfDevelopmentHook } from '@/components/people/types';
import type { PerformanceReviewKind, ReviewRelationship } from '@/types/database';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { invokeEdge } from '@/lib/functions';

const RELATIONSHIPS: Array<{ value: ReviewRelationship; label: string }> = [
  { value: 'self', label: 'Autoavaliação' }, { value: 'manager', label: 'Gestor' },
  { value: 'peer', label: 'Par' }, { value: 'direct_report', label: 'Liderado' }, { value: 'other', label: 'Outro' },
];

export function ReviewsTab({ model }: { model: ReturnTypeOfDevelopmentHook }) {
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(model.reviews.length === 0);
  const [title, setTitle] = useState('');
  const [reviewDate, setReviewDate] = useState(() => todayLocal());
  const [kind, setKind] = useState<PerformanceReviewKind>('standard');
  const [summary, setSummary] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(model.reviews[0]?.id ?? null);
  const selected = model.reviews.find((review) => review.id === selectedId) ?? model.reviews[0] ?? null;

  async function createReview(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      const created = await model.createReview({ title: title.trim(), reviewDate, kind, status: 'open', summary: summary.trim() || null });
      if (!created) throw new Error('A avaliação não foi retornada após a criação.');
      setSelectedId(created.id);
      setTitle(''); setSummary(''); setShowCreate(false);
      toast.success('Avaliação criada.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível criar a avaliação.'); }
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <SectionCard title="Avaliações" description="Histórico por data" icon={CalendarCheck} action={<Button type="button" variant="outline" className="min-h-11" onClick={() => setShowCreate((value) => !value)}><Plus aria-hidden="true" />Nova</Button>}>
        {showCreate && <form onSubmit={createReview} className="mb-5 space-y-4 rounded-card border border-line-soft bg-canvas p-4">
          <Field id="review-title" label="Título"><Input id="review-title" className="min-h-11" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Avaliação semestral" required /></Field>
          <Field id="review-date" label="Data"><Input id="review-date" type="date" className="min-h-11" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} required /></Field>
          <Field id="review-kind" label="Tipo"><select id="review-kind" className={selectClass} value={kind} onChange={(event) => setKind(event.target.value as PerformanceReviewKind)}><option value="standard">Padrão</option><option value="360">Avaliação 360</option></select></Field>
          <Field id="review-summary" label="Contexto (opcional)"><Textarea id="review-summary" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="O que será observado neste ciclo?" /></Field>
          <Button type="submit" className={submitClass} disabled={model.mutating}>{model.mutating ? 'Criando...' : 'Criar avaliação'}</Button>
        </form>}

        {model.reviews.length === 0 ? <EmptyState title="Nenhuma avaliação" description="Crie a primeira avaliação para acompanhar a evolução no tempo." /> : <div className="space-y-2">
          {model.reviews.map((review) => <button key={review.id} type="button" onClick={() => setSelectedId(review.id)} className={cn('min-h-11 w-full cursor-pointer rounded-tile border p-3 text-left transition-colors', selected?.id === review.id ? 'border-brand bg-brand-tint' : 'border-line-soft bg-surface hover:border-line')}>
            <span className="flex items-start justify-between gap-2"><span className="min-w-0 break-words text-callout font-semibold text-ink">{review.title}</span><StatusPill tone={review.kind === '360' ? 'brand' : 'neutral'}>{review.kind === '360' ? '360' : 'Padrão'}</StatusPill></span>
            <span className="mt-1 block text-footnote text-ink-muted">{formatDate(review.review_date)}</span>
          </button>)}
        </div>}
      </SectionCard>

      {selected ? <ReviewDetail model={model} review={selected} currentUserId={user?.id ?? null} /> : <SectionCard title="Detalhes da avaliação"><EmptyState title="Escolha uma avaliação" description="Os detalhes, dimensões e participantes aparecem aqui." /></SectionCard>}
    </div>
  );
}

function ReviewDetail({ model, review, currentUserId }: { model: ReturnTypeOfDevelopmentHook; review: ReturnTypeOfDevelopmentHook['reviews'][number]; currentUserId: string | null }) {
  const [dimensionName, setDimensionName] = useState('');
  const [dimensionDescription, setDimensionDescription] = useState('');
  const [participantEmail, setParticipantEmail] = useState('');
  const [relationship, setRelationship] = useState<ReviewRelationship>('peer');
  const [ownRelationship, setOwnRelationship] = useState<ReviewRelationship>('self');
  const dimensions = useMemo(() => model.reviewDimensions.filter((item) => item.review_id === review.id), [model.reviewDimensions, review.id]);
  const assignments = useMemo(() => model.reviewAssignments.filter((item) => item.review_id === review.id), [model.reviewAssignments, review.id]);
  const ownAssignment = assignments.find((assignment) => assignment.evaluator_user_id === currentUserId);

  async function addDimension(event: FormEvent) {
    event.preventDefault();
    try { await model.addReviewDimension(review.id, { name: dimensionName.trim(), description: dimensionDescription.trim() || null, position: dimensions.length }); setDimensionName(''); setDimensionDescription(''); toast.success('Dimensão adicionada.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível adicionar a dimensão.'); }
  }
  async function addSkillDimensions() {
    const usedSkillIds = new Set(dimensions.map((dimension) => dimension.skill_id).filter(Boolean));
    const usedNames = new Set(dimensions.map((dimension) => dimension.name.toLowerCase()));
    const pending = model.collaboratorSkills
      .map((entry) => model.skills.find((skill) => skill.id === entry.skill_id))
      .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill))
      .filter((skill) => !usedSkillIds.has(skill.id) && !usedNames.has(skill.name.toLowerCase()));
    if (pending.length === 0) { toast('As skills da pessoa já estão nesta avaliação.'); return; }
    try {
      let position = dimensions.length;
      for (const skill of pending) {
        await model.addReviewDimension(review.id, { skillId: skill.id, name: skill.name, description: skill.description, position: position++ });
      }
      toast.success(`${pending.length} ${pending.length === 1 ? 'dimensão criada' : 'dimensões criadas'} a partir das skills.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível criar as dimensões.'); }
  }
  async function addParticipant(event: FormEvent) {
    event.preventDefault();
    const result = await invokeEdge<{ ok: true; assignmentId: string }>('invite-review-assignment', {
      reviewId: review.id,
      evaluatorEmail: participantEmail.trim().toLowerCase(),
      relationship,
    });
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    setParticipantEmail('');
    await model.refetch();
    toast.success('Convite enviado.');
  }
  async function createOwnAssignment() {
    if (!currentUserId) return;
    try {
      await model.addReviewAssignment(review.id, { evaluatorUserId: currentUserId, relationship: ownRelationship });
      toast.success('Sua avaliação está pronta.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível preparar sua avaliação.');
    }
  }
  async function closeReview() {
    try { await model.closeReview(review.id); toast.success('Avaliação concluída.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível concluir a avaliação.'); }
  }

  return <div className="min-w-0 space-y-5">
    <SectionCard title={review.title} description={`${formatDate(review.review_date)} · ${review.kind === '360' ? 'Avaliação 360' : 'Avaliação padrão'}`} icon={UsersRound} action={review.status !== 'closed' ? <Button type="button" variant="outline" className="min-h-11" disabled={model.mutating} onClick={() => void closeReview()}><CheckCircle2 aria-hidden="true" />Concluir</Button> : <StatusPill tone="positive">Concluída</StatusPill>}>
      {review.summary ? <p className="break-words text-body text-ink-muted">{review.summary}</p> : <p className="text-footnote text-ink-subtle">Sem contexto registrado.</p>}
      {review.overall_score !== null && <div className="mt-4 rounded-tile bg-brand-tint p-4"><p className="text-caption font-semibold text-brand-hover">NOTA GERAL</p><p className="mt-1 text-title-2 font-bold text-ink">{review.overall_score.toLocaleString('pt-BR')}</p></div>}
    </SectionCard>

    <SectionCard title="Dimensões" description="Defina os pontos observados nesta avaliação" action={review.status === 'open' && model.collaboratorSkills.length > 0 ? <Button type="button" variant="outline" className="min-h-11" disabled={model.mutating} onClick={() => void addSkillDimensions()}><Award aria-hidden="true" />Usar skills da pessoa</Button> : undefined}>
      <form onSubmit={addDimension} className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <Field id={`dimension-name-${review.id}`} label="Nome"><Input id={`dimension-name-${review.id}`} className="min-h-11" value={dimensionName} onChange={(event) => setDimensionName(event.target.value)} placeholder="Ex.: Comunicação" required /></Field>
        <Field id={`dimension-description-${review.id}`} label="Descrição (opcional)"><Input id={`dimension-description-${review.id}`} className="min-h-11" value={dimensionDescription} onChange={(event) => setDimensionDescription(event.target.value)} placeholder="O que será avaliado" /></Field>
        <Button type="submit" variant="outline" className={submitClass} disabled={model.mutating}><Plus aria-hidden="true" />Adicionar</Button>
      </form>
      {dimensions.length === 0 ? <p className="mt-4 text-footnote text-ink-muted">Nenhuma dimensão adicionada.</p> : <ul className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2">{dimensions.map((dimension) => <li key={dimension.id} className="rounded-tile border border-line-soft bg-canvas p-3"><p className="break-words text-callout font-semibold text-ink">{dimension.name}</p>{dimension.description && <p className="mt-1 break-words text-footnote text-ink-muted">{dimension.description}</p>}</li>)}</ul>}
    </SectionCard>

    {currentUserId && <SectionCard title="Minha resposta" description="Sua resposta fica identificada no resultado desta avaliação" icon={MessageSquareText}>
      {ownAssignment ? <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-tile border border-line-soft bg-canvas p-4"><div><StatusPill tone={ownAssignment.status === 'submitted' ? 'positive' : 'warning'}>{ownAssignment.status === 'submitted' ? 'Enviada' : 'Pendente'}</StatusPill><p className="mt-2 text-footnote text-ink-muted">{ownAssignment.status === 'submitted' ? 'Você pode consultar as notas que enviou.' : 'Responda todas as dimensões antes de enviar.'}</p></div><Button asChild variant="outline" className="min-h-11"><Link to={`/avaliacao/360?assignment=${ownAssignment.id}`}>{ownAssignment.status === 'submitted' ? 'Ver minha resposta' : 'Responder agora'}</Link></Button></div> : <div className="rounded-tile border border-line-soft bg-canvas p-4"><p className="text-callout font-semibold text-ink">Quer incluir sua visão?</p><p className="mt-1 text-footnote text-ink-muted">Crie uma resposta usando as mesmas dimensões deste ciclo.</p><div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end"><Field id={`own-relationship-${review.id}`} label="Sua relação"><select id={`own-relationship-${review.id}`} className={selectClass} value={ownRelationship} onChange={(event) => setOwnRelationship(event.target.value as ReviewRelationship)}>{RELATIONSHIPS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field><Button type="button" variant="outline" className="min-h-11 shrink-0" disabled={model.mutating || review.status !== 'open' || dimensions.length === 0} onClick={() => void createOwnAssignment()}><Plus aria-hidden="true" />Criar minha avaliação</Button></div></div>}
    </SectionCard>}

    {review.kind === '360' && <SectionCard title="Participantes" description="Cada pessoa responde apenas a avaliação atribuída. As respostas não são anônimas." icon={UsersRound}>
      <form onSubmit={addParticipant} className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
        <Field id={`participant-email-${review.id}`} label="E-mail"><Input id={`participant-email-${review.id}`} type="email" className="min-h-11" value={participantEmail} onChange={(event) => setParticipantEmail(event.target.value)} placeholder="pessoa@empresa.com" required /></Field>
        <Field id={`participant-role-${review.id}`} label="Relação"><select id={`participant-role-${review.id}`} className={selectClass} value={relationship} onChange={(event) => setRelationship(event.target.value as ReviewRelationship)}>{RELATIONSHIPS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
        <Button type="submit" variant="outline" className={submitClass} disabled={model.mutating}><Send aria-hidden="true" />Enviar convite</Button>
      </form>
      {assignments.length === 0 ? <p className="mt-4 text-footnote text-ink-muted">Nenhum participante adicionado.</p> : <ul className="mt-4 space-y-2">{assignments.map((assignment) => <li key={assignment.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-tile border border-line-soft bg-canvas p-3"><div className="min-w-0"><p className="break-all text-callout font-semibold text-ink">{assignment.evaluator_email ?? 'Participante interno'}</p><p className="text-footnote text-ink-muted">{RELATIONSHIPS.find((item) => item.value === assignment.relationship)?.label}</p></div><StatusPill tone={assignment.status === 'submitted' ? 'positive' : 'warning'}>{assignment.status === 'submitted' ? 'Respondida' : 'Pendente'}</StatusPill></li>)}</ul>}
    </SectionCard>}

    {assignments.length > 0 && <SectionCard title="Respostas" description="Notas e comentários enviados por cada participante" icon={MessageSquareText}>
      <div className="space-y-3">{assignments.map((assignment) => <AssignmentResponse key={assignment.id} assignment={assignment} model={model} dimensions={dimensions} />)}</div>
    </SectionCard>}
  </div>;
}

function AssignmentResponse({ assignment, model, dimensions }: { assignment: ReturnTypeOfDevelopmentHook['reviewAssignments'][number]; model: ReturnTypeOfDevelopmentHook; dimensions: ReturnTypeOfDevelopmentHook['reviewDimensions'] }) {
  const response = model.reviewResponses.find((item) => item.assignment_id === assignment.id);
  const items = response ? model.reviewResponseItems.filter((item) => item.response_id === response.id) : [];
  const average = items.length > 0 ? items.reduce((sum, item) => sum + Number(item.score), 0) / items.length : null;
  return <article className="min-w-0 rounded-card border border-line-soft bg-canvas p-4"><div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-all text-callout font-semibold text-ink">{assignment.evaluator_email ?? 'Autoavaliação'}</p><p className="mt-1 text-footnote text-ink-muted">{RELATIONSHIPS.find((item) => item.value === assignment.relationship)?.label}</p></div><div className="flex items-center gap-2"><StatusPill tone={assignment.status === 'submitted' ? 'positive' : 'warning'}>{assignment.status === 'submitted' ? 'Respondida' : 'Pendente'}</StatusPill>{average !== null && <span className="text-callout font-bold text-ink">{average.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span>}</div></div>{!response ? <p className="mt-3 text-footnote text-ink-muted">A resposta ainda não foi enviada.</p> : <div className="mt-4 space-y-2">{items.map((item) => { const dimension = dimensions.find((entry) => entry.id === item.dimension_id); return <div key={item.id} className="rounded-tile border border-line-soft bg-surface p-3"><div className="flex flex-wrap justify-between gap-2"><p className="break-words text-footnote font-semibold text-ink">{dimension?.name ?? 'Dimensão'}</p><p className="text-footnote font-bold text-brand-hover">{Number(item.score).toLocaleString('pt-BR')}</p></div>{item.comment && <p className="mt-2 break-words text-footnote text-ink-muted">{item.comment}</p>}</div>; })}{response.overall_comment && <p className="break-words pt-2 text-footnote text-ink-muted"><strong className="text-ink">Comentário geral:</strong> {response.overall_comment}</p>}</div>}</article>;
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) { return <div className="min-w-0"><Label htmlFor={id} className="mb-2 block text-footnote font-semibold text-ink">{label}</Label>{children}</div>; }
