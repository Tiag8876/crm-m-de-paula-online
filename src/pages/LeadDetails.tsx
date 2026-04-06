import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import {
  ChevronLeft, Phone, MessageCircle, Mail, Calendar,
  Clock, Plus, Send, CheckCircle2,
  History, User, DollarSign, Briefcase, Pencil,
  FileText, Paperclip, AlertCircle, ListTodo, Video, X, ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar as DatePickerCalendar } from '@/components/ui/calendar';
import { LOSS_REASON_OPTIONS, isValidLossReasonDetail, validateLeadStatusChange } from '@/lib/leadValidation';

export function LeadDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, assignableUsers, fetchAssignableUsers } = useAuthStore();
  const {
    leads, campaigns, adGroups, ads, areasOfLaw, services, standardTasks, funnels, commercialDefaultFunnelId,
    updateLead, deleteLead, addNoteToLead, updateNoteInLead, deleteNoteFromLead,
    addDocumentToLead, updateDocumentInLead, deleteDocumentFromLead,
    addFollowUpToLead, updateFollowUpInLead, deleteFollowUpFromLead, updateFollowUpStatus,
    addTaskToLead, updateTaskInLead, deleteTaskFromLead, updateTaskStatus
  } = useStore();
  const lead = leads.find(l => l.id === id);

  const [newNote, setNewNote] = useState('');
  const [newNoteType, setNewNoteType] = useState<'message' | 'call' | 'meeting' | 'other'>('message');
  const [newDocName, setNewDocName] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [newDocFileData, setNewDocFileData] = useState<string | null>(null);
  const [newDocType, setNewDocType] = useState<'pdf' | 'image' | 'doc' | 'other'>('other');
  const [inputMode, setInputMode] = useState<'note' | 'document'>('note');

  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isAdSelectorOpen, setIsAdSelectorOpen] = useState(false);
  const [isAllLogsOpen, setIsAllLogsOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    cpf: '',
    legalArea: '',
    estimatedValue: '',
    areaOfLawId: '',
    serviceId: '',
    funnelId: '',
    campaignId: '',
    ownerUserId: '',
  });

  const [activeTab, setActiveTab] = useState<'history' | 'documents' | 'tasks'>('tasks');
  const [followUpType, setFollowUpType] = useState<'whatsapp' | 'ligacao' | 'email'>('whatsapp');
  const [followUpDate, setFollowUpDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [followUpTime, setFollowUpTime] = useState('09:00');
  const [followUpNotes, setFollowUpNotes] = useState('');
  useEffect(() => {
    fetchAssignableUsers().catch(() => null);
  }, [fetchAssignableUsers]);

  useEffect(() => {
    if (!lead) return;
    setEditForm({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      cpf: lead.cpf || '',
      legalArea: lead.legalArea || '',
      estimatedValue: lead.estimatedValue ? String(lead.estimatedValue) : '',
      areaOfLawId: lead.areaOfLawId || '',
      serviceId: lead.serviceId || '',
      funnelId: lead.funnelId || '',
      campaignId: lead.campaignId || '',
      ownerUserId: lead.ownerUserId || '',
    });
  }, [lead]);

  const campaign = campaigns.find(c => c.id === lead?.campaignId);
  const ad = ads.find(a => a.id === lead?.adId);

  const availableServices = services.filter(s => s.areaOfLawId === lead?.areaOfLawId);
  const availableAds = ads.filter(a => adGroups.find(ag => ag.id === a.adGroupId)?.campaignId === lead?.campaignId);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewDocFileData(reader.result as string);
        if (!newDocName) setNewDocName(file.name);
        if (file.type.includes('pdf')) setNewDocType('pdf');
        else if (file.type.includes('image')) setNewDocType('image');
        else if (file.type.includes('word') || file.type.includes('document')) setNewDocType('doc');
        else setNewDocType('other');
      };
      reader.readAsDataURL(file);
    }
  };

  if (!lead) {
    return (
      <div className="p-20 text-center">
        <h2 className="text-3xl font-serif font-bold text-primary">Lead não encontrado</h2>
        <Link to="/leads" className="text-muted-foreground hover:text-gold-400 mt-4 inline-block underline">Voltar para a lista</Link>
      </div>
    );
  }

  const commercialFunnels = (funnels || []).filter((funnel) => funnel.operation === 'commercial');
  const currentFunnel = commercialFunnels.find((funnel) => funnel.id === (lead.funnelId || commercialDefaultFunnelId))
    || commercialFunnels.find((funnel) => funnel.id === commercialDefaultFunnelId)
    || commercialFunnels[0];
  const sortedLogs = (lead.logs || []).slice().reverse();
  const visibleLogs = sortedLogs.slice(0, 5);
  const hasMoreLogs = sortedLogs.length > 5;
  const sortedStages = [...(currentFunnel?.stages || [])].sort((a, b) => a.order - b.order);
  const currentFieldSchema = [...(currentFunnel?.fieldSchema || [])].sort((a, b) => a.order - b.order);
  const currentStage = sortedStages.find(s => s.id === lead.status);
  const selectableUsers = (assignableUsers || []).filter((candidate) => candidate.active);
  const updateCustomField = (key: string, value: string) => {
    updateLead(lead.id, {
      customFields: {
        ...(lead.customFields || {}),
        [key]: value,
      },
    });
  };

  const handleDeleteLead = () => {
    const confirmed = window.confirm(`Deseja realmente excluir o lead "${lead.name}"?`);
    if (!confirmed) return;
    deleteLead(lead.id);
    navigate('/leads');
  };

  const handleSaveLeadEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateLead(lead.id, {
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      email: editForm.email.trim() || undefined,
      cpf: editForm.cpf.trim() || undefined,
      legalArea: editForm.legalArea.trim() || undefined,
      estimatedValue: editForm.estimatedValue ? Number(editForm.estimatedValue) : undefined,
      areaOfLawId: editForm.areaOfLawId || undefined,
      serviceId: editForm.serviceId || undefined,
      funnelId: editForm.funnelId || undefined,
      campaignId: editForm.campaignId || undefined,
      ownerUserId: editForm.ownerUserId || undefined,
    });
    setIsEditModalOpen(false);
  };

  const handleEditNote = (noteId: string, currentContent: string) => {
    const nextContent = prompt('Editar observação:', currentContent);
    if (nextContent === null) return;
    updateNoteInLead(lead.id, noteId, { content: nextContent.trim() });
  };

  const handleDeleteNote = (noteId: string) => {
    if (!confirm('Excluir esta observação?')) return;
    deleteNoteFromLead(lead.id, noteId);
  };

  const handleEditFollowUp = (followUpId: string, currentDate: string, currentNotes?: string) => {
    const nextDate = prompt('Editar data/hora do follow-up (ex: 2026-04-06T09:00)', currentDate);
    if (nextDate === null) return;
    const nextNotes = prompt('Editar objetivo do follow-up:', currentNotes || '');
    if (nextNotes === null) return;
    updateFollowUpInLead(lead.id, followUpId, { date: nextDate.trim(), notes: nextNotes.trim() || undefined });
  };

  const handleDeleteFollowUp = (followUpId: string) => {
    if (!confirm('Excluir este follow-up?')) return;
    deleteFollowUpFromLead(lead.id, followUpId);
  };

  const handleEditTask = (taskId: string, currentTitle: string, currentDescription?: string, currentDate?: string) => {
    const nextTitle = prompt('Editar título da tarefa:', currentTitle);
    if (nextTitle === null) return;
    const nextDescription = prompt('Editar descrição da tarefa:', currentDescription || '');
    if (nextDescription === null) return;
    const nextDate = prompt('Editar data da tarefa (YYYY-MM-DD):', currentDate || '');
    if (nextDate === null) return;
    updateTaskInLead(lead.id, taskId, {
      title: nextTitle.trim(),
      description: nextDescription.trim() || undefined,
      date: nextDate.trim(),
    });
  };

  const handleDeleteTask = (taskId: string) => {
    if (!confirm('Excluir esta tarefa?')) return;
    deleteTaskFromLead(lead.id, taskId);
  };

  const handleEditDocument = (documentId: string, currentName: string, currentUrl?: string) => {
    const nextName = prompt('Editar nome do documento:', currentName);
    if (nextName === null) return;
    const nextUrl = prompt('Editar link do documento (deixe vazio se não houver):', currentUrl || '');
    if (nextUrl === null) return;
    updateDocumentInLead(lead.id, documentId, {
      name: nextName.trim(),
      url: nextUrl.trim() || undefined,
    });
  };

  const handleDeleteDocument = (documentId: string) => {
    if (!confirm('Excluir este documento?')) return;
    deleteDocumentFromLead(lead.id, documentId);
  };

  const handleStatusChange = (nextStatus: string) => {
    if (nextStatus === 'perdido') {
      const reasonLabel = prompt(`Motivo de perda:\n${LOSS_REASON_OPTIONS.map((o) => `- ${o.label}`).join('\n')}`);
      if (!reasonLabel) return;
      const matched = LOSS_REASON_OPTIONS.find((o) => o.label.toLowerCase() === reasonLabel.trim().toLowerCase());
      if (!matched) {
        alert('Motivo inválido. Use um dos motivos listados.');
        return;
      }
      const detail = prompt('Descreva o motivo da perda com clareza (mínimo 12 caracteres):') || '';
      if (!isValidLossReasonDetail(detail)) {
        alert('Motivo de perda inválido. Evite justificativa genérica como "não respondeu".');
        return;
      }
      const nextLead = { ...lead, lossReasonCode: matched.value, lossReasonDetail: detail.trim() };
      const lockMessage = validateLeadStatusChange(nextLead, nextStatus);
      if (lockMessage) {
        alert(lockMessage);
        return;
      }
      updateLead(lead.id, { status: nextStatus, lossReasonCode: matched.value, lossReasonDetail: detail.trim() });
      return;
    }

    const lockMessage = validateLeadStatusChange(lead, nextStatus);
    if (lockMessage) {
      alert(lockMessage);
      return;
    }
    updateLead(lead.id, { status: nextStatus });
  };

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10">
      <header className="flex items-center justify-between">
        <button
          onClick={() => navigate('/leads')}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest">Voltar ao Pipeline</span>
        </button>
        <div className="flex gap-3 items-center">
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="px-4 py-2.5 rounded-lg border border-primary/40 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 transition-all inline-flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            Editar Cadastro
          </button>
          <button
            type="button"
            onClick={handleDeleteLead}
            className="px-4 py-2.5 rounded-lg border border-red-500/40 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all"
          >
            Excluir Lead
          </button>
          {/* Kanban stage selector with colored indicator */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: currentStage?.color || '#D4AF37' }}></div>
            <select
              value={lead.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-6 py-2.5 bg-card border border-border text-primary text-[10px] font-black rounded-lg uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {sortedStages.map(stage => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Lead Profile Section */}
      <section className="bg-card rounded-3xl border border-border shadow-2xl overflow-hidden">
        <div className="p-8 gold-gradient">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-2xl bg-background/20 backdrop-blur-md flex items-center justify-center border border-foreground/10">
              <User className="w-12 h-12 text-primary-foreground" />
            </div>
            <div className="text-primary-foreground">
              <h1 className="text-4xl font-serif font-bold tracking-tight">{lead.name}</h1>
              <div className="flex items-center gap-4 mt-2">
                <span
                  className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border"
                  style={{
                    backgroundColor: `${currentStage?.color}20`,
                    color: currentStage?.color,
                    borderColor: `${currentStage?.color}40`
                  }}
                >
                  {currentStage?.name || lead.status}
                </span>
                <span className="text-xs font-bold opacity-70">Registrado em {format(new Date(lead.createdAt), 'dd/MM/yyyy HH:mm')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-gold-500/60 uppercase tracking-widest">Nome do Lead</p>
            <input
              type="text"
              value={lead.name}
              onChange={(e) => updateLead(lead.id, { name: e.target.value })}
              className="w-full bg-transparent border-b border-border focus:border-primary focus:outline-none text-base font-bold"
            />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-gold-500/60 uppercase tracking-widest">Contato Direto</p>
            <div className="flex items-center gap-3 text-foreground">
              <Phone className="w-4 h-4 text-primary" />
              <input
                type="text"
                value={lead.phone}
                onChange={(e) => updateLead(lead.id, { phone: e.target.value })}
                className="bg-transparent border-b border-border focus:border-primary focus:outline-none text-sm font-bold w-full"
              />
            </div>
            <div className="flex items-center gap-3 text-muted-foreground text-sm">
              <Mail className="w-4 h-4 text-gold-500/50" />
              <input
                type="email"
                value={lead.email || ''}
                onChange={(e) => updateLead(lead.id, { email: e.target.value || undefined })}
                placeholder="Email"
                className="bg-transparent border-b border-border focus:border-primary focus:outline-none text-sm w-full"
              />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-gold-500/60 uppercase tracking-widest">Documento (CPF)</p>
            <div className="flex items-center gap-3 text-foreground">
              <User className="w-4 h-4 text-primary" />
              <input
                type="text"
                value={lead.cpf || ''}
                onChange={(e) => updateLead(lead.id, { cpf: e.target.value })}
                placeholder="000.000.000-00"
                className="bg-transparent border-b border-border focus:border-primary focus:outline-none text-sm font-bold w-full"
              />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-gold-500/60 uppercase tracking-widest">Área & Serviço</p>
            <div className="flex flex-col gap-2 mt-1">
              <select
                value={lead.areaOfLawId || ''}
                onChange={(e) => updateLead(lead.id, { areaOfLawId: e.target.value, serviceId: undefined })}
                className="bg-background/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Selecione a Área</option>
                {areasOfLaw.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {lead.areaOfLawId && (
                <select
                  value={lead.serviceId || ''}
                  onChange={(e) => {
                    const selectedService = services.find(s => s.id === e.target.value);
                    updateLead(lead.id, {
                      serviceId: e.target.value,
                      estimatedValue: selectedService?.price || lead.estimatedValue
                    });
                  }}
                  className="bg-background/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">Selecione o Serviço</option>
                  {availableServices.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>
            {lead.estimatedValue && (
              <div className="flex items-center gap-3 text-emerald-500 font-bold mt-2">
                <DollarSign className="w-4 h-4" />
                <span>R$ {lead.estimatedValue.toLocaleString()}</span>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-gold-500/60 uppercase tracking-widest">Origem do Lead</p>
            <div className="flex flex-col gap-2 mt-1">
              <select
                value={lead.campaignId || ''}
                onChange={(e) => {
                  const selectedCampaign = campaigns.find(c => c.id === e.target.value);
                  updateLead(lead.id, {
                    campaignId: e.target.value,
                    adGroupId: undefined,
                    adId: undefined,
                    areaOfLawId: selectedCampaign?.areaOfLawId || lead.areaOfLawId,
                    serviceId: selectedCampaign?.serviceId || lead.serviceId
                  });
                }}
                className="bg-background/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Selecione a Campanha</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              {/* Creative selector button */}
              <button
                onClick={() => setIsAdSelectorOpen(true)}
                disabled={!lead.campaignId}
                className="w-full bg-background/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground text-left flex items-center justify-between hover:border-gold-500/50 disabled:opacity-50"
              >
                <span>{ad ? ad.name : 'Selecionar Criativo'}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {ad && ad.mediaUrl && (
                <div className="mt-2 rounded-xl overflow-hidden border border-border bg-background aspect-video relative">
                  {ad.mediaType === 'video' ? (
                    <video src={ad.mediaUrl} className="w-full h-full object-cover" controls />
                  ) : (
                    <img src={ad.mediaUrl} alt={ad.name} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-background/60 p-1 backdrop-blur-sm">
                    <p className="text-[8px] text-foreground font-bold truncate text-center">{ad.name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-gold-500/60 uppercase tracking-widest">Vendedor Responsável</p>
            <select
              value={lead.ownerUserId || ''}
              onChange={(e) => updateLead(lead.id, { ownerUserId: e.target.value || undefined })}
              className="bg-background/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary w-full"
            >
              <option value="">Selecione um vendedor</option>
              {selectableUsers.map((assignableUser) => (
                <option key={assignableUser.id} value={assignableUser.id}>
                  {assignableUser.name}
                </option>
              ))}
            </select>
            {lead.status === 'perdido' && lead.lossReasonCode && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Motivo da perda: {LOSS_REASON_OPTIONS.find((o) => o.value === lead.lossReasonCode)?.label || lead.lossReasonCode}
              </p>
            )}
          </div>
        </div>
      </section>

      {currentFieldSchema.length > 0 && (
        <section className="bg-card rounded-3xl border border-border shadow-2xl overflow-hidden">
          <div className="border-b border-border bg-accent px-8 py-5">
            <h2 className="text-lg font-serif font-bold">Campos específicos do funil</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Estes campos acompanham o funil atual e deixam o cadastro aderente ao contexto dele.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 p-8 md:grid-cols-2">
            {currentFieldSchema.map((field) => (
              <div key={field.id} className={field.type === 'textarea' ? 'md:col-span-2 space-y-2' : 'space-y-2'}>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gold-500/60">
                  {field.label}
                </label>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left Column: Follow-ups & Actions */}
        <div className="space-y-10">
          <section className="bg-card rounded-3xl border border-border shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-border bg-accent flex items-center justify-between">
              <h2 className="text-lg font-serif font-bold text-foreground flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                Agenda
              </h2>
              <button
                onClick={() => setIsFollowUpModalOpen(true)}
                className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-gold-400 transition-all"
                title="Novo Agendamento"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto scrollbar-none">
              {(lead.followUps || []).filter(f => f.status === 'pendente').length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-border rounded-2xl">
                  <p className="text-muted-foreground italic text-sm">Nenhum follow-up agendado.</p>
                  <button
                    onClick={() => setIsFollowUpModalOpen(true)}
                    className="text-primary text-[10px] font-black uppercase tracking-widest mt-2 hover:underline"
                  >
                    Agendar Agora
                  </button>
                </div>
              ) : (
                (lead.followUps || []).filter(f => f.status === 'pendente').map((fu) => (
                  <div key={fu.id} className="p-4 bg-accent border border-border rounded-2xl group hover:border-gold-500/50 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {fu.type === 'whatsapp' ? <MessageCircle className="w-4 h-4 text-emerald-500" /> : <Phone className="w-4 h-4 text-blue-500" />}
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">{fu.type}</span>
                      </div>
                      <button
                        onClick={() => updateFollowUpStatus(lead.id, fu.id, 'concluido')}
                        className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-emerald-500 hover:border-emerald-500 transition-all group/check"
                        title="Marcar como concluído"
                      >
                        <CheckCircle2 className="w-4 h-4 text-transparent group-hover/check:text-primary-foreground" />
                      </button>
                    </div>
                    <p className="text-foreground text-sm font-bold">{format(new Date(fu.date), "dd/MM 'às' HH:mm")}</p>
                    {fu.notes && <p className="text-xs text-muted-foreground mt-2 italic">"{fu.notes}"</p>}
                    <div className="mt-3 flex gap-3">
                      <button type="button" onClick={() => handleEditFollowUp(fu.id, fu.date, fu.notes)} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                        Editar
                      </button>
                      <button type="button" onClick={() => handleDeleteFollowUp(fu.id)} className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:underline">
                        Excluir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Input Section (Notes & Docs) */}
          <section className="bg-card rounded-3xl border border-border shadow-2xl flex flex-col overflow-hidden">
            <div className="flex border-b border-border">
              <button
                onClick={() => setInputMode('note')}
                className={cn(
                  "flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all",
                  inputMode === 'note' ? "bg-accent text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Nova Observação
              </button>
              <button
                onClick={() => setInputMode('document')}
                className={cn(
                  "flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all",
                  inputMode === 'document' ? "bg-accent text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Anexar Documento
              </button>
            </div>
            <div className="p-6">
              {inputMode === 'note' ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    {(['message', 'call', 'meeting', 'other'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setNewNoteType(type)}
                        className={cn(
                          "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                          newNoteType === type
                            ? type === 'message' ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/50"
                            : type === 'call' ? "bg-blue-500/20 text-blue-500 border border-blue-500/50"
                            : type === 'meeting' ? "bg-purple-500/20 text-purple-500 border border-purple-500/50"
                            : "bg-gold-500/20 text-primary border border-gold-500/50"
                            : "bg-background/40 text-muted-foreground border border-border hover:border-gold-500/30"
                        )}
                      >
                        {type === 'message' ? 'Mensagem' : type === 'call' ? 'Ligação' : type === 'meeting' ? 'Reunião' : 'Outro'}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Digite os detalhes da conversa, objeções, etc..."
                      className="w-full p-4 bg-background/60 border border-border rounded-2xl text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all resize-none h-32"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const content = newNote.trim();
                        if (content) {
                          addNoteToLead(lead.id, newNoteType, content);
                          setNewNote('');
                        }
                      }}
                      className="absolute bottom-4 right-4 p-2 bg-primary text-primary-foreground rounded-lg hover:bg-gold-400 transition-all"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    placeholder="Nome do Documento (ex: Procuração)"
                    className="w-full px-4 py-3 bg-background/60 border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all"
                  />
                  <input
                    type="text"
                    value={newDocUrl}
                    onChange={(e) => setNewDocUrl(e.target.value)}
                    placeholder="Link do Documento (opcional)"
                    className="w-full px-4 py-3 bg-background/60 border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all"
                  />
                  <div className="relative">
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="w-full px-4 py-3 bg-background/60 border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-gold-500/10 file:text-primary hover:file:bg-gold-500/20 cursor-pointer"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (newDocName.trim()) {
                        addDocumentToLead(lead.id, {
                          name: newDocName,
                          url: newDocUrl,
                          fileData: newDocFileData || undefined,
                          type: newDocType
                        });
                        setNewDocName('');
                        setNewDocUrl('');
                        setNewDocFileData(null);
                        setActiveTab('documents');
                      }
                    }}
                    className="w-full py-3 bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-gold-400 transition-all"
                  >
                    Salvar Documento
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Central de Controle (Tabs) */}
        <div className="lg:col-span-2 bg-card rounded-3xl border border-border shadow-2xl flex flex-col overflow-hidden">
          <div className="flex border-b border-border bg-accent">
            {[
              { key: 'tasks', icon: ListTodo, label: 'Tarefas' },
              { key: 'documents', icon: FileText, label: 'Documentos' },
              { key: 'history', icon: History, label: 'Historico & Observacoes' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={cn(
                  "flex-1 py-5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                  activeTab === tab.key ? "text-primary border-b-2 border-primary bg-accent" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
          </div>

          <div className="p-8 flex-1 overflow-y-auto scrollbar-none min-h-[500px]">
            {activeTab === 'history' && (
              <div className="space-y-8">
                {(lead.notes || []).length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Observações do Vendedor</h3>
                    {(lead.notes || []).map((note) => (
                      <div key={note.id} className="p-5 bg-background/40 border border-border rounded-2xl">
                        <p className="text-foreground text-sm leading-relaxed">{note.content}</p>
                        <p className="text-[9px] text-muted-foreground mt-3 font-bold uppercase tracking-widest">
                          {format(new Date(note.createdAt), 'dd/MM/yyyy HH:mm')}
                        </p>
                        <div className="mt-3 flex gap-3">
                          <button type="button" onClick={() => handleEditNote(note.id, note.content)} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                            Editar
                          </button>
                          <button type="button" onClick={() => handleDeleteNote(note.id)} className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:underline">
                            Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Log do Sistema</h3>
                  <div className="space-y-6">
                    {visibleLogs.map((log) => (
                      <div key={log.id} className="relative pl-6 border-l border-border">
                        <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(212,175,55,0.5)]"></div>
                        <p className="text-[10px] text-gold-500/60 font-bold uppercase tracking-widest">{log.timestamp}</p>
                        <p className="text-sm text-foreground mt-1">{log.content}</p>
                      </div>
                    ))}
                  </div>
                  {hasMoreLogs && (
                    <button
                      onClick={() => setIsAllLogsOpen(true)}
                      className="w-full py-3 text-primary text-[10px] font-black uppercase tracking-widest hover:underline border border-border rounded-xl hover:bg-accent transition-all"
                    >
                      Ver Todos os Registros ({sortedLogs.length})
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="space-y-4">
                {(lead.documents || []).length === 0 ? (
                  <div className="text-center py-20">
                    <Paperclip className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground italic">Nenhum documento anexado a este lead.</p>
                    <p className="text-muted-foreground text-sm mt-2">Use o painel lateral para adicionar documentos ou links.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(lead.documents || []).map((doc) => (
                      <div key={doc.id} className="p-4 bg-background/40 border border-border rounded-2xl flex items-center justify-between group hover:border-gold-500/30 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-accent rounded-lg text-primary">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-foreground font-bold text-sm">{doc.name}</p>
                            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                              {format(new Date(doc.createdAt), 'dd/MM/yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {doc.url ? (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">
                              Abrir Link
                            </a>
                          ) : doc.fileData ? (
                            <a href={doc.fileData} download={doc.name} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">
                              Baixar Arquivo
                            </a>
                          ) : null}
                          <button type="button" onClick={() => handleEditDocument(doc.id, doc.name, doc.url)} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                            Editar
                          </button>
                          <button type="button" onClick={() => handleDeleteDocument(doc.id)} className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:underline">
                            Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Tarefas do Lead</h3>
                  <button
                    onClick={() => setIsTaskModalOpen(true)}
                    className="flex items-center gap-2 text-primary text-[10px] font-black uppercase tracking-widest hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    Nova Tarefa
                  </button>
                </div>

                <div className="space-y-4">
                  {(lead.tasks || []).length === 0 ? (
                    <div className="text-center py-20">
                      <ListTodo className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground italic">Nenhuma tarefa cadastrada para este lead.</p>
                    </div>
                  ) : (
                    (lead.tasks || []).map((task) => (
                      <div key={task.id} className={cn("p-4 bg-background/40 border rounded-2xl flex items-start justify-between group transition-all", task.status === 'concluida' ? "border-emerald-500/20 opacity-60" : "border-border hover:border-gold-500/30")}>
                        <div className="flex items-start gap-4">
                          <button
                            onClick={() => updateTaskStatus(lead.id, task.id, task.status === 'concluida' ? 'pendente' : 'concluida')}
                            className={cn("mt-1 w-5 h-5 rounded border flex items-center justify-center transition-all", task.status === 'concluida' ? "bg-emerald-500 border-emerald-500" : "border-border hover:border-primary")}
                          >
                            {task.status === 'concluida' && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                          </button>
                          <div>
                            <p className={cn("text-foreground font-bold text-sm", task.status === 'concluida' && "line-through text-muted-foreground")}>{task.title}</p>
                            {task.description && <p className="text-muted-foreground text-xs mt-1">{task.description}</p>}
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(task.date), 'dd/MM/yyyy')}
                              </span>
                              {task.isStandard && (
                                <span className="text-[9px] bg-accent text-primary px-2 py-0.5 rounded uppercase tracking-widest">
                                  Padrão
                                </span>
                              )}
                            </div>
                            <div className="mt-3 flex gap-3">
                              <button type="button" onClick={() => handleEditTask(task.id, task.title, task.description, task.date)} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                                Editar
                              </button>
                              <button type="button" onClick={() => handleDeleteTask(task.id)} className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:underline">
                                Excluir
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Follow-up Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-3xl p-8 w-full max-w-3xl shadow-2xl border border-border max-h-[90vh] overflow-y-auto scrollbar-none">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-serif font-bold gold-text-gradient">Editar Cadastro do Lead</h2>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="p-2 text-muted-foreground hover:text-primary rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveLeadEdit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Nome</label>
                <input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
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
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">CPF</label>
                <input
                  value={editForm.cpf}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, cpf: e.target.value }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Área Jurídica Livre</label>
                <input
                  value={editForm.legalArea}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, legalArea: e.target.value }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Valor Estimado</label>
                <input
                  type="number"
                  value={editForm.estimatedValue}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, estimatedValue: e.target.value }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Área de Atuação</label>
                <select
                  value={editForm.areaOfLawId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, areaOfLawId: e.target.value, serviceId: '' }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                >
                  <option value="">Selecione a Área</option>
                  {areasOfLaw.map((area) => (
                    <option key={area.id} value={area.id}>{area.name}</option>
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
                  <option value="">Selecione o Serviço</option>
                  {services
                    .filter((service) => !editForm.areaOfLawId || service.areaOfLawId === editForm.areaOfLawId)
                    .map((service) => (
                      <option key={service.id} value={service.id}>{service.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Funil</label>
                <select
                  value={editForm.funnelId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, funnelId: e.target.value, status: commercialFunnels.find((funnel) => funnel.id === e.target.value)?.stages?.[0]?.id || prev.status }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                >
                  <option value="">Selecione o funil</option>
                  {commercialFunnels.map((funnel) => (
                    <option key={funnel.id} value={funnel.id}>{funnel.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Campanha</label>
                <select
                  value={editForm.campaignId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, campaignId: e.target.value }))}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl"
                >
                  <option value="">Selecione a Campanha</option>
                  {campaigns.map((campaignItem) => (
                    <option key={campaignItem.id} value={campaignItem.id}>{campaignItem.name}</option>
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

      {isFollowUpModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-3xl p-8 w-full max-w-md shadow-2xl border border-border max-h-[90vh] overflow-y-auto scrollbar-none">
            <h2 className="text-2xl font-serif font-bold gold-text-gradient mb-6">Agendar Missao (Follow-up)</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!followUpDate || !followUpTime) return;
              addFollowUpToLead(lead.id, {
                type: followUpType,
                date: `${followUpDate}T${followUpTime}`,
                notes: followUpNotes,
              });
              setFollowUpNotes('');
              setFollowUpTime('09:00');
              setIsFollowUpModalOpen(false);
            }} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Canal de Contato</label>
                <select
                  value={followUpType}
                  onChange={(e) => setFollowUpType(e.target.value as 'whatsapp' | 'ligacao' | 'email')}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="ligacao">Ligacao Direta</option>
                  <option value="email">E-mail</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Data</label>
                  <input
                    required
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    type="date"
                    className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Hora</label>
                  <input
                    required
                    value={followUpTime}
                    onChange={(e) => setFollowUpTime(e.target.value)}
                    type="time"
                    className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Calendario</label>
                <div className="rounded-xl border border-border bg-background/40 p-2">
                  <DatePickerCalendar
                    mode="single"
                    selected={followUpDate ? new Date(`${followUpDate}T00:00:00`) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setFollowUpDate(format(date, 'yyyy-MM-dd'));
                      }
                    }}
                    className="mx-auto"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Objetivo da Missao</label>
                <textarea
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="Ex: Cobrar resposta sobre a proposta..."
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all h-24 resize-none"
                />
              </div>
              <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={() => setIsFollowUpModalOpen(false)} className="px-6 py-2 text-muted-foreground font-black text-[10px] uppercase tracking-widest">Cancelar</button>
                <button type="submit" className="px-8 py-3 bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-gold-400 transition-all shadow-xl">Agendar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-3xl p-8 w-full max-w-md shadow-2xl border border-border">
            <h2 className="text-2xl font-serif font-bold gold-text-gradient mb-6">Nova Tarefa</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const standardTaskId = formData.get('standardTask') as string;

              let title = formData.get('title') as string;
              let description = formData.get('description') as string;
              let isStandard = false;

              if (standardTaskId) {
                const stdTask = standardTasks.find(t => t.id === standardTaskId);
                if (stdTask) {
                  title = stdTask.title;
                  description = stdTask.description || '';
                  isStandard = true;
                }
              }

              addTaskToLead(lead.id, {
                title,
                description,
                date: formData.get('date') as string,
                isStandard
              });
              setIsTaskModalOpen(false);
            }} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Tarefa Padrão (Opcional)</label>
                <select
                  name="standardTask"
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all"
                  onChange={(e) => {
                    const form = e.target.closest('form');
                    const titleInput = form?.querySelector('input[name="title"]') as HTMLInputElement;
                    const descInput = form?.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
                    if (e.target.value) {
                      const stdTask = standardTasks.find(t => t.id === e.target.value);
                      if (stdTask) {
                        if (titleInput) titleInput.value = stdTask.title;
                        if (descInput) descInput.value = stdTask.description || '';
                        if (titleInput) titleInput.disabled = true;
                        if (descInput) descInput.disabled = true;
                      }
                    } else {
                      if (titleInput) { titleInput.value = ''; titleInput.disabled = false; }
                      if (descInput) { descInput.value = ''; descInput.disabled = false; }
                    }
                  }}
                >
                  <option value="">Criar Tarefa Personalizada</option>
                  {standardTasks.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Título da Tarefa</label>
                <input required name="title" type="text" placeholder="Ex: Enviar minuta de contrato" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Data Limite</label>
                <input required name="date" type="date" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Descrição (Opcional)</label>
                <textarea name="description" placeholder="Detalhes da tarefa..." className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all h-24 resize-none disabled:opacity-50" />
              </div>
              <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="px-6 py-2 text-muted-foreground font-black text-[10px] uppercase tracking-widest">Cancelar</button>
                <button type="submit" className="px-8 py-3 bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-gold-400 transition-all shadow-xl">Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Creative Selector Popup */}
      {isAdSelectorOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-3xl p-8 w-full max-w-2xl shadow-2xl border border-border max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-serif font-bold gold-text-gradient">Selecionar Criativo</h2>
              <button onClick={() => setIsAdSelectorOpen(false)} className="p-2 text-muted-foreground hover:text-primary rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-none">
              {availableAds.length === 0 ? (
                <div className="text-center py-20">
                  <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground italic">Nenhum criativo disponível para esta campanha.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {availableAds.map(a => {
                    const adGroup = adGroups.find(ag => ag.id === a.adGroupId);
                    return (
                      <button
                        key={a.id}
                        onClick={() => {
                          updateLead(lead.id, { adId: a.id, adGroupId: a.adGroupId });
                          setIsAdSelectorOpen(false);
                        }}
                        className={cn(
                          "flex flex-col gap-3 p-4 rounded-2xl border transition-all hover:border-gold-500/50 text-left",
                          lead.adId === a.id ? "border-primary bg-accent ring-2 ring-primary/30" : "border-border bg-background/40"
                        )}
                      >
                        <div className="aspect-video rounded-xl overflow-hidden border border-border bg-background">
                          {a.mediaType === 'video' ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <Video className="w-8 h-8 text-primary" />
                            </div>
                          ) : a.mediaUrl ? (
                            <img src={a.mediaUrl} alt={a.name} className="w-full h-full object-contain bg-background" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <Briefcase className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{a.name}</p>
                          {adGroup && (
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                              Conjunto: {adGroup.name}
                            </p>
                          )}
                        </div>
                        {lead.adId === a.id && (
                          <div className="flex items-center gap-1 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                            <CheckCircle2 className="w-3 h-3" /> Selecionado
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All Logs Popup */}
      {isAllLogsOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-3xl p-8 w-full max-w-2xl shadow-2xl border border-border max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-serif font-bold gold-text-gradient">Histórico Completo</h2>
              <button onClick={() => setIsAllLogsOpen(false)} className="p-2 text-muted-foreground hover:text-primary rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-none space-y-6">
              {sortedLogs.map((log) => (
                <div key={log.id} className="relative pl-6 border-l border-border">
                  <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(212,175,55,0.5)]"></div>
                  <p className="text-[10px] text-gold-500/60 font-bold uppercase tracking-widest">{log.timestamp}</p>
                  <p className="text-sm text-foreground mt-1">{log.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}







