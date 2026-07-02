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
{/*
router.get('/', async (req, res) => {
  try {
    // Obtener tiendas del usuario desde Supabase
    const stores = await supabaseService.getStoresByOwner(req.user.id);
    
    // Para cada tienda, obtener información adicional del PBX
    const businessesWithDetails = await Promise.all(
      stores.map(async (store) => {
        try {
          // Obtener detalles del departamento en PBX
          const members = await pbxApi.getDepartmentMembers(store.pbx_group_id);
          const owner = members.Members?.find(m => 
            m.Number.endsWith(pbxApi.adminSuffix) && m.Type === 'Extension'
          );
          
          // Contar empleados
          const employees = members.Members?.filter(m => 
            m.Type === 'Extension' && 
            !m.Number.endsWith(pbxApi.adminSuffix) &&
            m.Number !== owner?.Number
          ) || [];
          
          return {
            id: store.id,
            pbx_group_id: store.pbx_group_id,
            pbx_owner_id: store.pbx_owner_id,
            name: store.name,
            slug: store.slug,
            description: store.description,
            logo_url: store.logo_url,
            cover_url: store.cover_url,
            theme_color: store.theme_color,
            address: store.address,
            phone: store.phone,
            schedule: store.schedule,
            ownerNumber: owner?.Number,
            employeesCount: employees.length,
            role: 'owner',
            is_active: store.is_active,
            created_at: store.created_at
          };
        } catch (error) {
          console.error(`Error fetching PBX details for store ${store.id}:`, error);
          return {
            id: store.id,
            pbx_group_id: store.pbx_group_id,
            name: store.name,
            slug: store.slug,
            description: store.description,
            address: store.address,
            phone: store.phone,
            theme_color: store.theme_color,
            ownerNumber: null,
            employeesCount: 0,
            role: 'owner',
            is_active: store.is_active,
            error: 'Could not fetch PBX details'
          };
        }
      })
    );
    
    res.json({ businesses: businessesWithDetails });
  } catch (error) {
    console.error('Error listing user businesses:', error);
    res.status(500).json({ error: error.message });
  }
});
*/}

