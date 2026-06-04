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

}

// Exportar una instancia única del servicio
module.exports = new SupabaseService();