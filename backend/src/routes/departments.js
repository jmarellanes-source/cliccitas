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
router.post('/', async (req, res) => {
  const {
    businessName,
    ownerFirstName,
    ownerLastName,
    ownerEmail,
    ownerPassword,
    language = 'ES'
  } = req.body;
  
  // Validaciones...
  if (!businessName || !ownerFirstName || !ownerLastName || !ownerEmail || !ownerPassword) {
    return res.status(400).json({ 
      error: 'Missing required fields' 
    });
  }
  
  try {
    // 1. Verificar email no registrado en PBX
    const existingUser = await pbxApi.getUserByEmail(ownerEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered in PBX' });
    }
    
    console.log ("Checado correo :", ownerEmail)
    // 2. Obtener siguiente businessId
    const businessId = await pbxApi.getNextBusinessId();

    console.log ("Siguientes ID :", businessId)
    
    // 3. Generar nombre único
    const uniqueName = generateBusinessName(businessId, businessName);
    const slug = slugify(businessName);
    
    console.log ("Unique ID :", uniqueName)
    // 4. Verificar nombre único
    const exists = await pbxApi.checkDepartmentExists(uniqueName);
    if (exists) {
      return res.status(400).json({ error: 'Business name already exists' });
    }
    
    console.log ("Creand Owner:", businessId)
    // 5. Generar número de propietario
    const ownerNumber = pbxApi.generateOwnerNumber(businessId);

    console.log ("Number Available", ownerNumber)
    // 6. Verificar disponibilidad
    const isNumberAvailable = await pbxApi.isNumberAvailable(ownerNumber);
    if (!isNumberAvailable) {
      return res.status(500).json({ error: `Number ${ownerNumber} not available` });
    }
    
    console.log ("Creando usuario")

    // 7. Crear usuario propietario en PBX
    const pbxUser = await pbxApi.createUser({
      firstName: ownerFirstName,
      lastName: ownerLastName,
      email: ownerEmail,
      password: ownerPassword,
      number: ownerNumber,
      language: language
    });
    console.log ("Despues de crear user:" , businessId, uniqueName, language)
    // 8. Crear departamento
    const pbxGroup = await pbxApi.createDepartment(businessId, uniqueName, language);
    
    // 9. Asignar rol system_owners
    await pbxApi.assignRoleToUser(pbxUser.Id, pbxGroup.Id, 'department_administrator');
    
    // 10. Registrar relación en Supabase
    await supabaseService.linkUserToBusiness(
      req.user.id,
      pbxGroup.Id,
      pbxUser.Id,
      'owner'
    );
    
    // 11. Registrar en log
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
        businessId: businessId,
        slug: slug,
        url: `/negocio/${slug}`
      },
      owner: {
        id: pbxUser.Id,
        name: `${ownerFirstName} ${ownerLastName}`,
        email: ownerEmail,
        number: ownerNumber,
        role: 'system_owners'
      }
    });
    
  } catch (error) {
    console.error('Error creating business:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/departments/:id/employees - Agregar empleado
router.post('/:id/employees', requireRole('owner'), async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email, password } = req.body;
  
  try {
    const groupId = parseInt(id);
    
    // Obtener el grupo
    const groups = await pbxApi.listDepartments({ top: 1 });
    const group = groups.value.find(g => g.Id === groupId);
    
    if (!group) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    // Extraer businessId del nombre o números
    let businessId = null;
    if (group.Props && group.Props.UserNumberFrom) {
      businessId = pbxApi.getBusinessIdFromNumber(group.Props.UserNumberFrom);
    }
    
    if (!businessId) {
      return res.status(400).json({ error: 'Cannot determine business ID' });
    }
    
    // Contar empleados actuales
    const members = await pbxApi.getDepartmentMembers(groupId);
    const currentEmployees = members.Members?.filter(m => 
      m.Type === 'Extension' && !m.Number.endsWith(pbxApi.adminSuffix)
    ).length || 0;
    
    // Generar número para empleado
    const employeeNumber = pbxApi.generateEmployeeNumber(businessId, currentEmployees);
    
    // Verificar disponibilidad
    const isNumberAvailable = await pbxApi.isNumberAvailable(employeeNumber);
    if (!isNumberAvailable) {
      return res.status(500).json({ error: 'No available employee numbers' });
    }
    
    // Verificar email no existente
    const existingUser = await pbxApi.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Crear usuario
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
      role: 'users'
    });
    
  } catch (error) {
    console.error('Error adding employee:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/departments/:id/employees/:userId
router.delete('/:id/employees/:userId', requireRole('owner'), async (req, res) => {
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