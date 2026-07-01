// backend/src/routes/appointments.js - Nuevo archivo para endpoints de citas

const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase');
const { authenticateUser } = require('../middleware/auth');
const { sendAppointmentConfirmed } = require('../services/emailService');
const { generateTimeSlots } = require('./calendar');
const crypto = require('crypto');

// ============================================
// FUNCIONES AUXILIARES
// ============================================

// Generar token aleatorio para cliente
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// ============================================
// RUTAS PÚBLICAS (Clientes con token)
// ============================================

// Ver mis citas con token
router.get('/my-appointments', async (req, res) => {
  const { token } = req.query;
  
  try {
    if (!token) {
      return res.status(400).json({ error: 'Token requerido' });
    }
    
    // Verificar token
    const { data: tokenData, error: tokenError } = await supabaseService.admin
      .from('appointment_tokens')
      .select('appointment_id, email, expires_at, is_used')
      .eq('token', token)
      .eq('is_used', false)
      .single();
    
    if (tokenError || !tokenData) {
      return res.status(404).json({ error: 'Token inválido o expirado' });
    }
    
    // Verificar expiración
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Token expirado' });
    }
    
    // Obtener la cita
    const { data: appointment, error: aptError } = await supabaseService.admin
      .from('appointments')
      .select(`
        *,
        calendars:calendar_id (
          user_name,
          user_email
        ),
        stores:store_id (
          name,
          address,
          phone
        )
      `)
      .eq('id', tokenData.appointment_id)
      .single();
    
    if (aptError || !appointment) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    
    // Marcar token como usado (opcional - para que no se reutilice)
    // await supabaseService.admin
    //   .from('appointment_tokens')
    //   .update({ is_used: true, used_at: new Date().toISOString() })
    //   .eq('token', token);
    
    res.json({
      appointment: {
        id: appointment.id,
        customer_name: appointment.customer_name,
        customer_email: appointment.customer_email,
        customer_phone: appointment.customer_phone,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        status: appointment.status,
        notes: appointment.notes,
        store_name: appointment.stores?.name,
        employee_name: appointment.calendars?.user_name
      },
      token: token
    });
  } catch (error) {
    console.error('Error fetching appointment by token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cliente cancela su cita (solo si está pending o confirmed)
router.patch('/my-appointments/cancel', async (req, res) => {
  const { token } = req.body;
  
  try {
    if (!token) {
      return res.status(400).json({ error: 'Token requerido' });
    }
    
    // Verificar token
    const { data: tokenData, error: tokenError } = await supabaseService.admin
      .from('appointment_tokens')
      .select('appointment_id, email, expires_at, is_used')
      .eq('token', token)
      .eq('is_used', false)
      .single();
    
    if (tokenError || !tokenData) {
      return res.status(404).json({ error: 'Token inválido o expirado' });
    }
    
    // Verificar expiración
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Token expirado' });
    }
    
    // Obtener la cita para verificar estado
    const { data: appointment, error: aptError } = await supabaseService.admin
      .from('appointments')
      .select('status, customer_name, customer_email, start_time, store_id')
      .eq('id', tokenData.appointment_id)
      .single();
    
    if (aptError || !appointment) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    
    // Solo permite cancelar si está pending o confirmed
    if (!['pending', 'confirmed'].includes(appointment.status)) {
      return res.status(400).json({ error: 'Esta cita no se puede cancelar' });
    }
    
    // Actualizar estado a cancelled
    const { data: updated, error: updateError } = await supabaseService.admin
      .from('appointments')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', tokenData.appointment_id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    // Marcar token como usado
    await supabaseService.admin
      .from('appointment_tokens')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('token', token);
    
    res.json({
      success: true,
      message: 'Cita cancelada exitosamente',
      appointment: updated
    });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cliente confirma su cita
router.patch('/my-appointments/confirm', async (req, res) => {
  const { token, action, notes } = req.body;
  
  try {
    if (!token) {
      return res.status(400).json({ error: 'Token requerido' });
    }
    
    // Verificar token
    const { data: tokenData, error: tokenError } = await supabaseService.admin
      .from('appointment_tokens')
      .select('appointment_id, email, expires_at, is_used')
      .eq('token', token)
      .eq('is_used', false)
      .single();
    
    if (tokenError || !tokenData) {
      return res.status(404).json({ error: 'Token inválido o expirado' });
    }
    
    // Verificar expiración
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Token expirado' });
    }
    
    let updateData = {};
    
    switch (action) {
      case 'confirm':
        updateData = {
          status: 'confirmed',
          is_confirmed_by_client: true,
          confirmed_at: new Date().toISOString()
        };
        break;
      case 'cancel':
        updateData = { status: 'cancelled' };
        break;
      case 'reschedule':
        // Requiere nueva fecha/hora
        const { new_date, new_time } = req.body;
        if (!new_date || !new_time) {
          return res.status(400).json({ error: 'Nueva fecha y hora requeridas' });
        }
        // Validar disponibilidad antes de actualizar
        // ... lógica de validación
        updateData = {
          start_time: new Date(`${new_date}T${new_time}`).toISOString(),
          end_time: new Date(`${new_date}T${new_time}`).getTime() + 30 * 60000,
          status: 'pending'
        };
        break;
      case 'add_note':
        updateData = { notes: notes };
        break;
      default:
        return res.status(400).json({ error: 'Acción no válida' });
    }
    
    const { data: updated, error: updateError } = await supabaseService.admin
      .from('appointments')
      .update(updateData)
      .eq('id', tokenData.appointment_id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    res.json({
      success: true,
      message: 'Cita actualizada correctamente',
      appointment: updated
    });
  } catch (error) {
    console.error('Error updating appointment by token:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS PROTEGIDAS (Empleados/Owners con autenticación)
// ============================================

router.use(authenticateUser);

// Obtener todas las citas del negocio
router.get('/business/:slug', async (req, res) => {
  const { slug } = req.params;
  const { start_date, end_date, status } = req.query;
  
  try {
    // Obtener la tienda por slug
    const store = await supabaseService.getStoreBySlug(slug);
    if (!store) {
      return res.status(404).json({ error: 'Tienda no encontrada' });
    }
    
    // Verificar que el usuario tiene acceso a esta tienda
    const userBusinesses = await supabaseService.getUserBusinesses(req.user.id);
    const hasAccess = userBusinesses.some(ub => ub.pbx_group_id === store.pbx_group_id);
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
    }
    
    let query = supabaseService.admin
      .from('appointments')
      .select(`
        *,
        calendars:calendar_id (
          user_name,
          user_email
        ),
        stores:store_id (
          name
        )
      `)
      .eq('store_id', store.id);
    
    // Filtros opcionales
    if (start_date) {
      query = query.gte('start_time', new Date(start_date).toISOString());
    }
    if (end_date) {
      query = query.lte('end_time', new Date(end_date).toISOString());
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    const { data: appointments, error: aptError } = await query.order('start_time', { ascending: true });
    
    if (aptError) throw aptError;

    // Versión simplificada - solo formateo básico
    const appointmentsWithLocalTime = appointments.map(apt => {
      const startUTC = new Date(apt.start_time);
      const endUTC = new Date(apt.end_time);
      
      return {
        ...apt,
        // Convertir a hora local para mostrar
        start_time_formatted: startUTC.toLocaleString('es-MX', {
          timeZone: 'America/Mexico_City',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        end_time_formatted: endUTC.toLocaleString('es-MX', {
          timeZone: 'America/Mexico_City',
          hour: '2-digit',
          minute: '2-digit'
        }),
        // Fecha en formato YYYY-MM-DD para inputs date
        start_date_input: startUTC.toLocaleDateString('es-CA', {
          timeZone: 'America/Mexico_City'
        }),
        // Hora en formato HH:MM para inputs time
        start_time_input: startUTC.toLocaleTimeString('es-CA', {
          timeZone: 'America/Mexico_City',
          hour: '2-digit',
          minute: '2-digit'
        })
      };
    });
    
    res.json({appointments: appointmentsWithLocalTime });
  } catch (error) {
    console.error('Error fetching business appointments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener slots disponibles para reprogramar
router.get('/:appointmentId/available-slots', authenticateUser, async (req, res) => {
  const { appointmentId } = req.params;
  const { date } = req.query;
  
  try {
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    
    // Obtener la cita para conocer calendar_id
    const { data: appointment, error: aptError } = await supabaseService.admin
      .from('appointments')
      .select('calendar_id')
      .eq('id', appointmentId)
      .single();
    
    if (aptError || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    // Reutilizar la lógica de disponibilidad de calendar.js
    // Construir URL para el endpoint de available-slots
    //const calendarSlotsUrl = `${req.protocol}://${req.get('host')}/api/calendar/${appointment.calendar_id}/available-slots?date=${date}&service_duration=60`;
    
    // Hacer la petición internamente o reutilizar la función
    // Por ahora, llamamos directamente al servicio
    
    const workingHours = await supabaseService.getWorkingHoursByCalendar(appointment.calendar_id);

    const [year, month, day] = date.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day, 0, 0, 0); //local time
    //const targetDate = new Date(date); // This was tranforming to UTC
    
    const startOfDayUTC = new Date(year, month - 1, day, 0, 0, 0);
    const endOfDayUTC = new Date(year, month - 1, day, 23, 59, 59, 999);

    const dayOfWeek = targetDate.getDay();
    const daySchedule = workingHours.find(h => h.day_of_week === dayOfWeek);
    
    if (!daySchedule || !daySchedule.is_working_day) {
      return res.json({ available_slots: [], message: 'Cerrado este día' });
    }
    
    // Verificar excepciones
    const exceptions = await supabaseService.getExceptionsByCalendar(
      appointment.calendar_id, 
      date,
      date
    );
    
    let startTime = daySchedule.start_time;
    let endTime = daySchedule.end_time;
    
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
    console.log ("Target Date",targetDate)
    // Obtener citas existentes (excluyendo la actual)
    //const startOfDay = new Date(targetDate);
    //startOfDay.setHours(0, 0, 0, 0);
    //const endOfDay = new Date(targetDate);
    //endOfDay.setHours(23, 59, 59, 999);

    
    console.log (startOfDayUTC.toISOString(),"rango ISO",endOfDayUTC.toISOString())
    const existingAppointments = await supabaseService.getAppointmentsByCalendar(
      appointment.calendar_id,
      startOfDayUTC.toISOString(),
      endOfDayUTC.toISOString()
    );
    
    // Filtrar citas canceladas (no ocupan espacio)
    const activeAppointments = existingAppointments.filter(
      apt => apt.status !== 'cancelled'
    );

    console.log ("Tamaño appts", activeAppointments.length,appointmentId)
    // Filtrar la cita actual para no contar como ocupada
    const filteredAppointments = activeAppointments.filter(apt => apt.id !== appointmentId);
    console.log ("A punto de generar slots", filteredAppointments.length)
    // Generar slots
    const duration = 60;

    //considerar la cita que se esta revisando, si queremos quitarla usar filteredAppointments
    const slots = generateTimeSlots(startTime, endTime, duration, filteredAppointments); 

    
    res.json({
      date: date,
      available_slots: slots,
      working_hours: { start: startTime, end: endTime }
    });
  } catch (error) {
    console.error('Error fetching available slots for reschedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar cita (empleado/owner)
router.patch('/:appointmentId', async (req, res) => {
  const { appointmentId } = req.params;
  const { status, duration, notes, extended_duration } = req.body;
  
  try {
    // Verificar que la cita existe y pertenece a un negocio del usuario
    const { data: appointment, error: aptError } = await supabaseService.admin
      .from('appointments')
      .select('store_id, status, calendar_id')
      .eq('id', appointmentId)
      .single();
    
    if (aptError || !appointment) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    const store = await supabaseService.getStoreById(appointment.store_id);
    const userBusinesses = await supabaseService.getUserBusinesses(req.user.id);
    const hasAccess = userBusinesses.some(ub => ub.pbx_group_id === store.pbx_group_id);
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta cita' });
    }
    
    // Si el nuevo estado es 'confirmed' y antes era 'pending'
    const wasPending = appointment.status === 'pending';
    const wasConfirmed = appointment.status === 'confirmed';
    const isNowConfirmed = status === 'confirmed';
    const isNowCancelled = status === 'cancelled';
    const isNowRescheduled = status === 'rescheduled';


    const updateData = {};
    if (status) updateData.status = status;
    if (duration) updateData.extended_duration = duration;
    if (notes !== undefined) updateData.notes = notes;
    if (extended_duration !== undefined) updateData.extended_duration = extended_duration;
    
    updateData.updated_at = new Date().toISOString();
    
    const { data: updated, error: updateError } = await supabaseService.admin
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId)
      .select()
      .single();
    
    if (updateError) throw updateError;

    // Obtener el nombre del empleado (calendar.user_name)
    console.log ("valor de calendar id", appointment.calendar_id)
    let employeeName = 'el profesional';
    try {
      const { data: calendar, error: calendarError } = await supabaseService.admin
        .from('calendars')
        .select('user_name')
        .eq('id', appointment.calendar_id)
        .single();
      
      if (!calendarError && calendar) {
        employeeName = calendar.user_name;
        console.log(`Empleado encontrado: ${employeeName}`);
      } else {
        console.warn('No se encontró el empleado, usando nombre por defecto');
      }
    } catch (calError) {
      console.warn('Error obteniendo empleado:', calError.message);
    }
    

    console.log ("Verificando estados para enviar correo de confirmación")
    if (wasPending && isNowConfirmed) {
      try {
        // Usar la fecha local para el email
        const startDateTime = new Date(updated.start_time);
        console.log ("Enviando correo de confirmación..")
        await sendAppointmentConfirmed(
          {
            ...updated,
            customer_name: updated.customer_name,
            customer_email: updated.customer_email,
            customer_phone: updated.customer_phone,
            notes: updated.notes
          },
          startDateTime,
          store.name,
          employeeName 
        );
        console.log(`Email de confirmación enviado a ${updated.customer_email}`);   
      } catch (emailError) {
        console.error('Error enviando email de confirmación:', emailError);
      } 
    }

    if (isNowRescheduled) {
      try {
        // También enviar email de reprogramación si lo deseas
        // await sendAppointmentRescheduled(...)
        console.log(`📧 Cita reprogramada para ${updated.customer_email}`);
      } catch (emailError) {
        console.error('Error enviando email de reprogramación:', emailError);
      }
    }

    res.json({
      success: true,
      message: 'Cita actualizada correctamente',
      appointment: updated
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: error.message });
  }
});


// Reprogramar cita (empleado/owner)
router.patch('/:appointmentId/reschedule', async (req, res) => {
  const { appointmentId } = req.params;
  const { new_date, new_time, duration } = req.body;
  
  try {
    if (!new_date || !new_time) {
      return res.status(400).json({ error: 'Nueva fecha y hora requeridas' });
    }
    
    // Verificar que la cita existe
    const { data: appointment, error: aptError } = await supabaseService.admin
      .from('appointments')
      .select('store_id, status, customer_name, customer_email')
      .eq('id', appointmentId)
      .single();
    
    if (aptError || !appointment) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    
    // Calcular nueva fecha/hora
    const [year, month, day] = new_date.split('-').map(Number);
    const [hour, minute] = new_time.split(':').map(Number);
    const startDateTimeLocal = new Date(year, month - 1, day, hour, minute, 0);
    const appointmentDuration = duration || 30;
    const endDateTimeLocal = new Date(startDateTimeLocal.getTime() + appointmentDuration * 60000);
    
    // Convertir a UTC
    const startDateTimeUTC = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const endDateTimeUTC = new Date(startDateTimeUTC.getTime() + appointmentDuration * 60000);
    
    // Actualizar
    const { data: updated, error: updateError } = await supabaseService.admin
      .from('appointments')
      .update({
        start_time: startDateTimeLocal.toISOString(), //we need to send date & time in local time not UTC,
        end_time: endDateTimeLocal.toISOString(), //automatically postgresql will save in UTC 
        //status: 'rescheduled', //let's not move status , if it was confirmed or pending we want to keep it that way 
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    res.json({
      success: true,
      message: 'Cita reprogramada correctamente',
      appointment: updated
    });
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;