// frontend/src/pages/Dashboard.jsx
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import axios from 'axios';
import StoreCard from '../components/StoreCard';
import CreateBusinessModal from '../components/CreateBusinessModal';

function Dashboard() {
  const { user, logout, token } = useAuth();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [userRoles, setUserRoles] = useState({});

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/departments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const storesData = response.data.businesses || [];
      setStores(storesData);


      // Construir mapa de roles por tienda
      const rolesMap = {};
      storesData.forEach(store => {
        rolesMap[store.id] = store.role;
      });
      setUserRoles(rolesMap);

    } catch (error) {
      console.error('Error fetching stores:', error);
      setError('Error al cargar tus tiendas');
    } finally {
      setLoading(false);
    }
  };

  const handleStoreUpdate = () => {
    fetchStores();
  };

  const canManageAnyStore = stores.some(store => 
    store.role === 'owner' || store.role === 'admin'
  );

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
            <h3>Mis Tiendas</h3>
            {canManageAnyStore && (
                <button onClick={() => setShowModal(true)} style={styles.createBtn}>
                  + Crear Nueva Tienda
                </button>
            )}
          </div>

          {error && <div style={styles.error}>{error}</div>}

          {loading ? (
            <div style={styles.loading}>Cargando tus tiendas...</div>
          ) : stores.length === 0 ? (
            <div style={styles.emptyState}>
              <p>📭 No tienes tiendas aún</p>
              <p style={styles.emptyHint}>Haz clic en "Crear Nueva Tienda" para comenzar</p>
            </div>
          ) : (
            <div style={styles.grid}>
              {stores.map((store) => (
                <StoreCard
                  key={store.id}
                  store={store}
                  onUpdate={handleStoreUpdate}
                  userRole={store.role}  // Pasar el rol del usuario en esta tienda
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <CreateBusinessModal
          onClose={() => setShowModal(false)}
          onSuccess={handleStoreUpdate}
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '20px'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px'
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#6b7280'
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px',
    color: '#6b7280'
  },
  emptyHint: {
    fontSize: '14px',
    marginTop: '8px'
  }
};

export default Dashboard;