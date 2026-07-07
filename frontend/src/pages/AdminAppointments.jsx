// frontend/src/pages/AdminAppointments.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

function AdminAppointments() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('pending');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showModal, setShowModal] = useState(false);
  // Agregar estado para el modal de reprogramación
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({
    new_date: '',
    new_time: '',
    duration: 60
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('');

  useEffect(() => {
    fetchAppointments();
  }, [slug, filter]);


  const fetchAppointments = async () => {
    setLoading(true);
    try {
      // Obtener la fecha actual en formato ISO (YYYY-MM-DD)
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      // Agregar filtro de fecha al endpoint
      const url = `${import.meta.env.VITE_API_URL}/appointments/business/${slug}?status=${filter}&start_date=${todayStr}`;
      console.log('📡 Fetching appointments from today:', url);
      
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setAppointments(res.data.appointments || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setError(error.response?.data?.error || 'Error al cargar las citas');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAppointment = async (appointmentId, data) => {
    try {
      const res = await axios.patch(
        `${import.meta.env.VITE_API_URL}/appointments/${appointmentId}`,
        data,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Cita actualizada correctamente');
      setTimeout(() => setSuccess(''), 3000);
      fetchAppointments();
      setShowModal(false);
    } catch (error) {
      console.error('Error updating appointment:', error);
      setError(error.response?.data?.error || 'Error al actualizar la cita');
      setTimeout(() => setError(''), 3000);
    }
  };

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

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div style={styles.loading}>Cargando citas...</div>;
  }

  // Función para cargar slots disponibles al seleccionar fecha
  const loadAvailableSlots = async (date) => {
    if (!date || !selectedAppointment) return;
    
    setLoadingSlots(true);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/appointments/${selectedAppointment.id}/available-slots`,
        { 
          params: { date },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setAvailableSlots(res.data.available_slots || []);
    } catch (error) {
      console.error('Error loading slots:', error);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Función para reprogramar (mejorada)
  const handleReschedule = async () => {
    if (!rescheduleData.new_date || !rescheduleData.new_time) {
      setError('Por favor selecciona una nueva fecha y hora');
      return;
    }
    
    try {
      const response = await axios.patch(
        `${import.meta.env.VITE_API_URL}/appointments/${selectedAppointment.id}/reschedule`,
        {
          new_date: rescheduleData.new_date,
          new_time: rescheduleData.new_time,
          duration: rescheduleData.duration
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Cita reprogramada correctamente. El cliente recibirá un email de confirmación.');
      setTimeout(() => setSuccess(''), 4000);
      fetchAppointments();
      setShowRescheduleModal(false);
      setShowModal(false);
      // Limpiar datos
      setRescheduleData({ new_date: '', new_time: '', duration: 60 });
      setAvailableSlots([]);
      setSelectedSlot('');
    } catch (error) {
      console.error('Error rescheduling:', error);
      setError(error.response?.data?.error || 'Error al reprogramar');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Al abrir el modal de reprogramación, establecer fecha actual como default
  const openRescheduleModal = () => {

    if (!selectedAppointment) {
      console.error("No hay cita seleccionada");
      return;
    }
    const currentDate = new Date(selectedAppointment.start_time);
    const CurrentEnd = new Date(selectedAppointment.end_time);
    const durationMinutes = Math.round((CurrentEnd - currentDate) / (1000 * 60)); // Diferencia en minutos

    console.log ("Fecha a revisar",currentDate)

    const formattedDate = currentDate.toISOString().split('T')[0];
    const formattedTime = currentDate.toLocaleTimeString('es-CA', {
        timeZone: 'America/Mexico_City',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    console.log (formattedDate, "fecha formateada a revisar",formattedTime)  
    
    setRescheduleData({
      new_date: formattedDate,
      new_time: formattedTime,
      duration: durationMinutes  
    });
    setShowRescheduleModal(true);
    // Cargar slots para la fecha actual
    loadAvailableSlots(formattedDate);
  };

  // Al cambiar la fecha en el modal
  const handleDateChange = (date) => {
    setRescheduleData({...rescheduleData, new_date: date, new_time: ''});
    setSelectedSlot('');
    loadAvailableSlots(date);
  };

  // Al seleccionar un slot
  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    setRescheduleData({...rescheduleData, new_time: slot});
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate(`/${slug}`)} style={styles.backBtn}>
          ← Volver a la tienda
        </button>
        <h1 style={styles.title}>Gestión de Citas</h1>
        <div style={styles.userInfo}>
          <span>{user?.email}</span>
        </div>
      </div>

      {/* Filtros */}
      <div style={styles.filters}>
        <button
          onClick={() => setFilter('pending')}
          style={{ ...styles.filterBtn, ...(filter === 'pending' ? styles.filterActive : {}) }}
        >
          Pendientes
        </button>
        <button
          onClick={() => setFilter('confirmed')}
          style={{ ...styles.filterBtn, ...(filter === 'confirmed' ? styles.filterActive : {}) }}
        >
          Confirmadas
        </button>
        <button
          onClick={() => setFilter('completed')}
          style={{ ...styles.filterBtn, ...(filter === 'completed' ? styles.filterActive : {}) }}
        >
          Completadas
        </button>
        <button
          onClick={() => setFilter('cancelled')}
          style={{ ...styles.filterBtn, ...(filter === 'cancelled' ? styles.filterActive : {}) }}
        >
          Canceladas
        </button>
        <button
          onClick={() => setFilter('all')}
          style={{ ...styles.filterBtn, ...(filter === 'all' ? styles.filterActive : {}) }}
        >
          Todas
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {/* Lista de citas */}
      <div style={styles.list}>
        {appointments.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={styles.emptyIcon}>📋</span>
            <p>No hay citas {filter !== 'all' ? `con estado "${filter}"` : ''}</p>
          </div>
        ) : (
          appointments.map(apt => (
            <div key={apt.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.customerInfo}>
                  <strong style={styles.customerName}>{apt.customer_name}</strong>
                  <span style={styles.customerEmail}>{apt.customer_email}</span>
                </div>
                {getStatusBadge(apt.status)}
              </div>
              
              <div style={styles.cardBody}>
                <div style={styles.detailRow}>
                  <span>📅 {formatDate(apt.start_time)}</span>
                  <span>🕐 {formatTime(apt.start_time)} - {formatTime(apt.end_time)}</span>
                </div>
                {apt.customer_phone && (
                  <div style={styles.detailRow}>📞 {apt.customer_phone}</div>
                )}
                {apt.notes && (
                  <div style={styles.notes}>📝 {apt.notes}</div>
                )}
                <div style={styles.detailRow}>
                  <span>👤 {apt.calendars?.user_name || 'No asignado'}</span>
                </div>
              </div>
              
              <div style={styles.cardFooter}>
                <button
                  onClick={() => {
                    setSelectedAppointment(apt);
                    setShowModal(true);
                  }}
                  style={styles.editBtn}
                >
                  ⚙️ Gestionar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de gestión */}
      {showModal && selectedAppointment && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3>Gestionar Cita</h3>
              <button onClick={() => setShowModal(false)} style={styles.closeBtn}>×</button>
            </div>
            
            <div style={styles.modalBody}>
              <p><strong>Cliente:</strong> {selectedAppointment.customer_name}</p>
              <p><strong>Email:</strong> {selectedAppointment.customer_email}</p>
              <p><strong>Fecha:</strong> {formatDate(selectedAppointment.start_time)}
              <strong> Hora:</strong> {formatTime(selectedAppointment.start_time)}</p>
              <p><strong>Estado actual:</strong> {getStatusBadge(selectedAppointment.status)}</p>
              
              {selectedAppointment.notes && (
                <p><strong>Notas:</strong> {selectedAppointment.notes}</p>
              )}
              
              <div style={styles.modalActions}>
                <h4>Cambiar estado:</h4>
                <div style={styles.modalButtons}>
                  {selectedAppointment.status !== 'confirmed' && (
                    <button
                      onClick={() => handleUpdateAppointment(selectedAppointment.id, { status: 'confirmed' })}
                      style={styles.confirmBtn}
                    >
                      ✅ Confirmar cita
                    </button>
                  )}
                  {selectedAppointment.status !== 'rescheduled' && (
                    <button
                      onClick={openRescheduleModal}  // ← Usar la función que carga los datos
                      style={styles.completeBtn}
                    >
                      ✓ Reagendar
                    </button>
                  )}
                  {selectedAppointment.status !== 'cancelled' && (
                    <button
                      onClick={() => handleUpdateAppointment(selectedAppointment.id, { status: 'cancelled' })}
                      style={styles.cancelBtn}
                    >
                      ❌ Rechazar Cita
                    </button>
                  )}
                </div>
                
                <div style={styles.modalNotes}>
                  <h4>Agregar nota:</h4>
                  <textarea
                    id="modalNotes"
                    rows="3"
                    style={styles.textarea}
                    placeholder="Escribe una nota..."
                  />
                  <button
                    onClick={() => {
                      const notes = document.getElementById('modalNotes').value;
                      if (notes.trim()) {
                        handleUpdateAppointment(selectedAppointment.id, { notes });
                      }
                    }}
                    style={styles.addNoteBtn}
                  >
                    Agregar Nota
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* modal de reprogramación*/}
      {showRescheduleModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3>Reprogramar Cita</h3>
              <button onClick={() => setShowRescheduleModal(false)} style={styles.closeBtn}>×</button>
            </div>
            <div style={styles.modalBody}>
              {/* ✅ Mostrar la hora actual de la cita */}
              <div style={styles.currentAppointmentInfo}>
                <h2>📅 Cita actual</h2>
                <p><strong>Fecha:</strong> {formatDate(selectedAppointment.start_time)}
                <strong> Hora:</strong> {formatTime(selectedAppointment.start_time)}</p>
                <p><strong>Duración actual:</strong> {rescheduleData.duration || 60} min</p>
              </div>
              
              <hr style={styles.divider} />
              
              <h2>🔄 Cambiar a:</h2>
              
              <div style={styles.formGroup}>
                <label>Nueva Fecha</label>
                <input
                  type="date"
                  value={rescheduleData.new_date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  style={styles.input}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              {rescheduleData.new_date && (
                <div style={styles.formGroup}>
                  <label>Nueva Hora</label>
                  {loadingSlots ? (
                    <div style={styles.loadingSlots}>Cargando horarios disponibles...</div>
                  ) : availableSlots.length === 0 ? (
                    <div style={styles.noSlots}>No hay horarios disponibles para esta fecha</div>
                  ) : (
                    <div style={styles.slotsGrid}>
                      {availableSlots.map(slot => (
                        <button
                          key={slot}
                          onClick={() => handleSlotSelect(slot)}
                          style={{
                            ...styles.slotBtn,
                            ...(selectedSlot === slot ? styles.slotBtnSelected : {})
                          }}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div style={styles.formGroup}>
                <label>Duración (minutos)</label>
                <select
                  value={rescheduleData.duration}
                  onChange={(e) => setRescheduleData({...rescheduleData, duration: parseInt(e.target.value)})}
                  style={styles.input}
                >
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min (1 hora)</option>
                  <option value="75">75 min (1:15)</option>
                  <option value="90">90 min (1:30)</option>
                </select>
              </div>
              
              <div style={styles.modalButtons}>
                <button onClick={() => setShowRescheduleModal(false)} style={styles.cancelBtn}>
                  Cancelar
                </button>
                <button 
                  onClick={handleReschedule} 
                  disabled={!rescheduleData.new_date || !rescheduleData.new_time}
                  style={{
                    ...styles.confirmBtn,
                    ...(!rescheduleData.new_date || !rescheduleData.new_time ? styles.disabledBtn : {})
                  }}
                >
                  Reprogramar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6'
  },
  header: {
    backgroundColor: 'white',
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e5e7eb'
  },
  backBtn: {
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  title: {
    fontSize: '20px',
    fontWeight: '600'
  },
  userInfo: {
    fontSize: '14px',
    color: '#6b7280'
  },
  filters: {
    display: 'flex',
    gap: '8px',
    padding: '16px 24px',
    backgroundColor: 'white',
    borderBottom: '1px solid #e5e7eb',
    flexWrap: 'wrap'
  },
  filterBtn: {
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#6b7280'
  },
  filterActive: {
    backgroundColor: '#3B82F6',
    color: 'white'
  },
  list: {
    padding: '24px',
    maxWidth: '800px',
    margin: '0 auto'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid #f3f4f6'
  },
  customerInfo: {
    display: 'flex',
    flexDirection: 'column'
  },
  customerName: {
    fontSize: '16px'
  },
  customerEmail: {
    fontSize: '12px',
    color: '#6b7280'
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  detailRow: {
    fontSize: '14px',
    color: '#4b5563',
    display: 'flex',
    gap: '16px'
  },
  notes: {
    fontSize: '13px',
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    padding: '8px',
    borderRadius: '6px'
  },
  cardFooter: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #f3f4f6',
    display: 'flex',
    gap: '8px'
  },
  editBtn: {
    padding: '6px 16px',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  badge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '500'
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
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '12px',
    borderRadius: '8px',
    margin: '16px 24px'
  },
  success: {
    backgroundColor: '#d1fae5',
    color: '#059669',
    padding: '12px',
    borderRadius: '8px',
    margin: '16px 24px'
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#6b7280'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '90vh',
    overflowY: 'auto'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #e5e7eb'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6b7280'
  },
  modalBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  modalActions: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #e5e7eb'
  },
  modalButtons: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
    flexWrap: 'wrap'
  },
  modalNotes: {
    marginTop: '16px'
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'vertical',
    marginTop: '8px'
  },
  confirmBtn: {
    padding: '6px 16px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  completeBtn: {
    padding: '6px 16px',
    backgroundColor: '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  cancelBtn: {
    padding: '6px 16px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  addNoteBtn: {
    padding: '6px 16px',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    marginTop: '8px'
  },
  slotsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
    marginTop: '8px'
  },
  slotBtn: {
    padding: '8px',
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    textAlign: 'center',
    transition: 'all 0.2s'
  },
  slotBtnSelected: {
    backgroundColor: '#3B82F6',
    color: 'white',
    borderColor: '#3B82F6'
  },
  loadingSlots: {
    padding: '16px',
    textAlign: 'center',
    color: '#6b7280'
  },
  noSlots: {
    padding: '16px',
    textAlign: 'center',
    color: '#ef4444',
    backgroundColor: '#fee2e2',
    borderRadius: '6px'
  },
  formGroup: {
    marginBottom: '16px'
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px'
  },
  disabledBtn: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  currentAppointmentInfo: {
    backgroundColor: '#f0f9ff',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '16px',
    border: '1px solid #bae6fd'
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #e5e7eb',
    margin: '16px 0'
  },
};

export default AdminAppointments;