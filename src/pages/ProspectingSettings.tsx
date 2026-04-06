import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

export function ProspectingSettings({ embedded = false }: { embedded?: boolean }) {
  const {
    prospectKanbanStages,
    addProspectKanbanStage,
    updateProspectKanbanStage,
    deleteProspectKanbanStage,
    reorderProspectKanbanStages,
    prospectObjections,
    addProspectObjection,
    removeProspectObjection,
    prospectPlaybook,
    setProspectPlaybook,
  } = useStore();

  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#D4AF37');
  const [newObjection, setNewObjection] = useState('');

  const sortedStages = [...(prospectKanbanStages || [])].sort((a, b) => a.order - b.order);

  const moveStage = (id: string, direction: 'up' | 'down') => {
    const list = [...sortedStages];
    const index = list.findIndex((stage) => stage.id === id);
    if (index < 0) return;
    if (direction === 'up' && index > 0) [list[index - 1], list[index]] = [list[index], list[index - 1]];
    if (direction === 'down' && index < list.length - 1) [list[index], list[index + 1]] = [list[index + 1], list[index]];
    reorderProspectKanbanStages(list.map((item, idx) => ({ ...item, order: idx })));
  };

  return (
    <div className={embedded ? 'space-y-6' : 'mx-auto max-w-7xl space-y-8 p-10'}>
      {!embedded && (
        <header>
          <h1 className="text-5xl font-serif font-bold gold-text-gradient tracking-tight">Configuracoes da Prospeccao</h1>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Funil, objecoes e playbook de ligacao
          </p>
        </header>
      )}

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div>
          <h2 className="text-xl font-serif font-bold">Etapas da prospeccao</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina o fluxo usado antes de um lead entrar no funil principal do escritorio.
          </p>
        </div>
        <div className="flex gap-3">
          <input value={newStageName} onChange={(e) => setNewStageName(e.target.value)} placeholder="Nome da etapa" className="flex-1 rounded-lg border border-border bg-background px-3 py-2" />
          <input type="color" value={newStageColor} onChange={(e) => setNewStageColor(e.target.value)} className="h-10 w-12 rounded-lg border border-border bg-background" />
          <button
            onClick={() => {
              if (!newStageName.trim()) return;
              addProspectKanbanStage(newStageName.trim(), newStageColor);
              setNewStageName('');
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-black uppercase tracking-widest text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </div>
        <div className="space-y-2">
          {sortedStages.map((stage, index) => (
            <div key={stage.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
              <button onClick={() => moveStage(stage.id, 'up')} disabled={index === 0} className="disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
              <button onClick={() => moveStage(stage.id, 'down')} disabled={index === sortedStages.length - 1} className="disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
              <div className="h-8 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
              <input
                value={stage.name}
                onChange={(e) => updateProspectKanbanStage(stage.id, { name: e.target.value })}
                className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-sm"
              />
              <input type="color" value={stage.color} onChange={(e) => updateProspectKanbanStage(stage.id, { color: e.target.value })} className="h-8 w-10 rounded border border-border bg-background" />
              <button onClick={() => deleteProspectKanbanStage(stage.id)} className="text-red-400 hover:text-red-300">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div>
          <h2 className="text-xl font-serif font-bold">Objeccoes padrao</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reuna respostas e argumentos que ajudam a equipe a lidar com as objecoes mais comuns.
          </p>
        </div>
        <div className="flex gap-3">
          <input value={newObjection} onChange={(e) => setNewObjection(e.target.value)} placeholder="Nova objecao" className="flex-1 rounded-lg border border-border bg-background px-3 py-2" />
          <button
            onClick={() => {
              if (!newObjection.trim()) return;
              addProspectObjection(newObjection.trim());
              setNewObjection('');
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-black uppercase tracking-widest text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </div>
        <div className="space-y-2">
          {(prospectObjections || []).map((item) => (
            <div key={item} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
              <span className="text-sm">{item}</span>
              <button onClick={() => removeProspectObjection(item)} className="text-red-400 hover:text-red-300">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
        <div>
          <h2 className="text-xl font-serif font-bold">Playbook de ligacao</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Mantenha aqui o roteiro usado pelos vendedores durante o primeiro contato.
          </p>
        </div>
        <textarea
          value={prospectPlaybook}
          onChange={(e) => setProspectPlaybook(e.target.value)}
          className="h-56 w-full rounded-xl border border-border bg-background p-3 text-sm"
        />
        <p className="text-xs text-muted-foreground">Esse conteudo apoia a equipe durante a ligacao e reduz variacao na abordagem.</p>
      </section>
    </div>
  );
}
