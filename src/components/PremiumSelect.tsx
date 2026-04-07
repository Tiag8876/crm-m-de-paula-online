import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

export interface PremiumSelectOption {
  value: string;
  label: string;
  description?: string;
  group?: string;
}

interface PremiumSelectProps {
  options: PremiumSelectOption[];
  value?: string;
  onChange: (nextValue: string) => void;
  placeholder: string;
  emptyLabel?: string;
  emptyDescription?: string;
  name?: string;
  className?: string;
  triggerClassName?: string;
}

export function PremiumSelect({
  options,
  value,
  onChange,
  placeholder,
  emptyLabel,
  emptyDescription,
  name,
  className,
  triggerClassName,
}: PremiumSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedOption = options.find((option) => option.value === value);
  const groupedOptions = useMemo(() => {
    const groups = new Map<string, PremiumSelectOption[]>();
    for (const option of options) {
      const key = option.group || 'Opções';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(option);
    }
    return Array.from(groups.entries());
  }, [options]);

  return (
    <>
      {name ? <input type="hidden" name={name} value={value || ''} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left shadow-[0_12px_40px_rgba(0,0,0,0.18)] transition-all hover:border-gold-400/70 hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-gold-500/30',
              triggerClassName,
              className,
            )}
          >
            <span className="min-w-0">
              <span className={cn('block truncate text-sm font-semibold', selectedOption ? 'text-foreground' : 'text-muted-foreground')}>
                {selectedOption?.label || emptyLabel || placeholder}
              </span>
              <span className="block truncate text-[11px] uppercase tracking-[0.18em] text-gold-500/60">
                {selectedOption?.description || emptyDescription || placeholder}
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-gold-400/70" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[360px] rounded-2xl border border-border bg-card p-0 shadow-2xl">
          <Command className="rounded-2xl bg-card">
            <div className="border-b border-border px-3 py-2">
              <CommandInput placeholder={placeholder} className="rounded-xl border border-border bg-background/50 text-sm" />
            </div>
            <CommandList className="max-h-80">
              <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
              {emptyLabel ? (
                <CommandGroup heading="Seleção" className="p-2">
                  <CommandItem
                    value={`__empty__ ${emptyLabel}`}
                    onSelect={() => {
                      onChange('');
                      setOpen(false);
                    }}
                    className="mb-1 flex items-center justify-between rounded-xl border border-transparent px-3 py-3 data-[selected=true]:border-gold-500/30 data-[selected=true]:bg-gold-500/10"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{emptyLabel}</span>
                      <span className="block truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {emptyDescription || 'Sem filtro aplicado'}
                      </span>
                    </span>
                    <Check className={cn('h-4 w-4 text-gold-400', !value ? 'opacity-100' : 'opacity-0')} />
                  </CommandItem>
                </CommandGroup>
              ) : null}
              {groupedOptions.map(([groupLabel, items]) => (
                <CommandGroup key={groupLabel} heading={groupLabel} className="p-2">
                  {items.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={`${option.label} ${option.description || ''} ${option.group || ''}`}
                      onSelect={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className="mb-1 flex items-center justify-between rounded-xl border border-transparent px-3 py-3 data-[selected=true]:border-gold-500/30 data-[selected=true]:bg-gold-500/10"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">{option.label}</span>
                        <span className="block truncate text-[11px] uppercase tracking-[0.18em] text-gold-500/60">
                          {option.description || groupLabel}
                        </span>
                      </span>
                      <Check className={cn('h-4 w-4 text-gold-400', value === option.value ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}

