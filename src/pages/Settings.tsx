import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import {
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  ChevronDown,
  Copy,
  ListChecks,
  Plus,
  Shield,
  Star,
  Trash2,
  UserCircle2,
  Workflow,
} from 'lucide-react';
import { isAdminUser } from '@/lib/access';
import { buildEffectiveFieldSchema, getBaseFieldKeys, getBaseFieldSchema } from '@/lib/funnelFieldSchema';
import { UsersAdminPage } from '@/pages/UsersAdminPage';
import type { FunnelConfig, FunnelFieldType } from '@/types/crm';

type SettingsTab = 'profile' | 'team' | 'operations';
type OperationsSection = 'funnels' | 'areas' | 'sources' | 'tasks';
type StageDraft = { name: string; color: string };
type FunnelDraft = { name: string; description: string };
type ServiceDraft = { name: string; description: string; price: string };
type FieldDraft = {
  label: string;
  key: string;
  type: FunnelFieldType;
  required: boolean;
  placeholder: string;
  helpText: string;
};

const ADMIN_SECTION_LINKS = [
  {
    id: 'funnels',
    label: 'Funis e formulários',
    description: 'Crie, duplique e adapte cada funil aos dados que ele precisa pedir.',
    icon: Workflow,
  },
  {
    id: 'areas',
    label: 'Áreas de atuação',
    description: 'Organize especialidades do escritório sem espalhar isso em vários menus.',
    icon: BriefcaseBusiness,
  },
  {
    id: 'sources',
    label: 'Origens do lead',
    description: 'Defina de onde as oportunidades entram antes da equipe marcar campanha.',
    icon: Star,
  },
  {
    id: 'tasks',
    label: 'Tarefas padrão',
    description: 'Padronize próximas ações sem obrigar a equipe a memorizar o processo.',
    icon: ListChecks,
  },
] as const;

