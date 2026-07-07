// backend/src/services/supabase.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
// Usar la nueva clave SECRET_KEY para operaciones de backend
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - SUPABASE_URL');
  console.error('   - SUPABASE_SECRET_KEY (nueva nomenclatura sb_secret_xxx)');
  throw new Error('Supabase configuration incomplete');
}

// Crear cliente ADMINISTRATIVO (para backend)
// La SECRET_KEY permite bypass RLS y operaciones privilegiadas
const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);

// Opcional: También exportar un cliente público usando PUBLISHABLE_KEY
const supabasePublic = createClient(
  supabaseUrl,
  process.env.SUPABASE_PUBLISHABLE_KEY || ''
);

class SupabaseService {
  constructor() {
    this.admin = supabaseAdmin;
    this.public = supabasePublic;
    this.supabase = supabaseAdmin;  // ← Agregar esta línea para compatibilida
  }

  // Para operaciones que requieren bypass de RLS (crear negocios, etc.)
  async linkUserToBusiness(userId, pbxGroupId, pbxUserId, role = 'owner') {
    const { data, error } = await this.admin
      .from('user_businesses')
      .upsert({
        user_id: userId,
        pbx_group_id: pbxGroupId,
        pbx_user_id: pbxUserId,
        role: role,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id, pbx_group_id'
      })
      .select()
      .single();
    
    if (error) throw new Error(`Failed to link user to business: ${error.message}`);
    return data;
  }

  // Para operaciones de solo lectura que pueden respetar RLS
  async getUserBusinesses(userId) {
    // Usar cliente público (respeta RLS) o admin según necesidad
    const { data, error } = await this.admin
      .from('user_businesses')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw new Error(`Failed to get user businesses: ${error.message}`);
    return data;
  }

  // Invitar a un usuario por email (crea usuario pendiente)
  async createUserWithConfirmation(email, password, userMetadata = {}) {
    try {
      const { data, error } = await this.public.auth.signUp({
        email: email,
        password: password,
        options: {
          data: userMetadata,
          emailRedirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback`
        }
      });
      
      if (error) throw error;
      
      console.log(`✅ Confirmation email sent to ${email}`);
      return { user: data.user, error: null };
    } catch (error) {
      console.error('Error creating user:', error);
      return { user: null, error: error };
    }
  }

  async inviteUserByEmail(email, userMetadata = {}) {
    try {
      // Opción A: Usar el método admin de Supabase
      const { data, error } = await this.admin.auth.admin.inviteUserByEmail(email, {
        data: userMetadata,
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback`
      });
      
      if (error) throw error;
      
      console.log(`✅ Invitation email sent to ${email}`);
      return { user: data.user, error: null };
    } catch (error) {
      console.error('Error inviting user:', error);
      return { user: null, error: error };
    }
  }

  // Para operaciones de solo lectura que pueden respetar RLS
  async getUserBusinessesbyEmail(email) {
  // Buscar usuario por email (para obtener ID después de la invitación)
    try {
      console.log ("supabase.js buscando correo: ",email)
      const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'apikey': supabaseSecretKey,
          'Authorization': `Bearer ${supabaseSecretKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to get user');
      }
      
      const data = await response.json();
      console.log ("supabase.js tamaño de data ", data.length)
      return data.users?.find(u => u.email === email) || null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }


  async isBusinessOwner(userId, pbxGroupId) {
    const { data, error } = await this.admin
      .from('user_businesses')
      .select('role')
      .eq('user_id', userId)
      .eq('pbx_group_id', pbxGroupId)
      .eq('is_active', true)
      .single();
    
    if (error) return false;
    return data.role === 'owner';
  }

  async logBusinessCreation(userId, pbxGroupId, businessName, businessSlug, ownerEmail, ownerNumber) {
    const { error } = await this.admin
      .from('business_creation_log')
      .insert({
        user_id: userId,
        pbx_group_id: pbxGroupId,
        business_name: businessName,
        business_slug: businessSlug,
        owner_email: ownerEmail,
        owner_number: ownerNumber
      });
    
    if (error) console.error('Failed to log business creation:', error);
  }

  // CRUD de productos
  async createProduct(pbxGroupId, productData) {
    const { data, error } = await this.admin
      .from('products')
      .insert({
        pbx_group_id: pbxGroupId,
        ...productData
      })
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create product: ${error.message}`);
    return data;
  }

  async getProducts(pbxGroupId, { page = 1, limit = 20 } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    const { data, error, count } = await this.admin
      .from('products')
      .select('*', { count: 'exact' })
      .eq('pbx_group_id', pbxGroupId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(from, to);
    
    if (error) throw new Error(`Failed to get products: ${error.message}`);
    return { products: data, total: count, page, limit };
  }

  async updateProduct(productId, updates) {
    const { data, error } = await this.admin
      .from('products')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to update product: ${error.message}`);
    return data;
  }

  async deleteProduct(productId) {
    const { error } = await this.admin
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', productId);
    
    if (error) throw new Error(`Failed to delete product: ${error.message}`);
    return true;
  }

  // Store CRUD operations
  async createStore(storeData) {
    const { data, error } = await supabaseAdmin
      .from('stores')
      .insert({
        owner_id: storeData.owner_id,
        name: storeData.name,
        slug: storeData.slug,
        description: storeData.description || null,
        logo_url: storeData.logo_url || null,
        cover_url: storeData.cover_url || null,
        theme_color: storeData.theme_color || '#3B82F6',
        address: storeData.address || null,
        phone: storeData.phone || null,
        schedule: storeData.schedule || {},
        pbx_group_id: storeData.pbx_group_id,
        pbx_owner_id: storeData.pbx_owner_id,
        is_active: true
      })
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create store: ${error.message}`);
    return data;
  }
  
  async getStoreById(storeId) {
    const { data, error } = await supabaseAdmin
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();
    
    if (error) throw new Error(`Failed to get store: ${error.message}`);
    return data;
  }

  async getStoresByOwner(ownerId) {
    const { data, error } = await supabaseAdmin
      .from('stores')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) throw new Error(`Failed to get stores: ${error.message}`);
    return data;
  }

