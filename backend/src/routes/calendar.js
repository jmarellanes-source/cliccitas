// backend/src/routes/calendar.js
const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase');
const { authenticateUser } = require('../middleware/auth');
const { sendAppointmentConfirmation } = require('../services/emailService');
const crypto = require('crypto');

// Función para generar token
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};
// Función para crear fecha local (México)
const createLocalDateTime = (dateStr, timeStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0);
};
// Función para generar rango UTC para consultas a la BD
const getUTCRangeForLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const startUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const endUTC = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  return { startUTC, endUTC };
};

// Obtener calendarios de una tienda
router.get('/store/:slug', async (req, res) => {
  const { slug } = req.params;
  
  try {
    const store = await supabaseService.getStoreBySlug(slug);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const calendars = await supabaseService.getCalendarsByStore(store.id);
    const services = await supabaseService.getServicesByStore(store.id);
    
    res.json({
      store,
      calendars,
      services
    });
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener todos los empleados de una tienda (público)
router.get('/store/:slug/employees', async (req, res) => {
  const { slug } = req.params;
  
  try {
    const store = await supabaseService.getStoreBySlug(slug);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const calendars = await supabaseService.getCalendarsByStore(store.id);
    
    // Formatear empleados para vista pública
    const employees = calendars.map(cal => ({
      id: cal.id,
      pbx_user_id: cal.pbx_user_id,
      name: cal.user_name,
      email: cal.user_email,
      appointment_duration: cal.appointment_duration
    }));
    
    res.json({ employees });
  } catch (error) {
    console.error('Error fetching store employees:', error);
    res.status(500).json({ error: error.message });
  }
});


// Obtener horarios disponibles para una fecha específica
router.get('/:calendarId/available-slots', async (req, res) => {
  const { calendarId } = req.params;
  const { date, service_duration } = req.query;
  
  try {
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    
    console.log ("Date en available-slots ",date)
    //const targetDate = new Date(date);
    //const dayOfWeek = targetDate.getDay();

    const [year, month, day] = date.split('-').map(Number);
    // Para el día de semana (usar fecha local)
    const targetDate = new Date(year, month - 1, day);
    const dayOfWeek = targetDate.getDay();

    // 1. Obtener horarios de trabajo para ese día
    const workingHours = await supabaseService.getWorkingHoursByCalendar(calendarId);
    const daySchedule = workingHours.find(h => h.day_of_week === dayOfWeek);
    
    if (!daySchedule || !daySchedule.is_working_day) {
      return res.json({ available_slots: [], message: 'Cerrado este día' });
    }
    
    // 2. Verificar excepciones para esta fecha
    const exceptions = await supabaseService.getExceptionsByCalendar(
      calendarId, 
      targetDate.toISOString().split('T')[0],
      targetDate.toISOString().split('T')[0]
    );
    
    let startTime = daySchedule.start_time;
    let endTime = daySchedule.end_time;
    let isAvailable = true;

    // Si hay excepción, aplicar horario especial
    if (exceptions && exceptions.length > 0) {
      const exception = exceptions[0];
      if (!exception.is_available) {
        return res.json({ available_slots: [], message: 'Cerrado por excepción' });
      }
      if (exception.start_time && exception.end_time) {
        startTime = exception.start_time;
        endTime = exception.end_time;
      }
    }
    
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    
    const appointments = await supabaseService.getAppointmentsByCalendar(
      calendarId,
      startOfDay.toISOString(),
      endOfDay.toISOString()
    );
    
    // 4. Generar slots disponibles
    const duration = parseInt(service_duration) || 30;
    const slots = generateTimeSlots(startTime, endTime, duration, appointments);
    
    res.json({
      date: targetDate.toISOString().split('T')[0],
      available_slots: slots,
      working_hours: { start: startTime, end: endTime }
    });
  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crear cita (versión mejorada)
router.post('/appointments', async (req, res) => {
  const { 
    calendar_id, 
    employee_id,
    customer_name, 
    customer_email, 
    customer_phone, 
    appointment_date,
    appointment_time,
    duration,
    notes,
    service_id 
  } = req.body;
  
  try {
    // Validar campos requeridos
    if (!calendar_id || !customer_name || !customer_email || !appointment_date || !appointment_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // 1. Obtener el calendario (incluyendo employee_name)
    const { data: calendar, error: calendarError } = await supabaseService.admin
      .from('calendars')
      .select('store_id, appointment_duration, user_name')  // ✅ Agregar user_name
      .eq('id', calendar_id)
      .single();
    
    if (calendarError || !calendar) {
      return res.status(404).json({ error: 'Calendar not found' });
    }
    
    // 2. Obtener la tienda (para el nombre en el email)
    const store = await supabaseService.getStoreById(calendar.store_id);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    // Calcular hora de inicio y fin
    const startDateTime = createLocalDateTime(appointment_date, appointment_time); //Local Time
    const appointmentDuration = duration || calendar.appointment_duration || 30;
    const endDateTime = new Date(startDateTime.getTime() + appointmentDuration * 60000);
    
    // Verificar que el horario está disponible
    const dayOfWeek = startDateTime.getDay();
    const workingHours = await supabaseService.getWorkingHoursByCalendar(calendar_id);
    const daySchedule = workingHours.find(h => h.day_of_week === dayOfWeek);
    
    if (!daySchedule || !daySchedule.is_working_day) {
      return res.status(400).json({ error: 'Store is closed on this day' });
    }
    
    // Verificar conflictos usando UTC (para consultar BD)
    const { startUTC, endUTC } = getUTCRangeForLocalDate(appointment_date);
    
    const existingAppointments = await supabaseService.getAppointmentsByCalendar(
      calendar_id,
      startUTC.toISOString(),
      endUTC.toISOString()
    );
    
    // Verificar si el slot específico está ocupado (comparar hora local)
    const targetTimeKey = `${startDateTime.getHours().toString().padStart(2, '0')}:${startDateTime.getMinutes().toString().padStart(2, '0')}`;
    const isBooked = existingAppointments.some(apt => {
      const aptUTC = new Date(apt.start_time);
      const aptHour = aptUTC.getUTCHours();
      const aptMinute = aptUTC.getUTCMinutes();
      const aptTimeKey = `${aptHour.toString().padStart(2, '0')}:${aptMinute.toString().padStart(2, '0')}`;
      return aptTimeKey === targetTimeKey;
    });
    

    if (isBooked) {
      return res.status(409).json({ error: 'Time slot is already booked' });
    }

    const startDateTimeUTC = new Date(Date.UTC(
      startDateTime.getFullYear(),
      startDateTime.getMonth(),
      startDateTime.getDate(),
      startDateTime.getHours(),
      startDateTime.getMinutes(),
      0
    ));
    const endDateTimeUTC = new Date(startDateTimeUTC.getTime() + appointmentDuration * 60000);
    
    console.log("Guardando en BD - UTC:", startDateTimeUTC);    

    // Crear la cita
    const appointment = await supabaseService.createAppointment({
      store_id: calendar.store_id,
      calendar_id: calendar_id,
      customer_name,
      customer_email,
      customer_phone: customer_phone || null,
      start_time: startDateTimeUTC.toISOString(),
      end_time: endDateTimeUTC.toISOString(),
      status: 'pending',
      notes: notes || null,
      service_id: service_id || null
    });
    
    // 7. GENERAR TOKEN PARA EL CLIENTE
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Token válido por 30 días
    
    // Guardar token en la tabla appointment_tokens
    const { error: tokenError } = await supabaseService.admin
      .from('appointment_tokens')
      .insert({
        appointment_id: appointment.id,
        token: token,
        email: customer_email,
        expires_at: expiresAt.toISOString(),
        is_used: false
      });
    
    if (tokenError) {
      console.error('Error saving token:', tokenError);
      // No fallamos la creación de la cita, solo logueamos el error
    }
    
    // 8. ✅ ENVIAR EMAIL DE CONFIRMACIÓN
    try {
      await sendAppointmentConfirmation(
        appointment,                 // Datos de la cita
        token,                       // Token para gestionar
        expiresAt,                   // Fecha de expiración
        store.name,                  // ✅ Nombre de la tienda (ahora definido)
        calendar.user_name || 'el profesional'  // ✅ Nombre del empleado
      );
      console.log(`Email enviado a ${customer_email}`);
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // No fallamos la creación de la cita si el email falla
    }

    res.status(201).json({
      success: true,
      appointment: {
        id: appointment.id,
        customer_name: appointment.customer_name,
        customer_email: appointment.customer_email,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        status: appointment.status
      },
      message: 'Cita agendada exitosamente. Recibirás un correo de confirmación.'
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener horarios de un calendario específico
router.get('/:calendarId/schedule', async (req, res) => {
  const { calendarId } = req.params;
  const { start_date, end_date } = req.query;
  
  try {
    const workingHours = await supabaseService.getWorkingHoursByCalendar(calendarId);
    const exceptions = await supabaseService.getExceptionsByCalendar(calendarId, start_date, end_date);
    const appointments = await supabaseService.getAppointmentsByCalendar(calendarId, start_date, end_date);
    
    res.json({
      working_hours: workingHours,
      exceptions: exceptions,
      appointments: appointments
    });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS PROTEGIDAS (requieren autenticación)
// ============================================

router.use(authenticateUser);

// Actualizar calendario (horarios, duración, etc.)
router.patch('/:calendarId', async (req, res) => {
  const { calendarId } = req.params;
  const updates = req.body;
  
  try {
    const updated = await supabaseService.updateCalendar(calendarId, updates);
    res.json(updated);
  } catch (error) {
    console.error('Error updating calendar:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar horarios de trabajo
router.put('/working-hours/:hoursId', async (req, res) => {
  const { hoursId } = req.params;
  const updates = req.body;
  
  try {
    const updated = await supabaseService.updateWorkingHours(hoursId, updates);
    res.json(updated);
  } catch (error) {
    console.error('Error updating working hours:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crear excepción (día festivo, vacaciones)
router.post('/exceptions', async (req, res) => {
  const { calendar_id, exception_date, is_available, start_time, end_time, reason } = req.body;
  
  try {
    const exception = await supabaseService.createException({
      calendar_id,
      exception_date,
      is_available,
      start_time,
      end_time,
      reason
    });
    
    res.status(201).json(exception);
  } catch (error) {
    console.error('Error creating exception:', error);
    res.status(500).json({ error: error.message });
  }
});

// Gestionar citas (confirmar, cancelar, etc.)
router.patch('/appointments/:appointmentId', async (req, res) => {
  const { appointmentId } = req.params;
  const { status, notes } = req.body;
  
  try {
    const updated = await supabaseService.updateAppointment(appointmentId, { status, notes });
    res.json(updated);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// CRUD de servicios
router.get('/services/:storeId', async (req, res) => {
  const { storeId } = req.params;
  
  try {
    const services = await supabaseService.getServicesByStore(storeId);
    res.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/services', async (req, res) => {
  const { store_id, name, description, duration, price, color } = req.body;
  
  try {
    const service = await supabaseService.createService({
      store_id,
      name,
      description,
      duration,
      price,
      color
    });
    
    res.status(201).json(service);
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener calendario por pbx_user_id
router.get('/by-user/:pbxUserId', authenticateUser, async (req, res) => {
  const { pbxUserId } = req.params;
  
  try {
    const { data: calendar, error } = await supabaseService.supabase
      .from('calendars')
      .select('*')
      .eq('pbx_user_id', parseInt(pbxUserId))
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    res.json({ calendar: calendar || null });
  } catch (error) {
    console.error('Error fetching calendar by user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Función auxiliar para generar slots de tiempo
function generateTimeSlots(startTime, endTime, duration, appointments) {
  const slots = [];

  // Parsear horas locales (formato "HH:MM:SS")
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  // ✅ CORREGIDO: Usar UTC para los cálculos (las citas están en UTC)
  const start = new Date(Date.UTC(2000, 0, 1, startHour, startMinute, 0));
  const end = new Date(Date.UTC(2000, 0, 1, endHour, endMinute, 0));

  // Crear conjunto de horarios ocupados (convertir hora UTC a hora local)
  const bookedSlots = new Set();
  appointments.forEach(apt => {
    const aptStart = new Date(apt.start_time);
    // La BD guarda en UTC, obtener hora UTC directamente
    const hours = aptStart.getUTCHours().toString().padStart(2, '0');
    const minutes = aptStart.getUTCMinutes().toString().padStart(2, '0');
    const timeKey = `${hours}:${minutes}`;
    
    console.log(`Cita UTC: ${apt.start_time} -> Hora: ${timeKey}`);
    bookedSlots.add(timeKey);
  });

  let current = new Date(start);
  while (current < end) {
    const hours = current.getUTCHours().toString().padStart(2, '0');
    const minutes = current.getUTCMinutes().toString().padStart(2, '0');
    const timeSlot = `${hours}:${minutes}`;
    if (!bookedSlots.has(timeSlot)) {
      slots.push(timeSlot);
    }
    current.setUTCMinutes(current.getUTCMinutes() + duration);
  }
  
  return slots;
}

// backend/src/routes/calendar.js - Agregar estos endpoints

module.exports = router;