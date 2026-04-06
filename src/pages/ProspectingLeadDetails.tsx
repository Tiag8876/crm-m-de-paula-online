import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { ChevronLeft, MessageCircle, PhoneCall, CalendarPlus, CheckCircle2, Pencil, X } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

export function ProspectingLeadDetails() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, assignableUsers, fetchAssignableUsers } = useAuthStore();
  const {
    prospectLeads,
    funnels,
    prospectingDefaultFunnelId,
    services,
    updateProspectLead,
    deleteProspectLead,
    addNoteToProspectLead,
    updateNoteInProspectLead,
    deleteNoteFromProspectLead,
    addFollowUpToProspectLead,
    updateFollowUpInProspectLead,
    deleteFollowUpFromProspectLead,
    updateProspectFollowUpStatus,
    addTaskToProspectLead,
    updateTaskInProspectLead,
    deleteTaskFromProspectLead,
  } = useStore();

  const lead = (prospectLeads || []).find((item) => item.id === id);
  const [noteType, setNoteType] = useState<'message' | 'call' | 'meeting' | 'other'>('call');
  const [noteText, setNoteText] = useState('');
  const [followDate, setFollowDate] = useState('');
  const [followTime, setFollowTime] = useState('09:00');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDate, setTaskDate] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    clinicName: '',
    contactName: '',
    receptionistName: '',
    phone: '',
    email: '',
    cnpj: '',
    city: '',
    neighborhood: '',
    status: '',
    serviceId: '',
    funnelId: '',
    objectionReason: '',
    ownerUserId: '',
  });

  useEffect(() => {
    fetchAssignableUsers().catch(() => null);
  }, [fetchAssignableUsers]);

  useEffect(() => {
    if (!lead) return;
    setEditForm({
      clinicName: lead.clinicName || '',
      contactName: lead.contactName || '',
      receptionistName: lead.receptionistName || '',
      phone: lead.phone || '',
      email: lead.email || '',
      cnpj: lead.cnpj || '',
      city: lead.city || '',
      neighborhood: lead.neighborhood || '',
      status: lead.status || '',
      serviceId: lead.serviceId || '',
      funnelId: lead.funnelId || '',
      objectionReason: lead.objectionReason || '',
      ownerUserId: lead.ownerUserId || '',
    });
  }, [lead]);

  const prospectingFunnels = useMemo(
    () => (funnels || []).filter((funnel) => funnel.operation === 'prospecting'),
    [funnels],
  );
  const currentFunnel = useMemo(
    () => prospectingFunnels.find((funnel) => funnel.id === (lead?.funnelId || prospectingDefaultFunnelId))
      || prospectingFunnels.find((funnel) => funnel.id === prospectingDefaultFunnelId)
      || prospectingFunnels[0],
    [lead?.funnelId, prospectingDefaultFunnelId, prospectingFunnels],
  );
  const editFunnel = useMemo(
    () => prospectingFunnels.find((funnel) => funnel.id === editForm.funnelId)
      || currentFunnel,
    [currentFunnel, editForm.funnelId, prospectingFunnels],
  );
  const currentFieldSchema = useMemo(
    () => [...(currentFunnel?.fieldSchema || [])].sort((a, b) => a.order - b.order),
    [currentFunnel?.fieldSchema],
  );
  const stage = useMemo(
    () => (currentFunnel?.stages || []).find((item) => item.id === lead?.status),
    [currentFunnel?.stages, lead?.status]
  );
  const selectableUsers = (assignableUsers || []).filter((candidate) => candidate.active);
  const unifiedProspectingPath = currentFunnel
    ? `/leads?operation=prospecting&funnel=${currentFunnel.id}`
    : '/leads?operation=prospecting';

  if (!lead) {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-serif font-bold text-primary">Clínica não encontrada</h1>
        <Link to="/leads?operation=prospecting" className="text-muted-foreground hover:text-primary mt-3 inline-block">Voltar</Link>
      </div>
    );
  }

  const whatsappUrl = buildWhatsAppUrl(lead.phone);
  const updateCustomField = (key: string, value: string) => {
    updateProspectLead(lead.id, {
      customFields: {
        ...(lead.customFields || {}),
        [key]: value,
      },
    });
  };

  const submitNote = (event: FormEvent) => {
    event.preventDefault();
    if (!noteText.trim()) return;
    addNoteToProspectLead(lead.id, noteType, noteText.trim());
    setNoteText('');
  };

  const submitFollowup = (event: FormEvent) => {
    event.preventDefault();
    if (!followDate) return;
    addFollowUpToProspectLead(lead.id, {
      type: 'ligacao',
      date: `${followDate}T${followTime}:00`,
      notes: 'Retorno de prospecção',
    });
  };

  const handleDeleteClinic = () => {
    const confirmed = window.confirm(`Deseja realmente excluir a clínica "${lead.clinicName}"?`);
    if (!confirmed) return;
    deleteProspectLead(lead.id);
    navigate(unifiedProspectingPath);
  };

  const handleSaveProspectEdit = (event: FormEvent) => {
    event.preventDefault();
    updateProspectLead(lead.id, {
      clinicName: editForm.clinicName.trim(),
      contactName: editForm.contactName.trim(),
      receptionistName: editForm.receptionistName.trim() || undefined,
      phone: editForm.phone.trim(),
      email: editForm.email.trim() || undefined,
      cnpj: editForm.cnpj.trim() || undefined,
      city: editForm.city.trim() || undefined,
      neighborhood: editForm.neighborhood.trim() || undefined,
      status: editForm.status || lead.status,
      serviceId: editForm.serviceId || undefined,
      funnelId: editForm.funnelId || undefined,
      objectionReason: editForm.objectionReason || undefined,
      ownerUserId: editForm.ownerUserId || undefined,
    });
    setIsEditModalOpen(false);
  };

  const handleEditProspectNote = (noteId: string, currentContent: string) => {
    const nextContent = prompt('Editar registro de contato:', currentContent);
    if (nextContent === null) return;
    updateNoteInProspectLead(lead.id, noteId, { content: nextContent.trim() });
  };

  const handleDeleteProspectNote = (noteId: string) => {
    if (!confirm('Excluir este registro de contato?')) return;
    deleteNoteFromProspectLead(lead.id, noteId);
  };

  const handleEditProspectFollowUp = (followUpId: string, currentDate: string, currentNotes?: string) => {
    const nextDate = prompt('Editar data/hora do retorno (ex: 2026-04-06T09:00:00):', currentDate);
    if (nextDate === null) return;
    const nextNotes = prompt('Editar observação do retorno:', currentNotes || '');
    if (nextNotes === null) return;
    updateFollowUpInProspectLead(lead.id, followUpId, { date: nextDate.trim(), notes: nextNotes.trim() || undefined });
  };

  const handleDeleteProspectFollowUp = (followUpId: string) => {
    if (!confirm('Excluir este retorno?')) return;
    deleteFollowUpFromProspectLead(lead.id, followUpId);
  };

  const handleCreateTask = (event: FormEvent) => {
    event.preventDefault();
    if (!taskTitle.trim() || !taskDate) return;
    addTaskToProspectLead(lead.id, {
      title: taskTitle.trim(),
      description: taskDescription.trim() || undefined,
      date: taskDate,
    });
    setTaskTitle('');
    setTaskDescription('');
    setTaskDate('');
  };

  const handleEditProspectTask = (taskId: string, currentTitle: string, currentDescription?: string, currentDate?: string) => {
    const nextTitle = prompt('Editar título da tarefa:', currentTitle);
    if (nextTitle === null) return;
    const nextDescription = prompt('Editar descrição da tarefa:', currentDescription || '');
    if (nextDescription === null) return;
    const nextDate = prompt('Editar data da tarefa (YYYY-MM-DD):', currentDate || '');
    if (nextDate === null) return;
    updateTaskInProspectLead(lead.id, taskId, {
      title: nextTitle.trim(),
      description: nextDescription.trim() || undefined,
      date: nextDate.trim(),
    });
  };

  const handleDeleteProspectTask = (taskId: string) => {
    if (!confirm('Excluir esta tarefa?')) return;
    deleteTaskFromProspectLead(lead.id, taskId);
  };

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <button onClick={() => navigate(unifiedProspectingPath)} className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary">
          <ChevronLeft className="w-4 h-4" />
          Voltar ao Kanban de Prospecção
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="px-4 py-2 rounded-lg border border-primary/40 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 transition-all inline-flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            Editar Cadastro
          </button>
          <button
            type="button"
            onClick={handleDeleteClinic}
            className="px-4 py-2 rounded-lg border border-red-500/40 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all"
          >
            Excluir Clínica
          </button>
          <select
            value={lead.status}
            onChange={(e) => updateProspectLead(lead.id, { status: e.target.value })}
            className="px-4 py-2 rounded-lg border border-border bg-card text-xs uppercase tracking-widest"
          >
            {[...(currentFunnel?.stages || [])].sort((a, b) => a.order - b.order).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
      </header>

      <section className="bg-card border border-border rounded-2xl p-6">
        <input
          value={lead.clinicName}
          onChange={(e) => updateProspectLead(lead.id, { clinicName: e.target.value })}
          className="w-full text-4xl font-serif font-bold gold-text-gradient bg-transparent border-b border-border/50 focus:border-primary focus:outline-none"
        />
        <input
          value={lead.contactName}
          onChange={(e) => updateProspectLead(lead.id, { contactName: e.target.value })}
          className="w-full text-muted-foreground mt-1 bg-transparent border-b border-border/40 focus:border-primary focus:outline-none"
          placeholder="Responsável"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Recepcionista: {lead.receptionistName || '-'} | Bairro: {lead.neighborhood || '-'}
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <span className="px-3 py-1 rounded-full text-[10px] uppercase tracking-widest border border-border bg-accent">
            {stage?.name || lead.status}
          </span>
          <input
            value={lead.phone}
            onChange={(e) => updateProspectLead(lead.id, { phone: e.target.value })}
            className="text-sm text-muted-foreground bg-transparent border-b border-border/40 focus:border-primary focus:outline-none"
          />
          <input
            value={lead.email || ''}
            onChange={(e) => updateProspectLead(lead.id, { email: e.target.value || undefined })}
            placeholder="E-mail"
            className="text-sm text-muted-foreground bg-transparent border-b border-border/40 focus:border-primary focus:outline-none"
          />
          <input
            value={lead.cnpj || ''}
            onChange={(e) => updateProspectLead(lead.id, { cnpj: e.target.value || undefined })}
            placeholder="CNPJ"
            className="text-sm text-muted-foreground bg-transparent border-b border-border/40 focus:border-primary focus:outline-none"
          />
          <input
            value={lead.city || ''}
            onChange={(e) => updateProspectLead(lead.id, { city: e.target.value || undefined })}
            placeholder="Cidade"
            className="text-sm text-muted-foreground bg-transparent border-b border-border/40 focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex gap-2 mt-5">
          {whatsappUrl && (
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-emerald-500 hover:text-emerald-500 text-xs uppercase tracking-widest">
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
          )}
          <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs uppercase tracking-widest hover:border-primary">
            <PhoneCall className="w-4 h-4" />
            Ligar
          </a>
        </div>
      </section>

      {currentFieldSchema.length > 0 && (
        <section className="bg-card border border-border rounded-2xl p-6">
          <div className="mb-5">
            <h2 className="text-2xl font-serif font-bold">Campos específicos do funil</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Estes campos acompanham a lógica deste funil e podem ser ajustados direto aqui.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {currentFieldSchema.map((field) => (
              <div key={field.id} className={field.type === 'textarea' ? 'md:col-span-2 space-y-2' : 'space-y-2'}>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gold-500/60">{field.label}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    value={lead.customFields?.[field.key] || ''}
                    onChange={(e) => updateCustomField(field.key, e.target.value)}
                    placeholder={field.placeholder || field.helpText || ''}
                    className="min-h-[120px] w-full rounded-xl border border-border bg-background/40 px-4 py-3 text-sm"
                  />
                ) : (
                  <input
                    value={lead.customFields?.[field.key] || ''}
                    onChange={(e) => updateCustomField(field.key, e.target.value)}
                    type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
                    inputMode={field.type === 'number' || field.type === 'cpf' || field.type === 'cnpj' || field.type === 'phone' ? 'numeric' : undefined}
                    placeholder={field.placeholder || field.helpText || ''}
                    className="w-full rounded-xl border border-border bg-background/40 px-4 py-3 text-sm"
                  />
                )}
                {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-card border border-border rounded-2xl p-6 space-y-6">
          <h2 className="text-2xl font-serif font-bold">Registro de Contato e Observações</h2>
          <form onSubmit={submitNote} className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(['call', 'message', 'meeting', 'other'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setNoteType(type)}
                  className={`px-3 py-1 rounded-lg text-[10px] uppercase tracking-widest border ${noteType === type ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}
                >
                  {type === 'call' ? 'Ligação' : type === 'message' ? 'Mensagem' : type === 'meeting' ? 'Reunião' : 'Outro'}
                </button>
              ))}
            </div>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Digite objeções, necessidades e próximos passos..."
              className="w-full h-28 rounded-xl border border-border bg-background p-3 text-sm"
            />
            <div className="flex justify-end">
              <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest">Salvar registro</button>
            </div>
          </form>

          <div className="space-y-3">
            <h3 className="text-sm uppercase tracking-widest text-muted-foreground">Objeção principal</h3>
            <select
              value={lead.objectionReason || ''}
              onChange={(e) => updateProspectLead(lead.id, { objectionReason: e.target.value || undefined })}
              className="w-full rounded-lg border border-border bg-background p-2 text-sm"
            >
              <option value="">Selecione uma objeção</option>
              {(currentFunnel?.objections || []).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm uppercase tracking-widest text-muted-foreground">Dados da clínica</h3>
            <input
              value={lead.receptionistName || ''}
              onChange={(e) => updateProspectLead(lead.id, { receptionistName: e.target.value || undefined })}
              placeholder="Recepcionista"
              className="w-full rounded-lg border border-border bg-background p-2 text-sm"
            />
            <input
              value={lead.neighborhood || ''}
              onChange={(e) => updateProspectLead(lead.id, { neighborhood: e.target.value || undefined })}
              placeholder="Bairro"
              className="w-full rounded-lg border border-border bg-background p-2 text-sm"
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-sm uppercase tracking-widest text-muted-foreground">Timeline</h3>
            {(lead.notes || []).slice().reverse().map((note) => (
              <div key={note.id} className="rounded-xl border border-border bg-background/40 p-3">
                <p className="text-xs uppercase tracking-widest text-primary mb-1">{note.type}</p>
                <p className="text-sm">{note.content}</p>
                <div className="mt-3 flex gap-3">
                  <button type="button" onClick={() => handleEditProspectNote(note.id, note.content)} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                    Editar
                  </button>
                  <button type="button" onClick={() => handleDeleteProspectNote(note.id)} className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:underline">
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-serif font-bold text-xl mb-3">Playbook de Ligação</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{currentFunnel?.playbook || 'Nenhum playbook configurado para este funil.'}</p>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6 space-y-3">
            <h3 className="font-serif font-bold text-xl">Agendar Retorno</h3>
            <form onSubmit={submitFollowup} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={followDate} onChange={(e) => setFollowDate(e.target.value)} className="rounded-lg border border-border bg-background p-2 text-sm" required />
                <input type="time" value={followTime} onChange={(e) => setFollowTime(e.target.value)} className="rounded-lg border border-border bg-background p-2 text-sm" required />
              </div>
              <button type="submit" className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-xs uppercase tracking-widest hover:border-primary">
                <CalendarPlus className="w-4 h-4" />
                Agendar
              </button>
            </form>
            <div className="space-y-2 pt-2">
              {(lead.followUps || []).map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-background/40 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span>{new Date(item.date).toLocaleString('pt-BR')}</span>
                    {item.status === 'pendente' ? (
                      <button onClick={() => updateProspectFollowUpStatus(lead.id, item.id, 'concluido')} className="text-emerald-500 hover:underline">Concluir</button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-500"><CheckCircle2 className="w-3 h-3" />Concluído</span>
                    )}
                  </div>
                  <div className="mt-2 flex gap-3">
                    <button type="button" onClick={() => handleEditProspectFollowUp(item.id, item.date, item.notes)} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                      Editar
                    </button>
                    <button type="button" onClick={() => handleDeleteProspectFollowUp(item.id)} className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:underline">
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6 space-y-3">
            <h3 className="font-serif font-bold text-xl">Tarefas</h3>
            <form onSubmit={handleCreateTask} className="space-y-2">
              <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Título da tarefa" className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
              <input value={taskDate} onChange={(e) => setTaskDate(e.target.value)} type="date" className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
              <textarea value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder="Descrição (opcional)" className="w-full rounded-lg border border-border bg-background p-2 text-sm h-24 resize-none" />
              <button type="submit" className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-black uppercase tracking-widest text-primary-foreground">Adicionar tarefa</button>
            </form>
            <div className="space-y-2 pt-2">
              {(lead.tasks || []).map((task) => (
                <div key={task.id} className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{task.title}</p>
                      {task.description && <p className="text-xs text-muted-foreground mt-1">{task.description}</p>}
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">{task.date}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-3">
                    <button type="button" onClick={() => handleEditProspectTask(task.id, task.title, task.description, task.date)} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                      Editar
                    </button>
                    <button type="button" onClick={() => handleDeleteProspectTask(task.id)} className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:underline">
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6 space-y-2">
            <h3 className="font-serif font-bold text-xl">Serviço ofertado</h3>
            <select
              value={lead.serviceId || ''}
              onChange={(e) => updateProspectLead(lead.id, { serviceId: e.target.value || undefined })}
              className="w-full rounded-lg border border-border bg-background p-2 text-sm"
            >
              <option value="">Selecione um serviço</option>
              {(services || []).map((service) => (
                <option key={service.id} value={service.id}>{service.name}</option>
              ))}
            </select>
          </section>
          <section className="bg-card border border-border rounded-2xl p-6 space-y-2">
            <h3 className="font-serif font-bold text-xl">Atribuição</h3>
            <select
              value={lead.ownerUserId || ''}
              onChange={(e) => updateProspectLead(lead.id, { ownerUserId: e.target.value || undefined })}
              className="w-full rounded-lg border border-border bg-background p-2 text-sm"
            >
              <option value="">Sem atribuição (visível para vendedores)</option>
              {selectableUsers.map((assignableUser) => (
                <option key={assignableUser.id} value={assignableUser.id}>{assignableUser.name}</option>
              ))}
            </select>
          </section>
        </div>
      </section>

      {isEditModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-3xl p-8 w-full max-w-3xl shadow-2xl border border-border max-h-[90vh] overflow-y-auto scrollbar-none">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-serif font-bold gold-text-gradient">Editar Cadastro da Clínica</h2>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="p-2 text-muted-foreground hover:text-primary rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveProspectEdit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Nome da Clínica</label>
                <input
                  required
                  value={editForm.clinicName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, clinicName: e.target.value }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Responsável</label>
                <input
                  required
                  value={editForm.contactName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, contactName: e.target.value }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Recepcionista</label>
                <input
                  value={editForm.receptionistName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, receptionistName: e.target.value }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Telefone</label>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">E-mail</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">CNPJ</label>
                <input
                  value={editForm.cnpj}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, cnpj: e.target.value }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Cidade</label>
                <input
                  value={editForm.city}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, city: e.target.value }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Bairro</label>
                <input
                  value={editForm.neighborhood}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, neighborhood: e.target.value }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                >
                  {[...(editFunnel?.stages || [])].sort((a, b) => a.order - b.order).map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Funil</label>
                <select
                  value={editForm.funnelId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, funnelId: e.target.value, status: prospectingFunnels.find((funnel) => funnel.id === e.target.value)?.stages?.[0]?.id || prev.status }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                >
                  <option value="">Selecione o funil</option>
                  {prospectingFunnels.map((funnel) => (
                    <option key={funnel.id} value={funnel.id}>{funnel.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Serviço</label>
                <select
                  value={editForm.serviceId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, serviceId: e.target.value }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                >
                  <option value="">Selecione um serviço</option>
                  {(services || []).map((service) => (
                    <option key={service.id} value={service.id}>{service.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Objeção Principal</label>
                <select
                  value={editForm.objectionReason}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, objectionReason: e.target.value }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                >
                  <option value="">Selecione uma objeção</option>
                  {(editFunnel?.objections || []).map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Vendedor Responsável</label>
                <select
                  value={editForm.ownerUserId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, ownerUserId: e.target.value }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                >
                  <option value="">Sem atribuição</option>
                  {selectableUsers.map((assignableUser) => (
                      <option key={assignableUser.id} value={assignableUser.id}>{assignableUser.name}</option>
                    ))}
                </select>
              </div>

              <div className="md:col-span-2 flex justify-end gap-4 pt-4">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-6 py-2 text-muted-foreground font-black text-[10px] uppercase tracking-widest">
                  Cancelar
                </button>
                <button type="submit" className="px-8 py-3 bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-gold-400 transition-all shadow-xl">
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

