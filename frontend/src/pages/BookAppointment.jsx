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
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
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

  // Función para obtener fecha local actual (medianoche)
  const getLocalToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };

  // Función para comparar si una fecha es pasada (solo día, sin hora)
  const isPastDate = (date) => {
    const today = getLocalToday();
    const dateToCompare = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return dateToCompare < today;
  };

  // Generar semana actual (próximos 7 días)
  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getWeekDays = () => {
    const days = [];
    const todayLocal = getLocalToday(); 
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(todayLocal);
      date.setDate(todayLocal.getDate() + i);
      
      days.push({
        date: date,
        dateStr: formatLocalDate(date),
        dayName: date.toLocaleDateString('es-MX', { weekday: 'long' }),
        dayShort: date.toLocaleDateString('es-MX', { weekday: 'short' }),
        dayNumber: date.getDate(),
        month: date.toLocaleDateString('es-MX', { month: 'short' })
      });
    }
    return days;
  };

  const weekDays = getWeekDays();
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = getLocalToday();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [calendarDays, setCalendarDays] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);

  const [slotsAvailability, setSlotsAvailability] = useState({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const handleShowCalendar = async () => {
    setShowCalendar(!showCalendar);
    if (!showCalendar && selectedEmployee) {
      // Cargar disponibilidad solo para días del mes actual que no estén cargados
      const daysToLoad = calendarDays.filter(day => 
        day.isCurrentMonth && !slotsAvailability[day.dateStr]
      );
      if (daysToLoad.length > 0) {
        await loadMonthAvailability(selectedEmployee.id, daysToLoad);
      }
    }
  };

  // Generar calendario mensual
  useEffect(() => {
    generateCalendar(currentMonth);
  }, [currentMonth]);

  const generateCalendar = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
  
    const days = [];
    // Días del mes anterior
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayDate = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date: dayDate,
        dateStr: formatLocalDate(dayDate),
        dayNumber: prevMonthLastDay - i,
        isCurrentMonth: false,
        isToday: false
      });
    }
    
    // Días del mes actual
    const todayLocal = getLocalToday(); 
    for (let i = 1; i <= daysInMonth; i++) {
      const dayDate = new Date(year, month, i);
      const isToday = dayDate.getFullYear() === todayLocal.getFullYear() &&
                      dayDate.getMonth() === todayLocal.getMonth() &&
                      dayDate.getDate() === todayLocal.getDate();
      
      days.push({
        date: dayDate,
        dateStr: formatLocalDate(dayDate),
        dayNumber: i,
        isCurrentMonth: true,
        isToday: isToday
      });
    }
    
    // Días del mes siguiente (para completar 6 filas)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const dayDate = new Date(year, month + 1, i);
      days.push({
        date: dayDate,
        dateStr: formatLocalDate(dayDate), // Usar formato local
        dayNumber: i,
        isCurrentMonth: false,
        isToday: false
      });
    }
    
    setCalendarDays(days);
  };

  const changeMonth = (increment) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + increment, 1);
    setCurrentMonth(newDate);
  };

  useEffect(() => {
    fetchStoreData();
  }, [slug]);

  useEffect(() => {
    const employeeId = searchParams.get('employee');
    if (employeeId && employees.length > 0) {
      const emp = employees.find(e => String(e.id) === employeeId);
      if (emp) {
        handleEmployeeSelect(emp)
        // Cargar disponibilidad para los próximos 7 días
        loadWeekAvailability(emp.id, weekDays);
      }
    }
  }, [searchParams, employees]);

  // Cuando se selecciona empleado manualmente
  const handleEmployeeSelect = async (emp) => {
    setSelectedEmployee(emp);
    setCurrentStep(2);
    // Limpiar datos anteriores del empleado anterior
    setSelectedDate(null);
    setSelectedSlot('');
    setAvailableSlots([]);

    await loadWeekAvailability(emp.id, weekDays);
  };

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
        { params: { date: selectedDate, service_duration: 60 } }
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

  const fetchDayAvailability = async (employeeId, dateStr) => {
  try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/calendar/${employeeId}/available-slots`,
        { params: { date: dateStr, service_duration: 60 } }
      );
      const slots = res.data.available_slots || [];
      return slots.length;
    } catch (error) {
      console.error('Error fetching availability for', dateStr, error);
      return 0;
    }
  };

  // Cargar disponibilidad para los días de la semana
  const loadWeekAvailability = async (employeeId, weekDaysList) => {
    setLoadingAvailability(true);
    const availability = {};
    
    // Cargar en paralelo para mejor rendimiento
    const promises = weekDaysList.map(async (day) => {
      const count = await fetchDayAvailability(employeeId, day.dateStr);
      availability[day.dateStr] = count;
    });
    
    await Promise.all(promises);
    setSlotsAvailability(availability);
    setLoadingAvailability(false);
  };

  // Cargar disponibilidad para un mes completo
  const loadMonthAvailability = async (employeeId, monthDaysList) => {
    const availability = { ...slotsAvailability };
    
    // Cargar en lotes de 5 para no sobrecargar la API
    const batchSize = 5;
    for (let i = 0; i < monthDaysList.length; i += batchSize) {
      const batch = monthDaysList.slice(i, i + batchSize);
      const promises = batch.map(async (day) => {
        if (!availability[day.dateStr]) {
          const count = await fetchDayAvailability(employeeId, day.dateStr);
          availability[day.dateStr] = count;
        }
      });
      await Promise.all(promises);
      setSlotsAvailability({ ...availability });
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // useEffect simplificado - solo depende de selectedEmployee y selectedDate
  useEffect(() => {
    if (selectedEmployee && selectedDate) {
      console.log("Cargando slots para:", selectedDate);
      fetchAvailableSlots();
    }
  }, [selectedEmployee, selectedDate]);  // ← Eliminar forceRefresh de dependencias

  const handleDateSelect = (dateStr) => {
    console.log('Selected date:', dateStr, 'Current selectedDate:', selectedDate);
    
    // SOLUCIÓN: Resetear la fecha a null y luego establecerla de nuevo
    // Esto fuerza el useEffect a ejecutarse
    if (selectedDate === dateStr) {
      console.log("Misma fecha, resetear y recargar...");
      setSelectedDate(null);  // Primero resetear
      setAvailableSlots([]);
      setSelectedSlot('');
      setLoading(true);
      
      // En el próximo tick, establecer la fecha de nuevo
      setTimeout(() => {
        setSelectedDate(dateStr);
        setCurrentStep(3);
      }, 10);
      return;
    }
    
    // Fecha diferente
    setSelectedDate(dateStr);
    setCurrentStep(3);
    setAvailableSlots([]);
    setSelectedSlot('');
  };
    
  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    setCurrentStep(4);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee || !selectedDate || !selectedSlot) {
      setError('Por favor completa todos los pasos');
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
        duration: 60,
        notes: formData.notes
      });

      setSuccess('¡Cita agendada exitosamente!');
      setTimeout(() => {
        navigate(`/${slug}`);
      }, 2000);
    } catch (error) {
      console.error('Error booking appointment:', error);
      setError(error.response?.data?.error || 'Error al agendar la cita');
    } finally {
      setSubmitting(false);
    }
  };

  const resetBooking = () => {
    setSelectedEmployee(null);
    setSelectedDate(null);
    setSelectedSlot('');
    setAvailableSlots([]);
    setSlotsAvailability({});
    setCurrentStep(1);
    navigate(`/${slug}/agendar`, { replace: true });
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
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate(`/${slug}`)} style={styles.backBtn}>
          ←
        </button>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>Agendar Cita</h1>
          <p style={styles.subtitle}>{store?.name}</p>
        </div>
        <div style={styles.placeholder}></div>
      </div>

      {/* Progress Steps */}
      <div style={styles.progressContainer}>
        <div style={styles.steps}>
          <div style={{ ...styles.step, ...(currentStep >= 1 ? styles.stepActive : {}) }}>
            <span style={styles.stepNumber}>1</span>
            <span style={styles.stepLabel}>Profesional</span>
          </div>
          <div style={styles.stepLine}></div>
          <div style={{ ...styles.step, ...(currentStep >= 2 ? styles.stepActive : {}) }}>
            <span style={styles.stepNumber}>2</span>
            <span style={styles.stepLabel}>Fecha</span>
          </div>
          <div style={styles.stepLine}></div>
          <div style={{ ...styles.step, ...(currentStep >= 3 ? styles.stepActive : {}) }}>
            <span style={styles.stepNumber}>3</span>
            <span style={styles.stepLabel}>Horario</span>
          </div>
          <div style={styles.stepLine}></div>
          <div style={{ ...styles.step, ...(currentStep >= 4 ? styles.stepActive : {}) }}>
            <span style={styles.stepNumber}>4</span>
            <span style={styles.stepLabel}>Datos</span>
          </div>
        </div>
      </div>

      <div style={styles.content}>
        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {/* Step 1: Seleccionar empleado */}
        {currentStep === 1 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Elige un profesional</h3>
            <div style={styles.employeeGrid}>
              {employees.map(emp => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => handleEmployeeSelect(emp)} 
                  style={styles.employeeCard}
                >
                  <div style={styles.employeeAvatar}>
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={styles.employeeInfo}>
                    <span style={styles.employeeName}>{emp.name}</span>
                    <span style={styles.employeeDuration}>⏱ 60 min</span>
                  </div>
                  <span style={styles.arrow}>→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Seleccionar fecha */}
        {currentStep === 2 && selectedEmployee && (
          <div style={styles.section}>
            <div style={styles.selectedInfo}>
              <button onClick={resetBooking} style={styles.changeBtn}>Cambiar</button>
              <div style={styles.selectedEmployee}>
                <span>👤 {selectedEmployee.name}</span>
              </div>
            </div>
            
            <h3 style={styles.sectionTitle}>Selecciona una fecha</h3>
            
            {/* Semana rápida */}
            <div style={styles.weekContainer}>
              <p style={styles.weekLabel}>Próximos días</p>
              <div style={styles.weekGrid}>
                {weekDays.map(day => {
                  const availableCount = slotsAvailability[day.dateStr];
                  const isSelected = selectedDate === day.dateStr;
                  const isPast = isPastDate(day.date);
                  
                  return (
                    <button
                      key={day.dateStr}
                      onClick={() => {
                        console.log('Button clicked for date:', day.dateStr);  // ← Agrega este log
                        if (!isPast) {
                          handleDateSelect(day.dateStr);
                        }
                      }}
                      disabled={isPast}
                      style={{
                        ...styles.weekDayBtn,
                        ...(isSelected ? styles.weekDayBtnSelected : {}),
                        ...(isPast ? styles.weekDayBtnPast : {})
                      }}
                    >
                      <span style={styles.weekDayName}>{day.dayShort}</span>
                      <span style={styles.weekDayNumber}>{day.dayNumber}</span>
                      <span style={styles.weekDayMonth}>{day.month}</span>
                      {!isPast && availableCount !== undefined && (
                        <span style={{
                          ...styles.availabilityBadge,
                          ...(availableCount === 0 ? styles.availabilityBadgeZero : {})
                        }}>
                          {availableCount === 0 ? 'Completo' : `${availableCount} espacios`}
                        </span>
                      )}
                      {loadingAvailability && isSelected && (
                        <span style={styles.loadingBadge}>...</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Botón para mostrar calendario */}
            <button onClick={() => setShowCalendar(!showCalendar)} style={styles.toggleCalendarBtn}>
              {showCalendar ? '📅 Ocultar calendario' : '📅 Ver calendario completo'}
            </button>

            {/* Calendario mensual */}
            {showCalendar && (
              <div style={styles.calendarContainer}>
                <div style={styles.calendarHeader}>
                  <button onClick={() => changeMonth(-1)} style={styles.calendarNav}>←</button>
                  <span style={styles.calendarMonth}>
                    {currentMonth.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={() => changeMonth(1)} style={styles.calendarNav}>→</button>
                </div>
                <div style={styles.calendarWeekdays}>
                  {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(day => (
                    <div key={day} style={styles.calendarWeekday}>{day}</div>
                  ))}
                </div>
                <div style={styles.calendarDays}>
                  {calendarDays.map((day, idx) => {
                    const isSelected = selectedDate === day.dateStr;
                    const isPast = isPastDate(day.date);  // Usar función auxiliar
                    const availableCount = slotsAvailability[day.dateStr];
                    const isToday = day.isToday;
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => !isPast && handleDateSelect(day.dateStr)}
                        disabled={isPast}
                        style={{
                          ...styles.calendarDay,
                          ...(!day.isCurrentMonth ? styles.calendarDayOther : {}),
                          ...(isSelected ? styles.calendarDaySelected : {}),
                          ...(isToday ? styles.calendarDayToday : {}),
                          ...(isPast ? styles.calendarDayPast : {})
                        }}
                      >
                        <span>{day.dayNumber}</span>
                        {!isPast && day.isCurrentMonth && availableCount !== undefined && (
                          <span style={{
                            ...styles.calendarBadge,
                            ...(availableCount === 0 ? styles.calendarBadgeZero : {})
                          }}>
                            {availableCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p style={styles.calendarHint}>* Solo se pueden agendar fechas desde hoy</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Seleccionar horario */}
        {currentStep === 3 && selectedEmployee && selectedDate && (
          <div style={styles.section}>
            <div style={styles.selectedInfo}>
              <button onClick={() => setCurrentStep(2)} style={styles.backStepBtn}>← Atrás</button>
              <div style={styles.selectedDetails}>
                <span>👤 {selectedEmployee.name}</span>
                <span>📅 {new Date(selectedDate).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              </div>
            </div>
            
            <h3 style={styles.sectionTitle}>Elige un horario</h3>
            
            {loading ? (
              <div style={styles.loadingSlots}>
                <div style={styles.spinnerSmall}></div>
                <p>Cargando horarios...</p>
              </div>
            ) : availableSlots.length === 0 ? (
              <div style={styles.noSlots}>
                <span>😞</span>
                <p>No hay horarios disponibles para esta fecha</p>
                <button onClick={() => setCurrentStep(2)} style={styles.otherDateBtn}>
                  Elegir otra fecha
                </button>
              </div>
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

        {/* Step 4: Datos del cliente */}
        {currentStep === 4 && selectedEmployee && selectedDate && selectedSlot && (
          <div style={styles.section}>
            <div style={styles.selectedInfo}>
              <button onClick={() => setCurrentStep(3)} style={styles.backStepBtn}>← Atrás</button>
              <div style={styles.selectedDetails}>
                <span>👤 {selectedEmployee.name}</span>
                <span>📅 {new Date(selectedDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                <span>🕐 {selectedSlot}</span>
              </div>
            </div>
            
            <h3 style={styles.sectionTitle}>Tus datos</h3>
            
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Nombre completo</label>
                <input
                  type="text"
                  name="customer_name"
                  value={formData.customer_name}
                  onChange={handleInputChange}
                  placeholder="Ej: Juan Pérez"
                  required
                  style={styles.input}
                />
              </div>
              
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Correo electrónico</label>
                <input
                  type="email"
                  name="customer_email"
                  value={formData.customer_email}
                  onChange={handleInputChange}
                  placeholder="tucorreo@ejemplo.com"
                  required
                  style={styles.input}
                />
              </div>
              
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Teléfono</label>
                <input
                  type="tel"
                  name="customer_phone"
                  value={formData.customer_phone}
                  onChange={handleInputChange}
                  placeholder="+52 55 1234 5678"
                  style={styles.input}
                />
              </div>
              
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Notas adicionales</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Ej: Necesito silla de ruedas, soy alérgico a..."
                  rows="3"
                  style={styles.textarea}
                />
              </div>
              
              <button type="submit" disabled={submitting} style={styles.confirmBtn}>
                {submitting ? 'Confirmando...' : '✓ Confirmar Cita'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  },
  header: {
    backgroundColor: '#3B82F6',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: 'white'
  },
  backBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: 'white',
    cursor: 'pointer',
    padding: '8px',
    margin: '-8px'
  },
  headerContent: {
    textAlign: 'center'
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    margin: 0
  },
  subtitle: {
    fontSize: '12px',
    opacity: 0.9,
    marginTop: '4px'
  },
  placeholder: {
    width: '40px'
  },
  progressContainer: {
    backgroundColor: 'white',
    padding: '16px 20px',
    borderBottomLeftRadius: '20px',
    borderBottomRightRadius: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  },
  steps: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  step: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px'
  },
  stepActive: {
    opacity: 1
  },
  stepNumber: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#e5e7eb',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '600'
  },
  stepActive: {
    '& $stepNumber': {
      backgroundColor: '#3B82F6',
      color: 'white'
    }
  },
  stepLabel: {
    fontSize: '10px',
    color: '#6b7280'
  },
  stepLine: {
    width: '40px',
    height: '1px',
    backgroundColor: '#e5e7eb',
    margin: '0 8px'
  },
  content: {
    padding: '20px',
    maxWidth: '600px',
    margin: '0 auto'
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#1f2937'
  },
  selectedInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px'
  },
  selectedEmployee: {
    backgroundColor: '#eff6ff',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '14px',
    color: '#2563eb'
  },
  selectedDetails: {
    display: 'flex',
    gap: '12px',
    fontSize: '13px',
    color: '#6b7280',
    flexWrap: 'wrap'
  },
  changeBtn: {
    padding: '6px 12px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '20px',
    fontSize: '12px',
    color: '#4b5563',
    cursor: 'pointer'
  },
  backStepBtn: {
    padding: '6px 12px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '20px',
    fontSize: '12px',
    color: '#4b5563',
    cursor: 'pointer'
  },
  employeeGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  employeeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  employeeAvatar: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    backgroundColor: '#3B82F6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: '600',
    color: 'white'
  },
  employeeInfo: {
    flex: 1
  },
  employeeName: {
    fontSize: '16px',
    fontWeight: '500',
    display: 'block',
    marginBottom: '4px',
    color: '#1f2937'
  },
  employeeDuration: {
    fontSize: '12px',
    color: '#6b7280'
  },
  arrow: {
    fontSize: '20px',
    color: '#9ca3af'
  },
  weekContainer: {
    marginBottom: '20px'
  },
  weekLabel: {
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '12px',
    color: '#374151'
  },
  weekGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '8px'
  },
  weekDayBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 4px',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  weekDayBtnSelected: {
    backgroundColor: '#3B82F6',
    border: '#3B82F6',
    color: 'white'
  },
  weekDayName: {
    fontSize: '12px',
    fontWeight: '500',
    marginBottom: '4px'
  },
  weekDayNumber: {
    fontSize: '18px',
    fontWeight: '600'
  },
  weekDayMonth: {
    fontSize: '10px'
  },
  toggleCalendarBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    color: '#4b5563',
    cursor: 'pointer',
    marginTop: '12px'
  },
  calendarContainer: {
    marginTop: '20px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px'
  },
  calendarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  calendarNav: {
    padding: '8px 12px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px'
  },
  calendarMonth: {
    fontSize: '16px',
    fontWeight: '500'
  },
  calendarWeekdays: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    textAlign: 'center',
    marginBottom: '8px'
  },
  calendarWeekday: {
    fontSize: '12px',
    color: '#6b7280',
    padding: '8px 0'
  },
  calendarDays: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px'
  },
  calendarDay: {
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  calendarDayOther: {
    color: '#9ca3af',
    backgroundColor: '#f3f4f6'
  },
  calendarDaySelected: {
    backgroundColor: '#3B82F6',
    color: 'white'
  },
  calendarDayToday: {
    border: '2px solid #3B82F6',
    fontWeight: '600'
  },
  calendarDayPast: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  calendarHint: {
    fontSize: '11px',
    color: '#9ca3af',
    marginTop: '12px',
    textAlign: 'center'
  },
  slotsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px'
  },
  slotBtn: {
    padding: '12px',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center'
  },
  slotBtnSelected: {
    backgroundColor: '#10b981',
    border: '#10b981',
    color: 'white'
  },
  noSlots: {
    textAlign: 'center',
    padding: '32px',
    color: '#6b7280'
  },
  otherDateBtn: {
    marginTop: '16px',
    padding: '10px 20px',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer'
  },
  loadingSlots: {
    textAlign: 'center',
    padding: '32px'
  },
  form: {
    marginTop: '8px'
  },
  inputGroup: {
    marginBottom: '16px'
  },
  inputLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '8px',
    color: '#374151'
  },
  input: {
    width: '100%',
    padding: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    fontSize: '16px',
    backgroundColor: '#f9fafb',
    transition: 'all 0.2s'
  },
  textarea: {
    width: '100%',
    padding: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    fontSize: '16px',
    backgroundColor: '#f9fafb',
    resize: 'vertical',
    fontFamily: 'inherit'
  },
  confirmBtn: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '12px',
    borderRadius: '12px',
    marginBottom: '16px',
    fontSize: '14px'
  },
  success: {
    backgroundColor: '#d1fae5',
    color: '#059669',
    padding: '12px',
    borderRadius: '12px',
    marginBottom: '16px',
    fontSize: '14px'
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
  },
  spinnerSmall: {
    width: '30px',
    height: '30px',
    border: '2px solid #e5e7eb',
    borderTopColor: '#3B82F6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 12px'
  },
  availabilityBadge: {
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '10px',
    backgroundColor: '#10b981',
    color: 'white',
    marginTop: '4px',
    display: 'inline-block'
  },
  availabilityBadgeZero: {
    backgroundColor: '#ef4444'
  },
  loadingBadge: {
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '10px',
    backgroundColor: '#9ca3af',
    color: 'white',
    marginTop: '4px',
    display: 'inline-block'
  },
  weekDayBtnPast: {
    opacity: 0.5,
    backgroundColor: '#f3f4f6'
  },
  calendarBadge: {
    position: 'absolute',
    top: '2px',
    right: '2px',
    fontSize: '9px',
    padding: '2px 4px',
    borderRadius: '10px',
    backgroundColor: '#10b981',
    color: 'white',
    minWidth: '18px',
    textAlign: 'center'
  },
  calendarBadgeZero: {
    backgroundColor: '#ef4444'
  }
};

export default BookAppointment;