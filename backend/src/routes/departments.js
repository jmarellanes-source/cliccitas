// backend/src/routes/departments.js
const express = require('express');
const router = express.Router();
const pbxApi = require('../services/pbxApi');
const supabaseService = require('../services/supabase');
const { authenticateUser, requireRole } = require('../middleware/auth');
const { slugify, generateBusinessName } = require('../utils/slugify');

// Todos los endpoints requieren autenticación
router.use(authenticateUser);

// GET /api/departments - Listar negocios del usuario autenticado
router.get('/', async (req, res) => {
  try {
    const userBusinesses = await supabaseService.getUserBusinesses(req.user.id);
    
    const businessesWithDetails = await Promise.all(
      userBusinesses.map(async (ub) => {
        try {
          const members = await pbxApi.getDepartmentMembers(ub.pbx_group_id);
          const owner = members.Members?.find(m => 
            m.Number.endsWith(pbxApi.adminSuffix) && m.Type === 'Extension'
          );
          
          return {
            id: ub.pbx_group_id,
            pbxUserId: ub.pbx_user_id,
            role: ub.role,
            ownerNumber: owner?.Number,
            url: `/negocio/${ub.slug || ub.pbx_group_id}`
          };
        } catch (error) {
          return { id: ub.pbx_group_id, role: ub.role, error: 'Could not fetch details' };
        }
      })
    );
    
    res.json({ businesses: businessesWithDetails });
  } catch (error) {
    console.error('Error listing user businesses:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/departments - Crear un nuevo negocio
router.post('/', authenticateUser, async (req, res) => {
  const {
    businessName,
    ownerFirstName,
    ownerLastName,
    ownerEmail,
    ownerPassword,
    description,
    phone,
    address,
    theme_color,
    language = 'ES'
  } = req.body;
  
  // Validaciones básicas
  if (!businessName || !ownerFirstName || !ownerLastName || !ownerEmail || !ownerPassword) {
    return res.status(400).json({ 
      error: 'Missing required fields: businessName, ownerFirstName, ownerLastName, ownerEmail, ownerPassword' 
    });
  }
  
  try {
    // 1. Verificar si el email ya está registrado en PBX
    const existingUser = await pbxApi.getUserByEmail(ownerEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered in PBX' });
    }
    
    // 2. Encontrar el siguiente número disponible AUTOMÁTICAMENTE
    console.log('🔍 Searching for next available owner number...');
    let businessId, ownerNumber;
    
    try {
      const result = await pbxApi.getNextAvailableOwnerNumber();
      businessId = result.businessId;
      ownerNumber = result.ownerNumber;
      console.log(`✅ Found available: Business ID ${businessId}, Owner Number ${ownerNumber}`);
    } catch (error) {
      console.error('❌ No available numbers:', error.message);
      return res.status(503).json({ 
        error: 'No available extension numbers. Maximum business limit reached.',
        details: error.message 
      });
    }
    
    // 3. Generar nombre único para el departamento
    const uniqueName = generateBusinessName(businessId, businessName);
    const slug = slugify(businessName);
    
    // 4. Verificar que el nombre del departamento no exista
    const departmentExists = await pbxApi.checkDepartmentExists(uniqueName);
    if (departmentExists) {
      return res.status(400).json({ error: 'Business name already exists' });
    }
    
    // 5. Crear usuario propietario en PBX (PRIMERO)
    console.log(`👤 Creating owner user with number ${ownerNumber}...`);
    const pbxUser = await pbxApi.createUser({
      firstName: ownerFirstName,
      lastName: ownerLastName,
      email: ownerEmail,
      password: ownerPassword,
      number: ownerNumber,
      language: language
    });
    console.log(`✅ User created with ID: ${pbxUser.Id}`);
    
    // 6. Crear departamento (SEGUNDO)
    console.log(`🏢 Creating department with business ID ${businessId}...`);
    const pbxGroup = await pbxApi.createDepartment(businessId, uniqueName, language);
    console.log(`✅ Department created with ID: ${pbxGroup.Id}`);
    
    // 7. Asignar rol group_admins (TERCERO)
    await pbxApi.assignRoleToUser(pbxUser.Id, pbxGroup.Id, 'group_admins');
    console.log(`✅ Role assigned to user in department`);
    
    // 8. Guardar en tabla stores (CUARTO - AHORA pbxGroup y pbxUser YA EXISTEN)
    const storeData = {
      owner_id: req.user.id,
      name: businessName,
      slug: slug,
      description: description || null,
      phone: phone || null,
      address: address || null,
      theme_color: theme_color || '#3B82F6',
      pbx_group_id: pbxGroup.Id,     // ✅ Ahora existe
      pbx_owner_id: pbxUser.Id       // ✅ Ahora existe
    };
    
    const store = await supabaseService.createStore(storeData);
    console.log(`✅ Store created with ID: ${store.id}`);
    
    // 9. Registrar relación en Supabase (QUINTO)
    await supabaseService.linkUserToBusiness(
      req.user.id,
      pbxGroup.Id,
      pbxUser.Id,
      'owner'
    );
    
    // 10. Registrar en log (SEXTO)
    await supabaseService.logBusinessCreation(
      req.user.id,
      pbxGroup.Id,
      businessName,
      slug,
      ownerEmail,
      ownerNumber
    );
    
    res.status(201).json({
      success: true,
      business: {
        id: pbxGroup.Id,
        name: businessName,
        uniqueName: uniqueName,
        businessId: businessId,
        slug: slug,
        url: `/negocio/${slug}`,
        ownerNumber: ownerNumber,
        storeId: store.id
      },
      owner: {
        id: pbxUser.Id,
        name: `${ownerFirstName} ${ownerLastName}`,
        email: ownerEmail,
        number: ownerNumber,
        extension: ownerNumber,
        role: 'group_admins'
      },
      store: store,
      credentials: {
        email: ownerEmail,
        password: ownerPassword,
        extension: ownerNumber
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating business:', error);
    
    // Manejo específico de errores
    if (error.message.includes('ALREADY_IN_USE')) {
      return res.status(409).json({ error: 'Extension number already in use. Please try again.' });
    }
    
    if (error.message.includes('No available')) {
      return res.status(503).json({ error: error.message });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// POST /api/departments/:id/employees - Agregar empleado
router.post('/:id/employees', authenticateUser, requireRole('owner'), async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email, password } = req.body;
  
  try {
    const groupId = parseInt(id);
    
    // Obtener el grupo para conocer el business ID
    const groups = await pbxApi.listDepartments({ top: 100 });
    const group = groups.value.find(g => g.Id === groupId);
    
    if (!group) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    // Extraer business ID del número del propietario
    let businessId = null;
    const members = await pbxApi.getDepartmentMembers(groupId);
    const owner = members.Members?.find(m => 
      m.Number.endsWith(pbxApi.adminSuffix) && m.Type === 'Extension'
    );
    
    if (owner) {
      businessId = pbxApi.getBusinessIdFromNumber(owner.Number);
    }
    
    if (!businessId) {
      return res.status(400).json({ error: 'Cannot determine business ID' });
    }
    
    // Encontrar siguiente número de empleado disponible AUTOMÁTICAMENTE
    console.log(`🔍 Searching for next available employee number for business ${businessId}...`);
    let employeeNumber;
    
    try {
      employeeNumber = await pbxApi.getNextAvailableEmployeeNumber(businessId);
      console.log(`✅ Found available employee number: ${employeeNumber}`);
    } catch (error) {
      return res.status(503).json({ 
        error: 'No available employee numbers for this business',
        details: error.message
      });
    }
    
    // Verificar email no existente
    const existingUser = await pbxApi.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Crear usuario empleado
    const pbxUser = await pbxApi.createUser({
      firstName,
      lastName,
      email,
      password,
      number: employeeNumber,
      language: group.Language || 'ES'
    });
    
    // Asignar rol users
    await pbxApi.assignRoleToUser(pbxUser.Id, groupId, 'users');
    
    // Registrar relación en Supabase
    await supabaseService.linkUserToBusiness(
      req.user.id,
      groupId,
      pbxUser.Id,
      'employee'
    );
    
    res.status(201).json({
      id: pbxUser.Id,
      name: `${firstName} ${lastName}`,
      email: email,
      number: employeeNumber,
      extension: employeeNumber,
      role: 'users'
    });
    
  } catch (error) {
    console.error('❌ Error adding employee:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/departments/:id/employees/:userId
router.delete('/:id/employees/:userId', authenticateUser, requireRole('owner'), async (req, res) => {
  const { id, userId } = req.params;
  
  try {
    const groupId = parseInt(id);
    
    // Verificar que no sea el propietario
    const members = await pbxApi.getDepartmentMembers(groupId);
    const user = members.Members?.find(m => m.Id === parseInt(userId));
    
    if (!user) {
      return res.status(404).json({ error: 'User not found in department' });
    }
    
    if (user.Number.endsWith(pbxApi.adminSuffix)) {
      return res.status(400).json({ error: 'Cannot delete business owner' });
    }
    
    // Eliminar del grupo (remover Groups)
    await pbxApi.request('PATCH', `/xapi/v1/Users(${userId})`, {
      Groups: [],
      Id: parseInt(userId)
    });
    
    // Desactivar en Supabase
    await supabaseService.supabase
      .from('user_businesses')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('pbx_group_id', groupId)
      .eq('pbx_user_id', parseInt(userId));
    
    res.status(204).send();
    
  } catch (error) {
    console.error('Error removing employee:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;