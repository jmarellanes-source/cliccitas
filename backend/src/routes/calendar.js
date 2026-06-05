// backend/src/routes/calendar.js
const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase');
const { authenticateUser } = require('../middleware/auth');

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

// Crear cita (público)
router.post('/appointments', async (req, res) => {
  const { calendar_id, customer_name, customer_email, customer_phone, start_time, end_time, notes } = req.body;
  
  try {
    // Obtener el calendario para conocer store_id
    const calendar = await supabaseService.supabase
      .from('calendars')
      .select('store_id')
      .eq('id', calendar_id)
      .single();
    
    if (!calendar.data) {
      return res.status(404).json({ error: 'Calendar not found' });
    }
    
    const appointment = await supabaseService.createAppointment({
      store_id: calendar.data.store_id,
      calendar_id: calendar_id,
      customer_name,
      customer_email,
      customer_phone,
      start_time,
      end_time,
      status: 'pending',
      notes
    });
    
    res.status(201).json(appointment);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rutas protegidas para administración
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

module.exports = router;