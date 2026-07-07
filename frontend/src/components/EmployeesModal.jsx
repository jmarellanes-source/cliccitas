// frontend/src/components/EmployeesModal.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

function EmployeesModal({ store, onClose, onUpdate, userRole }) {
  const { token } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });

  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'employee'
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Verificar permisos
  const canManageEmployees = userRole === 'owner' || userRole === 'admin';
  const canAddEmployees = userRole === 'owner' || userRole === 'admin';
  const canDeleteEmployees = userRole === 'owner' || userRole === 'admin';
  const canChangeRoles = userRole === 'owner'; // Solo owner puede cambiar roles
  const canEditEmployees = userRole === 'owner' || userRole === 'admin';

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/departments/${store.pbx_group_id}/employees`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEmployees(response.data.employees || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setError('Error al cargar empleados');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleEditInputChange = (e) => {
    setEditFormData({
      ...editFormData,
      [e.target.name]: e.target.value
    });
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/departments/${store.pbx_group_id}/employees`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Empleado agregado exitosamente');
      setFormData({ firstName: '', lastName: '', email: '', password: '' });
      setShowAddForm(false);
      fetchEmployees();
      onUpdate();
    } catch (err) {
      console.error('Error adding employee:', err);
      setError(err.response?.data?.error || 'Error al agregar empleado');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Función para abrir el formulario de edición
  const handleEditEmployee = (employee) => {
    // Separar nombre completo en nombre y apellido
    const fullName = employee.name || '';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    setEditingEmployee(employee);
    setEditFormData({
      firstName: firstName,
      lastName: lastName,
      email: employee.email || '',
      role: employee.role || 'employee'
    });
    setShowEditForm(true);
  };

  // ✅ Función para guardar cambios del empleado
  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Combinar nombre y apellido para el backend
      const fullName = `${editFormData.firstName} ${editFormData.lastName}`.trim();
      
      // Actualizar el rol en PBX y Supabase
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/departments/${store.pbx_group_id}/employees/${editingEmployee.id}`,
        {
          firstName: editFormData.firstName,
          lastName: editFormData.lastName,
          name: fullName,  // Nombre completo para calendars.user_name
          email: editFormData.email,
          role: editFormData.role
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    
      
      setSuccess('Empleado actualizado exitosamente');
      setShowEditForm(false);
      setEditingEmployee(null);
      fetchEmployees();
      onUpdate();
    } catch (err) {
      console.error('Error updating employee:', err);
      setError(err.response?.data?.error || 'Error al actualizar empleado');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (!confirm('¿Estás seguro de eliminar este empleado?')) return;
    
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/departments/${store.pbx_group_id}/employees/${employeeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Empleado eliminado');
      fetchEmployees();
      onUpdate();
    } catch (err) {
      console.error('Error deleting employee:', err);
      setError(err.response?.data?.error || 'Error al eliminar empleado');
    }
  };

  // Obtener el color y texto del rol
  const getRoleBadge = (role) => {
    const roles = {
      owner: { text: '👑 Propietario', color: '#1e40af', bg: '#dbeafe' },
      admin: { text: '🔧 Administrador', color: '#7c3aed', bg: '#ede9fe' },
      employee: { text: '👥 Empleado', color: '#6b7280', bg: '#f3f4f6' }
    };
    const r = roles[role] || roles.employee;
    return <span style={{ ...styles.roleBadge, backgroundColor: r.bg, color: r.color }}>{r.text}</span>;
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2>Empleados de {store.name}</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        <div style={styles.sectionHeader}>
          <h3>Lista de Empleados</h3>
          {canAddEmployees && (          
            <button 
              onClick={() => setShowAddForm(!showAddForm)} 
              style={styles.addBtn}
            >
              + Agregar Empleado
            </button>
          )}
        </div>

        {/* Formulario de agregar */}
        {showAddForm && (
          <form onSubmit={handleAddEmployee} style={styles.addForm}>
            <div style={styles.row}>
              <input
                type="text"
                name="firstName"
                placeholder="Nombre"
                value={formData.firstName}
                onChange={handleInputChange}
                required
                style={styles.input}
              />
              <input
                type="text"
                name="lastName"
                placeholder="Apellido"
                value={formData.lastName}
                onChange={handleInputChange}
                required
                style={styles.input}
              />
            </div>
            <div style={styles.row}>
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleInputChange}
                required
                style={styles.input}
              />
              <input
                type="password"
                name="password"
                placeholder="Contraseña"
                value={formData.password}
                onChange={handleInputChange}
                required
                style={styles.input}
              />
            </div>
            <div style={styles.formButtons}>
              <button type="button" onClick={() => setShowAddForm(false)} style={styles.cancelBtn}>
                Cancelar
              </button>
              <button type="submit" disabled={loading} style={styles.submitBtn}>
                {loading ? 'Agregando...' : 'Agregar Empleado'}
              </button>
            </div>
          </form>
        )}

        {/* Formulario de edición */}
        {showEditForm && editingEmployee && (
          <form onSubmit={handleUpdateEmployee} style={styles.addForm}>
            <div style={styles.formHeader}>
              <h4>✏️ Editar Empleado</h4>
              <button 
                type="button" 
                onClick={() => {
                  setShowEditForm(false);
                  setEditingEmployee(null);
                }} 
                style={styles.closeSmallBtn}
              >
                ×
              </button>
            </div>
            
            {/* Fila 1: Nombre y Apellido */}
            <div style={styles.row}>
              <div style={styles.formGroup}>
                <label>Nombre</label>
                <input
                  type="text"
                  name="firstName"
                  value={editFormData.firstName || ''}
                  onChange={handleEditInputChange}
                  placeholder="Nombre"
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label>Apellido</label>
                <input
                  type="text"
                  name="lastName"
                  value={editFormData.lastName || ''}
                  onChange={handleEditInputChange}
                  placeholder="Apellido"
                  style={styles.input}
                />
              </div>
            </div>
            
            {/* Fila 2: Email y Rol */}
            <div style={styles.row}>
              {/*<div style={styles.formGroup}>
                <label>Email</label>
                <div>
                  <span>{editFormData.email || 'Sin email'}</span>
                </div>
              </div>*/} 
              {canChangeRoles && (
                <div style={styles.formGroup}>
                  <label>Rol</label>
                  <select
                    name="role"
                    value={editFormData.role || 'employee'}
                    onChange={handleEditInputChange}
                    style={styles.select}
                  >
                    <option value="employee">👥 Empleado</option>
                    <option value="admin">🔧 Administrador</option>
                    <option value="owner">👑 Propietario</option>
                  </select>
                </div>
              )}
              {!canChangeRoles && (
                <div style={styles.formGroup}>
                  <label>Rol</label>
                  <div style={styles.roleDisplay}>
                    {editFormData.role === 'owner' ? '👑 Propietario' : 
                    editFormData.role === 'admin' ? '🔧 Administrador' : 
                    '👥 Empleado'}
                  </div>
                </div>
              )}
            </div>
            
            {canChangeRoles && (
              <small style={styles.hint}>
                ⚠️ Solo el propietario puede cambiar roles. 
                    Para cambiar el email, elimina el empleado y vuelve a crearlo
              </small>
            )}
            
            <div style={styles.formButtons}>
              <button type="button" onClick={() => {
                setShowEditForm(false);
                setEditingEmployee(null);
              }} style={styles.cancelBtn}>
                Cancelar
              </button>
              <button type="submit" disabled={loading} style={styles.submitBtn}>
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        )}
        {/* Lista de empleados */}
        {loading && !showAddForm && !showEditForm ? (
          <div style={styles.loading}>Cargando empleados...</div>
        ) : employees.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No hay empleados registrados</p>
            <p style={styles.emptyHint}>Agrega empleados para gestionar tu tienda</p>
          </div>
        ) : (
          <div style={styles.employeeList}>
            {employees.map((emp) => (
              <div key={emp.id} style={styles.employeeItem}>
                <div style={styles.employeeInfo}>
                  <strong>{emp.name}</strong>
                  <span style={styles.employeeEmail}>{emp.email}</span>
                  <span style={styles.employeeExtension}>Ext: {emp.number}</span>
                  {getRoleBadge(emp.role)}
                </div>
                <div style={styles.employeeActions}>
                  {canEditEmployees && (
                    <button 
                      onClick={() => handleEditEmployee(emp)}
                      style={styles.editBtn}
                      title="Editar empleado"
                    >
                      ✏️
                    </button>
                  )}
                  {canDeleteEmployees && (
                    <button 
                      onClick={() => handleDeleteEmployee(emp.id)}
                      style={styles.deleteBtn}
                      title="Eliminar empleado"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    maxWidth: '700px',
    width: '90%',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '24px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #e5e7eb'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '28px',
    cursor: 'pointer',
    color: '#6b7280'
  },
  closeSmallBtn: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    color: '#6b7280',
    padding: '0 8px'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  addBtn: {
    padding: '6px 12px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  addForm: {
    backgroundColor: '#f3f4f6',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '20px'
  },
  formHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '12px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  input: {
    padding: '8px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px'
  },
  select: {
    padding: '8px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: 'white'
  },
  hint: {
    fontSize: '11px',
    color: '#6b7280',
    marginTop: '4px'
  },
  formButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '12px'
  },
  cancelBtn: {
    padding: '6px 12px',
    backgroundColor: '#e5e7eb',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  submitBtn: {
    padding: '6px 12px',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  employeeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  employeeItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    flexWrap: 'wrap',
    gap: '8px'
  },
  employeeInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1
  },
  employeeEmail: {
    fontSize: '12px',
    color: '#6b7280'
  },
  emailDisplay: {
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#f9fafb',
    minHeight: '36px',
    color: '#374151'
  },
  emailIcon: {
    fontSize: '14px'
  },
  emailHint: {
    fontSize: '11px',
    color: '#9ca3af',
    fontStyle: 'italic',
    marginLeft: 'auto'
  },
  employeeExtension: {
    fontSize: '12px',
    color: '#8b5cf6'
  },
  roleBadge: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '12px',
    fontWeight: '500',
    display: 'inline-block',
    marginTop: '4px',
    width: 'fit-content'
  },
  roleDisplay: {
    padding: '8px',
    backgroundColor: '#f3f4f6',
    borderRadius: '4px',
    fontSize: '14px',
    color: '#374151',
    border: '1px solid #e5e7eb',
    minHeight: '36px',
    display: 'flex',
    alignItems: 'center'
  },
  employeeActions: {
    display: 'flex',
    gap: '6px'
  },
  editBtn: {
    padding: '4px 8px',
    backgroundColor: '#dbeafe',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#2563eb',
    fontSize: '14px'
  },
  deleteBtn: {
    padding: '4px 8px',
    backgroundColor: '#fee2e2',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#dc2626',
    fontSize: '14px'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px'
  },
  success: {
    backgroundColor: '#d1fae5',
    color: '#059669',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px'
  },
  loading: {
    textAlign: 'center',
    padding: '32px',
    color: '#6b7280'
  },
  emptyState: {
    textAlign: 'center',
    padding: '32px',
    color: '#6b7280'
  },
  emptyHint: {
    fontSize: '12px',
    marginTop: '8px'
  }
};

export default EmployeesModal;