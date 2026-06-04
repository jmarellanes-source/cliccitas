// backend/src/services/pbxApi.js
const axios = require('axios');

class PbxApiService {
  constructor() {
    this.baseUrl = process.env.PBX_FQDN;
    this.clientId = process.env.PBX_CLIENT_ID;
    this.clientSecret = process.env.PBX_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiry = null;
    
    // Configuración corregida de extensiones
    this.extensionLength = parseInt(process.env.EXTENSION_LENGTH) || 4;
    this.businessIdStart = parseInt(process.env.BUSINESS_ID_START) || 100;
    this.businessIdEnd = parseInt(process.env.BUSINESS_ID_END) || 999;
    this.adminSuffix = process.env.ADMIN_SUFFIX || '0';
    this.employeeStartSuffix = parseInt(process.env.EMPLOYEE_START_SUFFIX) || 1;
    this.employeeEndSuffix = parseInt(process.env.EMPLOYEE_END_SUFFIX) || 9;
  }

  async authenticate() {
    const response = await axios.post(
      `https://${this.baseUrl}/connect/token`,
      new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials'
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    
    this.accessToken = response.data.access_token;
    this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    return this.accessToken;
  }

  async request(method, endpoint, data = null) {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }
    
    // Validar que $top no exceda 100
    if (endpoint.includes('$top=')) {
      const topMatch = endpoint.match(/\$top=(\d+)/);
      if (topMatch && parseInt(topMatch[1]) > 100) {
        throw new Error(`Invalid request: $top=${topMatch[1]} exceeds maximum allowed value of 100`);
      }
    }
    
    const url = `https://${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
    
    try {
      const response = await axios({ method, url, headers, data });
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`PBX API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  // Encontrar el siguiente business ID disponible
  async getNextBusinessId() {
    // Obtener todos los grupos (con paginación para respetar límite de 100)
    let allGroups = [];
    let skip = 0;
    const top = 100;
    let hasMore = true;
    
    while (hasMore) {
      const groups = await this.request('GET', `/xapi/v1/Groups?$top=${top}&$skip=${skip}`);
      if (groups.value && groups.value.length > 0) {
        allGroups = allGroups.concat(groups.value);
        skip += top;
        hasMore = groups.value.length === top;
      } else {
        hasMore = false;
      }
    }
    
    // Extraer business IDs usados
    const usedIds = new Set();
    for (const group of allGroups) {
      // Intentar extraer del nombre
      const nameMatch = group.Name.match(/business[_-]?(\d+)/i);
      if (nameMatch) {
        usedIds.add(parseInt(nameMatch[1]));
      }
      
      // Intentar extraer de los rangos de números
      if (group.Props && group.Props.UserNumberFrom) {
        const userFrom = parseInt(group.Props.UserNumberFrom);
        if (!isNaN(userFrom) && userFrom >= 1000) {
          const extractedId = Math.floor(userFrom / 10);
          if (extractedId >= this.businessIdStart && extractedId <= this.businessIdEnd) {
            usedIds.add(extractedId);
          }
        }
      }
    }
    
    // Buscar el primer business ID disponible
    for (let id = this.businessIdStart; id <= this.businessIdEnd; id++) {
      if (!usedIds.has(id)) {
        return id;
      }
    }
    
    throw new Error(`No available business IDs (range ${this.businessIdStart}-${this.businessIdEnd})`);
  }

  // Encontrar el siguiente número de extensión disponible para propietario
  async getNextAvailableOwnerNumber() {
    const maxAttempts = this.businessIdEnd - this.businessIdStart + 1;
    let attempts = 0;
    
    for (let id = this.businessIdStart; id <= this.businessIdEnd; id++) {
      const ownerNumber = this.generateOwnerNumber(id);
      const isAvailable = await this.isNumberAvailable(ownerNumber);
      
      console.log(`🔍 Checking owner number ${ownerNumber} (business ID ${id}): ${isAvailable ? '✅ Available' : '❌ In use'}`);
      
      if (isAvailable) {
        return { businessId: id, ownerNumber };
      }
      
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error('No available owner numbers found. All business IDs are in use.');
      }
    }
    
    throw new Error('No available owner numbers found');
  }

  // Encontrar el siguiente número disponible para empleado
  async getNextAvailableEmployeeNumber(businessId) {
    const maxEmployees = this.employeeEndSuffix - this.employeeStartSuffix + 1;
    
    for (let i = 0; i < maxEmployees; i++) {
      const employeeNumber = this.generateEmployeeNumber(businessId, i);
      const isAvailable = await this.isNumberAvailable(employeeNumber);
      
      console.log(`🔍 Checking employee number ${employeeNumber}: ${isAvailable ? '✅ Available' : '❌ In use'}`);
      
      if (isAvailable) {
        return employeeNumber;
      }
    }
    
    throw new Error(`No available employee numbers for business ID ${businessId}. Maximum employees: ${maxEmployees}`);
  }

