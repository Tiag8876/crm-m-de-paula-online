import { useEffect } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Users, Megaphone, Calendar, Settings, Shield, LogOut, BarChart3, FileText, Bell, Clock3, AlertTriangle, CheckCheck, Building2, KanbanSquare, ClipboardList, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useStore } from '@/store/useStore';
import { getUserAccessProfile, isAdminUser } from '@/lib/access';
import { api } from '@/lib/api';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const baseNavItems = [
  { icon: LayoutDashboard, label: 'Painel de Controle', path: '/' },
  { icon: Users, label: 'Gestao de Leads', path: '/leads' },
  { icon: Megaphone, label: 'Estrategia de Trafego', path: '/campaigns' },
  { icon: BarChart3, label: 'Painel de Trafego', path: '/traffic' },
  { icon: FileText, label: 'Relatorios', path: '/reports' },
  { icon: Calendar, label: 'Agenda', path: '/calendar' },
  { icon: Settings, label: 'Configuracoes', path: '/settings' },
];

const prospectingNavItems = [
  { icon: Building2, label: 'Visao Geral', path: '/prospecting' },
  { icon: KanbanSquare, label: 'Kanban', path: '/prospecting/leads' },
  { icon: ClipboardList, label: 'Relatorios', path: '/prospecting/reports' },
  { icon: SlidersHorizontal, label: 'Configuracoes', path: '/prospecting/settings' },
];

export function Layout() {
  const { user, logout } = useAuthStore();
  const { notifications, markNotificationRead, markAllNotificationsRead } = useStore();
  const profile = getUserAccessProfile(user);
  const logoSrc = typeof window !== 'undefined' && window.location.protocol === 'file:'
    ? './logo-m-de-paula.png'
    : '/logo-m-de-paula.png';

  const navItems = isAdminUser(user)
    ? [...baseNavItems, { icon: Shield, label: 'Usuarios', path: '/admin/users' }]
    : baseNavItems.filter((item) => {
        if (profile === 'traffic') {
          return ['/', '/campaigns', '/traffic', '/calendar', '/settings'].includes(item.path);
        }
        return ['/', '/leads', '/reports', '/calendar', '/settings'].includes(item.path);
      });

  const showProspecting = isAdminUser(user) || profile === 'commercial';

  const unreadCount = (notifications || []).filter((item) => !item.read).length;

  useEffect(() => {
    const onBeforeUnload = () => {
      if (!localStorage.getItem('lawcrm-token')) return;
      api.post('/api/backup/now').catch(() => null);
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return (
    <div className="flex h-screen bg-background text-foreground font-sans">
      <aside className="w-72 bg-card border-r border-border flex flex-col shadow-2xl z-20">
        <div className="p-8 border-b border-border">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border border-gold-500/30 shadow-[0_0_20px_rgba(212,175,55,0.25)]">
              <img
                src={logoSrc}
                alt="Logo CRM M de Paula"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                }}
              />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-serif font-bold tracking-[0.2em] gold-text-gradient uppercase">CRM M de Paula</h1>
              <p className="text-[10px] text-gold-500/60 tracking-[0.4em] uppercase mt-1">Sistema Comercial</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-3 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-4 px-4 py-3.5 rounded-lg text-xs font-semibold tracking-widest uppercase transition-all duration-300 group',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(212,175,55,0.4)]'
                    : 'text-muted-foreground hover:text-gold-400 hover:bg-accent'
                )
              }
            >
              <item.icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
              {item.label}
            </NavLink>
          ))}

          {showProspecting && (
            <div className="pt-3 mt-2 border-t border-border/60">
              <p className="px-4 pb-2 text-[10px] uppercase tracking-[0.22em] text-gold-500/60">Prospecção</p>
              <div className="space-y-2">
                {prospectingNavItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/prospecting'}
                    className={({ isActive }) =>
                      cn(
                        'ml-4 flex items-center gap-3 px-4 py-2.5 rounded-lg text-[11px] font-semibold tracking-wider uppercase transition-all duration-300 group',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                          : 'text-muted-foreground hover:text-gold-400 hover:bg-accent'
                      )
                    }
                  >
                    <item.icon className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="p-6 border-t border-border">
          <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-accent border border-border">
            <div className="w-10 h-10 rounded-full gold-gradient p-[1px]">
              <div className="w-full h-full rounded-full bg-card flex items-center justify-center overflow-hidden">
                <Users className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-xs text-gold-100 truncate tracking-wider uppercase">{user?.name}</p>
              <p className="text-[10px] text-gold-500/60 truncate tracking-tight">{user?.sector} - {user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-xs uppercase tracking-widest hover:bg-accent"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto scrollbar-none bg-background relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gold-900/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gold-900/5 rounded-full blur-[100px] pointer-events-none -z-10"></div>

        <div className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border px-6 py-3 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative p-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors">
                <Bell className="w-5 h-5 text-primary" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[360px] p-0">
              <DropdownMenuLabel className="px-4 py-3 text-xs uppercase tracking-widest flex items-center justify-between gap-3">
                Alertas da Operacao
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="text-[10px] text-primary uppercase tracking-widest hover:underline inline-flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  Marcar tudo
                </button>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-[420px] overflow-y-auto scrollbar-none p-1">
                {(notifications || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground px-3 py-8 text-center">Sem alertas no momento.</p>
                ) : (
                  (notifications || []).map((alert) => (
                    <DropdownMenuItem key={alert.id} asChild>
                      <Link
                        to={alert.leadId ? `/leads/${alert.leadId}` : '/'}
                        onClick={() => markNotificationRead(alert.id)}
                        className={cn('flex items-start gap-3 p-3 rounded-md cursor-pointer', !alert.read && 'bg-accent/50')}
                      >
                        {alert.category === 'idle' || alert.category === 'followup' ? (
                          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-400" />
                        ) : (
                          <Clock3 className="w-4 h-4 mt-0.5 text-primary" />
                        )}
                        <div>
                          <p className="text-sm font-semibold leading-tight">
                            {alert.title} {!alert.read && <span className="text-primary">•</span>}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 leading-tight">{alert.description}</p>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
