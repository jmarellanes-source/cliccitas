// backend/src/routes/auth.js - Versión completa actualizada

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY for auth routes');
  throw new Error('Supabase auth configuration incomplete');
}

const supabase = createClient(supabaseUrl, supabasePublishableKey);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Registro con email/contraseña (con redirección al frontend)
router.post('/register', async (req, res) => {
  const { email, password, fullName } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName || email.split('@')[0] },
        emailRedirectTo: `${FRONTEND_URL}/auth/callback`
      }
    });
    
    if (error) throw error;
    
    res.status(201).json({
      message: 'Usuario registrado. Revisa tu correo para confirmar tu cuenta.',
      user: data.user ? {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.user_metadata?.full_name
      } : null
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login con email/contraseña
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.user_metadata?.full_name,
        emailConfirmed: data.user.email_confirmed_at !== null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: 'Invalid email or password' });
  }
});

// Endpoint para manejar el callback de confirmación (desde el enlace del correo)
router.get('/confirm', async (req, res) => {
  const { access_token, refresh_token, type, error, error_description } = req.query;
  
  if (error) {
    return res.redirect(`${FRONTEND_URL}/auth/error?error=${encodeURIComponent(error_description || error)}`);
  }
  
  if (access_token && type === 'signup') {
    return res.redirect(
      `${FRONTEND_URL}/auth/callback?access_token=${access_token}&refresh_token=${refresh_token}&type=confirmed`
    );
  }
  
  if (access_token && type === 'recovery') {
    return res.redirect(
      `${FRONTEND_URL}/auth/reset-password?access_token=${access_token}&type=recovery`
    );
  }
  
  res.redirect(FRONTEND_URL);
});

// Intercambiar código por sesión (para flujo OAuth)
router.post('/callback', async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Code is required' });
  }
  
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) throw error;
    
    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: data.user
    });
  } catch (error) {
    console.error('Callback error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Obtener usuario actual
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.substring(7);
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) throw error;
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name,
        emailConfirmed: user.email_confirmed_at !== null,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Refresh token
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  
  if (!refresh_token) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }
  
  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token
    });
    
    if (error) throw error;
    
    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: error.message });
  }
});

module.exports = router;