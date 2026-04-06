import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useSystemStore } from '@/store/useSystemStore';
import {
  Plus,
  Trash2,
  Edit2,
  Scale,
  Briefcase,
  ListTodo,
  LayoutGrid,
  ArrowUp,
  ArrowDown,
  BookOpen,
} from 'lucide-react';
import { getUserAccessProfile, isAdminUser } from '@/lib/access';
import { getApiBase } from '@/lib/apiConfig';

export function Settings() {
  const { user, logout, updateOwnProfile } = useAuthStore();
  const {
    mode,
    database,
    apiBase,
    backendReachable,
    publicSetupAllowed,
    bootstrapConfigured,
    initialized,
    syncState,
    syncError,
    lastSyncAt,
    setRuntimeInfo,
  } = useSystemStore();
  const isAdmin = isAdminUser(user);
  const accessProfile = getUserAccessProfile(user);
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

  const [activeTab, setActiveTab] = useState<'account' | 'areas' | 'services' | 'tasks' | 'kanban' | 'guide'>('account');
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
    let mounted = true;

    const loadRuntime = async () => {
      try {
        const base = getApiBase();
        const [healthResponse, setupResponse] = await Promise.all([
          fetch(`${base}/api/health`, { cache: 'no-store' }),
          fetch(`${base}/api/setup-status`, { cache: 'no-store' }),
        ]);

        const health = await healthResponse.json().catch(() => ({}));
        const setup = await setupResponse.json().catch(() => ({}));

        if (!mounted) return;
        setRuntimeInfo({
          apiBase: base || window.location.origin,
          backendReachable: healthResponse.ok,
          mode: String(health?.mode || 'online'),
          database: String(health?.database || 'unknown'),
          publicSetupAllowed: Boolean(setup?.publicSetupAllowed),
          bootstrapConfigured: Boolean(setup?.bootstrapConfigured),
          initialized: Boolean(setup?.initialized),
        });
      } catch {
        if (!mounted) return;
        setRuntimeInfo({
          apiBase: getApiBase() || window.location.origin,
          backendReachable: false,
          mode: 'online',
          database: 'unavailable',
        });
      }
    };

    loadRuntime();

    return () => {
      mounted = false;
    };
  }, [setRuntimeInfo]);

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

  const tabs = [
    { key: 'account', icon: Edit2, label: 'Conta' },
    { key: 'guide', icon: BookOpen, label: 'Guia do Sistema' },
    { key: 'areas', icon: Scale, label: 'Áreas de Atuação' },
    { key: 'services', icon: Briefcase, label: 'Serviços' },
    { key: 'tasks', icon: ListTodo, label: 'Tarefas Padrão' },
    { key: 'kanban', icon: LayoutGrid, label: 'Fluxo Kanban' },
  ].filter((tab) => isAdmin || tab.key === 'account' || tab.key === 'guide');

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-serif font-bold text-primary">Configurações do Sistema</h1>
        <p className="text-muted-foreground">Gerencie áreas de atuação, serviços, tarefas e o fluxo do Kanban.</p>
      </div>

      <div className="mb-8 flex gap-4 overflow-x-auto border-b border-border pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
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

      {activeTab === 'account' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-serif text-gold-400">Sessão da Conta</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Usuário atual: <span className="font-semibold text-gold-100">{user?.name}</span>
            </p>

            <div className="mb-4 space-y-1 rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
              <p>Diagnóstico de acesso</p>
              <p>role: <span className="text-gold-100">{user?.role || '-'}</span></p>
              <p>setor: <span className="text-gold-100">{user?.sector || '-'}</span></p>
              <p>perfil resolvido: <span className="text-gold-100">{accessProfile}</span></p>
              <p>admin reconhecido: <span className="text-gold-100">{isAdmin ? 'sim' : 'nao'}</span></p>
              <p>modo do sistema: <span className="text-gold-100">{mode}</span></p>
            </div>

            <div className="mb-4 rounded-lg border border-border bg-background/40 p-4 text-sm text-muted-foreground">
              Este ambiente reflete o estado real do backend online. As informacoes acima sao carregadas da API e da sincronizacao do sistema, nao de texto fixo.
            </div>

            <button
              onClick={logout}
              className="rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400"
            >
              Sair da Conta
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-serif text-gold-400">Diagnostico Online</h2>
            <div className="space-y-1 rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
              <p>modo real: <span className="text-gold-100">{mode}</span></p>
              <p>api ativa: <span className="text-gold-100">{apiBase || '-'}</span></p>
              <p>banco de dados: <span className="text-gold-100">{database}</span></p>
              <p>backend acessivel: <span className="text-gold-100">{backendReachable ? 'sim' : 'nao'}</span></p>
              <p>provisionamento concluido: <span className="text-gold-100">{initialized ? 'sim' : 'nao'}</span></p>
              <p>bootstrap configurado: <span className="text-gold-100">{bootstrapConfigured ? 'sim' : 'nao'}</span></p>
              <p>setup publico: <span className="text-gold-100">{publicSetupAllowed ? 'habilitado' : 'desabilitado'}</span></p>
              <p>sincronizacao: <span className="text-gold-100">{syncState}</span></p>
              <p>ultimo sync: <span className="text-gold-100">{lastSyncAt ? new Date(lastSyncAt).toLocaleString('pt-BR') : '-'}</span></p>
              <p>erro de sync: <span className="text-gold-100">{syncError || '-'}</span></p>
            </div>
            <div className="mt-4 rounded-lg border border-border bg-background/40 p-4 text-sm text-muted-foreground">
              Este bloco e alimentado pelo backend online e pelo estado real de sincronizacao. Ele serve para validar se os dados estao indo para o servidor.
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-serif text-gold-400">Meu Perfil</h2>
            <form onSubmit={handleUpdateOwnProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Nome exibido</label>
                <input value={profileName} onChange={(event) => setProfileName(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Email de acesso</label>
                <input value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} type="email" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Foto de perfil (URL)</label>
                <input value={profileAvatarUrl} onChange={(event) => setProfileAvatarUrl(event.target.value)} placeholder="https://..." className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Senha atual</label>
                <input value={profileCurrentPassword} onChange={(event) => setProfileCurrentPassword(event.target.value)} type="password" placeholder="Obrigatoria para trocar email ou senha" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Nova senha</label>
                <input value={profileNewPassword} onChange={(event) => setProfileNewPassword(event.target.value)} type="password" placeholder="Deixe em branco para manter" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gold-500/60">Confirmar nova senha</label>
                <input value={profileConfirmPassword} onChange={(event) => setProfileConfirmPassword(event.target.value)} type="password" placeholder="Repita a nova senha" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </div>
              <div className="md:col-span-2 flex items-center justify-between gap-4">
                <div className="text-xs text-muted-foreground">
                  Alteracoes sensiveis usam o backend online e atualizam sua sessao atual.
                </div>
                <button type="submit" className="rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400">
                  Salvar Perfil
                </button>
              </div>
              {profileMessage && <p className="md:col-span-2 text-sm text-emerald-400">{profileMessage}</p>}
              {profileError && <p className="md:col-span-2 text-sm text-red-400">{profileError}</p>}
            </form>
          </div>

          {!isAdmin && (
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                Apenas administradores podem editar as configurações estruturais do sistema.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'guide' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-3 text-xl font-serif text-gold-400">Documentação Completa do Aplicativo</h2>
            <p className="text-sm text-muted-foreground">
              Este guia orienta a operação diária do CRM M de Paula. Use como manual de treinamento para novos usuários.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-2 font-semibold text-gold-100">1. Painel de Controle</h3>
              <p className="text-sm text-muted-foreground">
                Mostra os indicadores principais da operação: volume de leads, conversão, follow-ups atrasados e fila crítica.
                O administrador vê a operação completa. Usuários veem apenas dados permitidos pelo perfil.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-2 font-semibold text-gold-100">2. Gestão de Leads</h3>
              <p className="text-sm text-muted-foreground">
                Cadastre e mova leads no funil. Registre histórico, tarefas, documentos e follow-ups.
                O sistema prioriza disciplina comercial com alertas de inatividade e cobrança de retorno.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-2 font-semibold text-gold-100">3. Estratégia de Tráfego</h3>
              <p className="text-sm text-muted-foreground">
                Organize campanhas, conjuntos e criativos. Mantenha nomenclatura padrão para facilitar análise por campanha
                e decisões de escala, corte e reposicionamento.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-2 font-semibold text-gold-100">4. Relatórios Comerciais</h3>
              <p className="text-sm text-muted-foreground">
                Acompanhe entradas, fechamentos e taxa de conversão. O vendedor vê visão personalizada.
                O administrador vê consolidado geral para diagnosticar gargalo entre tráfego e comercial.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-2 font-semibold text-gold-100">5. Agenda e Follow-up</h3>
              <p className="text-sm text-muted-foreground">
                Centralize compromissos e retornos. Follow-up vencido entra como prioridade para evitar perda por demora.
                Use a agenda diariamente no início e no fim do expediente.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-2 font-semibold text-gold-100">6. Usuários e Permissões (Admin)</h3>
              <p className="text-sm text-muted-foreground">
                Cadastre usuários por perfil: Administrador, Comercial ou Tráfego. O admin pode editar, inativar e excluir usuários.
                Regra recomendada: cada lead deve ter responsável definido.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-2 font-semibold text-gold-100">7. Passo a Passo de Implantação</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Criar áreas de atuação do escritório.</li>
                <li>Cadastrar serviços por área.</li>
                <li>Definir tarefas padrão de atendimento.</li>
                <li>Configurar etapas do Kanban comercial.</li>
                <li>Cadastrar usuários e perfis da equipe.</li>
                <li>Treinar o time para registrar toda interação no lead.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {isAdmin && activeTab === 'areas' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-serif text-gold-400">Nova Área de Atuação</h2>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Nome da Área (ex: Trabalhista)"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                placeholder="Descrição (opcional)"
                value={newAreaDesc}
                onChange={(e) => setNewAreaDesc(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              />
              <button
                onClick={handleAddArea}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400"
              >
                <Plus className="h-4 w-4" /> Adicionar
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            {areasOfLaw.map((area) => (
              <div key={area.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div>
                  <h3 className="text-lg font-bold text-gold-100">{area.name}</h3>
                  {area.description && <p className="text-sm text-muted-foreground">{area.description}</p>}
                </div>
                <button
                  onClick={() => deleteAreaOfLaw(area.id)}
                  className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
            {areasOfLaw.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhuma área de atuação cadastrada.</p>}
          </div>
        </div>
      )}

      {isAdmin && activeTab === 'services' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-serif text-gold-400">Novo Serviço</h2>
            <div className="mb-4 grid grid-cols-2 gap-4">
              <select
                value={selectedAreaForService}
                onChange={(e) => setSelectedAreaForService(e.target.value)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">Selecione a Área de Atuação</option>
                {areasOfLaw.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Nome do Serviço"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                placeholder="Descrição (opcional)"
                value={newServiceDesc}
                onChange={(e) => setNewServiceDesc(e.target.value)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              />
              <input
                type="number"
                placeholder="Valor Estimado (opcional)"
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
                <Plus className="h-4 w-4" /> Adicionar Serviço
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            {services.map((service) => {
              const area = areasOfLaw.find((item) => item.id === service.areaOfLawId);

              return (
                <div key={service.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded bg-accent px-2 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                        {area?.name || 'Área Desconhecida'}
                      </span>
                      {service.price && (
                        <span className="rounded bg-emerald-400/10 px-2 py-1 text-xs font-mono text-emerald-400">
                          R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-gold-100">{service.name}</h3>
                    {service.description && <p className="text-sm text-muted-foreground">{service.description}</p>}
                  </div>
                  <button
                    onClick={() => deleteService(service.id)}
                    className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              );
            })}
            {services.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhum serviço cadastrado.</p>}
          </div>
        </div>
      )}

      {isAdmin && activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-serif text-gold-400">Nova Tarefa Padrão</h2>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Título da Tarefa"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                placeholder="Descrição (opcional)"
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              />
              <button
                onClick={handleAddTask}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400"
              >
                <Plus className="h-4 w-4" /> Adicionar
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            {standardTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div>
                  <h3 className="text-lg font-bold text-gold-100">{task.title}</h3>
                  {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
                </div>
                <button
                  onClick={() => deleteStandardTask(task.id)}
                  className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
            {standardTasks.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhuma tarefa padrão cadastrada.</p>}
          </div>
        </div>
      )}

      {isAdmin && activeTab === 'kanban' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-xl font-serif text-gold-400">Nova Etapa do Kanban</h2>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Nome da Etapa"
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
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground transition-colors hover:bg-gold-400"
              >
                <Plus className="h-4 w-4" /> Adicionar
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            {[...kanbanStages].sort((a, b) => a.order - b.order).map((stage, index, orderedStages) => (
              <div key={stage.id} className="group flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <button
                      disabled={index === 0}
                      onClick={() => moveStage(stage.id, 'up')}
                      className="p-1 text-muted-foreground transition-all hover:text-primary disabled:opacity-0"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      disabled={index === orderedStages.length - 1}
                      onClick={() => moveStage(stage.id, 'down')}
                      className="p-1 text-muted-foreground transition-all hover:text-primary disabled:opacity-0"
                    >
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
                      <h3 className="flex items-center gap-2 text-lg font-bold text-gold-100">
                        {stage.name}
                        <button
                          onClick={() => setEditingStageId(stage.id)}
                          className="p-1 text-muted-foreground opacity-0 transition-all hover:text-primary group-hover:opacity-100"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </h3>
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
        </div>
      )}
    </div>
  );
}

