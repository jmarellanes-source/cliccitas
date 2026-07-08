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
      const storeRes = await axios.get(
        `${import.meta.env.VITE_API_URL}/calendar/store/${slug}`
      );
      setStore(storeRes.data.store);

      const deptRes = await axios.get(
        `${import.meta.env.VITE_API_URL}/departments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const userStore = deptRes.data.businesses?.find(b => b.slug === slug);
      if (userStore) {
        setUserRole(userStore.role);
        
        if (userStore.role === 'owner') {
          const employeesRes = await axios.get(
            `${import.meta.env.VITE_API_URL}/departments/${userStore.pbx_group_id}/employees`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setEmployees(employeesRes.data.employees || []);
          
          if (employeesRes.data.employees?.length > 0) {
            setSelectedEmployee(employeesRes.data.employees[0]);
          }
        } else {
          const employeesRes = await axios.get(
            `${import.meta.env.VITE_API_URL}/departments/${userStore.pbx_group_id}/employees`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          const myEmployee = employeesRes.data.employees?.find(
            e => e.id === userStore.pbx_user_id
          );
          
          console.log('👤 My employee record:', myEmployee);
          
          setSelectedEmployee({
            id: userStore.pbx_user_id,
            name: user.user_metadata?.full_name || user.email,
            number: userStore.ownerNumber,
            calendar_id: myEmployee?.calendar_id || null,
            role: 'employee'
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
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Cargando...</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorIcon}>🏪</div>
        <h2>Tienda no encontrada</h2>
        <p>No pudimos encontrar la tienda que buscas.</p>
        <button onClick={() => navigate('/Inicio')} style={styles.errorBtn}>
          Volver al Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate(`/${slug}`)} style={styles.backBtn}>
          ← Volver a la tienda
        </button>
        <div style={styles.headerCenter}>
          <h1 style={styles.title}>Administrar Calendario</h1>
          <p style={styles.subtitle}>{store.name}</p>
        </div>
        <div style={styles.userInfo}>
          <div style={styles.userAvatar}>
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <div style={styles.userDetails}>
            <span style={styles.userEmail}>{user?.email}</span>
            <span style={styles.roleBadge}>
              {userRole === 'owner' ? '👑 Propietario' : '👥 Empleado'}
            </span>
          </div>
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
        <div style={styles.managerWrapper}>
          <CalendarManager
            store={store}
            calendar={{ id: selectedEmployee.calendar_id }}
            onUpdate={fetchStoreData}
            userRole={userRole}
          />
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6'
  },
  header: {
    backgroundColor: 'white',
    borderBottom: '1px solid #e5e7eb',
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  backBtn: {
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#374151',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
    ':hover': {
      backgroundColor: '#e5e7eb'
    }
  },
  headerCenter: {
    textAlign: 'center'
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#111827',
    margin: 0
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '4px 0 0 0'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  userAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#3B82F6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '600',
    fontSize: '18px'
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '4px'
  },
  userEmail: {
    fontSize: '14px',
    color: '#374151',
    fontWeight: '500'
  },
  roleBadge: {
    padding: '2px 8px',
    backgroundColor: '#e0e7ff',
    borderRadius: '20px',
    fontSize: '11px',
    color: '#4338ca',
    fontWeight: '500'
  },
  managerWrapper: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px'
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    backgroundColor: '#f3f4f6'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#3B82F6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  errorContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    backgroundColor: '#f3f4f6',
    textAlign: 'center'
  },
  errorIcon: {
    fontSize: '64px'
  },
  errorBtn: {
    marginTop: '16px',
    padding: '10px 20px',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  }
};

// Agregar keyframes para la animación
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default AdminCalendar;