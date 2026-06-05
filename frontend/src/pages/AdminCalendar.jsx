// frontend/src/pages/AdminCalendar.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import CalendarManager from '../components/CalendarManager';
import EmployeeSelector from '../components/EmployeeSelector';

function AdminCalendar() {
  const { slug } = useParams();
  const { user, token, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [store, setStore] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/${slug}`);
      return;
    }
    
    if (user) {
      fetchStoreData();
    }
  }, [user, authLoading, slug]);

  const fetchStoreData = async () => {
    try {
      // Obtener información de la tienda
      const storeRes = await axios.get(
        `${import.meta.env.VITE_API_URL}/calendar/store/${slug}`
      );
      setStore(storeRes.data.store);

      // Obtener empleados y determinar rol
      const deptRes = await axios.get(
        `${import.meta.env.VITE_API_URL}/departments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const userStore = deptRes.data.businesses?.find(b => b.slug === slug);
      if (userStore) {
        setUserRole(userStore.role);
        
        // Para owner, obtener todos los empleados
        if (userStore.role === 'owner') {
          const employeesRes = await axios.get(
            `${import.meta.env.VITE_API_URL}/departments/${userStore.pbx_group_id}/employees`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setEmployees(employeesRes.data.employees || []);
          
          // Seleccionar el primer empleado (o el propio owner)
          if (employeesRes.data.employees?.length > 0) {
            setSelectedEmployee(employeesRes.data.employees[0]);
          }
        } else {
          // Para empleado, solo su propio calendario
          setSelectedEmployee({
            id: userStore.pbxUserId,
            name: user.user_metadata?.full_name || user.email,
            number: userStore.ownerNumber
          });
        }
      }
    } catch (error) {
      console.error('Error fetching store data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || authLoading) {
    return <div style={styles.loading}>Cargando...</div>;
  }

  if (!store) {
    return <div style={styles.error}>Tienda no encontrada</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate(`/${slug}`)} style={styles.backBtn}>
          ← Volver a la tienda
        </button>
        <h1>Administrar Calendario - {store.name}</h1>
        <div style={styles.userInfo}>
          <span>{user?.email}</span>
          <span style={styles.roleBadge}>
            {userRole === 'owner' ? '👑 Propietario' : '👥 Empleado'}
          </span>
        </div>
      </div>

      {userRole === 'owner' && employees.length > 0 && (
        <EmployeeSelector
          employees={employees}
          selectedEmployee={selectedEmployee}
          onSelect={setSelectedEmployee}
          currentUserRole={userRole}
        />
      )}

      {selectedEmployee && (
        <CalendarManager
          store={store}
          calendar={{ id: selectedEmployee.calendar_id }}
          onUpdate={fetchStoreData}
          userRole={userRole}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
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
  backBtn: {
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#374151'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  roleBadge: {
    padding: '4px 8px',
    backgroundColor: '#e0e7ff',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#4338ca'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280'
  },
  error: {
    textAlign: 'center',
    padding: '40px',
    color: '#dc2626'
  }
};

export default AdminCalendar;