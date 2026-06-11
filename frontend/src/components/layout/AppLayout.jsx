import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Bell, LogOut, GraduationCap, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { cn } from '../../lib/utils.js';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/estudiantes', label: 'Estudiantes', icon: Users },
  { to: '/alertas', label: 'Alertas', icon: Bell },
  { to: '/usuarios', label: 'Usuarios', icon: ShieldCheck, adminOnly: true },
];

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 bg-ink text-white flex flex-col">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-white/10">
          <GraduationCap className="h-6 w-6 text-primary-light" />
          <div className="leading-tight">
            <p className="font-semibold text-sm">Analítica Predictiva</p>
            <p className="text-xs text-white/60">Abandono Escolar</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems
            .filter((item) => !item.adminOnly || user?.role === 'admin')
            .map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-primary text-white' : 'text-white/70 hover:bg-white/10'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-sm font-medium truncate">{user?.full_name}</p>
          <p className="text-xs text-white/50 capitalize">{user?.role}</p>
          <button
            onClick={logout}
            className="mt-3 flex items-center gap-2 text-xs text-white/70 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
