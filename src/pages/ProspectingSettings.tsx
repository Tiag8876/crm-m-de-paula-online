import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

export function ProspectingSettings() {
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
    <div className="p-10 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-5xl font-serif font-bold gold-text-gradient tracking-tight">Configurações da Prospecção</h1>
        <p className="text-muted-foreground mt-2 font-medium tracking-[0.1em] uppercase text-xs">
          Funil, objeções e playbook de ligação
        </p>
      </header>

      <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="text-xl font-serif font-bold">Etapas do Funil</h2>
        <div className="flex gap-3">
          <input value={newStageName} onChange={(e) => setNewStageName(e.target.value)} placeholder="Nome da etapa" className="flex-1 rounded-lg border border-border bg-background px-3 py-2" />
          <input type="color" value={newStageColor} onChange={(e) => setNewStageColor(e.target.value)} className="w-12 h-10 rounded-lg border border-border bg-background" />
          <button
            onClick={() => {
              if (!newStageName.trim()) return;
              addProspectKanbanStage(newStageName.trim(), newStageColor);
              setNewStageName('');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs uppercase tracking-widest font-black"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
        <div className="space-y-2">
          {sortedStages.map((stage, index) => (
            <div key={stage.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
              <button onClick={() => moveStage(stage.id, 'up')} disabled={index === 0} className="disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
              <button onClick={() => moveStage(stage.id, 'down')} disabled={index === sortedStages.length - 1} className="disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
              <div className="w-3 h-8 rounded-full" style={{ backgroundColor: stage.color }} />
              <input
                value={stage.name}
                onChange={(e) => updateProspectKanbanStage(stage.id, { name: e.target.value })}
                className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-sm"
              />
              <input type="color" value={stage.color} onChange={(e) => updateProspectKanbanStage(stage.id, { color: e.target.value })} className="w-10 h-8 rounded border border-border bg-background" />
              <button onClick={() => deleteProspectKanbanStage(stage.id)} className="text-red-400 hover:text-red-300">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="text-xl font-serif font-bold">Objeções padrão</h2>
        <div className="flex gap-3">
          <input value={newObjection} onChange={(e) => setNewObjection(e.target.value)} placeholder="Nova objeção" className="flex-1 rounded-lg border border-border bg-background px-3 py-2" />
          <button
            onClick={() => {
              addProspectObjection(newObjection);
              setNewObjection('');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs uppercase tracking-widest font-black"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
        <div className="space-y-2">
          {(prospectObjections || []).map((item) => (
            <div key={item} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
              <span className="text-sm">{item}</span>
              <button onClick={() => removeProspectObjection(item)} className="text-red-400 hover:text-red-300">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card border border-border rounded-2xl p-6 space-y-3">
        <h2 className="text-xl font-serif font-bold">Playbook de ligação</h2>
        <textarea
          value={prospectPlaybook}
          onChange={(e) => setProspectPlaybook(e.target.value)}
          className="w-full h-56 rounded-xl border border-border bg-background p-3 text-sm"
        />
        <p className="text-xs text-muted-foreground">Esse conteúdo aparece dentro da página da clínica para guiar o vendedor durante a ligação.</p>
      </section>
    </div>
  );
}

