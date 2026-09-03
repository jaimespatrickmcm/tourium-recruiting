import { useEffect, useState, type FormEvent } from 'react';
import { CircleDollarSign, History, MapPin, Save, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, SectionCard, formatDate, formatMoney, submitClass } from '@/components/people/shared';
import type { ReturnTypeOfDevelopmentHook } from '@/components/people/types';

type ProfileForm = {
  birthDate: string;
  street: string;
  number: string;
  complement: string;
  city: string;
  state: string;
  postalCode: string;
  shirtSize: string;
  foodPreferences: string;
  dietaryRestrictions: string;
};

const EMPTY_FORM: ProfileForm = {
  birthDate: '', street: '', number: '', complement: '', city: '', state: '', postalCode: '',
  shirtSize: '', foodPreferences: '', dietaryRestrictions: '',
};

export function ProfileTab({ model }: { model: ReturnTypeOfDevelopmentHook }) {
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [salary, setSalary] = useState('');
  const [salaryDate, setSalaryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [salaryReason, setSalaryReason] = useState('');

  useEffect(() => {
    const profile = model.privateProfile;
    const address = profile?.address ?? {};
    setForm({
      birthDate: profile?.birth_date ?? '',
      street: address.street ?? '',
      number: address.number ?? '',
      complement: address.complement ?? '',
      city: address.city ?? '',
      state: address.state ?? '',
      postalCode: address.postal_code ?? '',
      shirtSize: profile?.shirt_size ?? '',
      foodPreferences: profile?.food_preferences.join(', ') ?? '',
      dietaryRestrictions: profile?.dietary_restrictions.join(', ') ?? '',
    });
  }, [model.privateProfile]);

  function field(name: keyof ProfileForm) {
    return { value: form[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [name]: event.target.value })) };
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    try {
      await model.savePrivateProfile({
        birth_date: form.birthDate || null,
        address: {
          street: form.street.trim(), number: form.number.trim(), complement: form.complement.trim(),
          city: form.city.trim(), state: form.state.trim(), postal_code: form.postalCode.trim(),
        },
        shirt_size: form.shirtSize.trim() || null,
        food_preferences: form.foodPreferences.split(',').map((item) => item.trim()).filter(Boolean),
        dietary_restrictions: form.dietaryRestrictions.split(',').map((item) => item.trim()).filter(Boolean),
      });
      toast.success('Dados pessoais salvos.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar os dados.');
    }
  }

  async function saveSalary(event: FormEvent) {
    event.preventDefault();
    const normalized = salary.includes(',') ? salary.replace(/\./g, '').replace(',', '.') : salary;
    const amount = Number(normalized);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Informe um salário válido.');
      return;
    }
    try {
      await model.recordSalaryChange({ amountMinor: Math.round(amount * 100), effectiveFrom: salaryDate, reason: salaryReason.trim() || null });
      setSalary('');
      setSalaryReason('');
      toast.success('Alteração salarial registrada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar o salário.');
    }
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <SectionCard title="Dados pessoais" description="Informações usadas no dia a dia da empresa" icon={UserRound}>
        <form onSubmit={saveProfile} className="space-y-5">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field label="Data de nascimento" id="person-birth"><Input id="person-birth" type="date" className="min-h-11" {...field('birthDate')} /></Field>
            <Field label="Tamanho de camisa" id="person-shirt"><Input id="person-shirt" placeholder="Ex.: M" className="min-h-11" {...field('shirtSize')} /></Field>
          </div>
          <div className="border-t border-line-soft pt-5">
            <div className="mb-4 flex items-center gap-2"><MapPin className="h-4 w-4 text-brand" aria-hidden="true" /><h3 className="text-callout font-semibold text-ink">Endereço</h3></div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-6">
              <Field label="Rua" id="person-street" className="sm:col-span-4"><Input id="person-street" className="min-h-11" {...field('street')} /></Field>
              <Field label="Número" id="person-number" className="sm:col-span-2"><Input id="person-number" className="min-h-11" {...field('number')} /></Field>
              <Field label="Complemento" id="person-complement" className="sm:col-span-3"><Input id="person-complement" className="min-h-11" {...field('complement')} /></Field>
              <Field label="Cidade" id="person-city" className="sm:col-span-3"><Input id="person-city" className="min-h-11" {...field('city')} /></Field>
              <Field label="Estado" id="person-state" className="sm:col-span-3"><Input id="person-state" className="min-h-11" {...field('state')} /></Field>
              <Field label="CEP" id="person-postal" className="sm:col-span-3"><Input id="person-postal" inputMode="numeric" className="min-h-11" {...field('postalCode')} /></Field>
            </div>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field label="Comidas preferidas" id="person-food"><Textarea id="person-food" placeholder="Separe por vírgulas" {...field('foodPreferences')} /></Field>
            <Field label="Restrições alimentares" id="person-diet"><Textarea id="person-diet" placeholder="Separe por vírgulas" {...field('dietaryRestrictions')} /></Field>
          </div>
          <p className="text-caption text-ink-muted">Preferências e restrições alimentares são opcionais. Registre apenas o que a pessoa quiser compartilhar.</p>
          <Button type="submit" className={submitClass} disabled={model.mutating}><Save aria-hidden="true" />{model.mutating ? 'Salvando...' : 'Salvar dados'}</Button>
        </form>
      </SectionCard>

      <div className="min-w-0 space-y-5">
        <SectionCard title="Salário" description="Cada mudança fica registrada no histórico" icon={CircleDollarSign}>
          <form onSubmit={saveSalary} className="space-y-4">
            <Field label="Novo salário" id="salary-amount"><Input id="salary-amount" inputMode="decimal" placeholder="Ex.: 8.500,00" className="min-h-11" value={salary} onChange={(event) => setSalary(event.target.value)} required /></Field>
            <Field label="Vigência" id="salary-date"><Input id="salary-date" type="date" className="min-h-11" value={salaryDate} onChange={(event) => setSalaryDate(event.target.value)} required /></Field>
            <Field label="Motivo (opcional)" id="salary-reason"><Textarea id="salary-reason" value={salaryReason} onChange={(event) => setSalaryReason(event.target.value)} placeholder="Ex.: promoção para coordenação" /></Field>
            <Button type="submit" className={submitClass} disabled={model.mutating}>{model.mutating ? 'Registrando...' : 'Registrar mudança'}</Button>
          </form>
        </SectionCard>

        <SectionCard title="Histórico salarial" icon={History}>
          {model.salaryHistory.length === 0 ? <EmptyState title="Nenhum salário registrado" description="O primeiro lançamento aparece aqui com sua data de vigência." /> : (
            <ol className="space-y-3">
              {model.salaryHistory.map((entry) => <li key={entry.id} className="rounded-tile border border-line-soft bg-canvas p-4"><p className="text-callout font-bold text-ink">{formatMoney(entry.amount_minor, entry.currency)}</p><p className="mt-1 text-footnote text-ink-muted">Desde {formatDate(entry.effective_from)}</p>{entry.reason && <p className="mt-2 break-words text-footnote text-ink-muted">{entry.reason}</p>}</li>)}
            </ol>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function Field({ label, id, children, className }: { label: string; id: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label htmlFor={id} className="mb-2 block text-footnote font-semibold text-ink">{label}</Label>{children}</div>;
}
