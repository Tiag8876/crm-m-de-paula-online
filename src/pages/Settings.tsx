import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Shield,
  UserCircle2,
  Workflow,
} from 'lucide-react';
import { isAdminUser } from '@/lib/access';
import { UsersAdminPage } from '@/pages/UsersAdminPage';
import { ProspectingSettings } from '@/pages/ProspectingSettings';

type SettingsTab = 'profile' | 'team' | 'operations';

const ADMIN_SECTION_LINKS = [
  { id: 'areas', label: 'Areas de atuacao' },
  { id: 'services', label: 'Servicos' },
  { id: 'tasks', label: 'Tarefas padrao' },
  { id: 'kanban', label: 'Funil comercial' },
  { id: 'prospecting', label: 'Prospeccao' },
] as const;

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
    kanbanStages,
    addAreaOfLaw,
    deleteAreaOfLaw,
    addService,
    deleteService,
    addStandardTask,
    deleteStandardTask,
    addKanbanStage,
    updateKanbanStage,
    deleteKanbanStage,
    reorderKanbanStages,
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
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#D4AF37');
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [profileCurrentPassword, setProfileCurrentPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    setProfileName(user?.name || '');
    setProfileEmail(user?.email || '');
    setProfileAvatarUrl(user?.avatarUrl || '');
  }, [user]);

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

  const handleAddArea = () => {
    if (!newAreaName.trim()) return;
    addAreaOfLaw(newAreaName, newAreaDesc);
    setNewAreaName('');
    setNewAreaDesc('');
  };

  const handleAddService = () => {
    if (!newServiceName.trim() || !selectedAreaForService) return;
    addService(
      selectedAreaForService,
      newServiceName,
      newServiceDesc,
      newServicePrice ? Number(newServicePrice) : undefined,
    );
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

  const handleAddStage = () => {
    if (!newStageName.trim()) return;
    addKanbanStage(newStageName, newStageColor);
    setNewStageName('');
    setNewStageColor('#D4AF37');
  };

  const moveStage = (id: string, direction: 'up' | 'down') => {
    const sorted = [...kanbanStages].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((stage) => stage.id === id);

    if (direction === 'up' && index > 0) {
      [sorted[index - 1], sorted[index]] = [sorted[index], sorted[index - 1]];
    } else if (direction === 'down' && index < sorted.length - 1) {
      [sorted[index], sorted[index + 1]] = [sorted[index + 1], sorted[index]];
    }

    reorderKanbanStages(sorted.map((stage, order) => ({ ...stage, order })));
  };

  const handleUpdateOwnProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);

    if (profileNewPassword && profileNewPassword !== profileConfirmPassword) {
      setProfileError('A confirmacao da nova senha nao confere.');
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
    ...(isAdmin ? [{ key: 'operations' as const, icon: Workflow, label: 'Operacao do CRM' }] : []),
  ];

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-serif font-bold text-primary">Configuracoes</h1>
        <p className="max-w-3xl text-muted-foreground">
          Organize seu perfil, equipe e a estrutura operacional do CRM em um unico lugar, com menos menus e mais previsibilidade.
        </p>
      </div>

      <div className="mb-8 flex gap-3 overflow-x-auto border-b border-border pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-5 py-3 text-sm font-semibold uppercase tracking-wider transition-all ${
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-gold-400'
            }`}
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
                  Atualize seus dados de acesso, foto e senha sem precisar navegar por telas tecnicas.
                </p>
              </div>
              <div className="rounded-full border border-border bg-background/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {user?.role === 'admin' ? 'Administrador' : 'Usuario da equipe'}
              </div>
            </div>

            <form onSubmit={handleUpdateOwnProfile} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2 flex items-center gap-4 rounded-xl border border-border bg-background/40 p-4">
                <div className="h-16 w-16 overflow-hidden rounded-full border border-border bg-card">
                  {profileAvatarUrl ? (
                    <img src={profileAvatarUrl} alt={profileName || user?.name || 'Perfil'} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-black uppercase tracking-widest text-primary">
                      {(profileName || user?.name || 'U')
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase() || '')
                        .join('')}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Foto de perfil</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfileAvatarFile}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:font-bold file:text-primary-foreground hover:file:bg-gold-400"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">Use uma imagem nitida. O arquivo fica salvo no seu perfil.</p>
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
                <input
                  value={profileCurrentPassword}
                  onChange={(event) => setProfileCurrentPassword(event.target.value)}
                  type="password"
                  placeholder="Obrigatoria para trocar email ou senha"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Nova senha</label>
                <input
                  value={profileNewPassword}
                  onChange={(event) => setProfileNewPassword(event.target.value)}
                  type="password"
                  placeholder="Deixe em branco para manter"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Confirmar nova senha</label>
                <input
                  value={profileConfirmPassword}
                  onChange={(event) => setProfileConfirmPassword(event.target.value)}
                  type="password"
                  placeholder="Repita a nova senha"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </div>

              <div className="md:col-span-2 flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                <p>Alteracoes sensiveis pedem sua senha atual para evitar erro e manter sua conta protegida.</p>
                <button type="submit" className="rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400">
                  Salvar perfil
                </button>
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
              Cadastre pessoas, perfis de acesso e mantenha a operacao do escritorio organizada no mesmo ponto de administracao.
            </p>
          </div>
          <UsersAdminPage embedded />
        </div>
      )}

      {isAdmin && activeTab === 'operations' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-2xl font-serif text-gold-400">Operacao do CRM</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Aqui ficam os cadastros estruturais do sistema. Em vez de espalhar regras por varios menus, a operacao passa a ser configurada em um unico fluxo previsivel.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {ADMIN_SECTION_LINKS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => jumpToSection(section.id)}
                  className="rounded-full border border-border bg-background/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>

          <section id="settings-section-areas" className="space-y-6 rounded-xl border border-border bg-card p-6">
            <div>
              <h3 className="text-xl font-serif text-gold-400">Areas de atuacao</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Defina as especialidades do escritorio. Elas organizam servicos, funis e leitura do negocio.
              </p>
            </div>
            <div className="flex flex-col gap-4 xl:flex-row">
              <input
                type="text"
                placeholder="Nome da area"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                placeholder="Descricao curta"
                value={newAreaDesc}
                onChange={(e) => setNewAreaDesc(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              />
              <button
                onClick={handleAddArea}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400"
              >
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
              {areasOfLaw.length === 0 && <p className="py-6 text-center text-muted-foreground">Nenhuma area cadastrada.</p>}
            </div>
          </section>

          <section id="settings-section-services" className="space-y-6 rounded-xl border border-border bg-card p-6">
            <div>
              <h3 className="text-xl font-serif text-gold-400">Servicos</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Monte o catalogo comercial da operacao para padronizar propostas, qualificacao e contexto dos leads.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <select
                value={selectedAreaForService}
                onChange={(e) => setSelectedAreaForService(e.target.value)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">Selecione a area de atuacao</option>
                {areasOfLaw.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Nome do servico"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                placeholder="Descricao curta"
                value={newServiceDesc}
                onChange={(e) => setNewServiceDesc(e.target.value)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              />
              <input
                type="number"
                placeholder="Valor estimado"
                value={newServicePrice}
                onChange={(e) => setNewServicePrice(e.target.value)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleAddService}
                disabled={!selectedAreaForService || !newServiceName}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Adicionar servico
              </button>
            </div>
            <div className="grid gap-4">
              {services.map((service) => {
                const area = areasOfLaw.find((item) => item.id === service.areaOfLawId);
                return (
                  <div key={service.id} className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-4">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="rounded bg-accent px-2 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                          {area?.name || 'Area nao vinculada'}
                        </span>
                        {service.price && (
                          <span className="rounded bg-emerald-400/10 px-2 py-1 text-xs font-mono text-emerald-400">
                            R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        )}
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
              {services.length === 0 && <p className="py-6 text-center text-muted-foreground">Nenhum servico cadastrado.</p>}
            </div>
          </section>

          <section id="settings-section-tasks" className="space-y-6 rounded-xl border border-border bg-card p-6">
            <div>
              <h3 className="text-xl font-serif text-gold-400">Tarefas padrao</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Padronize as proximas acoes mais comuns da equipe para ganhar consistencia e reduzir retrabalho.
              </p>
            </div>
            <div className="flex flex-col gap-4 xl:flex-row">
              <input
                type="text"
                placeholder="Titulo da tarefa"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                placeholder="Descricao curta"
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              />
              <button
                onClick={handleAddTask}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400"
              >
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
              {standardTasks.length === 0 && <p className="py-6 text-center text-muted-foreground">Nenhuma tarefa padrao cadastrada.</p>}
            </div>
          </section>

          <section id="settings-section-kanban" className="space-y-6 rounded-xl border border-border bg-card p-6">
            <div>
              <h3 className="text-xl font-serif text-gold-400">Funil comercial</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ajuste as etapas do Kanban principal do escritorio. Esse funil representa o trabalho comercial recorrente.
              </p>
            </div>
            <div className="flex flex-col gap-4 xl:flex-row">
              <input
                type="text"
                placeholder="Nome da etapa"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              />
              <input
                type="color"
                value={newStageColor}
                onChange={(e) => setNewStageColor(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-background p-1"
              />
              <button
                onClick={handleAddStage}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400"
              >
                <Plus className="h-4 w-4" /> Adicionar
              </button>
            </div>
            <div className="grid gap-4">
              {[...kanbanStages].sort((a, b) => a.order - b.order).map((stage, index, orderedStages) => (
                <div key={stage.id} className="group flex items-center justify-between rounded-xl border border-border bg-background/40 p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <button disabled={index === 0} onClick={() => moveStage(stage.id, 'up')} className="p-1 text-muted-foreground transition-all hover:text-primary disabled:opacity-0">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button disabled={index === orderedStages.length - 1} onClick={() => moveStage(stage.id, 'down')} className="p-1 text-muted-foreground transition-all hover:text-primary disabled:opacity-0">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="h-10 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
                    {editingStageId === stage.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          defaultValue={stage.name}
                          onBlur={(e) => {
                            updateKanbanStage(stage.id, { name: e.target.value });
                            setEditingStageId(null);
                          }}
                          autoFocus
                          className="rounded border border-primary bg-background px-2 py-1 text-foreground"
                        />
                        <input
                          type="color"
                          defaultValue={stage.color}
                          onChange={(e) => updateKanbanStage(stage.id, { color: e.target.value })}
                          className="h-8 w-8 cursor-pointer rounded border border-border bg-background"
                        />
                      </div>
                    ) : (
                      <div>
                        <h4 className="flex items-center gap-2 text-lg font-bold text-gold-100">
                          {stage.name}
                          <button onClick={() => setEditingStageId(stage.id)} className="p-1 text-muted-foreground opacity-0 transition-all hover:text-primary group-hover:opacity-100">
                            <Edit2 className="h-3 w-3" />
                          </button>
                        </h4>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Tem certeza que deseja excluir esta etapa?')) {
                        deleteKanbanStage(stage.id);
                      }
                    }}
                    className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section id="settings-section-prospecting" className="space-y-6 rounded-xl border border-border bg-card p-6">
            <div>
              <h3 className="text-xl font-serif text-gold-400">Prospeccao</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Traga a configuracao da prospeccao para o mesmo contexto operacional do CRM, evitando um menu tecnico separado.
              </p>
            </div>
            <ProspectingSettings embedded />
          </section>
        </div>
      )}
    </div>
  );
}
