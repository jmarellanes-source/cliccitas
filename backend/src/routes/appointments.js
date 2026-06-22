// backend/src/routes/appointments.js - Nuevo archivo para endpoints de citas

const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase');
const { authenticateUser } = require('../middleware/auth');
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
    
    res.json({ appointments });
  } catch (error) {
    console.error('Error fetching business appointments:', error);
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
      .select('store_id, status')
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

module.exports = router;