  async getStoreBySlug(slug) {
    const { data, error } = await supabaseAdmin
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updateStore(storeId, updates) {
    const { data, error } = await supabaseAdmin
      .from('stores')
      .update(updates)
      .eq('id', storeId)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to update store: ${error.message}`);
    return data;
  }

  async deleteStore(storeId) {
    const { error } = await supabaseAdmin
      .from('stores')
      .update({ is_active: false })
      .eq('id', storeId);
    
    if (error) throw new Error(`Failed to delete store: ${error.message}`);
    return true;
  }

  // backend/src/services/supabase.js - Agregar estos métodos para los calendarios
  async getStoreByPbxGroupId(pbxGroupId) {
    const { data, error } = await supabaseAdmin
      .from('stores')
      .select('*')
      .eq('pbx_group_id', pbxGroupId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getStoreBySlug(slug) {
    const { data, error } = await supabaseAdmin
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // Calendar methods
  async createCalendar(calendarData) {
    const { data, error } = await supabaseAdmin
      .from('calendars')
      .insert({
        store_id: calendarData.store_id,
        pbx_user_id: calendarData.pbx_user_id,
        user_name: calendarData.user_name,
        user_email: calendarData.user_email,
        timezone: calendarData.timezone || 'America/Mexico_City',
        appointment_duration: calendarData.appointment_duration || 30,
        break_between_appointments: calendarData.break_between_appointments || 0,
        is_active: true
      })
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create calendar: ${error.message}`);
    return data;
  }

  async getCalendarsByStore(storeId) {
    const { data, error } = await supabaseAdmin
      .from('calendars')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true);
    
