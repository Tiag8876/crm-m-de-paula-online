import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import {
  ArrowDown,
  ArrowUp,
  BadgeHelp,
  BriefcaseBusiness,
  Copy,
  Database,
  ListChecks,
  Plus,
  Shield,
  Star,
  Trash2,
  UserCircle2,
  Workflow,
} from 'lucide-react';
import { isAdminUser } from '@/lib/access';
import { UsersAdminPage } from '@/pages/UsersAdminPage';
import type { FunnelConfig, FunnelFieldType } from '@/types/crm';

type SettingsTab = 'profile' | 'team' | 'operations';
type StageDraft = { name: string; color: string };
type FunnelDraft = { name: string; description: string };
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
    id: 'services',
    label: 'Serviços',
    description: 'Centralize ofertas, precificação e contexto comercial em uma mesma camada.',
    icon: Database,
  },
  {
    id: 'tasks',
    label: 'Tarefas padrão',
    description: 'Padronize próximas ações sem obrigar a equipe a memorizar o processo.',
    icon: ListChecks,
  },
] as const;

const FIELD_TYPE_OPTIONS: Array<{ value: FunnelFieldType; label: string }> = [
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
  const initialTab: SettingsTab = requestedTab === 'team' || requestedTab === 'operations' ? requestedTab : 'profile';

  const {
    areasOfLaw,
    services,
    standardTasks,
    funnels,
    commercialDefaultFunnelId,
    prospectingDefaultFunnelId,
    addAreaOfLaw,
    deleteAreaOfLaw,
    addService,
    deleteService,
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
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaDesc, setNewAreaDesc] = useState('');
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [selectedAreaForService, setSelectedAreaForService] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newFunnelName, setNewFunnelName] = useState('');
  const [newFunnelDescription, setNewFunnelDescription] = useState('');
  const [newFunnelOperation, setNewFunnelOperation] = useState<FunnelConfig['operation']>('commercial');
  const [stageDrafts, setStageDrafts] = useState<Record<string, StageDraft>>({});
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, FieldDraft>>({});
  const [objectionDrafts, setObjectionDrafts] = useState<Record<string, string>>({});
  const [funnelDrafts, setFunnelDrafts] = useState<Record<string, FunnelDraft>>({});
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
        return a.name.localeCompare(b.name);
      }),
    [funnels],
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
    if (activeTab !== 'operations') return;
    const section = searchParams.get('section');
    if (!section) return;

    const timer = window.setTimeout(() => {
      const element = document.getElementById(`settings-section-${section}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [activeTab, searchParams]);

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
  };

  const getStageDraft = (funnelId: string) => stageDrafts[funnelId] || { name: '', color: '#D4AF37' };
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

  const updateFieldDraft = (funnelId: string, patch: Partial<FieldDraft>) => {
    setFieldDrafts((current) => ({
      ...current,
      [funnelId]: { ...getFieldDraft(funnelId), ...patch },
    }));
  };

  const handleAddArea = () => {
    if (!newAreaName.trim()) return;
    addAreaOfLaw(newAreaName, newAreaDesc);
    setNewAreaName('');
    setNewAreaDesc('');
  };

  const handleAddService = () => {
    if (!newServiceName.trim() || !selectedAreaForService) return;
    addService(selectedAreaForService, newServiceName, newServiceDesc, newServicePrice ? Number(newServicePrice) : undefined);
    setNewServiceName('');
    setNewServiceDesc('');
    setNewServicePrice('');
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
    });
    setNewFunnelName('');
    setNewFunnelDescription('');
    setNewFunnelOperation('commercial');
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
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-serif font-bold text-primary">Configurações</h1>
        <p className="max-w-3xl text-muted-foreground">
          Organize perfil, equipe e estrutura operacional do CRM em um único lugar, com menos menus e mais clareza para a equipe.
        </p>
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
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-serif text-gold-400">Meu perfil</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Atualize seus dados de acesso, foto e senha sem navegar por blocos técnicos que não ajudam no seu trabalho.
                </p>
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
                  <p className="mt-2 text-xs text-muted-foreground">Use uma imagem nítida. O arquivo fica salvo no seu perfil.</p>
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
                <p>Alterações sensíveis pedem sua senha atual para reduzir erro e manter a conta protegida.</p>
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
            <h2 className="text-2xl font-serif text-gold-400">Equipe</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre pessoas, níveis de acesso e mantenha a operação do escritório no mesmo ponto de administração.
            </p>
          </div>
          <UsersAdminPage embedded />
        </div>
      )}

      {isAdmin && activeTab === 'operations' && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-2xl font-serif text-gold-400">Operação do CRM</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Centralize a estrutura do sistema num só lugar: funis, formulários, catálogo comercial e rotinas da equipe.
              </p>
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {ADMIN_SECTION_LINKS.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => jumpToSection(section.id)}
                      className="rounded-2xl border border-border bg-background/40 p-4 text-left transition-all hover:border-primary/60 hover:bg-accent/40"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black uppercase tracking-[0.16em] text-foreground">{section.label}</p>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <BadgeHelp className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-[0.16em] text-gold-500/80">Leitura rápida</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Esta área foi organizada para mostrar só o que ajuda a decidir. Menos ruído, menos menus paralelos e mais previsibilidade para a equipe.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-gold-500/80">Regra de experiência</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>Os funis definem como o cadastro se comporta.</li>
                  <li>Áreas, serviços e tarefas apoiam a operação, não concorrem com ela.</li>
                  <li>Quando a equipe procurar algo, deve existir um único lugar óbvio para encontrar.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-primary">Objetivo desta camada</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Deixar o CRM configurável o suficiente para operar vários contextos sem virar um sistema confuso ou cheio de áreas duplicadas.
                </p>
              </div>
            </div>
          </div>

          <section id="settings-section-funnels" className="space-y-6 rounded-xl border border-border bg-card p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h3 className="text-xl font-serif text-gold-400">Funis e formulários</h3>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Aqui nasce o comportamento real do CRM. Cada funil pode ter etapas, playbook e campos próprios para não forçar o mesmo cadastro em contextos diferentes.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-background/40 p-4 text-sm text-muted-foreground xl:max-w-sm">
                Use esta área para modelar cenários como comercial jurídico, prospecção de clínicas, indicação ou qualquer outro processo que exija dados e etapas próprias.
              </div>
            </div>

            <div className="grid gap-4 rounded-xl border border-border bg-background/40 p-4 md:grid-cols-2 xl:grid-cols-4">
              <input type="text" placeholder="Nome do novo funil" value={newFunnelName} onChange={(event) => setNewFunnelName(event.target.value)} className="rounded-lg border border-border bg-background px-4 py-2" />
              <select value={newFunnelOperation} onChange={(event) => setNewFunnelOperation(event.target.value as FunnelConfig['operation'])} className="rounded-lg border border-border bg-background px-4 py-2">
                <option value="commercial">Comercial</option>
                <option value="prospecting">Prospecção</option>
              </select>
              <input type="text" placeholder="Descrição curta" value={newFunnelDescription} onChange={(event) => setNewFunnelDescription(event.target.value)} className="rounded-lg border border-border bg-background px-4 py-2 xl:col-span-2" />
              <div className="md:col-span-2 xl:col-span-4 flex justify-end">
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

                return (
                  <div key={funnel.id} className="rounded-2xl border border-border bg-background/30 p-5">
                    <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="grid flex-1 gap-3 md:grid-cols-2">
                        <input value={draft.name} onChange={(event) => setFunnelDrafts((current) => ({ ...current, [funnel.id]: { ...draft, name: event.target.value } }))} onBlur={() => updateFunnel(funnel.id, { name: draft.name.trim() || funnel.name })} className="rounded-lg border border-border bg-card px-4 py-2 font-semibold" />
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          <span className="rounded-full border border-border px-3 py-2">{funnel.operation === 'commercial' ? 'Comercial' : 'Prospecção'}</span>
                          {isDefault && <span className="rounded-full bg-primary px-3 py-2 text-primary-foreground">Principal</span>}
                        </div>
                        <input value={draft.description} onChange={(event) => setFunnelDrafts((current) => ({ ...current, [funnel.id]: { ...draft, description: event.target.value } }))} onBlur={() => updateFunnel(funnel.id, { description: draft.description.trim() || undefined })} placeholder="Descricao do funil" className="rounded-lg border border-border bg-card px-4 py-2 md:col-span-2" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!isDefault && (
                          <button type="button" onClick={() => setDefaultFunnel(funnel.operation, funnel.id)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary">
                            <Star className="h-4 w-4" /> Definir principal
                          </button>
                        )}
                        <button type="button" onClick={() => duplicateFunnel(funnel.id)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary">
                          <Copy className="h-4 w-4" /> Duplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Excluir o funil \"${funnel.name}\"?`)) {
                              deleteFunnel(funnel.id);
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" /> Excluir
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gold-500/80">Etapas</h4>
                        <span className="text-xs text-muted-foreground">{sortedStages.length} etapa(s)</span>
                      </div>
                      {sortedStages.map((stage, index) => (
                        <div key={stage.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:flex-row lg:items-center">
                          <div className="flex items-center gap-2">
                            <button disabled={index === 0} onClick={() => {
                              const reordered = [...sortedStages];
                              [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
                              reorderFunnelStages(funnel.id, reordered.map((item, order) => ({ ...item, order })));
                            }} className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30">
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button disabled={index === sortedStages.length - 1} onClick={() => {
                              const reordered = [...sortedStages];
                              [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
                              reorderFunnelStages(funnel.id, reordered.map((item, order) => ({ ...item, order })));
                            }} className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30">
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <div className="h-8 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
                          </div>
                          <input value={stage.name} onChange={(event) => updateFunnelStage(funnel.id, stage.id, { name: event.target.value })} className="flex-1 rounded-lg border border-border bg-background px-3 py-2" />
                          <input type="color" value={stage.color} onChange={(event) => updateFunnelStage(funnel.id, stage.id, { color: event.target.value })} className="h-10 w-12 rounded-lg border border-border bg-background" />
                          <button onClick={() => deleteFunnelStage(funnel.id, stage.id)} className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-500/10">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <div className="grid gap-3 rounded-xl border border-dashed border-border bg-background/40 p-3 md:grid-cols-[1fr_auto_auto]">
                        <input value={stageDraft.name} onChange={(event) => updateStageDraft(funnel.id, { name: event.target.value })} placeholder="Nova etapa" className="rounded-lg border border-border bg-background px-3 py-2" />
                        <input type="color" value={stageDraft.color} onChange={(event) => updateStageDraft(funnel.id, { color: event.target.value })} className="h-10 w-12 rounded-lg border border-border bg-background" />
                        <button
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

                    <div className="mt-6 space-y-3 rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gold-500/80">Campos do cadastro</h4>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Defina os dados que este funil precisa pedir no momento do cadastro.
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">{(funnel.fieldSchema || []).length} campo(s)</span>
                      </div>

                      {(funnel.fieldSchema || []).length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-background/30 p-4 text-sm text-muted-foreground">
                          Este funil ainda usa só os campos padrão do CRM.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(funnel.fieldSchema || []).map((field, index) => (
                            <div key={field.id} className="rounded-xl border border-border bg-background/40 p-3">
                              <div className="grid gap-3 lg:grid-cols-[auto_auto_1fr_180px_160px_auto] lg:items-center">
                                <div className="flex items-center gap-2">
                                  <button
                                    disabled={index === 0}
                                    onClick={() => {
                                      const reordered = [...(funnel.fieldSchema || [])];
                                      [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
                                      reorderFunnelFields(funnel.id, reordered.map((item, order) => ({ ...item, order })));
                                    }}
                                    className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30"
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </button>
                                  <button
                                    disabled={index === (funnel.fieldSchema || []).length - 1}
                                    onClick={() => {
                                      const reordered = [...(funnel.fieldSchema || [])];
                                      [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
                                      reorderFunnelFields(funnel.id, reordered.map((item, order) => ({ ...item, order })));
                                    }}
                                    className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30"
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </button>
                                </div>
                                <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(field.required)}
                                    onChange={(event) => updateFunnelField(funnel.id, field.id, { required: event.target.checked })}
                                    className="rounded border-border bg-background"
                                  />
                                  Obrigatório
                                </label>
                                <input
                                  value={field.label}
                                  onChange={(event) => updateFunnelField(funnel.id, field.id, {
                                    label: event.target.value,
                                    key: normalizeFieldKey(event.target.value || field.key),
                                  })}
                                  className="rounded-lg border border-border bg-background px-3 py-2"
                                />
                                <select
                                  value={field.type}
                                  onChange={(event) => updateFunnelField(funnel.id, field.id, { type: event.target.value as FunnelFieldType })}
                                  className="rounded-lg border border-border bg-background px-3 py-2"
                                >
                                  {FIELD_TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                                <input
                                  value={field.placeholder || ''}
                                  onChange={(event) => updateFunnelField(funnel.id, field.id, { placeholder: event.target.value })}
                                  placeholder="Placeholder"
                                  className="rounded-lg border border-border bg-background px-3 py-2"
                                />
                                <button onClick={() => deleteFunnelField(funnel.id, field.id)} className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-500/10">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="mt-3 grid gap-3 md:grid-cols-[200px_1fr]">
                                <input
                                  value={field.key}
                                  onChange={(event) => updateFunnelField(funnel.id, field.id, { key: normalizeFieldKey(event.target.value) })}
                                  placeholder="chave_interna"
                                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                />
                                <input
                                  value={field.helpText || ''}
                                  onChange={(event) => updateFunnelField(funnel.id, field.id, { helpText: event.target.value })}
                                  placeholder="Ajuda curta para quem vai preencher"
                                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {(() => {
                        const fieldDraft = getFieldDraft(funnel.id);
                        return (
                          <div className="grid gap-3 rounded-xl border border-dashed border-border bg-background/40 p-4 lg:grid-cols-[1.2fr_180px_160px_auto]">
                            <div className="space-y-3">
                              <input
                                value={fieldDraft.label}
                                onChange={(event) => updateFieldDraft(funnel.id, {
                                  label: event.target.value,
                                  key: normalizeFieldKey(event.target.value),
                                })}
                                placeholder="Ex: Nome da clínica, CNPJ, origem do caso"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                              />
                              <div className="grid gap-3 md:grid-cols-2">
                                <input
                                  value={fieldDraft.key}
                                  onChange={(event) => updateFieldDraft(funnel.id, { key: normalizeFieldKey(event.target.value) })}
                                  placeholder="chave_interna"
                                  className="rounded-lg border border-border bg-background px-3 py-2"
                                />
                                <input
                                  value={fieldDraft.placeholder}
                                  onChange={(event) => updateFieldDraft(funnel.id, { placeholder: event.target.value })}
                                  placeholder="Placeholder"
                                  className="rounded-lg border border-border bg-background px-3 py-2"
                                />
                              </div>
                            </div>
                            <select
                              value={fieldDraft.type}
                              onChange={(event) => updateFieldDraft(funnel.id, { type: event.target.value as FunnelFieldType })}
                              className="rounded-lg border border-border bg-background px-3 py-2"
                            >
                              {FIELD_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                            <div className="space-y-3">
                              <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                <input
                                  type="checkbox"
                                  checked={fieldDraft.required}
                                  onChange={(event) => updateFieldDraft(funnel.id, { required: event.target.checked })}
                                  className="rounded border-border bg-background"
                                />
                                Obrigatório
                              </label>
                              <input
                                value={fieldDraft.helpText}
                                onChange={(event) => updateFieldDraft(funnel.id, { helpText: event.target.value })}
                                placeholder="Ajuda curta"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                              />
                            </div>
                            <button
                              onClick={() => {
                                if (!fieldDraft.label.trim()) return;
                                addFunnelField(funnel.id, {
                                  key: normalizeFieldKey(fieldDraft.key || fieldDraft.label),
                                  label: fieldDraft.label.trim(),
                                  type: fieldDraft.type,
                                  required: fieldDraft.required,
                                  placeholder: fieldDraft.placeholder.trim(),
                                  helpText: fieldDraft.helpText.trim(),
                                });
                                setFieldDrafts((current) => ({
                                  ...current,
                                  [funnel.id]: {
                                    label: '',
                                    key: '',
                                    type: 'text',
                                    required: false,
                                    placeholder: '',
                                    helpText: '',
                                  },
                                }));
                              }}
                              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400"
                            >
                              <Plus className="h-4 w-4" /> Adicionar campo
                            </button>
                          </div>
                        );
                      })()}
                    </div>

                    {funnel.operation === 'prospecting' && (
                      <div className="mt-6 grid gap-6 xl:grid-cols-2">
                        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                          <div>
                            <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gold-500/80">Objeções</h4>
                            <p className="mt-1 text-sm text-muted-foreground">Use objeções padrão quando o funil exigir abordagem comercial consultiva.</p>
                          </div>
                          <div className="flex gap-2">
                            <input value={objectionDraft} onChange={(event) => setObjectionDrafts((current) => ({ ...current, [funnel.id]: event.target.value }))} placeholder="Nova objeção" className="flex-1 rounded-lg border border-border bg-background px-3 py-2" />
                            <button
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
                                <button onClick={() => removeFunnelObjection(funnel.id, item)} className="text-red-400 hover:text-red-300">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                          <div>
                            <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gold-500/80">Playbook</h4>
                            <p className="mt-1 text-sm text-muted-foreground">Esse roteiro acompanha o funil e deixa a operação replicável.</p>
                          </div>
                          <textarea value={funnel.playbook || ''} onChange={(event) => setFunnelPlaybook(funnel.id, event.target.value)} className="h-56 w-full rounded-xl border border-border bg-background p-3 text-sm" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          <section id="settings-section-areas" className="space-y-6 rounded-xl border border-border bg-card p-6">
            <div>
              <h3 className="text-xl font-serif text-gold-400">Áreas de atuação</h3>
              <p className="mt-1 text-sm text-muted-foreground">Defina as especialidades do escritório para organizar serviços e contexto comercial.</p>
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
                <div key={area.id} className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-4">
                  <div>
                    <h4 className="text-lg font-bold text-gold-100">{area.name}</h4>
                    {area.description && <p className="text-sm text-muted-foreground">{area.description}</p>}
                  </div>
                  <button onClick={() => deleteAreaOfLaw(area.id)} className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
              {areasOfLaw.length === 0 && <p className="py-6 text-center text-muted-foreground">Nenhuma área cadastrada.</p>}
            </div>
          </section>

          <section id="settings-section-services" className="space-y-6 rounded-xl border border-border bg-card p-6">
            <div>
              <h3 className="text-xl font-serif text-gold-400">Serviços</h3>
              <p className="mt-1 text-sm text-muted-foreground">Monte o catálogo comercial para padronizar propostas e contexto dos leads.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <select value={selectedAreaForService} onChange={(e) => setSelectedAreaForService(e.target.value)} className="rounded-lg border border-border bg-background px-4 py-2">
                <option value="">Selecione a área de atuação</option>
                {areasOfLaw.map((area) => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </select>
              <input type="text" placeholder="Nome do serviço" value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} className="rounded-lg border border-border bg-background px-4 py-2" />
              <input type="text" placeholder="Descrição curta" value={newServiceDesc} onChange={(e) => setNewServiceDesc(e.target.value)} className="rounded-lg border border-border bg-background px-4 py-2" />
              <input type="number" placeholder="Valor estimado" value={newServicePrice} onChange={(e) => setNewServicePrice(e.target.value)} className="rounded-lg border border-border bg-background px-4 py-2" />
            </div>
            <div className="flex justify-end">
              <button onClick={handleAddService} disabled={!selectedAreaForService || !newServiceName} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50">
                <Plus className="h-4 w-4" /> Adicionar serviço
              </button>
            </div>
            <div className="grid gap-4">
              {services.map((service) => {
                const area = areasOfLaw.find((item) => item.id === service.areaOfLawId);
                return (
                  <div key={service.id} className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-4">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="rounded bg-accent px-2 py-1 text-xs font-bold uppercase tracking-wider text-primary">{area?.name || 'Área não vinculada'}</span>
                        {service.price && <span className="rounded bg-emerald-400/10 px-2 py-1 text-xs font-mono text-emerald-400">R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                      </div>
                      <h4 className="text-lg font-bold text-gold-100">{service.name}</h4>
                      {service.description && <p className="text-sm text-muted-foreground">{service.description}</p>}
                    </div>
                    <button onClick={() => deleteService(service.id)} className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                );
              })}
              {services.length === 0 && <p className="py-6 text-center text-muted-foreground">Nenhum serviço cadastrado.</p>}
            </div>
          </section>

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
        </div>
      )}
    </div>
  );
}

