// frontend/src/pages/BookAppointment.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

function BookAppointment() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [store, setStore] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    notes: ''
  });

  // Obtener fechas disponibles (próximos 30 días)
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  useEffect(() => {
    fetchStoreData();
  }, [slug]);

  useEffect(() => {
    const employeeId = searchParams.get('employee');
    if (employeeId && employees.length > 0) {
      const emp = employees.find(e => e.id === parseInt(employeeId));
      if (emp) setSelectedEmployee(emp);
    }
  }, [searchParams, employees]);

  useEffect(() => {
    if (selectedEmployee && selectedDate) {
      fetchAvailableSlots();
    }
  }, [selectedEmployee, selectedDate]);

  const fetchStoreData = async () => {
    try {
      const storeRes = await axios.get(
        `${import.meta.env.VITE_API_URL}/calendar/store/${slug}`
      );
      setStore(storeRes.data.store);
      
      const employeesRes = await axios.get(
        `${import.meta.env.VITE_API_URL}/calendar/store/${slug}/employees`
      );
      setEmployees(employeesRes.data.employees || []);
    } catch (error) {
      console.error('Error fetching store:', error);
      setError('Error al cargar la información');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSlots = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/calendar/${selectedEmployee.id}/available-slots`,
        { params: { date: selectedDate, service_duration: 30 } }
      );
      setAvailableSlots(res.data.available_slots || []);
      setSelectedSlot('');
    } catch (error) {
      console.error('Error fetching slots:', error);
      setAvailableSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee || !selectedDate || !selectedSlot) {
      setError('Por favor selecciona empleado, fecha y hora');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/calendar/appointments`, {
        calendar_id: selectedEmployee.id,
        employee_id: selectedEmployee.pbx_user_id,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone,
        appointment_date: selectedDate,
        appointment_time: selectedSlot,
        duration: 30,
        notes: formData.notes
      });

      setSuccess('¡Cita agendada exitosamente! Recibirás un correo de confirmación.');
      setFormData({ customer_name: '', customer_email: '', customer_phone: '', notes: '' });
      setSelectedSlot('');
      setSelectedDate('');
      setSelectedEmployee(null);
      
      setTimeout(() => {
        navigate(`/${slug}`);
      }, 3000);
    } catch (error) {
      console.error('Error booking appointment:', error);
      setError(error.response?.data?.error || 'Error al agendar la cita');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !store) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate(`/${slug}`)} style={styles.backBtn}>
          ← Volver a la tienda
        </button>
        <h1>Agendar Cita</h1>
        {store && <p style={styles.storeName}>{store.name}</p>}
      </div>

      <div style={styles.content}>
        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Paso 1: Seleccionar empleado */}
          <div style={styles.section}>
            <h3>1. Selecciona un profesional</h3>
            <div style={styles.employeeGrid}>
              {employees.map(emp => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => setSelectedEmployee(emp)}
                  style={{
                    ...styles.employeeBtn,
                    ...(selectedEmployee?.id === emp.id ? styles.employeeBtnSelected : {})
                  }}
                >
                  <div style={styles.employeeAvatar}>
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <span>{emp.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Paso 2: Seleccionar fecha */}
          {selectedEmployee && (
            <div style={styles.section}>
              <h3>2. Selecciona una fecha</h3>
              <div style={styles.dateGrid}>
                {getAvailableDates().map(date => (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    style={{
                      ...styles.dateBtn,
                      ...(selectedDate === date ? styles.dateBtnSelected : {})
                    }}
                  >
                    {new Date(date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Paso 3: Seleccionar hora */}
          {selectedEmployee && selectedDate && (
            <div style={styles.section}>
              <h3>3. Selecciona una hora</h3>
              {loading ? (
                <p>Cargando horarios...</p>
              ) : availableSlots.length === 0 ? (
                <p style={styles.noSlots}>No hay horarios disponibles para esta fecha</p>
              ) : (
                <div style={styles.slotsGrid}>
                  {availableSlots.map(slot => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
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

          {/* Paso 4: Datos del cliente */}
          {selectedEmployee && selectedDate && selectedSlot && (
            <div style={styles.section}>
              <h3>4. Tus datos</h3>
              <div style={styles.formGroup}>
                <label>Nombre completo *</label>
                <input
                  type="text"
                  name="customer_name"
                  value={formData.customer_name}
                  onChange={handleInputChange}
                  required
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label>Email *</label>
                <input
                  type="email"
                  name="customer_email"
                  value={formData.customer_email}
                  onChange={handleInputChange}
                  required
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label>Teléfono</label>
                <input
                  type="tel"
                  name="customer_phone"
                  value={formData.customer_phone}
                  onChange={handleInputChange}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label>Notas adicionales</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                  style={styles.textarea}
                />
              </div>
            </div>
          )}

          {/* Botón de confirmación */}
          {selectedEmployee && selectedDate && selectedSlot && (
            <button type="submit" disabled={submitting} style={styles.submitBtn}>
              {submitting ? 'Agendando...' : 'Confirmar Cita'}
            </button>
          )}
        </form>
      </div>
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
    borderBottom: '1px solid #e5e7eb',
    textAlign: 'center'
  },
  backBtn: {
    position: 'absolute',
    left: '24px',
    top: '24px',
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  storeName: {
    color: '#6b7280',
    fontSize: '14px'
  },
  content: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '32px 24px'
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  employeeGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    marginTop: '16px'
  },
  employeeBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    cursor: 'pointer',
    minWidth: '100px',
    transition: 'all 0.2s'
  },
  employeeBtnSelected: {
    backgroundColor: '#e0e7ff',
    borderColor: '#3B82F6'
  },
  employeeAvatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#e0e7ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#4338ca'
  },
  dateGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '16px'
  },
  dateBtn: {
    padding: '10px 16px',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  dateBtnSelected: {
    backgroundColor: '#3B82F6',
    color: 'white',
    borderColor: '#3B82F6'
  },
  slotsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginTop: '16px'
  },
  slotBtn: {
    padding: '10px 20px',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  slotBtnSelected: {
    backgroundColor: '#10b981',
    color: 'white',
    borderColor: '#10b981'
  },
  noSlots: {
    textAlign: 'center',
    padding: '32px',
    color: '#6b7280'
  },
  formGroup: {
    marginBottom: '16px'
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px'
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'vertical'
  },
  submitBtn: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '16px'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '16px'
  },
  success: {
    backgroundColor: '#d1fae5',
    color: '#059669',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '16px'
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#3B82F6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }
};

export default BookAppointment;