// frontend/src/pages/StoreFront.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

function StoreFront() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, token, loading: authLoading } = useAuth();
  const [store, setStore] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState(null); // 'owner', 'admin', 'employee', null
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    fetchStoreData();
  }, [slug]);

  // ✅ Verificar el rol del usuario en esta tienda
  useEffect(() => {
    const checkUserRole = async () => {
      if (!user || !token) {
        setIsAuthenticated(false);
        setUserRole(null);
        return;
      }

      setIsAuthenticated(true);
      
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/departments`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        const userStore = response.data.businesses?.find(b => b.slug === slug);
        if (userStore) {
          setUserRole(userStore.role);
        } else {
          setUserRole(null);
        }
      } catch (error) {
        console.error('Error checking user role:', error);
        setUserRole(null);
      }
    };

    if (!authLoading) {
      checkUserRole();
    }
  }, [user, token, authLoading, slug]);

  const fetchStoreData = async () => {
    try {
      const storeRes = await axios.get(
        `${import.meta.env.VITE_API_URL}/calendar/store/${slug}`
      );
      setStore(storeRes.data.store);
      
      const employeesRes = await axios.get(
        `${import.meta.env.VITE_API_URL}/calendar/store/${slug}/employees`
      );
      setEmployees(employeesRes.data.employees || []);
    } catch (error) {
      console.error('Error fetching store:', error);
      setError('No pudimos cargar la información de la tienda');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Determinar qué botones mostrar
  const canManageAppointments = userRole === 'owner' || userRole === 'admin' || userRole === 'employee';
  const canManageCalendar = userRole === 'owner' || userRole === 'admin' || userRole === 'employee';

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Cargando...</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div style={styles.errorContainer}>
        <h2>Tienda no encontrada</h2>
        <p>{error || 'La tienda que buscas no existe'}</p>
        <Link to="/" style={styles.homeLink}>Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Hero Section */}
      <div style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.storeName}>{store.name}</h1>
          {store.description && (
            <p style={styles.storeDescription}>{store.description}</p>
          )}
          
          {/* ✅ Botones de administración (solo para usuarios autenticados con permisos) */}
          <div style={styles.adminButtons}>
            {canManageAppointments && (
              <button 
                onClick={() => navigate(`/${slug}/admin/citas`)} 
                style={styles.adminBtn}
              >
                📋 Ver Citas
              </button>
            )}
            {canManageCalendar && (
              <button 
                onClick={() => navigate(`/${slug}/admin/calendar`)} 
                style={styles.adminBtn}
              >
                📅 Mi Calendario
              </button>
            )}
            <button 
              onClick={() => navigate(`/${slug}/agendar`)} 
              style={styles.bookBtn}
            >
              📅 Agendar Cita
            </button>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div style={styles.infoSection}>
        <div style={styles.infoGrid}>
          {store.address && (
            <div style={styles.infoCard}>
              <span style={styles.infoIcon}>📍</span>
              <div>
                <h3>Dirección</h3>
                <p>{store.address}</p>
              </div>
            </div>
          )}
          {store.phone && (
            <div style={styles.infoCard}>
              <span style={styles.infoIcon}>📞</span>
              <div>
                <h3>Teléfono</h3>
                <p>{store.phone}</p>
              </div>
            </div>
          )}
          <div style={styles.infoCard}>
            <span style={styles.infoIcon}>👥</span>
            <div>
              <h3>Profesionales</h3>
              <p>{employees.length} especialistas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Employees Section */}
      {employees.length > 0 && (
        <div style={styles.employeesSection}>
          <h2>Nuestros Especialistas</h2>
          <div style={styles.employeesGrid}>
            {employees.map(emp => (
              <div key={emp.id} style={styles.employeeCard}>
                <div style={styles.employeeAvatar}>
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <h4>{emp.name}</h4>
                <button 
                  onClick={() => navigate(`/${slug}/agendar?employee=${emp.id}&name=${encodeURIComponent(emp.name)}`)}
                  style={styles.selectBtn}
                >
                  Agendar con {emp.name.split(' ')[0]}
                </button>
              </div>
            ))}
          </div>
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
  hero: {
    backgroundColor: '#3B82F6',
    padding: '60px 24px',
    textAlign: 'center',
    color: 'white'
  },
  heroContent: {
    maxWidth: '800px',
    margin: '0 auto'
  },
  storeName: {
    fontSize: '48px',
    marginBottom: '16px',
    fontWeight: 'bold'
  },
  storeDescription: {
    fontSize: '18px',
    marginBottom: '24px',
    opacity: 0.95
  },
  adminButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '12px',
    marginTop: '8px'
  },
  bookBtn: {
    padding: '14px 32px',
    backgroundColor: 'white',
    color: '#3B82F6',
    border: 'none',
    borderRadius: '50px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s'
  },
  adminBtn: {
    padding: '14px 32px',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
    border: '2px solid rgba(255, 255, 255, 0.5)',
    borderRadius: '50px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  infoSection: {
    maxWidth: '1200px',
    margin: '-30px auto 0',
    padding: '0 24px'
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px'
  },
  infoCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '12px',
    display: 'flex',
    gap: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  infoIcon: {
    fontSize: '28px'
  },
  employeesSection: {
    maxWidth: '1200px',
    margin: '60px auto',
    padding: '0 24px'
  },
  employeesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '24px',
    marginTop: '32px'
  },
  employeeCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  employeeAvatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#e0e7ff',
    color: '#4338ca',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    fontWeight: 'bold',
    margin: '0 auto 16px'
  },
  selectBtn: {
    marginTop: '16px',
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#374151'
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px'
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
    textAlign: 'center'
  },
  homeLink: {
    color: '#3B82F6',
    textDecoration: 'none'
  }
};

export default StoreFront;