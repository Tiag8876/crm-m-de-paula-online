import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, Plus, X, MessageCircle, PhoneCall, ListTodo } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { FollowUp, Task } from '@/types/crm';

type CalendarFollowUpItem = FollowUp & { leadName: string; leadId: string; itemType: 'followup' };
type CalendarTaskItem = Task & { leadName: string; leadId: string; itemType: 'task' };
type CalendarItem = CalendarFollowUpItem | CalendarTaskItem;

export function CalendarPage() {
  const { leads, addFollowUpToLead, addTaskToLead, kanbanStages } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalType, setModalType] = useState<'followup' | 'task'>('followup');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 0 }),
    end: addDays(startOfWeek(monthEnd, { weekStartsOn: 0 }), 6),
  });

  const allFollowUps: CalendarFollowUpItem[] = leads.flatMap((lead) =>
    (lead.followUps || []).map((fu) => ({ ...fu, leadName: lead.name, leadId: lead.id, itemType: 'followup' as const }))
  );

  const allTasks: CalendarTaskItem[] = leads.flatMap((lead) =>
    (lead.tasks || []).map((task) => ({ ...task, leadName: lead.name, leadId: lead.id, itemType: 'task' as const }))
  );

  const allItems: CalendarItem[] = [...allFollowUps, ...allTasks];

  const prevMonth = () => setCurrentDate(addDays(monthStart, -1));
  const nextMonth = () => setCurrentDate(addDays(monthEnd, 1));

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setIsModalOpen(true);
  };

  const groupedLeads = kanbanStages
    .sort((a, b) => a.order - b.order)
    .map(stage => ({
      stage,
      leads: leads.filter(l => l.status === stage.id)
    }))
    .filter(group => group.leads.length > 0);

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold gold-text-gradient tracking-tight">Agenda</h1>
          <p className="text-muted-foreground mt-2 font-medium tracking-widest uppercase text-[10px]">Gestão de Compromissos & Tarefas</p>
        </div>
        <div className="flex items-center gap-4 bg-card p-2 rounded-2xl border border-border shadow-xl">
          <button onClick={prevMonth} className="p-2 text-primary hover:bg-accent rounded-xl transition-all">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span className="text-foreground font-serif font-bold text-lg min-w-[180px] text-center uppercase tracking-widest">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <button onClick={nextMonth} className="p-2 text-primary hover:bg-accent rounded-xl transition-all">
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 bg-card rounded-3xl border border-border shadow-2xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-accent">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="py-4 text-center text-[10px] font-black text-gold-500/60 uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayItems = allItems.filter(item => isSameDay(new Date(item.date), day));
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();

              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(day)}
                  className={`min-h-[140px] p-3 border-r border-b border-border transition-all hover:bg-accent cursor-pointer group relative ${!isCurrentMonth ? 'opacity-20' : ''}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-sm font-bold ${isToday(day) ? 'w-8 h-8 gold-gradient text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-gold-500/20' : 'text-muted-foreground'}`}>
                      {format(day, 'd')}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-gold-500/20 rounded-md text-primary">
                      <Plus className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    {dayItems.slice(0, 3).map((item) => (
                      <div key={item.id} onClick={(e) => e.stopPropagation()}>
                        <Link
                          to={`/leads/${item.leadId}`}
                          className={cn(
                            "block p-1.5 rounded-lg text-[9px] font-bold uppercase tracking-tighter truncate border",
                            item.itemType === 'followup'
                              ? (item.status === 'concluido' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-gold-500/10 border-gold-500/30 text-primary')
                              : (item.status === 'concluida' ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' : 'bg-muted border-border text-muted-foreground')
                          )}
                        >
                          {item.itemType === 'followup' ? 'F' : 'T'} • {format(new Date(item.date), 'HH:mm')} • {item.leadName}
                        </Link>
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <p className="text-[8px] text-muted-foreground font-black uppercase tracking-widest text-center mt-1">
                        + {dayItems.length - 3} mais
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-8">
          <section className="bg-card rounded-3xl border border-border shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-border bg-accent">
              <h2 className="text-lg font-serif font-bold text-gold-100 flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary" />
                Próximos Passos
              </h2>
            </div>
            <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto scrollbar-none">
              {allItems
                .filter(item => new Date(item.date) >= new Date() && (item.status === 'pendente'))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(0, 8)
                .map((item) => (
                  <Link
                    key={item.id}
                    to={`/leads/${item.leadId}`}
                    className="block p-4 bg-background/40 rounded-2xl border border-border hover:border-gold-500/30 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-black text-gold-500/60 uppercase tracking-widest">
                        {format(new Date(item.date), "dd 'de' MMM • HH:mm", { locale: ptBR })}
                      </span>
                      {item.itemType === 'followup' ? (
                        item.type === 'whatsapp' ? <MessageCircle className="w-4 h-4 text-emerald-500" /> : <PhoneCall className="w-4 h-4 text-primary" />
                      ) : (
                        <ListTodo className="w-4 h-4 text-blue-500" />
                      )}
                    </div>
                    <p className="text-foreground font-bold group-hover:text-primary transition-colors">
                      {item.leadName}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 italic line-clamp-1">
                      {item.itemType === 'followup' ? item.notes : (item.title || item.description)}
                    </p>
                  </Link>
                ))}
              {allItems.filter(item => new Date(item.date) >= new Date() && (item.status === 'pendente')).length === 0 && (
                <p className="text-muted-foreground text-center italic py-10">Nenhum compromisso agendado.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {isModalOpen && selectedDate && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-3xl p-8 w-full max-w-md shadow-2xl border border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-serif font-bold gold-text-gradient">
                Agendar {modalType === 'followup' ? 'Follow-up' : 'Tarefa'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-muted-foreground hover:text-primary rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex gap-2 mb-6 p-1 bg-background/40 rounded-xl border border-border">
              <button
                onClick={() => setModalType('followup')}
                className={cn(
                  "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  modalType === 'followup' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Follow-up
              </button>
              <button
                onClick={() => setModalType('task')}
                className={cn(
                  "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  modalType === 'task' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Tarefa
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const leadId = formData.get('leadId') as string;
              const time = formData.get('time') as string;
              const dateStr = format(selectedDate, 'yyyy-MM-dd');

              if (modalType === 'followup') {
                const rawType = formData.get('type');
                const followUpType = rawType === 'email' || rawType === 'ligacao' || rawType === 'whatsapp' ? rawType : 'whatsapp';
                addFollowUpToLead(leadId, {
                  type: followUpType,
                  date: `${dateStr}T${time}`,
                  notes: formData.get('notes') as string,
                });
              } else {
                addTaskToLead(leadId, {
                  title: formData.get('title') as string,
                  description: formData.get('notes') as string,
                  date: `${dateStr}T${time}`,
                });
              }
              setIsModalOpen(false);
            }} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Lead (Organizado por Kanban)</label>
                <select required name="leadId" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all">
                  <option value="">Selecione o Lead</option>
                  {groupedLeads.map(group => (
                    <optgroup key={group.stage.id} label={group.stage.name.toUpperCase()} className="bg-card text-primary font-black">
                      {group.leads.map(l => (
                        <option key={l.id} value={l.id} className="text-foreground font-normal">
                          {l.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {modalType === 'followup' ? (
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Canal de Contato</label>
                  <select name="type" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all">
                    <option value="whatsapp">WhatsApp</option>
                    <option value="ligacao">Ligação Direta</option>
                    <option value="email">E-mail</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Título da Tarefa</label>
                  <input required name="title" type="text" placeholder="Ex: Enviar minuta de contrato" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Data</label>
                  <input type="text" value={format(selectedDate, 'dd/MM/yyyy')} disabled className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-muted-foreground focus:outline-none transition-all cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Hora</label>
                  <input required name="time" type="time" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Observações / Descrição</label>
                <textarea name="notes" placeholder="Detalhes importantes..." className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all h-24 resize-none" />
              </div>
              <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-muted-foreground font-black text-[10px] uppercase tracking-widest">Cancelar</button>
                <button type="submit" className="px-8 py-3 bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-gold-400 transition-all shadow-xl">Agendar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


