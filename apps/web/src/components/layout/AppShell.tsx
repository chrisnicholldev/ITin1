import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { logout } from '@/api/auth';
import { getOrgSettings } from '@/api/settings';
import {
  LayoutDashboard,
  Ticket,
  Monitor,
  Shield,
  Server,
  Globe,
  BookOpen,
  MapPin,
  Users,
  Settings,
  Plug,
  LogOut,
  Menu,
  X,
  Building2,
  DatabaseBackup,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, minRole: 'end_user' },
  { href: '/tickets', label: 'Tickets', icon: Ticket, minRole: 'end_user' },
  { href: '/assets', label: 'Assets', icon: Monitor, minRole: 'it_technician' },
  { href: '/vault', label: 'Vault', icon: Shield, minRole: 'it_technician' },
  { href: '/docs', label: 'Docs', icon: BookOpen, minRole: 'end_user' },
  { href: '/network/racks', label: 'Racks', icon: Server, minRole: 'it_technician' },
  { href: '/network/networks', label: 'Networks', icon: Globe, minRole: 'it_technician' },
  { href: '/vendors', label: 'Vendors', icon: Building2, minRole: 'it_technician' },
  { href: '/admin/locations', label: 'Locations', icon: MapPin, minRole: 'it_admin' },
  { href: '/admin/users', label: 'Users', icon: Users, minRole: 'it_admin' },
  { href: '/admin/integrations', label: 'Integrations', icon: Plug, minRole: 'it_admin' },
  { href: '/admin/backup', label: 'Backup', icon: DatabaseBackup, minRole: 'it_admin' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, minRole: 'it_admin' },
];

const roleWeight: Record<string, number> = {
  end_user: 0,
  it_technician: 1,
  it_admin: 2,
  super_admin: 3,
};

function hasAccess(userRole: string, minRole: string) {
  return (roleWeight[userRole] ?? 0) >= (roleWeight[minRole] ?? 0);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout: storeLogout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: orgSettings } = useQuery({
    queryKey: ['org-settings'],
    queryFn: getOrgSettings,
    staleTime: 5 * 60 * 1000,
  });
  const orgName = orgSettings?.orgName ?? 'IT Helpdesk';

  useEffect(() => { document.title = orgName; }, [orgName]);

  const handleLogout = async () => {
    try { await logout(); } catch { /* ignore */ }
    storeLogout();
    navigate('/login');
  };

  const visibleItems = navItems.filter((item) => hasAccess(user?.role ?? 'end_user', item.minRole));

  const Sidebar = () => (
    <nav className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-5 border-b">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center overflow-hidden flex-shrink-0">
          {orgSettings?.orgLogoUrl
            ? <img src={orgSettings.orgLogoUrl} alt="logo" className="w-full h-full object-contain" />
            : <Ticket className="w-4 h-4 text-primary-foreground" />}
        </div>
        <span className="font-semibold text-lg">{orgName}</span>
      </div>

      <div className="flex-1 py-4 space-y-1 px-2">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              location.pathname.startsWith(item.href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        ))}
      </div>

      <div className="border-t p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold">
            {user?.displayName?.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={handleLogout}>
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-shrink-0 border-r bg-card flex-col">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-60 h-full bg-card border-r flex flex-col">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b bg-card">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-semibold">{orgName}</span>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