router.get('/', authenticateUser, async (req, res) => {
  try {
    // Obtener TODOS los negocios donde el usuario tiene rol (owner o employee)
    const userBusinesses = await supabaseService.getUserBusinesses(req.user.id);
    
    const businessesWithDetails = await Promise.all(
      userBusinesses.map(async (ub) => {
        try {
          // Obtener detalles de la tienda desde stores
          const store = await supabaseService.getStoreByPbxGroupId(ub.pbx_group_id);
          
          // Obtener detalles del departamento en PBX
          const members = await pbxApi.getDepartmentMembers(ub.pbx_group_id);
          const owner = members.Members?.find(m => 
            m.Number.endsWith(pbxApi.adminSuffix) && m.Type === 'Extension'
          );
          
          return {
            id: store?.id,
            pbx_group_id: ub.pbx_group_id,
            pbx_user_id: ub.pbx_user_id,
            name: store?.name,
            slug: store?.slug,
            description: store?.description,
            address: store?.address,
            phone: store?.phone,
            theme_color: store?.theme_color,
            ownerNumber: owner?.Number,
            role: ub.role,
            is_active: store?.is_active,
            url: `/negocio/${store?.slug}`
          };
        } catch (error) {
          console.error(`Error fetching business details:`, error);
          return {
            pbx_group_id: ub.pbx_group_id,
            role: ub.role,
            error: 'Could not fetch details'
          };
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
    
    // 2. Encontrar el siguiente número disponible
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
    
    // 5. Crear usuario propietario en PBX
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
    
    // 6. Crear departamento
    console.log(`🏢 Creating department with business ID ${businessId}...`);
    const pbxGroup = await pbxApi.createDepartment(businessId, uniqueName, language);
    console.log(`✅ Department created with ID: ${pbxGroup.Id}`);
    
    // 7. Asignar rol group_admins
    await pbxApi.assignRoleToUser(pbxUser.Id, pbxGroup.Id, 'group_admins');
    console.log(`✅ Role assigned to user in department`);
    
    // 8. Guardar en tabla stores
    const storeData = {
      owner_id: req.user.id,
      name: businessName,
      slug: slug,
      description: description || null,
      phone: phone || null,
      address: address || null,
      theme_color: theme_color || '#3B82F6',
      pbx_group_id: pbxGroup.Id,
      pbx_owner_id: pbxUser.Id
    };
    
    const store = await supabaseService.createStore(storeData);
    console.log(`✅ Store created with ID: ${store.id}`);
    
    // 9. Crear calendario para el OWNER (después de tener store.id y pbxUser.Id)
    console.log(`📅 Creating calendar for owner ${pbxUser.Id}...`);
    const ownerCalendar = await supabaseService.createCalendar({
      store_id: store.id,
      pbx_user_id: pbxUser.Id,
      user_name: `${ownerFirstName} ${ownerLastName}`,
      user_email: ownerEmail,
      timezone: 'America/Mexico_City',
      appointment_duration: 30,
      break_between_appointments: 0,
      is_active: true
    });
    console.log(`✅ Owner calendar created with ID: ${ownerCalendar.id}`);
    // Crear horarios por defecto (Lunes a Viernes, 9am - 6pm)
    const defaultWorkingHours = [
      { day_of_week: 1, start_time: '09:00', end_time: '18:00', is_working_day: true },
      { day_of_week: 2, start_time: '09:00', end_time: '18:00', is_working_day: true },
      { day_of_week: 3, start_time: '09:00', end_time: '18:00', is_working_day: true },
      { day_of_week: 4, start_time: '09:00', end_time: '18:00', is_working_day: true },
      { day_of_week: 5, start_time: '09:00', end_time: '18:00', is_working_day: true },
      { day_of_week: 6, start_time: '10:00', end_time: '14:00', is_working_day: true },  // Sábado medio día
      { day_of_week: 0, start_time: '00:00', end_time: '00:00', is_working_day: false }   // Domingo cerrado
    ];
    
    for (const hours of defaultWorkingHours) {
      await supabaseService.createWorkingHours({
        calendar_id: ownerCalendar.id,
        ...hours
      });
    }
    
    // 10. Registrar relación en Supabase (SIN calendar_id)
    await supabaseService.linkUserToBusiness(
      req.user.id,
      pbxGroup.Id,
      pbxUser.Id,
      'owner'
      // No se pasa calendar_id - la relación está en calendars.pbx_user_id
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
    
    if (error.message.includes('ALREADY_IN_USE')) {
      return res.status(409).json({ error: 'Extension number already in use. Please try again.' });
    }
    
    if (error.message.includes('No available')) {
      return res.status(503).json({ error: error.message });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// GET /api/departments/:id/employees - Listar empleados
router.get('/:id/employees', authenticateUser, async (req, res) => {
  const { id } = req.params;
  
  try {
    const groupId = parseInt(id);
    const members = await pbxApi.getDepartmentMembers(groupId);
    
    const owner = members.Members?.find(m => 
      m.Number.endsWith(pbxApi.adminSuffix) && m.Type === 'Extension'
    );
    
    const store = await supabaseService.getStoreByPbxGroupId(groupId);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    // Obtener calendarios de la tienda (incluye owner y empleados)
    const calendars = await supabaseService.getCalendarsByStore(store.id);
    
    const calendarMap = new Map();
    (calendars || []).forEach(cal => {
      calendarMap.set(cal.pbx_user_id, { id: cal.id, user_name: cal.user_name });
    });
    
    // Incluir TANTO al owner como a los empleados en la lista
    const employeeMembers = members.Members?.filter(m => 
      m.Type === 'Extension'
    ) || [];
    
    const employees = [];
    for (const emp of employeeMembers) {
      try {
        const pbxUser = await pbxApi.getUserByNumber(emp.Number);
        const pbxUserId = pbxUser?.Id;
        const calendar = calendarMap.get(pbxUserId);
        const isOwner = emp.Number.endsWith(pbxApi.adminSuffix);
        console.log ("pbxuserid", pbxUserId, "  ")
        employees.push({
          id: pbxUserId,
          name: calendar?.user_name || pbxUser?.FirstName + ' ' + pbxUser?.LastName || emp.MemberName,
          number: emp.Number,
          email: pbxUser?.EmailAddress || '',
          role: isOwner ? 'owner' : 'employee',
          calendar_id: calendar?.id || null
        });
      } catch (err) {
        console.error(`Error fetching user for number ${emp.Number}:`, err);
        employees.push({
          id: null,
          name: emp.MemberName,
          number: emp.Number,
          email: '',
          role: emp.Number.endsWith(pbxApi.adminSuffix) ? 'owner' : 'employee',
          calendar_id: null
        });
      }
    }
    
    console.log(`✅ Found ${employees.length} employees (including owner)`);
    
    res.json({ employees });
  } catch (error) {
    console.error('Error listing employees:', error);
    res.status(500).json({ error: error.message });
  }
});


// POST /api/departments/:id/employees - Agregar empleado
router.post('/:id/employees', authenticateUser, requireRole('owner'), async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email, password } = req.body;
  
  try {
    const groupId = parseInt(id);
    
    // Obtener el grupo y la tienda
    const groups = await pbxApi.listDepartments({ top: 100 });
    const group = groups.value.find(g => g.Id === groupId);
    
    if (!group) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    // Obtener la tienda asociada
    const store = await supabaseService.getStoreByPbxGroupId(groupId);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    // Extraer business ID
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
    
    // Encontrar siguiente número de empleado disponible
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
    console.log("Email verificado , no existe");

    // 2. Crear usuario empleado en PBX
    const pbxUser = await pbxApi.createUser({
      firstName,
      lastName,
      email,
      password,
      number: employeeNumber,
      language: group.Language || 'ES'
    });
    console.log(`PBX user created: ${pbxUser.Id}`);
    
    // 3. Asignar rol users en PBX
    await pbxApi.assignRoleToUser(pbxUser.Id, groupId, 'users');
    console.log(`Role assigned in PBX`);

    console.log ("Buscando con email: ",email)

    // Verificar si el email ya existe en Supabase Auth
    let existingAuthUser = await supabaseService.getUserBusinessesbyEmail(email);
    let authUserId;
    
    if (existingAuthUser) {
      // Usuario ya existe
      authUserId = existingAuthUser.id;
      console.log(`User already exists in Supabase: ${authUserId}`);
    } else {
      // 1. Enviar invitación por email (NO crear usuario directamente)
      console.log(`Sending invitation to ${email}...`);

      const { user, error: inviteError } = await supabaseService.inviteUserByEmail(email, {
        full_name: `${firstName} ${lastName}`,
        role: 'employee',
        business_name: store.name
      });

      {/*const { user, error: inviteError } = await supabaseService.createUserWithConfirmation(
        email,
        'Th1sPassword%',
        {
          full_name: `${firstName} ${lastName}`,
          role: 'employee',
          business_name: store.name
        }
      );
      */}
      
      if (inviteError) {
        console.error('Error inviting user:', inviteError);
        return res.status(500).json({ 
          error: 'Failed to send invitation',
          details: inviteError.message 
        });
      }
      
      authUserId = user.id;
      console.log(`Invitation sent, user created with ID: ${authUserId}`);
    }
    
    // 4. Crear registro en user_businesses (vincula auth.user con pbx)
    await supabaseService.linkUserToBusiness(
      authUserId,      // ← user_id de Supabase Auth
      groupId,         // pbx_group_id
      pbxUser.Id,      // pbx_user_id
      'employee'       // role
    );
    console.log(`✅ user_businesses record created`);
    
    // 5. Crear calendario para el empleado
    const calendar = await supabaseService.createCalendar({
      store_id: store.id,
      pbx_user_id: pbxUser.Id,
      user_name: `${firstName} ${lastName}`,
      user_email: email,
      timezone: 'America/Mexico_City',
      appointment_duration: 30
    });
    console.log(`Calendar created: ${calendar.id}`);
    
    // 6. Crear horarios por defecto
    const defaultWorkingHours = [
      { day_of_week: 1, start_time: '09:00', end_time: '18:00', is_working_day: true },
      { day_of_week: 2, start_time: '09:00', end_time: '18:00', is_working_day: true },
      { day_of_week: 3, start_time: '09:00', end_time: '18:00', is_working_day: true },
      { day_of_week: 4, start_time: '09:00', end_time: '18:00', is_working_day: true },
      { day_of_week: 5, start_time: '09:00', end_time: '18:00', is_working_day: true },
      { day_of_week: 6, start_time: '10:00', end_time: '14:00', is_working_day: true },
      { day_of_week: 0, start_time: '00:00', end_time: '00:00', is_working_day: false }
    ];
    
    for (const hours of defaultWorkingHours) {
      await supabaseService.createWorkingHours({
        calendar_id: calendar.id,
        ...hours
      });
    }
    console.log(`Working hours created`);
    
    res.status(201).json({
      id: pbxUser.Id,
      name: `${firstName} ${lastName}`,
      email: email,
      number: employeeNumber,
      extension: employeeNumber,
      role: 'employee',
      calendar_id: calendar.id,
      auth_user_id: authUserId,  // Para que el empleado pueda iniciar sesión
      credentials: {
        email: email,
        password: password  // Mostrar solo en creación
      }
    });
    
  } catch (error) {
    console.error('Error adding employee:', error);
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

router.patch('/:id/employees/:userId', authenticateUser, requireRole('owner'), async (req, res) => {
  const { id, userId } = req.params;
  const { role, name, email } = req.body;
  
  try {
    const groupId = parseInt(id);
    const pbxUserId = parseInt(userId);
    
    // Verificar que el empleado existe en el grupo
    const members = await pbxApi.getDepartmentMembers(groupId);
    const employee = members.Members?.find(m => m.Id === pbxUserId);
    
    if (!employee) {
      return res.status(404).json({ error: 'Empleado no encontrado en este departamento' });
    }
    
    // Actualizar rol en user_businesses
    if (role) {
      await supabaseService.supabase
        .from('user_businesses')
        .update({ 
          role: role,
          updated_at: new Date().toISOString()
        })
        .eq('pbx_user_id', pbxUserId)
        .eq('pbx_group_id', groupId);
    }
    
    // Actualizar nombre y email en PBX (si se proporcionan)
    const pbxUpdates = {};
    if (name) {
      const [firstName, ...lastNameParts] = name.split(' ');
      pbxUpdates.FirstName = firstName;
      pbxUpdates.LastName = lastNameParts.join(' ') || '';
    }
    if (email) {
      pbxUpdates.EmailAddress = email;
    }
    
    if (Object.keys(pbxUpdates).length > 0) {
      await pbxApi.updateUser(pbxUserId, pbxUpdates);
    }
    
    res.json({
      success: true,
      message: 'Empleado actualizado correctamente'
    });
    
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;