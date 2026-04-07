import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { PremiumSelectOption } from '@/components/PremiumSelect';

interface PremiumMultiSelectProps {
  options: PremiumSelectOption[];
  values: string[];
  onChange: (nextValues: string[]) => void;
  placeholder: string;
  emptyLabel?: string;
  emptyDescription?: string;
  className?: string;
  triggerClassName?: string;
}

export function PremiumMultiSelect({
  options,
  values,
  onChange,
  placeholder,
  emptyLabel,
  emptyDescription,
  className,
  triggerClassName,
}: PremiumMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedOptions = options.filter((option) => values.includes(option.value));
  const groupedOptions = useMemo(() => {
    const groups = new Map<string, PremiumSelectOption[]>();
    for (const option of options) {
      const key = option.group || 'Opções';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(option);
    }
    return Array.from(groups.entries());
  }, [options]);

  const summaryLabel = selectedOptions.length
    ? selectedOptions.map((option) => option.label).join(', ')
    : (emptyLabel || placeholder);

  const summaryDescription = selectedOptions.length
    ? `${selectedOptions.length} item(ns) selecionado(s)`
    : (emptyDescription || placeholder);

  const toggleValue = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }
    onChange([...values, value]);
  };

  return (
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
            <span className={cn('block truncate text-sm font-semibold', selectedOptions.length ? 'text-foreground' : 'text-muted-foreground')}>
              {summaryLabel}
            </span>
            <span className="block truncate text-[11px] uppercase tracking-[0.18em] text-gold-500/60">
              {summaryDescription}
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
            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            {groupedOptions.map(([groupLabel, items]) => (
              <CommandGroup key={groupLabel} heading={groupLabel} className="p-2">
                {items.map((option) => {
                  const checked = values.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={`${option.label} ${option.description || ''} ${option.group || ''}`}
                      onSelect={() => toggleValue(option.value)}
                      className="mb-1 flex items-center justify-between rounded-xl border border-transparent px-3 py-3 data-[selected=true]:border-gold-500/30 data-[selected=true]:bg-gold-500/10"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">{option.label}</span>
                        <span className="block truncate text-[11px] uppercase tracking-[0.18em] text-gold-500/60">
                          {option.description || groupLabel}
                        </span>
                      </span>
                      <Check className={cn('h-4 w-4 text-gold-400', checked ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
