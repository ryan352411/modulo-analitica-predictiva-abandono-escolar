import { Navigate, Outlet } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ProtectedRoute({ roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-risk-high" />
        <h1 className="mt-4 text-lg font-semibold">Sin permisos</h1>
        <p className="mt-1 text-sm text-ink/60">
          No tienes permisos para acceder a esta sección. Si crees que es un error, contacta al
          administrador de tu escuela.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
