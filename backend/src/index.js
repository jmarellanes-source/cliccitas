// backend/src/index.js
require('dotenv').config({ path: 'backend/.env.local' });

// Validar variables de entorno requeridas al inicio
const requiredEnvVars = [
  'PBX_FQDN',
  'PBX_CLIENT_ID', 
  'PBX_CLIENT_SECRET',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',  // Nueva nomenclatura
  'SUPABASE_SECRET_KEY'         // Nueva nomenclatura
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\nPlease check your .env.local file');
  process.exit(1);
}

console.log('✅ All required environment variables are set');

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const departmentRoutes = require('./routes/departments');
const authRoutes = require('./routes/auth');
const storeRoutes = require('./routes/stores');
const calendarRoutes = require('./routes/calendar');
const appointmentRoutes = require('./routes/appointments');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));


// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Ruta raíz - manejar redirección de Supabase
app.get('/', (req, res) => {
  const { access_token, refresh_token, type, error, error_description } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  if (access_token && type === 'signup') {
    return res.redirect(`${frontendUrl}/auth/callback?access_token=${access_token}&refresh_token=${refresh_token}&type=confirmed`);
  }
  
  if (error) {
    return res.redirect(`${frontendUrl}/auth/error?error=${encodeURIComponent(error_description || error)}`);
  }
  
  res.redirect(frontendUrl);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/auth', authRoutes); 
app.use('/api/stores', storeRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/appointments', appointmentRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📞 PBX FQDN: ${process.env.PBX_FQDN}`);
  console.log(`🔄 Supabase: ${process.env.SUPABASE_URL}\n`);
});