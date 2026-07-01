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

    const targetDate = new Date(year, month - 1, day, 0, 0, 0); //local time
    //const targetDate = new Date(year, month - 1, day); // This was tranforming to UTC

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
      //targetDate.toISOString().split('T')[0],
      //targetDate.toISOString().split('T')[0]
      date,
      date
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
    
    //const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0)); // Double UTC
    //const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)); // Double UTC
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
 
    const appointments = await supabaseService.getAppointmentsByCalendar(
      calendarId,
      startOfDay.toISOString(),
      endOfDay.toISOString()
    );

    const activeAppointments = appointments.filter(
      apt => apt.status !== 'cancelled'
    );
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 4. Generar slots disponibles
    const duration = parseInt(service_duration) || 30;

    // When we are requesting slots for "today" , first slot should be at least current hour
    if (today.toISOString().split('T')[0] === targetDate.toISOString().split('T')[0]) {

        const totalMinutosActuales = now.getHours() * 60 + now.getMinutes();  //+1 ayuda a tomar siguiente slot
        const proximoSlotEnMinutos = Math.ceil(totalMinutosActuales / duration) * duration;

        const proximaHora = Math.floor(proximoSlotEnMinutos / 60) % 24;
        const proximosMinutos = proximoSlotEnMinutos % 60;

        startTime = String(proximaHora).padStart(2, '0') + ':' + String(proximosMinutos).

        console.log ("el starttime es",startTime) 
    }
    
    const slots = generateTimeSlots(startTime, endTime, duration, activeAppointments);


    res.json({
      //date: targetDate.toISOString().split('T')[0],
      date: date,
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
  try {
    const { 
      calendar_id, 
      employee_id, // No usado - considerar eliminar
      customer_name, 
      customer_email, 
      customer_phone, 
      appointment_date, // Formato: 'YYYY-MM-DD' (local)
      appointment_time, // Formato: 'HH:MM' (local, 24h)
      duration,
      notes,
      service_id 
    } = req.body;

    // Validación centralizada y más clara
    const requiredFields = { calendar_id, customer_name, customer_email, appointment_date, appointment_time };
    const missingFields = Object.entries(requiredFields)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    // Obtener todos los datos en una sola operación
    const [calendar, workingHours] = await Promise.all([
      supabaseService.admin
        .from('calendars')
        .select('store_id, appointment_duration, user_name')
        .eq('id', calendar_id)
        .single(),
      supabaseService.getWorkingHoursByCalendar(calendar_id)
    ]);

    // Validaciones tempranas
    if (!calendar.data) {
      return res.status(404).json({ error: 'Calendar not found' });
    }

    console.log ("calendario:",calendar.data)
    const store = await supabaseService.getStoreById(calendar.data.store_id);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Crear fecha local y UTC de forma limpia
    const startLocal = new Date(`${appointment_date}T${appointment_time}:00`);
    if (isNaN(startLocal.getTime())) {
      return res.status(400).json({ error: 'Invalid date or time format' });
    }

    // Validar día laboral
    const dayOfWeek = startLocal.getDay();
    const daySchedule = workingHours.find(h => h.day_of_week === dayOfWeek);
    
    if (!daySchedule?.is_working_day) {
      return res.status(400).json({ error: 'Store is closed on this day' });
    }
  
    // Normalizar tiempo a formato HH:MM (sin segundos)
    const normalizeTimeToHM = (timeStr) => {
      // Si tiene formato "HH:MM:SS", extraer solo HH:MM
      if (timeStr.length > 5) {
        return timeStr.substring(0, 5);
      }
      return timeStr;
    };

    // Validar horario dentro del rango laboral
    const timeStr = normalizeTimeToHM(appointment_time);
    const startStr = normalizeTimeToHM(daySchedule.start_time);
    const endStr = normalizeTimeToHM(daySchedule.end_time);
    console.log ("guardando cita",timeStr,startStr,endStr)
    if (timeStr < startStr || timeStr > endStr) {
      return res.status(400).json({ 
        error: `Working hours are ${daySchedule.start_time} - ${daySchedule.end_time}` 
      });
    }

    // Calcular duración y fechas
    const appointmentDuration = duration || calendar.data.appointment_duration || 30;
    const endLocal = new Date(startLocal.getTime() + appointmentDuration * 60000);

    // Crear fechas UTC correctamente
    const startUTC = new Date(Date.UTC(
      startLocal.getFullYear(),
      startLocal.getMonth(),
      startLocal.getDate(),
      startLocal.getHours(),
      startLocal.getMinutes(),
      0
    ));
    const endUTC = new Date(Date.UTC(
      endLocal.getFullYear(),
      endLocal.getMonth(),
      endLocal.getDate(),
      endLocal.getHours(),
      endLocal.getMinutes(),
      0
    ));

    // Verificar conflictos de forma más eficiente
    const existingAppointments = await supabaseService.getAppointmentsByCalendar(
      calendar_id,
      startUTC.toISOString(),
      endUTC.toISOString()
    );

    // Filtrar citas canceladas (no ocupan espacio)
    const activeAppointments = existingAppointments.filter(
      apt => apt.status !== 'cancelled'
    );

    // Verificar conflicto usando timestamp en minutos (más preciso y eficiente)
    const startMinutes = startLocal.getHours() * 60 + startLocal.getMinutes();
    const endMinutes = endLocal.getHours() * 60 + endLocal.getMinutes();

    const isBooked = activeAppointments.some(apt => {
      const aptStart = new Date(apt.start_time);
      const aptEnd = new Date(apt.end_time);
      const aptStartMinutes = aptStart.getUTCHours() * 60 + aptStart.getUTCMinutes();
      const aptEndMinutes = aptEnd.getUTCHours() * 60 + aptEnd.getUTCMinutes();
      
      // Detectar superposición real
      return (startMinutes < aptEndMinutes && endMinutes > aptStartMinutes);
    });

    if (isBooked) {
      return res.status(409).json({ error: 'Time slot is already booked' });
    }

    // Crear la cita con todas las validaciones previas
    const appointment = await supabaseService.createAppointment({
      store_id: calendar.data.store_id,
      calendar_id,
      customer_name: customer_name.trim(),
      customer_email: customer_email.trim().toLowerCase(),
      customer_phone: customer_phone || null,
      start_time: startLocal.toISOString(),
      end_time: endLocal.toISOString(),
      status: 'pending',
      notes: notes?.trim() || null,
      service_id: service_id || null
    });

    // Generar token (con manejo de errores)
    let token = null;
    let expiresAt = null;
    try {
      token = generateToken();
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error: tokenError } = await supabaseService.admin
        .from('appointment_tokens')
        .insert({
          appointment_id: appointment.id,
          token,
          email: customer_email.trim().toLowerCase(),
          expires_at: expiresAt.toISOString(),
          is_used: false
        });

      if (tokenError) {
        console.error('Error saving token:', tokenError);
        token = null; // No fallar la cita por error de token
      }
    } catch (tokenError) {
      console.error('Error in token generation:', tokenError);
    }

    // Enviar email (con manejo de errores)
    try {
      await sendAppointmentConfirmation(
        appointment,
        startLocal, // Fecha local para mostrar en el email
        token,
        expiresAt,
        store.name,
        calendar.data.user_name || 'el profesional'
      );
      console.log(`Email sent to ${customer_email}`);
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // No fallamos la creación de la cita si el email falla
    }

    // Respuesta consistente con fechas en formato local para el frontend
    res.status(201).json({
      success: true,
      appointment: {
        id: appointment.id,
        customer_name: appointment.customer_name,
        customer_email: appointment.customer_email,
        start_time: startLocal.toISOString(), // Mantenemos ISO pero el frontend lo interpreta como local
        end_time: endLocal.toISOString(),
        status: appointment.status
      },
      message: 'Cita recibida. Recibirás un correo con los detalles.'
    });

  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ 
      error: 'Error al crear la cita', 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
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
  // Convertir a minutos
  const toMinutes = (time) => {
    if (typeof time === 'string') {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    }
    return time.getHours() * 60 + time.getMinutes();
  };

  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  
  // Crear mapa de citas por hora de inicio para búsqueda rápida
  const appointmentsMap = new Map();
  appointments.forEach(apt => {
    const aptStart = toMinutes(new Date(apt.start_time));
    const aptEnd = toMinutes(new Date(apt.end_time));
    appointmentsMap.set(aptStart, aptEnd);
  });

  const slots = [];
  let current = start;

  while (current < end) {
    // Verificar si hay una cita en este momento exacto
    if (appointmentsMap.has(current)) {
      // Saltar al final de la cita
      current = appointmentsMap.get(current);
      continue;
    }

    // Verificar si hay una cita que empieza antes de que termine este slot
    const slotEnd = current + duration;
    let hasAppointmentInSlot = false;
    let nextAppointmentStart = null;

    for (const [aptStart, aptEnd] of appointmentsMap) {
      // Si la cita empieza dentro del slot (y no es exactamente al inicio)
      if (aptStart > current && aptStart < slotEnd) {
        hasAppointmentInSlot = true;
        nextAppointmentStart = aptStart;
        break;
      }
    }

    if (hasAppointmentInSlot) {
      // Si hay una cita en medio, el slot disponible es hasta que empieza la cita
      if (nextAppointmentStart > current) {
        slots.push(formatTime(current));
      }
      // Saltar al inicio de la cita
      current = nextAppointmentStart;
    } else {
      // Slot completamente disponible
      slots.push(formatTime(current));
      current = slotEnd;
    }
  }

  return slots;
}

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}
// backend/src/routes/calendar.js - Agregar estos endpoints

module.exports = router;
module.exports.generateTimeSlots = generateTimeSlots;