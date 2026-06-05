// frontend/src/components/CalendarManager.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

function CalendarManager({ store, calendar, onUpdate, userRole }) {
  const { token } = useAuth();
  const [workingHours, setWorkingHours] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('hours');
  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const daysOfWeek = [
    { id: 0, name: 'Domingo', short: 'Dom' },
    { id: 1, name: 'Lunes', short: 'Lun' },
    { id: 2, name: 'Martes', short: 'Mar' },
    { id: 3, name: 'Miércoles', short: 'Mié' },
    { id: 4, name: 'Jueves', short: 'Jue' },
    { id: 5, name: 'Viernes', short: 'Vie' },
    { id: 6, name: 'Sábado', short: 'Sáb' }
  ];

  useEffect(() => {
    fetchCalendarData();
  }, [calendar?.id]);

  const fetchCalendarData = async () => {
    if (!calendar?.id) return;
    
    setLoading(true);
    try {
      const hoursRes = await axios.get(
        `${import.meta.env.VITE_API_URL}/calendar/${calendar.id}/schedule`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setWorkingHours(hoursRes.data.working_hours || []);
      setExceptions(hoursRes.data.exceptions || []);
      setAppointments(hoursRes.data.appointments || []);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      setError('Error al cargar los datos del calendario');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkingHourChange = async (dayId, field, value) => {
    const hour = workingHours.find(h => h.day_of_week === dayId);
    if (!hour) return;

    try {
      const updated = await axios.put(
        `${import.meta.env.VITE_API_URL}/calendar/working-hours/${hour.id}`,
        { [field]: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setWorkingHours(workingHours.map(h => 
        h.day_of_week === dayId ? updated.data : h
      ));
      showSuccess('Horario actualizado');
    } catch (error) {
      showError('Error al actualizar horario');
    }
  };

  const handleAddException = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/calendar/exceptions`,
        {
          calendar_id: calendar.id,
          exception_date: formData.get('exception_date'),
          is_available: formData.get('is_available') === 'true',
          start_time: formData.get('start_time') || null,
          end_time: formData.get('end_time') || null,
          reason: formData.get('reason')
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setShowExceptionForm(false);
      fetchCalendarData();
      showSuccess('Excepción agregada');
    } catch (error) {
      showError('Error al agregar excepción');
    }
  };

  const handleUpdateAppointment = async (appointmentId, status) => {
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/calendar/appointments/${appointmentId}`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      fetchCalendarData();
      showSuccess('Cita actualizada');
    } catch (error) {
      showError('Error al actualizar cita');
    }
  };

  const showSuccess = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 3000);
  };

  const showError = (message) => {
    setError(message);
    setTimeout(() => setError(''), 3000);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'Pendiente', color: '#f59e0b', bg: '#fef3c7' },
      confirmed: { text: 'Confirmada', color: '#10b981', bg: '#d1fae5' },
      cancelled: { text: 'Cancelada', color: '#ef4444', bg: '#fee2e2' },
      completed: { text: 'Completada', color: '#6b7280', bg: '#f3f4f6' },
      no_show: { text: 'No Asistió', color: '#dc2626', bg: '#fee2e2' }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span style={{ ...styles.badge, backgroundColor: badge.bg, color: badge.color }}>
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinnerSmall}></div>
        <p>Cargando calendario...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab('hours')}
          className={activeTab === 'hours' ? 'tab-active' : ''}
          style={{ ...styles.tab, ...(activeTab === 'hours' ? styles.tabActive : {}) }}
        >
          🕐 Horarios
        </button>
        <button
          onClick={() => setActiveTab('exceptions')}
          style={{ ...styles.tab, ...(activeTab === 'exceptions' ? styles.tabActive : {}) }}
        >
          📅 Excepciones
        </button>
        <button
          onClick={() => setActiveTab('appointments')}
          style={{ ...styles.tab, ...(activeTab === 'appointments' ? styles.tabActive : {}) }}
        >
          📋 Citas ({appointments.length})
        </button>
      </div>

      {activeTab === 'hours' && (
        <div style={styles.tabContent}>
          <div style={styles.sectionHeader}>
            <h3>Horarios de Atención</h3>
            <p style={styles.sectionDesc}>Define los horarios de trabajo para cada día</p>
          </div>

          <div style={styles.hoursGrid}>
            {daysOfWeek.map(day => {
              const hour = workingHours.find(h => h.day_of_week === day.id);
              if (!hour) return null;
              
              return (
                <div key={day.id} style={styles.hourCard}>
                  <div style={styles.dayHeader}>
                    <span style={styles.dayName}>{day.name}</span>
                    <label style={styles.toggleSwitch}>
                      <input
                        type="checkbox"
                        checked={hour.is_working_day}
                        onChange={(e) => handleWorkingHourChange(day.id, 'is_working_day', e.target.checked)}
                      />
                      <span style={styles.toggleSlider}></span>
                    </label>
                  </div>
                  
                  {hour.is_working_day && (
                    <div style={styles.timeRange}>
                      <input
                        type="time"
                        value={hour.start_time?.substring(0, 5) || '09:00'}
                        onChange={(e) => handleWorkingHourChange(day.id, 'start_time', e.target.value + ':00')}
                        style={styles.timeInput}
                      />
                      <span style={styles.timeSeparator}>→</span>
                      <input
                        type="time"
                        value={hour.end_time?.substring(0, 5) || '18:00'}
                        onChange={(e) => handleWorkingHourChange(day.id, 'end_time', e.target.value + ':00')}
                        style={styles.timeInput}
                      />
                    </div>
                  )}
                  
                  {!hour.is_working_day && (
                    <div style={styles.closedBadge}>Cerrado</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'exceptions' && (
        <div style={styles.tabContent}>
          <div style={styles.sectionHeader}>
            <div>
              <h3>Excepciones</h3>
              <p style={styles.sectionDesc}>Días festivos, vacaciones o días con horario especial</p>
            </div>
            <button onClick={() => setShowExceptionForm(true)} style={styles.primaryBtn}>
              + Agregar Excepción
            </button>
          </div>

          {showExceptionForm && (
            <form onSubmit={handleAddException} style={styles.formCard}>
              <h4 style={styles.formTitle}>Nueva Excepción</h4>
              <div style={styles.formGrid}>
                <div style={styles.formField}>
                  <label>Fecha *</label>
                  <input type="date" name="exception_date" required style={styles.input} />
                </div>
                <div style={styles.formField}>
                  <label>Tipo *</label>
                  <select name="is_available" required style={styles.select}>
                    <option value="false">Día NO laboral (cerrado)</option>
                    <option value="true">Día laboral (horario especial)</option>
                  </select>
                </div>
                <div style={styles.formField}>
                  <label>Horario especial (inicio)</label>
                  <input type="time" name="start_time" style={styles.input} />
                </div>
                <div style={styles.formField}>
                  <label>Horario especial (fin)</label>
                  <input type="time" name="end_time" style={styles.input} />
                </div>
                <div style={{ ...styles.formField, gridColumn: '1 / -1' }}>
                  <label>Motivo</label>
                  <input type="text" name="reason" placeholder="Ej: Vacaciones, Feriado" style={styles.input} />
                </div>
              </div>
              <div style={styles.formActions}>
                <button type="button" onClick={() => setShowExceptionForm(false)} style={styles.secondaryBtn}>
                  Cancelar
                </button>
                <button type="submit" style={styles.primaryBtnSmall}>
                  Guardar
                </button>
              </div>
            </form>
          )}

          <div style={styles.exceptionsList}>
            {exceptions.length === 0 ? (
              <div style={styles.emptyState}>
                <span style={styles.emptyIcon}>📅</span>
                <p>No hay excepciones configuradas</p>
              </div>
            ) : (
              exceptions.map(exception => (
                <div key={exception.id} style={styles.exceptionCard}>
                  <div style={styles.exceptionDate}>
                    <strong>{new Date(exception.exception_date).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                    {exception.reason && <span style={styles.exceptionReason}> - {exception.reason}</span>}
                  </div>
                  <div style={styles.exceptionStatus}>
                    {exception.is_available ? (
                      <span style={styles.availableBadge}>
                        🕐 {exception.start_time?.substring(0, 5)} - {exception.end_time?.substring(0, 5)}
                      </span>
                    ) : (
                      <span style={styles.closedBadgeLarge}>🔴 Cerrado</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'appointments' && (
        <div style={styles.tabContent}>
          <div style={styles.sectionHeader}>
            <div>
              <h3>Citas Programadas</h3>
              <p style={styles.sectionDesc}>Gestiona las citas de los clientes</p>
            </div>
          </div>

          <div style={styles.appointmentsList}>
            {appointments.length === 0 ? (
              <div style={styles.emptyState}>
                <span style={styles.emptyIcon}>📋</span>
                <p>No hay citas programadas</p>
              </div>
            ) : (
              appointments.map(appointment => (
                <div key={appointment.id} style={styles.appointmentCard}>
                  <div style={styles.appointmentHeader}>
                    <div style={styles.customerInfo}>
                      <strong style={styles.customerName}>{appointment.customer_name}</strong>
                      <span style={styles.customerEmail}>{appointment.customer_email}</span>
                    </div>
                    {getStatusBadge(appointment.status)}
                  </div>
                  <div style={styles.appointmentDetails}>
                    <div style={styles.detailItem}>📅 {new Date(appointment.start_time).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                    <div style={styles.detailItem}>🕐 {new Date(appointment.start_time).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} - {new Date(appointment.end_time).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
                    {appointment.customer_phone && <div style={styles.detailItem}>📞 {appointment.customer_phone}</div>}
                  </div>
                  {appointment.notes && <div style={styles.appointmentNotes}>📝 {appointment.notes}</div>}
                  <div style={styles.appointmentActions}>
                    {appointment.status === 'pending' && (
                      <>
                        <button onClick={() => handleUpdateAppointment(appointment.id, 'confirmed')} style={styles.confirmBtn}>
                          ✓ Confirmar
                        </button>
                        <button onClick={() => handleUpdateAppointment(appointment.id, 'cancelled')} style={styles.cancelBtn}>
                          ✗ Cancelar
                        </button>
                      </>
                    )}
                    {appointment.status === 'confirmed' && (
                      <button onClick={() => handleUpdateAppointment(appointment.id, 'completed')} style={styles.completeBtn}>
                        ✓ Marcar Completada
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    overflow: 'hidden'
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    padding: '0 24px'
  },
  tab: {
    padding: '14px 24px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#6b7280',
    transition: 'all 0.2s'
  },
  tabActive: {
    color: '#3B82F6',
    borderBottom: '2px solid #3B82F6',
    backgroundColor: 'transparent'
  },
  tabContent: {
    padding: '24px'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  sectionDesc: {
    fontSize: '13px',
    color: '#6b7280',
    marginTop: '4px'
  },
  hoursGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px'
  },
  hourCard: {
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #e5e7eb',
    transition: 'all 0.2s'
  },
  dayHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  dayName: {
    fontWeight: '600',
    fontSize: '16px',
    color: '#374151'
  },
  toggleSwitch: {
    position: 'relative',
    display: 'inline-block',
    width: '44px',
    height: '24px'
  },
  timeRange: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  timeInput: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: 'white'
  },
  timeSeparator: {
    color: '#6b7280',
    fontSize: '14px'
  },
  closedBadge: {
    textAlign: 'center',
    padding: '8px',
    backgroundColor: '#fee2e2',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#dc2626'
  },
  primaryBtn: {
    padding: '10px 20px',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  primaryBtnSmall: {
    padding: '8px 16px',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  secondaryBtn: {
    padding: '8px 16px',
    backgroundColor: '#e5e7eb',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151'
  },
  formCard: {
    backgroundColor: '#f9fafb',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '24px',
    border: '1px solid #e5e7eb'
  },
  formTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: '600'
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '20px'
  },
  formField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  input: {
    padding: '10px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px'
  },
  select: {
    padding: '10px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: 'white'
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },
  exceptionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  exceptionCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    flexWrap: 'wrap',
    gap: '12px'
  },
  exceptionDate: {
    fontSize: '14px'
  },
  exceptionReason: {
    color: '#6b7280'
  },
  availableBadge: {
    padding: '4px 12px',
    backgroundColor: '#d1fae5',
    borderRadius: '20px',
    fontSize: '13px',
    color: '#059669'
  },
  closedBadgeLarge: {
    padding: '4px 12px',
    backgroundColor: '#fee2e2',
    borderRadius: '20px',
    fontSize: '13px',
    color: '#dc2626'
  },
  appointmentsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  appointmentCard: {
    padding: '20px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    border: '1px solid #e5e7eb'
  },
  appointmentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #e5e7eb',
    flexWrap: 'wrap',
    gap: '12px'
  },
  customerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  customerName: {
    fontSize: '16px',
    color: '#111827'
  },
  customerEmail: {
    fontSize: '13px',
    color: '#6b7280'
  },
  appointmentDetails: {
    display: 'flex',
    gap: '20px',
    fontSize: '14px',
    color: '#4b5563',
    flexWrap: 'wrap',
    marginBottom: '12px'
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  appointmentNotes: {
    padding: '12px',
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '16px'
  },
  appointmentActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  badge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '500'
  },
  confirmBtn: {
    padding: '6px 16px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  cancelBtn: {
    padding: '6px 16px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  completeBtn: {
    padding: '6px 16px',
    backgroundColor: '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '12px 20px',
    margin: '16px',
    borderRadius: '10px',
    fontSize: '14px'
  },
  success: {
    backgroundColor: '#d1fae5',
    color: '#059669',
    padding: '12px 20px',
    margin: '16px',
    borderRadius: '10px',
    fontSize: '14px'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    gap: '12px',
    color: '#6b7280'
  },
  spinnerSmall: {
    width: '30px',
    height: '30px',
    border: '2px solid #e5e7eb',
    borderTopColor: '#3B82F6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px',
    color: '#6b7280'
  },
  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px'
  }
};

export default CalendarManager;