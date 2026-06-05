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
  const [selectedDate, setSelectedDate] = useState('');
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
      // Obtener horarios
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
      setSuccess('Horario actualizado');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating working hours:', error);
      setError('Error al actualizar horario');
      setTimeout(() => setError(''), 3000);
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
      setSuccess('Excepción agregada');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error adding exception:', error);
      setError('Error al agregar excepción');
      setTimeout(() => setError(''), 3000);
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
      setSuccess('Cita actualizada');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating appointment:', error);
      setError('Error al actualizar cita');
      setTimeout(() => setError(''), 3000);
    }
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
    return <div style={styles.loading}>Cargando calendario...</div>;
  }

  return (
    <div style={styles.container}>
      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab('hours')}
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

      {/* Tab: Horarios de Trabajo */}
      {activeTab === 'hours' && (
        <div style={styles.tabContent}>
          <h3>Horarios de Atención</h3>
          <p style={styles.hint}>
            Define los horarios de trabajo para cada día de la semana
          </p>

          <div style={styles.hoursTable}>
            {daysOfWeek.map(day => {
              const hour = workingHours.find(h => h.day_of_week === day.id);
              if (!hour) return null;
              
              return (
                <div key={day.id} style={styles.hourRow}>
                  <div style={styles.dayName}>{day.name}</div>
                  <div style={styles.hourControls}>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={hour.is_working_day}
                        onChange={(e) => handleWorkingHourChange(day.id, 'is_working_day', e.target.checked)}
                      />
                      Activo
                    </label>
                    
                    {hour.is_working_day && (
                      <>
                        <input
                          type="time"
                          value={hour.start_time?.substring(0, 5) || '09:00'}
                          onChange={(e) => handleWorkingHourChange(day.id, 'start_time', e.target.value)}
                          style={styles.timeInput}
                        />
                        <span>a</span>
                        <input
                          type="time"
                          value={hour.end_time?.substring(0, 5) || '18:00'}
                          onChange={(e) => handleWorkingHourChange(day.id, 'end_time', e.target.value)}
                          style={styles.timeInput}
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Excepciones */}
      {activeTab === 'exceptions' && (
        <div style={styles.tabContent}>
          <div style={styles.sectionHeader}>
            <h3>Excepciones</h3>
            <button onClick={() => setShowExceptionForm(true)} style={styles.addBtn}>
              + Agregar Excepción
            </button>
          </div>
          <p style={styles.hint}>
            Días festivos, vacaciones o días con horario especial
          </p>

          {showExceptionForm && (
            <form onSubmit={handleAddException} style={styles.exceptionForm}>
              <h4>Nueva Excepción</h4>
              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label>Fecha *</label>
                  <input
                    type="date"
                    name="exception_date"
                    required
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label>Tipo *</label>
                  <select name="is_available" required style={styles.input}>
                    <option value="false">Día NO laboral (cerrado)</option>
                    <option value="true">Día laboral (horario especial)</option>
                  </select>
                </div>
              </div>
              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label>Horario especial (inicio)</label>
                  <input
                    type="time"
                    name="start_time"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label>Horario especial (fin)</label>
                  <input
                    type="time"
                    name="end_time"
                    style={styles.input}
                  />
                </div>
              </div>
              <div style={styles.formGroup}>
                <label>Motivo</label>
                <input
                  type="text"
                  name="reason"
                  placeholder="Ej: Vacaciones, Feriado, Capacitación"
                  style={styles.input}
                />
              </div>
              <div style={styles.formButtons}>
                <button type="button" onClick={() => setShowExceptionForm(false)} style={styles.cancelBtn}>
                  Cancelar
                </button>
                <button type="submit" style={styles.submitBtn}>
                  Guardar
                </button>
              </div>
            </form>
          )}

          <div style={styles.exceptionsList}>
            {exceptions.length === 0 ? (
              <p style={styles.emptyState}>No hay excepciones configuradas</p>
            ) : (
              exceptions.map(exception => (
                <div key={exception.id} style={styles.exceptionItem}>
                  <div>
                    <strong>{new Date(exception.exception_date).toLocaleDateString('es-MX')}</strong>
                    {exception.reason && <span> - {exception.reason}</span>}
                  </div>
                  <div>
                    {exception.is_available ? (
                      <span style={{ color: '#10b981' }}>
                        Horario: {exception.start_time?.substring(0, 5)} - {exception.end_time?.substring(0, 5)}
                      </span>
                    ) : (
                      <span style={{ color: '#ef4444' }}>Cerrado</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Citas */}
      {activeTab === 'appointments' && (
        <div style={styles.tabContent}>
          <h3>Citas Programadas</h3>
          <p style={styles.hint}>
            Gestiona las citas de los clientes
          </p>

          <div style={styles.appointmentsList}>
            {appointments.length === 0 ? (
              <p style={styles.emptyState}>No hay citas programadas</p>
            ) : (
              appointments.map(appointment => (
                <div key={appointment.id} style={styles.appointmentItem}>
                  <div style={styles.appointmentHeader}>
                    <div>
                      <strong>{appointment.customer_name}</strong>
                      <span style={styles.appointmentEmail}>{appointment.customer_email}</span>
                    </div>
                    {getStatusBadge(appointment.status)}
                  </div>
                  <div style={styles.appointmentDetails}>
                    <div>📅 {new Date(appointment.start_time).toLocaleDateString('es-MX')}</div>
                    <div>🕐 {new Date(appointment.start_time).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} - {new Date(appointment.end_time).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
                    {appointment.customer_phone && <div>📞 {appointment.customer_phone}</div>}
                    {appointment.notes && <div style={styles.appointmentNotes}>📝 {appointment.notes}</div>}
                  </div>
                  <div style={styles.appointmentActions}>
                    {appointment.status === 'pending' && (
                      <>
                        <button onClick={() => handleUpdateAppointment(appointment.id, 'confirmed')} style={styles.confirmBtn}>
                          Confirmar
                        </button>
                        <button onClick={() => handleUpdateAppointment(appointment.id, 'cancelled')} style={styles.cancelAppointmentBtn}>
                          Cancelar
                        </button>
                      </>
                    )}
                    {appointment.status === 'confirmed' && (
                      <button onClick={() => handleUpdateAppointment(appointment.id, 'completed')} style={styles.completeBtn}>
                        Marcar Completada
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
    padding: '24px'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    borderBottom: '1px solid #e5e7eb',
    marginBottom: '24px'
  },
  tab: {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#6b7280',
    borderRadius: '6px 6px 0 0'
  },
  tabActive: {
    color: '#3B82F6',
    borderBottom: '2px solid #3B82F6',
    backgroundColor: '#eff6ff'
  },
  tabContent: {
    padding: '20px 0'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  hoursTable: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  hourRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  },
  dayName: {
    fontWeight: '600',
    width: '100px'
  },
  hourControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  timeInput: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px'
  },
  addBtn: {
    padding: '8px 16px',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  exceptionForm: {
    backgroundColor: '#f9fafb',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '24px',
    border: '1px solid #e5e7eb'
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  input: {
    padding: '8px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px'
  },
  formButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '16px'
  },
  cancelBtn: {
    padding: '8px 16px',
    backgroundColor: '#e5e7eb',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  submitBtn: {
    padding: '8px 16px',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  exceptionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '16px'
  },
  exceptionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  },
  appointmentsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  appointmentItem: {
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  },
  appointmentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '1px solid #e5e7eb'
  },
  appointmentEmail: {
    fontSize: '12px',
    color: '#6b7280',
    marginLeft: '8px'
  },
  appointmentDetails: {
    display: 'flex',
    gap: '16px',
    fontSize: '14px',
    color: '#4b5563',
    flexWrap: 'wrap',
    marginBottom: '12px'
  },
  appointmentNotes: {
    width: '100%',
    fontSize: '13px',
    color: '#6b7280',
    marginTop: '8px'
  },
  appointmentActions: {
    display: 'flex',
    gap: '8px'
  },
  badge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500'
  },
  confirmBtn: {
    padding: '6px 12px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  cancelAppointmentBtn: {
    padding: '6px 12px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  completeBtn: {
    padding: '6px 12px',
    backgroundColor: '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  hint: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '20px'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px'
  },
  success: {
    backgroundColor: '#d1fae5',
    color: '#059669',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280'
  },
  emptyState: {
    textAlign: 'center',
    padding: '32px',
    color: '#6b7280'
  }
};

export default CalendarManager;