import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/layout/ProtectedRoute.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Students from './pages/Students.jsx';
import StudentDetail from './pages/StudentDetail.jsx';
import StudentForm from './pages/StudentForm.jsx';
import Alerts from './pages/Alerts.jsx';
import Users from './pages/Users.jsx';
import HighRisk from './pages/HighRisk.jsx';
import ModelInfo from './pages/ModelInfo.jsx';
import AuditLogs from './pages/AuditLogs.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/estudiantes" element={<Students />} />
          <Route path="/estudiantes/nuevo" element={<StudentForm />} />
          <Route path="/estudiantes/:id" element={<StudentDetail />} />
          <Route path="/estudiantes/:id/editar" element={<StudentForm />} />
          <Route path="/riesgo-alto" element={<HighRisk />} />
          <Route path="/alertas" element={<Alerts />} />
          <Route path="/usuarios" element={<Users />} />
          <Route path="/modelo" element={<ModelInfo />} />
          <Route path="/auditoria" element={<AuditLogs />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