const BASE_FIELD_TYPE_OPTIONS: Array<{ value: FunnelFieldType; label: string }> = [
  { value: 'text', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Moeda' },
  { value: 'select', label: 'Seleção' },
  { value: 'multiselect', label: 'Múltipla escolha' },
  { value: 'user', label: 'Usuário responsável' },
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
];

const CUSTOM_FIELD_TYPE_OPTIONS: Array<{ value: FunnelFieldType; label: string }> = [
  { value: 'text', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'number', label: 'Número' },
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
];

const normalizeFieldKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export function Settings() {
  const { user, updateOwnProfile } = useAuthStore();
  const isAdmin = isAdminUser(user);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const requestedSection = searchParams.get('section');
  const initialTab: SettingsTab = requestedTab === 'team' || requestedTab === 'operations' ? requestedTab : 'profile';
  const validOperationSections = ADMIN_SECTION_LINKS.map((section) => section.id);
  const normalizedRequestedSection = requestedSection === 'services' ? 'areas' : requestedSection;
  const initialOperationSection: OperationsSection = validOperationSections.includes((normalizedRequestedSection || '') as OperationsSection)
    ? (normalizedRequestedSection as OperationsSection)
    : 'funnels';

  const {
    areasOfLaw,
    services,
    leadSources,
    standardTasks,
    funnels,
    commercialDefaultFunnelId,
    prospectingDefaultFunnelId,
    addAreaOfLaw,
    deleteAreaOfLaw,
    addService,
    deleteService,
    addLeadSource,
    updateLeadSource,
    deleteLeadSource,
    addStandardTask,
    deleteStandardTask,
    addFunnel,
    updateFunnel,
    duplicateFunnel,
    deleteFunnel,
    setDefaultFunnel,
    addFunnelStage,
    updateFunnelStage,
    deleteFunnelStage,
    reorderFunnelStages,
    addFunnelField,
    updateFunnelField,
    deleteFunnelField,
    reorderFunnelFields,
    addFunnelObjection,
    removeFunnelObjection,
    setFunnelPlaybook,
  } = useStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [activeOperationSection, setActiveOperationSection] = useState<OperationsSection>(initialOperationSection);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaDesc, setNewAreaDesc] = useState('');
  const [newLeadSourceName, setNewLeadSourceName] = useState('');
  const [newLeadSourceKind, setNewLeadSourceKind] = useState<'campaign' | 'referral' | 'partner' | 'organic' | 'other'>('referral');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newFunnelName, setNewFunnelName] = useState('');
  const [newFunnelDescription, setNewFunnelDescription] = useState('');
  const [newFunnelOperation, setNewFunnelOperation] = useState<FunnelConfig['operation']>('commercial');
  const [newFunnelAreaId, setNewFunnelAreaId] = useState('');
  const [stageDrafts, setStageDrafts] = useState<Record<string, StageDraft>>({});
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, FieldDraft>>({});
  const [objectionDrafts, setObjectionDrafts] = useState<Record<string, string>>({});
  const [funnelDrafts, setFunnelDrafts] = useState<Record<string, FunnelDraft>>({});
  const [expandedFunnels, setExpandedFunnels] = useState<Record<string, boolean>>({});
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});
  const [serviceDrafts, setServiceDrafts] = useState<Record<string, ServiceDraft>>({});
  const [expandedStageSections, setExpandedStageSections] = useState<Record<string, boolean>>({});
  const [expandedFieldSections, setExpandedFieldSections] = useState<Record<string, boolean>>({});
  const [fieldModalFunnelId, setFieldModalFunnelId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [profileCurrentPassword, setProfileCurrentPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const sortedFunnels = useMemo(
    () =>
      [...(funnels || [])].sort((a, b) => {
        if (a.operation !== b.operation) return a.operation.localeCompare(b.operation);
        const areaA = areasOfLaw.find((area) => area.id === a.areaOfLawId)?.name || '';
        const areaB = areasOfLaw.find((area) => area.id === b.areaOfLawId)?.name || '';
        if (areaA !== areaB) return areaA.localeCompare(areaB, 'pt-BR');
        return a.name.localeCompare(b.name);
      }),
    [areasOfLaw, funnels],
  );

  const servicesByArea = useMemo(
    () =>
      areasOfLaw.reduce<Record<string, typeof services>>((acc, area) => {
        acc[area.id] = services.filter((service) => service.areaOfLawId === area.id);
        return acc;
      }, {}),
    [areasOfLaw, services],
  );

  useEffect(() => {
    setProfileName(user?.name || '');
    setProfileEmail(user?.email || '');
    setProfileAvatarUrl(user?.avatarUrl || '');
  }, [user]);

  useEffect(() => {
    const nextDrafts: Record<string, FunnelDraft> = {};
    for (const funnel of sortedFunnels) {
      nextDrafts[funnel.id] = {
        name: funnel.name,
        description: funnel.description || '',
      };
    }
    setFunnelDrafts(nextDrafts);
  }, [sortedFunnels]);

  useEffect(() => {
    if (!isAdmin && activeTab !== 'profile') {
      setActiveTab('profile');
      setSearchParams({ tab: 'profile' }, { replace: true });
      return;
    }

    const nextTab: SettingsTab = requestedTab === 'team' || requestedTab === 'operations' ? requestedTab : 'profile';
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [activeTab, isAdmin, requestedTab, setSearchParams]);

  useEffect(() => {
    const normalizedSection = requestedSection === 'services' ? 'areas' : requestedSection;
    const nextSection: OperationsSection = validOperationSections.includes((normalizedSection || '') as OperationsSection)
      ? (normalizedSection as OperationsSection)
      : 'funnels';
    if (nextSection !== activeOperationSection) {
      setActiveOperationSection(nextSection);
    }
  }, [activeOperationSection, requestedSection, validOperationSections]);

  const setTab = (tab: SettingsTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    if (tab !== 'operations') {
      next.delete('section');
    }
    setSearchParams(next, { replace: true });
    setActiveTab(tab);
  };

  const jumpToSection = (sectionId: (typeof ADMIN_SECTION_LINKS)[number]['id']) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'operations');
    next.set('section', sectionId);
    setSearchParams(next, { replace: true });
    setActiveTab('operations');
    setActiveOperationSection(sectionId);
  };

  const getStageDraft = (funnelId: string) => stageDrafts[funnelId] || { name: '', color: '#D4AF37' };
  const getServiceDraft = (areaId: string): ServiceDraft =>
    serviceDrafts[areaId] || { name: '', description: '', price: '' };
  const getFieldDraft = (funnelId: string): FieldDraft =>
    fieldDrafts[funnelId] || {
      label: '',
      key: '',
      type: 'text',
      required: false,
      placeholder: '',
      helpText: '',
    };
  const getObjectionDraft = (funnelId: string) => objectionDrafts[funnelId] || '';

  const updateStageDraft = (funnelId: string, patch: Partial<StageDraft>) => {
    setStageDrafts((current) => ({
      ...current,
      [funnelId]: { ...getStageDraft(funnelId), ...patch },
    }));
  };

  const updateServiceDraft = (areaId: string, patch: Partial<ServiceDraft>) => {
    setServiceDrafts((current) => ({
      ...current,
      [areaId]: { ...getServiceDraft(areaId), ...patch },
    }));
  };

  const updateFieldDraft = (funnelId: string, patch: Partial<FieldDraft>) => {
    setFieldDrafts((current) => ({
      ...current,
      [funnelId]: { ...getFieldDraft(funnelId), ...patch },
    }));
  };

  const toggleStageSection = (funnelId: string) => {
    setExpandedStageSections((current) => ({ ...current, [funnelId]: !current[funnelId] }));
  };

  const toggleFieldSection = (funnelId: string) => {
    setExpandedFieldSections((current) => ({ ...current, [funnelId]: !current[funnelId] }));
  };

  const openFieldModal = (funnelId: string) => {
    setFieldModalFunnelId(funnelId);
  };

  const closeFieldModal = () => {
    setFieldModalFunnelId(null);
  };

  const toggleFunnelCard = (funnelId: string) => {
    setExpandedFunnels((current) => ({ ...current, [funnelId]: !current[funnelId] }));
  };

  const toggleAreaCard = (areaId: string) => {
    setExpandedAreas((current) => ({ ...current, [areaId]: !current[areaId] }));
  };

  const upsertFunnelFieldByKey = (
    funnel: FunnelConfig,
    key: string,
    baseField: ReturnType<typeof getBaseFieldSchema>[number],
    patch: Partial<Omit<ReturnType<typeof getBaseFieldSchema>[number], 'id' | 'order' | 'key'>>,
  ) => {
    const existing = (funnel.fieldSchema || []).find((field) => field.key === key);
    if (existing) {
      updateFunnelField(funnel.id, existing.id, patch);
      return;
    }

    addFunnelField(funnel.id, {
      key,
      label: patch.label ?? baseField.label,
      type: patch.type ?? baseField.type,
      required: patch.required ?? baseField.required,
      placeholder: patch.placeholder ?? baseField.placeholder,
      helpText: patch.helpText ?? baseField.helpText,
    });
  };

  const resetBaseFieldOverride = (funnel: FunnelConfig, key: string) => {
    const existing = (funnel.fieldSchema || []).find((field) => field.key === key);
    if (existing) {
      deleteFunnelField(funnel.id, existing.id);
    }
  };

  const handleAddArea = () => {
    if (!newAreaName.trim()) return;
    addAreaOfLaw(newAreaName, newAreaDesc);
    setNewAreaName('');
    setNewAreaDesc('');
  };

  const handleAddService = (areaId: string) => {
    const draft = getServiceDraft(areaId);
    if (!draft.name.trim()) return;
    addService(areaId, draft.name, draft.description, draft.price ? Number(draft.price) : undefined);
    setServiceDrafts((current) => ({
      ...current,
      [areaId]: { name: '', description: '', price: '' },
    }));
  };

  const handleAddLeadSource = () => {
    if (!newLeadSourceName.trim()) return;
    addLeadSource(newLeadSourceName.trim(), newLeadSourceKind);
    setNewLeadSourceName('');
    setNewLeadSourceKind('referral');
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    addStandardTask(newTaskTitle, newTaskDesc);
    setNewTaskTitle('');
    setNewTaskDesc('');
  };

  const handleAddFunnel = () => {
    if (!newFunnelName.trim()) return;
    addFunnel({
      name: newFunnelName.trim(),
      description: newFunnelDescription.trim() || undefined,
      operation: newFunnelOperation,
      areaOfLawId: newFunnelAreaId || undefined,
    });
    setNewFunnelName('');
    setNewFunnelDescription('');
    setNewFunnelOperation('commercial');
    setNewFunnelAreaId('');
  };

  const handleUpdateOwnProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);

    if (profileNewPassword && profileNewPassword !== profileConfirmPassword) {
      setProfileError('A confirmação da nova senha não confere.');
      return;
    }

    try {
      await updateOwnProfile({
        name: profileName.trim(),
        email: profileEmail.trim(),
        avatarUrl: profileAvatarUrl.trim(),
        currentPassword: profileCurrentPassword || undefined,
        newPassword: profileNewPassword || undefined,
      });
      setProfileCurrentPassword('');
      setProfileNewPassword('');
      setProfileConfirmPassword('');
      setProfileMessage('Perfil atualizado com sucesso.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Falha ao atualizar perfil.');
    }
  };

  const handleProfileAvatarFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileAvatarUrl(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsDataURL(file);
  };

  const tabs = [
    { key: 'profile' as const, icon: UserCircle2, label: 'Meu Perfil' },
    ...(isAdmin ? [{ key: 'team' as const, icon: Shield, label: 'Equipe' }] : []),
    ...(isAdmin ? [{ key: 'operations' as const, icon: Workflow, label: 'Operação do CRM' }] : []),
  ];

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl md:text-4xl font-serif font-bold text-primary">Configurações</h1>
      </div>

      <div className="mb-8 flex gap-3 overflow-x-auto border-b border-border pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-5 py-3 text-sm font-semibold uppercase tracking-wider transition-all ${activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-gold-400'}`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                <h2 className="text-xl font-serif text-gold-400">Meu perfil</h2>
              </div>
              <div className="rounded-full border border-border bg-background/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {user?.role === 'admin' ? 'Administrador' : 'Usuário da equipe'}
              </div>
            </div>

            <form onSubmit={handleUpdateOwnProfile} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2 flex items-center gap-4 rounded-xl border border-border bg-background/40 p-4">
                <div className="h-16 w-16 overflow-hidden rounded-full border border-border bg-card">
                  {profileAvatarUrl ? (
                    <img src={profileAvatarUrl} alt={profileName || user?.name || 'Perfil'} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-black uppercase tracking-widest text-primary">
                      {(profileName || user?.name || 'U').split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('')}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Foto de perfil</label>
                  <input type="file" accept="image/*" onChange={handleProfileAvatarFile} className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:font-bold file:text-primary-foreground hover:file:bg-gold-400" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Nome exibido</label>
                <input value={profileName} onChange={(event) => setProfileName(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Email de acesso</label>
                <input value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} type="email" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Senha atual</label>
                <input value={profileCurrentPassword} onChange={(event) => setProfileCurrentPassword(event.target.value)} type="password" placeholder="Obrigatória para trocar e-mail ou senha" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Nova senha</label>
                <input value={profileNewPassword} onChange={(event) => setProfileNewPassword(event.target.value)} type="password" placeholder="Deixe em branco para manter" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Confirmar nova senha</label>
                <input value={profileConfirmPassword} onChange={(event) => setProfileConfirmPassword(event.target.value)} type="password" placeholder="Repita a nova senha" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>

              <div className="md:col-span-2 flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                <p>Para trocar e-mail ou senha, informe sua senha atual.</p>
                <button type="submit" className="rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400">Salvar perfil</button>
              </div>

              {profileMessage && <p className="md:col-span-2 text-sm text-emerald-400">{profileMessage}</p>}
              {profileError && <p className="md:col-span-2 text-sm text-red-400">{profileError}</p>}
            </form>
          </div>
        </div>
      )}

      {isAdmin && activeTab === 'team' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-xl font-serif text-gold-400">Equipe</h2>
          </div>
          <UsersAdminPage embedded />
        </div>
      )}

      {isAdmin && activeTab === 'operations' && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-lg font-serif font-bold text-gold-400">Operação do CRM</h2>
              </div>

              <div className="grid gap-3">
                {ADMIN_SECTION_LINKS.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeOperationSection === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => jumpToSection(section.id)}
                      className={`rounded-2xl border p-4 text-left transition-all ${isActive ? 'border-primary bg-primary/10 shadow-[0_0_18px_rgba(212,175,55,0.12)]' : 'border-border bg-card hover:border-primary/60 hover:bg-accent/40'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${isActive ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-background/40 text-primary'}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black uppercase tracking-[0.16em] text-foreground">{section.label}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="space-y-6">

          {activeOperationSection === 'funnels' && (
          <section id="settings-section-funnels" className="space-y-6 rounded-xl border border-border bg-card p-6">
            <div>
              <h3 className="text-xl font-serif text-gold-400">Funis e formulários</h3>
            </div>

            <div className="grid gap-4 rounded-xl border border-border bg-background/40 p-5 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Nome do funil</label>
                <input type="text" value={newFunnelName} onChange={(event) => setNewFunnelName(event.target.value)} className="w-full rounded-lg border border-border bg-background px-4 py-3" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Tipo de operação</label>
                <select value={newFunnelOperation} onChange={(event) => setNewFunnelOperation(event.target.value as FunnelConfig['operation'])} className="w-full rounded-lg border border-border bg-background px-4 py-3">
                <option value="commercial">Comercial</option>
                <option value="prospecting">Prospecção</option>
              </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Área de atuação</label>
                <select value={newFunnelAreaId} onChange={(event) => setNewFunnelAreaId(event.target.value)} className="w-full rounded-lg border border-border bg-background px-4 py-3">
                  <option value="">Sem área vinculada</option>
                  {areasOfLaw.map((area) => (
                    <option key={area.id} value={area.id}>{area.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Descrição</label>
                <input type="text" value={newFunnelDescription} onChange={(event) => setNewFunnelDescription(event.target.value)} className="w-full rounded-lg border border-border bg-background px-4 py-3" />
              </div>
              <div className="lg:col-span-2 flex justify-end">
                <button onClick={handleAddFunnel} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400">
                  <Plus className="h-4 w-4" /> Criar funil
                </button>
              </div>
            </div>
            <div className="space-y-6">
              {sortedFunnels.map((funnel) => {
                const isDefault = funnel.operation === 'commercial' ? funnel.id === commercialDefaultFunnelId : funnel.id === prospectingDefaultFunnelId;
                const sortedStages = [...(funnel.stages || [])].sort((a, b) => a.order - b.order);
                const draft = funnelDrafts[funnel.id] || { name: funnel.name, description: funnel.description || '' };
                const stageDraft = getStageDraft(funnel.id);
                const objectionDraft = getObjectionDraft(funnel.id);
                const effectiveFields = buildEffectiveFieldSchema(funnel);
                const baseFieldKeys = getBaseFieldKeys(funnel.operation);
                const baseFields = effectiveFields.filter((field) => baseFieldKeys.has(field.key));
                const customFields = effectiveFields.filter((field) => !baseFieldKeys.has(field.key));
                const fieldOverrides = new Map((funnel.fieldSchema || []).map((field) => [field.key, field]));
                const isFunnelOpen = Boolean(expandedFunnels[funnel.id]);
                const isStageOpen = Boolean(expandedStageSections[funnel.id]);
                const isFieldOpen = Boolean(expandedFieldSections[funnel.id]);
                const linkedArea = areasOfLaw.find((area) => area.id === funnel.areaOfLawId);

                return (
                  <article key={funnel.id} className="overflow-hidden rounded-2xl border border-border bg-background/30">
                    <div className="flex flex-col gap-4 border-b border-border/70 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
                      <button
                        type="button"
                        onClick={() => toggleFunnelCard(funnel.id)}
                        className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
                      >
                        <div className="min-w-0 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="truncate font-serif text-xl font-bold text-foreground">{funnel.name}</h4>
                            <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                              {funnel.operation === 'commercial' ? 'Comercial' : 'Prospecção'}
                            </span>
                            {linkedArea && (
                              <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                                {linkedArea.name}
                              </span>
                            )}
                            {isDefault && (
                              <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-primary-foreground">
                                Principal
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isFunnelOpen ? 'rotate-180' : ''}`} />
                      </button>

                      <div className="flex flex-wrap gap-2">
                        {!isDefault && (
                          <button
                            type="button"
                            onClick={() => setDefaultFunnel(funnel.operation, funnel.id)}
                            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:text-primary"
                          >
                            <Star className="h-4 w-4" /> Principal
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => duplicateFunnel(funnel.id)}
                          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:text-primary"
                        >
                          <Copy className="h-4 w-4" /> Duplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Excluir o funil "${funnel.name}"?`)) {
                              deleteFunnel(funnel.id);
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" /> Excluir
                        </button>
                      </div>
                    </div>

                    {isFunnelOpen && (
                      <div className="space-y-5 px-5 py-5">
                        <div className="grid gap-4 xl:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Nome do funil</label>
                            <input
                              value={draft.name}
                              onChange={(event) => setFunnelDrafts((current) => ({ ...current, [funnel.id]: { ...draft, name: event.target.value } }))}
                              onBlur={() => updateFunnel(funnel.id, { name: draft.name.trim() || funnel.name })}
                              className="w-full rounded-lg border border-border bg-card px-4 py-3 font-semibold"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Descrição</label>
                            <input
                              value={draft.description}
                              onChange={(event) => setFunnelDrafts((current) => ({ ...current, [funnel.id]: { ...draft, description: event.target.value } }))}
                              onBlur={() => updateFunnel(funnel.id, { description: draft.description.trim() || undefined })}
                              className="w-full rounded-lg border border-border bg-card px-4 py-3"
                            />
                          </div>
                          <div className="space-y-2 xl:max-w-md">
                            <label className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Área de atuação</label>
                            <select
                              value={funnel.areaOfLawId || ''}
                              onChange={(event) => updateFunnel(funnel.id, { areaOfLawId: event.target.value || undefined })}
                              className="w-full rounded-lg border border-border bg-card px-4 py-3"
                            >
                              <option value="">Sem área vinculada</option>
                              {areasOfLaw.map((area) => (
                                <option key={area.id} value={area.id}>{area.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
                          <button
                            type="button"
                            onClick={() => toggleStageSection(funnel.id)}
                            className="flex w-full items-center justify-between gap-4 text-left"
                          >
                            <div>
                              <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gold-500/80">Etapas</h4>
                              <span className="text-xs text-muted-foreground">{sortedStages.length} etapa(s)</span>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isStageOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {isStageOpen && (
                            <div className="space-y-3">
                              {sortedStages.map((stage, index) => (
                                <div key={stage.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4 lg:flex-row lg:items-center">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={index === 0}
                                      onClick={() => {
                                        const reordered = [...sortedStages];
                                        [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
                                        reorderFunnelStages(funnel.id, reordered.map((item, order) => ({ ...item, order })));
                                      }}
                                      className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30"
                                    >
                                      <ArrowUp className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={index === sortedStages.length - 1}
                                      onClick={() => {
                                        const reordered = [...sortedStages];
                                        [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
                                        reorderFunnelStages(funnel.id, reordered.map((item, order) => ({ ...item, order })));
                                      }}
                                      className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30"
                                    >
                                      <ArrowDown className="h-4 w-4" />
                                    </button>
                                    <div className="h-8 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
                                  </div>
                                  <input
                                    value={stage.name}
                                    onChange={(event) => updateFunnelStage(funnel.id, stage.id, { name: event.target.value })}
                                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2"
                                  />
                                  <input
                                    type="color"
                                    value={stage.color}
                                    onChange={(event) => updateFunnelStage(funnel.id, stage.id, { color: event.target.value })}
                                    className="h-10 w-12 rounded-lg border border-border bg-background"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => deleteFunnelStage(funnel.id, stage.id)}
                                    className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-500/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}

                              <div className="grid gap-3 rounded-xl border border-dashed border-border bg-background/40 p-4 md:grid-cols-[1fr_auto_auto]">
                                <input
                                  value={stageDraft.name}
                                  onChange={(event) => updateStageDraft(funnel.id, { name: event.target.value })}
                                  placeholder="Nova etapa"
                                  className="rounded-lg border border-border bg-background px-3 py-2"
                                />
                                <input
                                  type="color"
                                  value={stageDraft.color}
                                  onChange={(event) => updateStageDraft(funnel.id, { color: event.target.value })}
                                  className="h-10 w-12 rounded-lg border border-border bg-background"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!stageDraft.name.trim()) return;
                                    addFunnelStage(funnel.id, stageDraft.name.trim(), stageDraft.color);
                                    setStageDrafts((current) => ({ ...current, [funnel.id]: { name: '', color: '#D4AF37' } }));
                                  }}
                                  className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400"
                                >
                                  <Plus className="h-4 w-4" /> Adicionar
                                </button>
                              </div>
                            </div>
                          )}
                        </section>

                        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
                          <button
                            type="button"
                            onClick={() => toggleFieldSection(funnel.id)}
                            className="flex w-full items-center justify-between gap-4 text-left"
                          >
                            <div>
                              <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gold-500/80">Campos do cadastro</h4>
                              <span className="text-xs text-muted-foreground">{effectiveFields.length} campo(s)</span>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isFieldOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {isFieldOpen && (
                            <div className="space-y-4">
                              <div className="grid gap-3">
                                {baseFields.map((field) => {
                                  const baseDefinition = getBaseFieldSchema(funnel.operation).find((item) => item.key === field.key)!;
                                  const hasOverride = fieldOverrides.has(field.key);
                                  return (
                                    <div key={field.key} className="rounded-xl border border-border bg-background/40 p-4">
                                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                        <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Campo padrão</p>
                                        {hasOverride && (
                                          <button
                                            type="button"
                                            onClick={() => resetBaseFieldOverride(funnel, field.key)}
                                            className="rounded-lg border border-border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:text-primary"
                                          >
                                            Restaurar padrão
                                          </button>
                                        )}
                                      </div>
                                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_180px]">
                                        <input
                                          value={field.label}
                                          onChange={(event) => upsertFunnelFieldByKey(funnel, field.key, baseDefinition, { label: event.target.value })}
                                          className="w-full rounded-lg border border-border bg-background px-3 py-2"
                                        />
                                        <select
                                          value={field.type}
                                          onChange={(event) => upsertFunnelFieldByKey(funnel, field.key, baseDefinition, { type: event.target.value as FunnelFieldType })}
                                          className="w-full rounded-lg border border-border bg-background px-3 py-2"
                                        >
                                          {BASE_FIELD_TYPE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                          ))}
                                        </select>
                                        <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(field.required)}
                                            onChange={(event) => upsertFunnelFieldByKey(funnel, field.key, baseDefinition, { required: event.target.checked })}
                                            className="rounded border-border bg-background"
                                          />
                                          Obrigatório
                                        </label>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="grid gap-3">
                                {customFields.map((field, index) => (
                                  <div key={field.id} className="rounded-xl border border-border bg-background/40 p-4">
                                    <div className="grid gap-3 xl:grid-cols-[auto_minmax(0,1fr)_220px_180px_auto] xl:items-center">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          disabled={index === 0}
                                          onClick={() => {
                                            const reordered = [...customFields];
                                            [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
                                            reorderFunnelFields(funnel.id, [
                                              ...(funnel.fieldSchema || []).filter((item) => baseFieldKeys.has(item.key)),
                                              ...reordered.map((item, order) => ({ ...item, order })),
                                            ]);
                                          }}
                                          className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30"
                                        >
                                          <ArrowUp className="h-4 w-4" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={index === customFields.length - 1}
                                          onClick={() => {
                                            const reordered = [...customFields];
                                            [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
                                            reorderFunnelFields(funnel.id, [
                                              ...(funnel.fieldSchema || []).filter((item) => baseFieldKeys.has(item.key)),
                                              ...reordered.map((item, order) => ({ ...item, order })),
                                            ]);
                                          }}
                                          className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30"
                                        >
                                          <ArrowDown className="h-4 w-4" />
                                        </button>
                                      </div>
                                      <input
                                        value={field.label}
                                        onChange={(event) => updateFunnelField(funnel.id, field.id, {
                                          label: event.target.value,
                                          key: normalizeFieldKey(event.target.value || field.key),
                                        })}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2"
                                      />
                                      <select
                                        value={field.type}
                                        onChange={(event) => updateFunnelField(funnel.id, field.id, { type: event.target.value as FunnelFieldType })}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2"
                                      >
                                        {CUSTOM_FIELD_TYPE_OPTIONS.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                      </select>
                                      <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(field.required)}
                                          onChange={(event) => updateFunnelField(funnel.id, field.id, { required: event.target.checked })}
                                          className="rounded border-border bg-background"
                                        />
                                        Obrigatório
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => deleteFunnelField(funnel.id, field.id)}
                                        className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-500/10"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => openFieldModal(funnel.id)}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400"
                                >
                                  <Plus className="h-4 w-4" /> Adicionar campo
                                </button>
                              </div>
                            </div>
                          )}
                        </section>

                        {funnel.operation === 'prospecting' && (
                          <div className="grid gap-5 xl:grid-cols-2">
                            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                              <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gold-500/80">Objeções</h4>
                              <div className="flex gap-2">
                                <input
                                  value={objectionDraft}
                                  onChange={(event) => setObjectionDrafts((current) => ({ ...current, [funnel.id]: event.target.value }))}
                                  placeholder="Nova objeção"
                                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!objectionDraft.trim()) return;
                                    addFunnelObjection(funnel.id, objectionDraft.trim());
                                    setObjectionDrafts((current) => ({ ...current, [funnel.id]: '' }));
                                  }}
                                  className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400"
                                >
                                  Adicionar
                                </button>
                              </div>
                              <div className="space-y-2">
                                {(funnel.objections || []).map((item) => (
                                  <div key={item} className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-3 py-2 text-sm">
                                    <span>{item}</span>
                                    <button type="button" onClick={() => removeFunnelObjection(funnel.id, item)} className="text-red-400 hover:text-red-300">
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                              <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gold-500/80">Playbook</h4>
                              <textarea
                                value={funnel.playbook || ''}
                                onChange={(event) => setFunnelPlaybook(funnel.id, event.target.value)}
                                className="h-56 w-full rounded-xl border border-border bg-background p-3 text-sm"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}

            </div>
          </section>
          )}
          {activeOperationSection === 'areas' && (
          <section id="settings-section-areas" className="space-y-6 rounded-xl border border-border bg-card p-6">
            <div>
              <h3 className="text-xl font-serif text-gold-400">Áreas de atuação</h3>
            </div>
            <div className="flex flex-col gap-4 xl:flex-row">
              <input type="text" placeholder="Nome da área" value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} className="flex-1 rounded-lg border border-border bg-background px-4 py-2" />
              <input type="text" placeholder="Descrição curta" value={newAreaDesc} onChange={(e) => setNewAreaDesc(e.target.value)} className="flex-1 rounded-lg border border-border bg-background px-4 py-2" />
              <button onClick={handleAddArea} className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400">
                <Plus className="h-4 w-4" /> Adicionar
              </button>
            </div>
            <div className="grid gap-4">
              {areasOfLaw.map((area) => (
                <article key={area.id} className="overflow-hidden rounded-xl border border-border bg-background/40">
                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <button
                      type="button"
                      onClick={() => toggleAreaCard(area.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className="rounded-lg border border-border bg-card p-2 text-gold-400">
                        <ChevronDown className={`h-4 w-4 transition-transform ${expandedAreas[area.id] ? 'rotate-180' : ''}`} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate text-lg font-bold text-gold-100">{area.name}</h4>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          <span>{servicesByArea[area.id]?.length || 0} serviço(s)</span>
                          {area.description ? <span className="normal-case tracking-normal">{area.description}</span> : null}
                        </div>
                      </div>
                    </button>
                    <button onClick={() => deleteAreaOfLaw(area.id)} className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>

                  {expandedAreas[area.id] && (
                    <div className="space-y-5 border-t border-border px-5 py-5">
                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_180px_auto]">
                        <input
                          type="text"
                          placeholder="Nome do serviço"
                          value={getServiceDraft(area.id).name}
                          onChange={(e) => updateServiceDraft(area.id, { name: e.target.value })}
                          className="rounded-lg border border-border bg-background px-4 py-2"
                        />
                        <input
                          type="text"
                          placeholder="Descrição curta"
                          value={getServiceDraft(area.id).description}
                          onChange={(e) => updateServiceDraft(area.id, { description: e.target.value })}
                          className="rounded-lg border border-border bg-background px-4 py-2"
                        />
                        <input
                          type="number"
                          placeholder="Valor estimado"
                          value={getServiceDraft(area.id).price}
                          onChange={(e) => updateServiceDraft(area.id, { price: e.target.value })}
                          className="rounded-lg border border-border bg-background px-4 py-2"
                        />
                        <button
                          onClick={() => handleAddService(area.id)}
                          disabled={!getServiceDraft(area.id).name.trim()}
                          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" /> Adicionar
                        </button>
                      </div>

                      <div className="space-y-3">
                        {servicesByArea[area.id]?.length ? (
                          servicesByArea[area.id].map((service) => (
                            <div key={service.id} className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-4 py-3">
                              <div>
                                <h5 className="text-sm font-bold text-gold-100">{service.name}</h5>
                                {service.description ? <p className="text-sm text-muted-foreground">{service.description}</p> : null}
                              </div>
                              <div className="flex items-center gap-3">
                                {service.price ? (
                                  <span className="rounded bg-emerald-400/10 px-2 py-1 text-xs font-mono text-emerald-400">
                                    R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                ) : null}
                                <button onClick={() => deleteService(service.id)} className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-xl border border-dashed border-border bg-background/40 px-4 py-4 text-sm text-muted-foreground">
                            Esta área ainda não tem serviços cadastrados.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              ))}
              {areasOfLaw.length === 0 && <p className="py-6 text-center text-muted-foreground">Nenhuma área cadastrada.</p>}
            </div>
          </section>
          )}

          {activeOperationSection === 'sources' && (
          <section id="settings-section-sources" className="space-y-6 rounded-xl border border-border bg-card p-6">
            <div>
              <h3 className="text-xl font-serif text-gold-400">Origens do lead</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_220px_auto]">
              <input
                type="text"
                placeholder="Nome da origem"
                value={newLeadSourceName}
                onChange={(e) => setNewLeadSourceName(e.target.value)}
                className="rounded-lg border border-border bg-background px-4 py-2"
              />
              <select
                value={newLeadSourceKind}
                onChange={(e) => setNewLeadSourceKind(e.target.value as 'campaign' | 'referral' | 'partner' | 'organic' | 'other')}
                className="rounded-lg border border-border bg-background px-4 py-2"
              >
                <option value="campaign">Campanha</option>
                <option value="referral">Indicação</option>
                <option value="partner">Parceria</option>
                <option value="organic">Orgânico</option>
                <option value="other">Outro</option>
              </select>
              <button
                onClick={handleAddLeadSource}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400"
              >
                <Plus className="h-4 w-4" /> Adicionar
              </button>
            </div>
            <div className="grid gap-4">
              {leadSources.map((source) => (
                <div key={source.id} className="grid items-center gap-3 rounded-xl border border-border bg-background/40 p-4 xl:grid-cols-[minmax(0,1fr)_220px_auto]">
                  <input
                    value={source.name}
                    disabled={source.locked}
                    onChange={(e) => updateLeadSource(source.id, { name: e.target.value })}
                    className="rounded-lg border border-border bg-background px-4 py-2 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                  <select
                    value={source.kind}
                    disabled={source.locked}
                    onChange={(e) => updateLeadSource(source.id, { kind: e.target.value as 'campaign' | 'referral' | 'partner' | 'organic' | 'other' })}
                    className="rounded-lg border border-border bg-background px-4 py-2 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <option value="campaign">Campanha</option>
                    <option value="referral">Indicação</option>
                    <option value="partner">Parceria</option>
                    <option value="organic">Orgânico</option>
                    <option value="other">Outro</option>
                  </select>
                  <button
                    onClick={() => deleteLeadSource(source.id)}
                    disabled={source.locked}
                    className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
          )}

          {activeOperationSection === 'tasks' && (
          <section id="settings-section-tasks" className="space-y-6 rounded-xl border border-border bg-card p-6">
            <div>
              <h3 className="text-xl font-serif text-gold-400">Tarefas padrão</h3>
              <p className="mt-1 text-sm text-muted-foreground">Padronize as próximas ações mais comuns da equipe para reduzir retrabalho.</p>
            </div>
            <div className="flex flex-col gap-4 xl:flex-row">
              <input type="text" placeholder="Título da tarefa" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="flex-1 rounded-lg border border-border bg-background px-4 py-2" />
              <input type="text" placeholder="Descrição curta" value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)} className="flex-1 rounded-lg border border-border bg-background px-4 py-2" />
              <button onClick={handleAddTask} className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400">
                <Plus className="h-4 w-4" /> Adicionar
              </button>
            </div>
            <div className="grid gap-4">
              {standardTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-4">
                  <div>
                    <h4 className="text-lg font-bold text-gold-100">{task.title}</h4>
                    {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
                  </div>
                  <button onClick={() => deleteStandardTask(task.id)} className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
              {standardTasks.length === 0 && <p className="py-6 text-center text-muted-foreground">Nenhuma tarefa padrão cadastrada.</p>}
            </div>
          </section>
          )}
            </div>
          </div>
        </div>
      )}

      {fieldModalFunnelId && (() => {
        const targetFunnel = sortedFunnels.find((item) => item.id === fieldModalFunnelId);
        if (!targetFunnel) return null;
        const fieldDraft = getFieldDraft(targetFunnel.id);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-serif font-bold text-gold-400">Novo campo</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{targetFunnel.name}</p>
                </div>
                <button type="button" onClick={closeFieldModal} className="rounded-lg p-2 text-muted-foreground hover:bg-background hover:text-primary">
                  <Plus className="h-5 w-5 rotate-45" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Título do campo</label>
                  <input
                    value={fieldDraft.label}
                    onChange={(event) => updateFieldDraft(targetFunnel.id, {
                      label: event.target.value,
                      key: normalizeFieldKey(event.target.value),
                    })}
                    placeholder="Ex.: Nome da clínica"
                    className="w-full rounded-lg border border-border bg-background px-4 py-3"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Tipo</label>
                    <select
                      value={fieldDraft.type}
                      onChange={(event) => updateFieldDraft(targetFunnel.id, { type: event.target.value as FunnelFieldType })}
                      className="w-full rounded-lg border border-border bg-background px-4 py-3"
                    >
                      {CUSTOM_FIELD_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Obrigatoriedade</label>
                    <label className="flex h-[46px] items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={fieldDraft.required}
                        onChange={(event) => updateFieldDraft(targetFunnel.id, { required: event.target.checked })}
                        className="rounded border-border bg-background"
                      />
                      Obrigatório
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3 border-t border-border pt-5">
                <button type="button" onClick={closeFieldModal} className="rounded-lg px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!fieldDraft.label.trim()) return;
                    addFunnelField(targetFunnel.id, {
                      key: normalizeFieldKey(fieldDraft.key || fieldDraft.label),
                      label: fieldDraft.label.trim(),
                      type: fieldDraft.type,
                      required: fieldDraft.required,
                      placeholder: fieldDraft.placeholder.trim(),
                      helpText: fieldDraft.helpText.trim(),
                    });
                    setFieldDrafts((current) => ({
                      ...current,
                      [targetFunnel.id]: {
                        label: '',
                        key: '',
                        type: 'text',
                        required: false,
                        placeholder: '',
                        helpText: '',
                      },
                    }));
                    closeFieldModal();
                  }}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-gold-400"
                >
                  Salvar campo
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