  // Generar número de extensión para propietario
  generateOwnerNumber(businessId) {
    // businessId=100 -> 1000, businessId=101 -> 1010, businessId=999 -> 9990
    return (businessId * 10 + parseInt(this.adminSuffix)).toString();
  }

  // Generar número de extensión para empleado
  generateEmployeeNumber(businessId, employeeIndex) {
    const suffix = this.employeeStartSuffix + employeeIndex;
    if (suffix > this.employeeEndSuffix) {
      throw new Error(`Maximum employees per business is ${this.employeeEndSuffix - this.employeeStartSuffix + 1}`);
    }
    return (businessId * 10 + suffix).toString();
  }

  // Extraer businessId de un número de extensión
  getBusinessIdFromNumber(number) {
    const num = parseInt(number);
    if (isNaN(num) || num < 1000 || num > 9999) return null;
    return Math.floor(num / 10);
  }

  async isNumberAvailable(number) {
    try {
      // 1. Verificar en usuarios
      const users = await this.request(
        'GET',
        `/xapi/v1/Users?$filter=Number eq '${number}'&$top=1`
      );
      
      if (users.value && users.value.length > 0) {
        console.log(`❌ Number ${number} is already used by user: ${users.value[0].FirstName} ${users.value[0].LastName}`);
        return false;
      }
      
      // 2. Verificar en grupos (por si el número es un grupo)
      const groups = await this.request(
        'GET',
        `/xapi/v1/Groups?$filter=Number eq '${number}'&$top=1`
      );
      
      if (groups.value && groups.value.length > 0) {
        console.log(`❌ Number ${number} is already used by group: ${groups.value[0].Name}`);
        return false;
      }
      
      console.log(`✅ Number ${number} is available`);
      return true;
      
    } catch (error) {
      console.error(`❌ Error checking number ${number}:`, error.message);
      // Por seguridad, retornar false para evitar duplicados
      return false;
    }
  }
  async checkDepartmentExists(name) {
    const encodedName = encodeURIComponent(name);
    const result = await this.request('GET', `/xapi/v1/Groups?$filter=Name eq '${encodedName}'`);
    return result.value && result.value.length > 0;
  }

  async createDepartment(businessId, name, language = 'ES') {
    const baseNumber = businessId * 10;
    
    const body = {
      AllowCallService: true,
      Id: 0,
      Language: language,
      Name: name,
      PromptSet: '1e6ed594-af95-4bb4-af56-b957ac87d6d7',
      Props: {
        LiveChatMaxCount: 20,
        PersonalContactsMaxCount: 500,
        PromptsMaxCount: 10,
        SystemNumberFrom: (baseNumber + 30).toString(),
        SystemNumberTo: (baseNumber + 39).toString(),
        TrunkNumberFrom: (baseNumber + 40).toString(),
        TrunkNumberTo: (baseNumber + 45).toString(),
        UserNumberFrom: (baseNumber + 20).toString(),
        UserNumberTo: (baseNumber + 29).toString()
      },
      TimeZoneId: '51',
      DisableCustomPrompt: true
    };
    
    return this.request('POST', '/xapi/v1/Groups', body);
  }

  async createUser(userData) {
    const body = {
      AccessPassword: userData.password,
      EmailAddress: userData.email,
      FirstName: userData.firstName,
      Id: 0,
      Language: userData.language || 'ES',
      LastName: userData.lastName,
      Number: userData.number,
      PromptSet: '1e6ed594-af95-4bb4-af56-b957ac87d6d7',
      SendEmailMissedCalls: true,
      VMEmailOptions: 'Notification',
      Require2FA: false
    };
    
    return this.request('POST', '/xapi/v1/Users', body);
  }

  async assignRoleToUser(userId, groupId, roleName) {
    return this.request('PATCH', `/xapi/v1/Users(${userId})`, {
      Groups: [{ 
        GroupId: groupId, 
        Rights: { RoleName: roleName } 
      }],
      Id: userId
    });
  }

  async getUserByEmail(email) {
    const result = await this.request(
      'GET',
      `/xapi/v1/Users?$filter=tolower(EmailAddress) eq '${email.toLowerCase()}'&$top=1`
    );
    return result.value && result.value.length > 0 ? result.value[0] : null;
  }

  async getUserById(userId) {
    try {
      return await this.request('GET', `/xapi/v1/Users(${userId})`);
    } catch (error) {
      return null;
    }
  }

  async updateDepartment(groupId, updates) {
    return this.request('PATCH', `/xapi/v1/Groups(${groupId})`, updates);
  }

  async deleteDepartment(groupId) {
    return this.request('POST', '/xapi/v1/Groups/Pbx.DeleteCompanyById', { id: groupId });
  }

  async getDepartmentMembers(groupId) {
    return this.request('GET', `/xapi/v1/Groups(${groupId})?$expand=Members`);
  }

  async listDepartments({ top = 100, skip = 0 } = {}) {
    // Asegurar que top nunca exceda 100
    const safeTop = Math.min(top, 100);
    return this.request('GET', `/xapi/v1/Groups?$top=${safeTop}&$skip=${skip}`);
  }
}

module.exports = new PbxApiService();