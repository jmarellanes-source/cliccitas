// frontend/src/pages/MyAppointments.jsx
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

function MyAppointments() { 
  const { slug } = useParams();  // ← Obtener slug de la URL
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token no proporcionado');
      setLoading(false);
      return;
    }
    fetchAppointment();
  }, [token]);

  const fetchAppointment = async () => {
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/appointments/my-appointments?token=${token}`
      );
      setAppointment(res.data.appointment);
    } catch (error) {
      console.error('Error fetching appointment:', error);
      setError(error.response?.data?.error || 'Error al cargar la cita');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action, data = {}) => {
    setActionLoading(true);
    try {
      const res = await axios.patch(
        `${import.meta.env.VITE_API_URL}/appointments/my-appointments/confirm`,
        { token, action, ...data }
      );
      setSuccess(res.data.message);
      setAppointment(res.data.appointment);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Error al procesar la solicitud');
      setTimeout(() => setError(''), 3000);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingSpinner}></div>
        <p>Cargando tu cita...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <span style={styles.errorIcon}>🔒</span>
          <h2>Acceso no autorizado</h2>
          <p>{error}</p>
          <button onClick={() => window.location.href = '/'} style={styles.homeBtn}>
            Ir al inicio
          </button>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <span style={styles.errorIcon}>📋</span>
          <h2>Cita no encontrada</h2>
          <p>No pudimos encontrar la cita asociada a este enlace.</p>
          <button onClick={() => window.location.href = '/'} style={styles.homeBtn}>
            Ir al inicio
          </button>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { text: 'Pendiente', color: '#f59e0b', bg: '#fef3c7' },
      confirmed: { text: 'Confirmada', color: '#10b981', bg: '#d1fae5' },
      cancelled: { text: 'Cancelada', color: '#ef4444', bg: '#fee2e2' },
      completed: { text: 'Completada', color: '#6b7280', bg: '#f3f4f6' },
      no_show: { text: 'No asistió', color: '#dc2626', bg: '#fee2e2' }
    };
    const s = statusMap[status] || statusMap.pending;
    return <span style={{ ...styles.badge, backgroundColor: s.bg, color: s.color }}>{s.text}</span>;
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1>📅 Mi Cita</h1>
          {getStatusBadge(appointment.status)}
        </div>

        <div style={styles.details}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Cliente:</span>
            <span>{appointment.customer_name}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Email:</span>
            <span>{appointment.customer_email}</span>
          </div>
          {appointment.customer_phone && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Teléfono:</span>
              <span>{appointment.customer_phone}</span>
            </div>
          )}
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Profesional:</span>
            <span>{appointment.employee_name || 'No asignado'}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Fecha:</span>
            <span>{new Date(appointment.start_time).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Hora:</span>
            <span>{new Date(appointment.start_time).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} - {new Date(appointment.end_time).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {appointment.notes && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Notas:</span>
              <span style={styles.notes}>{appointment.notes}</span>
            </div>
          )}
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Tienda:</span>
            <span>{appointment.store_name}</span>
          </div>
        </div>

        {success && <div style={styles.successMessage}>{success}</div>}

        <div style={styles.actions}>
          {appointment.status === 'pending' && (
            <>
              <button
                onClick={() => handleAction('confirm')}
                disabled={actionLoading}
                style={styles.confirmBtn}
              >
                ✅ Confirmar Cita
              </button>
              <button
                onClick={() => handleAction('cancel')}
                disabled={actionLoading}
                style={styles.cancelBtn}
              >
                ❌ Cancelar Cita
              </button>
            </>
          )}
          {appointment.status === 'confirmed' && (
            <button
              onClick={() => handleAction('cancel')}
              disabled={actionLoading}
              style={styles.cancelBtn}
            >
              ❌ Cancelar Cita
            </button>
          )}
          <button onClick={() => window.location.href = '/'} style={styles.homeBtn}>
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '600px',
    width: '100%',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #e5e7eb'
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #f3f4f6'
  },
  detailLabel: {
    fontWeight: '500',
    color: '#6b7280'
  },
  notes: {
    maxWidth: '200px',
    textAlign: 'right',
    wordBreak: 'break-word'
  },
  badge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '500'
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '16px'
  },
  confirmBtn: {
    padding: '12px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  cancelBtn: {
    padding: '12px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  homeBtn: {
    padding: '12px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  successMessage: {
    backgroundColor: '#d1fae5',
    color: '#059669',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '16px',
    textAlign: 'center'
  },
  errorCard: {
    textAlign: 'center',
    padding: '40px'
  },
  errorIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px'
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#3B82F6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 16px'
  }
};

export default MyAppointments;