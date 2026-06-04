// frontend/src/pages/Dashboard.jsx
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import axios from 'axios';
import CreateBusinessModal from '../components/CreateBusinessModal';

function Dashboard() {
  const { user, logout, token } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/departments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBusinesses(response.data.businesses || []);
    } catch (error) {
      console.error('Error fetching businesses:', error);
      setError('Error al cargar tus negocios');
    } finally {
      setLoading(false);
    }
  };

  const handleBusinessCreated = (newBusiness) => {
    setBusinesses([...businesses, newBusiness.business]);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.logo}>Mi Plataforma</h1>
          <div style={styles.userInfo}>
            <span style={styles.userEmail}>{user?.email}</span>
            <button onClick={logout} style={styles.logoutBtn}>
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.welcome}>
          <h2>¡Bienvenido, {user?.fullName || user?.email?.split('@')[0]}!</h2>
          <p style={styles.subtitle}>
            {user?.emailConfirmed 
              ? '✅ Tu cuenta está verificada' 
              : '⚠️ Por favor verifica tu email para usar todas las funciones'}
          </p>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3>Mis Negocios</h3>
            <button onClick={() => setShowModal(true)} style={styles.createBtn}>
              + Crear Nuevo Negocio
            </button>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          {loading ? (
            <div style={styles.loading}>Cargando tus negocios...</div>
          ) : businesses.length === 0 ? (
            <div style={styles.emptyState}>
              <p>📭 No tienes negocios aún</p>
              <p style={styles.emptyHint}>Haz clic en "Crear Nuevo Negocio" para comenzar</p>
            </div>
          ) : (
            <div style={styles.grid}>
              {businesses.map((biz) => (
                <div key={biz.id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <span style={styles.roleBadge}>
                      {biz.role === 'owner' ? '👑 Propietario' : '👥 Empleado'}
                    </span>
                  </div>
                  <div style={styles.cardBody}>
                    <h4 style={styles.businessName}>Negocio #{biz.id}</h4>
                    <p style={styles.businessDetail}>Rol: {biz.role}</p>
                    {biz.ownerNumber && (
                      <p style={styles.businessDetail}>Extensión: {biz.ownerNumber}</p>
                    )}
                  </div>
                  <div style={styles.cardFooter}>
                    <button style={styles.viewBtn}>Ver Tienda</button>
                    <button style={styles.editBtn}>Configurar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <CreateBusinessModal
          onClose={() => setShowModal(false)}
          onSuccess={handleBusinessCreated}
        />
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
    padding: '0 24px',
    position: 'sticky',
    top: 0,
    zIndex: 100
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 0'
  },
  logo: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#3B82F6',
    margin: 0
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  userEmail: {
    color: '#6b7280',
    fontSize: '14px'
  },
  logoutBtn: {
    padding: '8px 16px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '32px 24px'
  },
  welcome: {
    marginBottom: '32px'
  },
  subtitle: {
    color: '#6b7280',
    marginTop: '8px'
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #e5e7eb'
  },
  createBtn: {
    padding: '10px 20px',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px'
  },
  card: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden',
    transition: 'box-shadow 0.2s'
  },
  cardHeader: {
    padding: '12px 16px',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    textAlign: 'right'
  },
  roleBadge: {
    fontSize: '12px',
    padding: '4px 8px',
    backgroundColor: '#e0e7ff',
    color: '#4338ca',
    borderRadius: '4px'
  },
  cardBody: {
    padding: '16px'
  },
  businessName: {
    margin: '0 0 8px 0',
    fontSize: '18px',
    fontWeight: '600'
  },
  businessDetail: {
    margin: '4px 0',
    fontSize: '14px',
    color: '#6b7280'
  },
  cardFooter: {
    padding: '12px 16px',
    backgroundColor: '#f9fafb',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    gap: '8px'
  },
  viewBtn: {
    flex: 1,
    padding: '8px',
    backgroundColor: 'white',
    border: '1px solid #3B82F6',
    borderRadius: '4px',
    color: '#3B82F6',
    cursor: 'pointer'
  },
  editBtn: {
    flex: 1,
    padding: '8px',
    backgroundColor: '#3B82F6',
    border: 'none',
    borderRadius: '4px',
    color: 'white',
    cursor: 'pointer'
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px',
    color: '#6b7280'
  },
  emptyHint: {
    fontSize: '14px',
    marginTop: '8px'
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#6b7280'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px'
  }
};

export default Dashboard;