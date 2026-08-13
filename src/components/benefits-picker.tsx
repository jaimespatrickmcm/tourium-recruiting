import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { BENEFIT_CATALOG, isCustomBenefit } from '@/lib/benefits';
import { cn } from '@/lib/utils';

const MAX_LENGTH = 80;

/**
 * Seletor de benefícios controlado e sem efeito colateral: quem chama decide
 * quando salvar. Aceita itens do catálogo e itens escritos pela empresa.
 */
export function BenefitsPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [custom, setCustom] = useState('');

  const selectedKeys = new Set(value.map((item) => item.toLowerCase()));

  function add(item: string) {
    const clean = item.trim().slice(0, MAX_LENGTH);
    if (!clean) return;
    if (selectedKeys.has(clean.toLowerCase())) return;
    onChange([...value, clean]);
  }

  function remove(item: string) {
    onChange(value.filter((current) => current !== item));
  }

  function toggle(item: string) {
    if (selectedKeys.has(item.toLowerCase())) {
      onChange(value.filter((current) => current.toLowerCase() !== item.toLowerCase()));
      return;
    }
    add(item);
  }

  function submitCustom() {
    add(custom);
    setCustom('');
  }

  return (
    <div className="space-y-6">
      {/* Selecionados */}
      <div>
        <p className="text-eyebrow font-bold uppercase text-ink-subtle mb-2.5">
          Selecionados ({value.length})
        </p>
        {value.length === 0 ? (
          <p className="text-footnote text-ink-muted">
            Nada escolhido ainda. Clica nos itens abaixo ou escreve o seu.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {value.map((item) => (
              <span
                key={item}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-footnote font-medium',
                  isCustomBenefit(item)
                    ? 'border-line bg-canvas text-ink'
                    : 'border-sky-200 bg-sky-50 text-sky-800',
                )}
              >
                {item}
                <button
                  type="button"
                  onClick={() => remove(item)}
                  aria-label={`Remover ${item}`}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-current opacity-50 transition-opacity hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Catálogo */}
      <div className="space-y-4">
        {BENEFIT_CATALOG.map((group) => (
          <div key={group.group}>
            <p className="text-eyebrow font-bold uppercase text-ink-subtle mb-2">
              {group.group}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.items.map((item) => {
                const selected = selectedKeys.has(item.toLowerCase());
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggle(item)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-footnote font-medium transition-colors',
                      selected
                        ? 'border-sky-300 bg-sky-100 text-sky-800'
                        : 'border-line-soft bg-white text-ink-muted hover:border-line hover:text-ink',
                    )}
                  >
                    {selected ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    ) : (
                      <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    )}
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Customizado */}
      <div>
        <p className="text-eyebrow font-bold uppercase text-ink-subtle mb-2">
          Tem algo que não está na lista?
        </p>
        <div className="flex gap-2">
          <input
            value={custom}
            maxLength={MAX_LENGTH}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitCustom();
              }
            }}
            placeholder="Ex.: Sexta curta, almoço do time toda quinta"
            className="h-10 flex-1 rounded-tile border border-line-soft px-3 text-callout text-ink outline-none placeholder:text-[#a1a1a6] focus:border-brand"
          />
          <button
            type="button"
            onClick={submitCustom}
            disabled={!custom.trim()}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-white px-4 py-2 text-footnote font-semibold text-ink transition-colors hover:border-line disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

export default BenefitsPicker;
