// frontend/src/components/EmployeesModal.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

function EmployeesModal({ store, onClose, onUpdate }) {
  const { token } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
          <button 
            onClick={() => setShowAddForm(!showAddForm)} 
            style={styles.addBtn}
          >
            + Agregar Empleado
          </button>
        </div>

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

        {loading && !showAddForm ? (
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
                </div>
                <button 
                  onClick={() => handleDeleteEmployee(emp.id)}
                  style={styles.deleteBtn}
                >
                  🗑️
                </button>
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
    maxWidth: '600px',
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
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '12px'
  },
  input: {
    padding: '8px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px'
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
    border: '1px solid #e5e7eb'
  },
  employeeInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  employeeEmail: {
    fontSize: '12px',
    color: '#6b7280'
  },
  employeeExtension: {
    fontSize: '12px',
    color: '#8b5cf6'
  },
  deleteBtn: {
    padding: '6px 12px',
    backgroundColor: '#fee2e2',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#dc2626'
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