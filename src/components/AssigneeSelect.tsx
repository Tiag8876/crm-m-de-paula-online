import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, ShieldCheck, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/types/auth';

interface AssigneeSelectProps {
  users: AppUser[];
  value?: string;
  onChange: (nextValue?: string) => void;
  placeholder?: string;
  unassignedLabel?: string;
  className?: string;
}

const getInitials = (name?: string) =>
  (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CR';

export function AssigneeSelect({
  users,
  value,
  onChange,
  placeholder = 'Selecione um vendedor',
  unassignedLabel = 'Sem atribuição definida',
  className,
}: AssigneeSelectProps) {
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () =>
      Array.from(new Map((users || []).map((user) => [user.id, user])).values()).sort((a, b) => {
        if (a.role !== b.role) {
          return a.role === 'admin' ? -1 : 1;
        }
        return a.name.localeCompare(b.name, 'pt-BR');
      }),
    [users],
  );

  const selectedUser = options.find((user) => user.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'flex w-full items-center justify-between rounded-xl border border-gold-500/60 bg-background/50 px-4 py-3 text-left shadow-[0_0_0_1px_rgba(212,175,55,0.04)] transition-all hover:border-gold-400/80 hover:bg-background/70 focus:outline-none focus:ring-2 focus:ring-gold-500/30',
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/10">
              {selectedUser ? (
                <Avatar className="h-10 w-10 border border-gold-500/20">
                  <AvatarImage src={selectedUser.avatarUrl} alt={selectedUser.name} />
                  <AvatarFallback className="bg-gold-500/15 text-[11px] font-black uppercase text-gold-300">
                    {getInitials(selectedUser.name)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <UserRound className="h-4 w-4 text-gold-300" />
              )}
            </span>
            <span className="min-w-0">
              <span className={cn('block truncate text-sm font-semibold', selectedUser ? 'text-foreground' : 'text-muted-foreground')}>
                {selectedUser?.name || placeholder}
              </span>
              <span className="block truncate text-[11px] uppercase tracking-[0.22em] text-gold-500/60">
                {selectedUser ? (selectedUser.role === 'admin' ? 'Administrador' : selectedUser.sector || 'Equipe comercial') : 'Responsável pelo lead'}
              </span>
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-gold-400/70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] rounded-2xl border border-border bg-card p-0 shadow-2xl">
        <Command className="rounded-2xl bg-card">
          <div className="border-b border-border px-3 py-2">
            <CommandInput placeholder="Buscar por nome ou setor" className="rounded-xl border border-border bg-background/50 text-sm" />
          </div>
          <CommandList className="max-h-80">
            <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
            <CommandGroup heading="Equipe disponível" className="p-2">
              <CommandItem
                value={`sem atribuicao ${unassignedLabel}`}
                onSelect={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
                className="mb-1 flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 data-[selected=true]:border-gold-500/30 data-[selected=true]:bg-gold-500/10"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-border bg-background/50">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">{unassignedLabel}</span>
                  <span className="truncate text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Disponível para toda a equipe</span>
                </span>
                <Check className={cn('h-4 w-4 text-gold-400', !value ? 'opacity-100' : 'opacity-0')} />
              </CommandItem>
              {options.map((user) => (
                <CommandItem
                  key={user.id}
                  value={`${user.name} ${user.email} ${user.sector} ${user.role}`}
                  onSelect={() => {
                    onChange(user.id);
                    setOpen(false);
                  }}
                  className="mb-1 flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 data-[selected=true]:border-gold-500/30 data-[selected=true]:bg-gold-500/10"
                >
                  <Avatar className="h-10 w-10 border border-gold-500/20">
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    <AvatarFallback className="bg-gold-500/15 text-[11px] font-black uppercase text-gold-300">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">{user.name}</span>
                    <span className="flex items-center gap-2 truncate text-[11px] uppercase tracking-[0.22em] text-gold-500/60">
                      {user.role === 'admin' ? <ShieldCheck className="h-3.5 w-3.5" /> : null}
                      <span>{user.role === 'admin' ? 'Administrador' : user.sector || 'Equipe comercial'}</span>
                    </span>
                  </span>
                  <Check className={cn('h-4 w-4 text-gold-400', value === user.id ? 'opacity-100' : 'opacity-0')} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
