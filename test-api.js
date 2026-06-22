// test-api.js
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
let authToken = null;

async function testAPI() {
  console.log('🧪 Iniciando pruebas del API...\n');

  // 1. Health Check
  console.log('1. Health Check:');
  try {
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('   ✅', health.data);
  } catch (error) {
    console.log('   ❌', error.message);
  }

  // 2. Registrar usuario
  console.log('\n2. Registrar usuario:');
  //try {
  //  const register = await axios.post(`${BASE_URL}/api/auth/register`, {
  //    email: `jemarellanes@outlook.com`,
  //    password: '123456',
  //    fullName: 'Test User'
  //  });
  //  console.log('   ✅ Usuario registrado:', register.data.message);
  //} catch (error) {
  //  console.log('   ❌', error.response?.data?.error || error.message);
  //}

  // 3. Login
  console.log('\n3. Iniciar sesión:');
  try {
    const login = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'jemarellanes@gmail.com',
      password: 'C1tas$'
    });
    authToken = login.data.access_token;
    console.log('   ✅ Login exitoso');
    console.log('   📝 Token:', authToken?.substring(0, 50) + '...');
  } catch (error) {
    console.log('   ❌', error.response?.data?.error || error.message);
  }

  // 4. Listar departamentos (requiere token)
  if (authToken) {
    console.log('\n4. Listar departamentos:');
    try {
      const departments = await axios.get(`${BASE_URL}/api/departments`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('   Departamentos obtenidos:', departments.data);
    } catch (error) {
      console.log(' ', error.response?.data?.error || error.message);
    }

    // 5. Crear negocio
    console.log('\n5. Crear negocio:');
    try {
      const business = await axios.post(`${BASE_URL}/api/departments`, {
        businessName: `Tienda Test 1`,
        ownerFirstName: 'Test',
        ownerLastName: 'Owner',
        ownerEmail: `jemarellanes@gmail.com`,
        ownerPassword: 'Th1sPassword%',
        language: 'ES'
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('Negocio creado:', business.data);
    } catch (error) {
      console.log(' ', error.response?.data?.error || error.message);
    }
  }

  console.log('\n Pruebas completadas');
}

testAPI();