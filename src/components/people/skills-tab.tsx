import { useMemo, useState, type FormEvent } from 'react';
import { Award, BookOpenCheck, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, SectionCard, StatusPill, selectClass, submitClass } from '@/components/people/shared';
import type { ReturnTypeOfDevelopmentHook } from '@/components/people/types';
import type { CollaboratorSkillStatus } from '@/types/database';

export function SkillsTab({ model }: { model: ReturnTypeOfDevelopmentHook }) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [level, setLevel] = useState('1');
  const [status, setStatus] = useState<CollaboratorSkillStatus>('in_progress');
  const [evidence, setEvidence] = useState('');
  const currentBySkill = useMemo(() => new Map(model.collaboratorSkills.map((item) => [item.skill_id, item])), [model.collaboratorSkills]);

  async function createSkill(event: FormEvent) {
    event.preventDefault();
    try { const skill = await model.createSkill({ name: name.trim(), category: category.trim() || null, description: description.trim() || null }); if (!skill) throw new Error('A skill não foi retornada após a criação.'); setSelectedSkill(skill.id); setName(''); setCategory(''); setDescription(''); setShowCreate(false); toast.success('Skill criada.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível criar a skill.'); }
  }
  async function saveSkill(event: FormEvent) {
    event.preventDefault();
    if (!selectedSkill) { toast.error('Escolha uma skill.'); return; }
    try { await model.saveCollaboratorSkill(selectedSkill, { level: Number(level), status, evidence: evidence.trim() || null, unlockedAt: status === 'unlocked' ? new Date().toISOString() : null }); setEvidence(''); toast.success(status === 'unlocked' ? 'Skill desbloqueada.' : 'Evolução registrada.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a skill.'); }
  }

  return <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(300px,0.7fr)_minmax(0,1.3fr)]">
    <div className="min-w-0 space-y-5">
      <SectionCard title="Registrar evolução" description="Atualize o nível ou desbloqueie uma skill" icon={BookOpenCheck}>
        <form onSubmit={saveSkill} className="space-y-4">
          <Field id="skill-select" label="Skill"><select id="skill-select" className={selectClass} value={selectedSkill} onChange={(event) => { const id = event.target.value; setSelectedSkill(id); const current = currentBySkill.get(id); setLevel(String(current?.level ?? 1)); setStatus(current?.status ?? 'in_progress'); setEvidence(current?.evidence ?? ''); }} required><option value="">Escolha uma skill</option>{model.skills.filter((skill) => skill.active).map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></Field>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field id="skill-level" label="Nível"><Input id="skill-level" type="number" min={1} max={5} className="min-h-11" value={level} onChange={(event) => setLevel(event.target.value)} required /></Field>
            <Field id="skill-status" label="Situação"><select id="skill-status" className={selectClass} value={status} onChange={(event) => setStatus(event.target.value as CollaboratorSkillStatus)}><option value="in_progress">Em desenvolvimento</option><option value="unlocked">Desbloqueada</option></select></Field>
          </div>
          <Field id="skill-evidence" label="Evidência (opcional)"><Textarea id="skill-evidence" value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Conte onde essa skill foi demonstrada" /></Field>
          <Button type="submit" className={submitClass} disabled={model.mutating}>{model.mutating ? 'Salvando...' : 'Salvar evolução'}</Button>
        </form>
      </SectionCard>

      <SectionCard title="Catálogo" description="Skills disponíveis para o time" action={<Button type="button" variant="outline" className="min-h-11" onClick={() => setShowCreate((value) => !value)}><Plus aria-hidden="true" />Nova skill</Button>}>
        {showCreate && <form onSubmit={createSkill} className="space-y-4 rounded-card border border-line-soft bg-canvas p-4">
          <Field id="new-skill-name" label="Nome"><Input id="new-skill-name" className="min-h-11" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Comunicação escrita" required /></Field>
          <Field id="new-skill-category" label="Categoria (opcional)"><Input id="new-skill-category" className="min-h-11" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Ex.: Liderança" /></Field>
          <Field id="new-skill-description" label="Descrição (opcional)"><Textarea id="new-skill-description" value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          <Button type="submit" className={submitClass} disabled={model.mutating}>Criar skill</Button>
        </form>}
      </SectionCard>
    </div>

    <SectionCard title="Skills da pessoa" description="Níveis e conquistas registradas" icon={Award}>
      {model.collaboratorSkills.length === 0 ? <EmptyState title="Nenhuma skill registrada" description="Escolha uma skill do catálogo e registre o primeiro nível." /> : <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {model.collaboratorSkills.map((entry) => { const skill = model.skills.find((item) => item.id === entry.skill_id); return <article key={entry.skill_id} className="min-w-0 rounded-card border border-line-soft bg-canvas p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-callout font-bold text-ink">{skill?.name ?? 'Skill removida'}</p>{skill?.category && <p className="mt-1 text-footnote text-ink-muted">{skill.category}</p>}</div><StatusPill tone={entry.status === 'unlocked' ? 'positive' : 'warning'}>{entry.status === 'unlocked' ? 'Desbloqueada' : 'Em desenvolvimento'}</StatusPill></div><div className="mt-4" aria-label={`Nível ${entry.level} de 5`}><div className="mb-2 flex justify-between text-caption text-ink-muted"><span>Nível atual</span><span>{entry.level}/5</span></div><div className="h-2 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${Math.min(100, Math.max(0, entry.level * 20))}%` }} /></div></div>{entry.evidence && <p className="mt-3 break-words text-footnote text-ink-muted">{entry.evidence}</p>}</article>; })}
      </div>}
    </SectionCard>
  </div>;
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) { return <div className="min-w-0"><Label htmlFor={id} className="mb-2 block text-footnote font-semibold text-ink">{label}</Label>{children}</div>; }
