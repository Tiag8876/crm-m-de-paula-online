import { useEffect, useMemo, useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Settings, LogOut, BarChart3, FileText, Bell, Clock3, AlertTriangle, CheckCheck, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useStore } from '@/store/useStore';
import { getUserAccessProfile, isAdminUser } from '@/lib/access';
import { api } from '@/lib/api';
import { normalizePtBrText } from '@/lib/text';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const baseNavItems = [
  { icon: LayoutDashboard, label: 'Painel de Controle', path: '/' },
  { icon: Users, label: 'Gestão de Leads', path: '/leads' },
  { icon: BarChart3, label: 'Painel de Tráfego', path: '/traffic' },
  { icon: FileText, label: 'Relatórios', path: '/reports' },
  { icon: Calendar, label: 'Agenda', path: '/calendar' },
  { icon: Settings, label: 'Configurações', path: '/settings' },
];

export function Layout() {
  const { user, logout } = useAuthStore();
  const { notifications, markNotificationRead, markAllNotificationsRead } = useStore();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('lawcrm-sidebar-collapsed') === 'true';
  });
  const profile = getUserAccessProfile(user);
  const logoSrc = typeof window !== 'undefined' && window.location.protocol === 'file:'
    ? './logo-m-de-paula.png'
    : '/logo-m-de-paula.png';

  const navItems = useMemo(
    () =>
      isAdminUser(user)
        ? baseNavItems
        : baseNavItems.filter((item) => {
            if (profile === 'traffic') {
              return ['/', '/traffic', '/calendar', '/settings'].includes(item.path);
            }
            return ['/', '/leads', '/reports', '/calendar', '/settings'].includes(item.path);
          }),
    [profile, user],
  );

  const userInitials = (user?.name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const unreadCount = (notifications || []).filter((item) => !item.read).length;

  useEffect(() => {
    const onBeforeUnload = () => {
      if (!localStorage.getItem('lawcrm-token')) return;
      api.post('/api/backup-now').catch(() => null);
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('lawcrm-sidebar-collapsed', String(next));
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground font-sans">
      <aside className={cn('bg-card border-r border-border flex flex-col shadow-2xl z-20 transition-all duration-300', collapsed ? 'w-24' : 'w-72')}>
        <div className={cn('border-b border-border', collapsed ? 'p-4' : 'p-8')}>
          <div className="flex flex-col items-center gap-4">
            <div className={cn('rounded-full overflow-hidden border border-gold-500/30 shadow-[0_0_20px_rgba(212,175,55,0.25)]', collapsed ? 'w-12 h-12' : 'w-16 h-16')}>
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

            {!collapsed ? (
              <div className="text-center">
                <h1 className="text-2xl font-serif font-bold tracking-[0.2em] gold-text-gradient uppercase">CRM M de Paula</h1>
                <p className="text-[10px] text-gold-500/60 tracking-[0.4em] uppercase mt-1">Sistema Comercial</p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={toggleSidebar}
              className="inline-flex items-center justify-center rounded-xl border border-border bg-accent text-muted-foreground hover:text-primary hover:border-gold-500/30 transition-all w-10 h-10"
              aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
              title={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <nav className={cn('flex-1 overflow-y-auto', collapsed ? 'p-3 space-y-2' : 'p-6 space-y-3')}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-lg text-xs font-semibold tracking-widest uppercase transition-all duration-300 group',
                  collapsed ? 'justify-center px-3 py-3.5' : 'gap-4 px-4 py-3.5',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(212,175,55,0.4)]'
                    : 'text-muted-foreground hover:text-gold-400 hover:bg-accent',
                )
              }
            >
              <item.icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
              {!collapsed ? item.label : null}
            </NavLink>
          ))}
        </nav>

        <div className={cn('border-t border-border', collapsed ? 'p-3' : 'p-6')}>
          <div className={cn('rounded-xl bg-accent border border-border', collapsed ? 'flex justify-center px-3 py-3' : 'flex items-center gap-4 px-4 py-3')}>
            <div className="w-10 h-10 rounded-full gold-gradient p-[1px]">
              <div className="w-full h-full rounded-full bg-card flex items-center justify-center overflow-hidden">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-black uppercase tracking-widest text-primary">{userInitials}</span>
                )}
              </div>
            </div>
            {!collapsed ? (
              <div className="overflow-hidden">
                <p className="font-bold text-xs text-gold-100 truncate tracking-wider uppercase">{user?.name}</p>
                <p className="text-[10px] text-gold-500/60 truncate tracking-tight">{user?.sector} - {user?.role}</p>
              </div>
            ) : null}
          </div>
          <button
            onClick={logout}
            className={cn('mt-3 w-full flex items-center justify-center rounded-xl border border-border text-xs uppercase tracking-widest hover:bg-accent', collapsed ? 'px-3 py-2.5' : 'gap-2 px-4 py-2')}
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed ? 'Sair' : null}
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
                Alertas da Operação
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
                            {normalizePtBrText(alert.title)} {!alert.read && <span className="text-primary">•</span>}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 leading-tight">{normalizePtBrText(alert.description)}</p>
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