    if (error) throw new Error(`Failed to get calendars: ${error.message}`);
    return data;
  }

  async getCalendarByPbxUserId(storeId, pbxUserId) {
    const { data, error } = await supabaseAdmin
      .from('calendars')
      .select('*')
      .eq('store_id', storeId)
      .eq('pbx_user_id', pbxUserId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updateCalendar(calendarId, updates) {
    const { data, error } = await supabaseAdmin
      .from('calendars')
      .update(updates)
      .eq('id', calendarId)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to update calendar: ${error.message}`);
    return data;
  }

  // Working Hours methods
  async createWorkingHours(hoursData) {
    const { data, error } = await supabaseAdmin
      .from('working_hours')
      .insert({
        calendar_id: hoursData.calendar_id,
        day_of_week: hoursData.day_of_week,
        start_time: hoursData.start_time,
        end_time: hoursData.end_time,
        is_working_day: hoursData.is_working_day
      })
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create working hours: ${error.message}`);
    return data;
  }

  async getWorkingHoursByCalendar(calendarId) {
    const { data, error } = await supabaseAdmin
      .from('working_hours')
      .select('*')
      .eq('calendar_id', calendarId)
      .order('day_of_week');
    
    if (error) throw new Error(`Failed to get working hours: ${error.message}`);
    return data;
  }

  async updateWorkingHours(hoursId, updates) {
    const { data, error } = await supabaseAdmin
      .from('working_hours')
      .update(updates)
      .eq('id', hoursId)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to update working hours: ${error.message}`);
    return data;
  }

  // Exceptions methods
  async createException(exceptionData) {
    const { data, error } = await supabaseAdmin
      .from('exceptions')
      .insert({
        calendar_id: exceptionData.calendar_id,
        exception_date: exceptionData.exception_date,
        is_available: exceptionData.is_available,
        start_time: exceptionData.start_time || null,
        end_time: exceptionData.end_time || null,
        reason: exceptionData.reason || null
      })
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create exception: ${error.message}`);
    return data;
  }

  async getExceptionsByCalendar(calendarId, startDate, endDate) {
    let query = supabaseAdmin
      .from('exceptions')
      .select('*')
      .eq('calendar_id', calendarId);
    
    if (startDate) {
      query = query.gte('exception_date', startDate);
    }
    if (endDate) {
      query = query.lte('exception_date', endDate);
    }
    
    const { data, error } = await query;
    
    if (error) throw new Error(`Failed to get exceptions: ${error.message}`);
    return data;
  }

  // Appointments methods
  async createAppointment(appointmentData) {
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .insert({
        store_id: appointmentData.store_id,
        calendar_id: appointmentData.calendar_id,
        customer_name: appointmentData.customer_name,
        customer_email: appointmentData.customer_email,
        customer_phone: appointmentData.customer_phone || null,
        start_time: appointmentData.start_time,
        end_time: appointmentData.end_time,
        status: appointmentData.status || 'pending',
        notes: appointmentData.notes || null
      })
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create appointment: ${error.message}`);
    return data;
  }

  async getAppointmentsByCalendar(calendarId, startDate, endDate) {
    let query = supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('calendar_id', calendarId);
    
    if (startDate) {
      query = query.gte('start_time', startDate);
    }
    if (endDate) {
      query = query.lte('end_time', endDate);
    }
    console.log (startDate,"Inicio y fin para slots", endDate)
    
    const { data, error } = await query.order('start_time');
    
    if (error) throw new Error(`Failed to get appointments: ${error.message}`);
    return data;
  }

  async updateAppointment(appointmentId, updates) {
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .update(updates)
      .eq('id', appointmentId)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to update appointment: ${error.message}`);
    return data;
  }

  // Services methods
  async createService(serviceData) {
    const { data, error } = await supabaseAdmin
      .from('services')
      .insert({
        store_id: serviceData.store_id,
        name: serviceData.name,
        description: serviceData.description || null,
        duration: serviceData.duration,
        price: serviceData.price || null,
        color: serviceData.color || '#3B82F6',
        is_active: true
      })
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create service: ${error.message}`);
    return data;
  }

  async getServicesByStore(storeId) {
    const { data, error } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('name');
    
    if (error) throw new Error(`Failed to get services: ${error.message}`);
    return data;
  }

}


// Exportar una instancia única del servicio
module.exports = new SupabaseService();