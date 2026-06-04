// backend/src/middleware/auth.js
const { createClient } = require('@supabase/supabase-js');

// Usar la clave PUBLISHABLE_KEY para autenticación (no necesita privilegios admin)
const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY for auth middleware');
}

const supabase = createClient(supabaseUrl, supabasePublishableKey);

async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Usar la clave publishable para verificar el token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('Auth error:', error?.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

function requireRole(role) {
  return async (req, res, next) => {
    const { id } = req.params; // pbxGroupId
    const userId = req.user.id;
    
    // Necesitamos importar supabaseService aquí para evitar dependencia circular
    const supabaseService = require('../services/supabase');
    
    try {
      const userBusinesses = await supabaseService.getUserBusinesses(userId);
      const business = userBusinesses.find(b => b.pbx_group_id === parseInt(id));
      
      if (!business || !business.is_active) {
        return res.status(403).json({ error: 'User does not have access to this business' });
      }
      
      const roleHierarchy = { 'owner': 3, 'admin': 2, 'employee': 1 };
      const requiredLevel = roleHierarchy[role];
      const userLevel = roleHierarchy[business.role];
      
      if (!requiredLevel || !userLevel || userLevel < requiredLevel) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

module.exports = { authenticateUser, requireRole };