// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import AdminCalendar from './pages/AdminCalendar';
import AdminAppointments from './pages/AdminAppointments';  // ← Nuevo componente
import StoreFront from './pages/StoreFront';
import BookAppointment from './pages/BookAppointment';
import MyAppointments from './pages/MyAppointments';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ============================================
              RUTAS PÚBLICAS (sin autenticación)
          ============================================ */}
          
          {/* Página pública de la tienda */}
          <Route path="/:slug" element={<StoreFront />} />
          
          {/* Agendar cita (público) */}
          <Route path="/:slug/agendar" element={<BookAppointment />} />
          
          {/* Ver citas (cliente con token) */}
          <Route path="/:slug/citas" element={<MyAppointments />} />
          
          {/* Ruta alternativa para clientes (sin slug) */}
          <Route path="/mis-citas" element={<MyAppointments />} />

          {/* ============================================
              RUTAS DE AUTENTICACIÓN
          ============================================ */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* ============================================
              RUTAS PROTEGIDAS (requieren autenticación)
          ============================================ */}
          
          {/* Dashboard principal */}
          <Route path="/Inicio" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          {/* Administrar calendario */}
          <Route path="/:slug/admin/calendar" element={
            <ProtectedRoute>
              <AdminCalendar />
            </ProtectedRoute>
          } />
          
          {/* Redirigir /:slug/admin a /:slug/admin/calendar (por compatibilidad) */}
          <Route path="/:slug/admin" element={
            <ProtectedRoute>
              <Navigate to="/:slug/admin/calendar" replace />
            </ProtectedRoute>
          } />
          
          {/* Administrar citas (empleados/owners) */}
          <Route path="/:slug/admin/citas" element={
            <ProtectedRoute>
              <AdminAppointments />
            </ProtectedRoute>
          } />
          
          {/* Redirección por defecto */}
          <Route path="/" element={<Navigate to="/Inicio" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;