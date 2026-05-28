// frontend/src/pages/Dashboard.jsx
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import axios from 'axios';

function Dashboard() {
  const { user, logout } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/departments`);
      setBusinesses(response.data.businesses || []);
    } catch (error) {
      console.error('Error fetching businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Dashboard</h1>
        <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Cerrar Sesión
        </button>
      </div>
      
      <div style={{ marginTop: '30px' }}>
        <h2>Bienvenido, {user?.fullName || user?.email}</h2>
        <p>Email confirmado: {user?.emailConfirmed ? '✅ Sí' : '❌ No'}</p>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h3>Tus Negocios</h3>
        {loading ? (
          <p>Cargando...</p>
        ) : businesses.length === 0 ? (
          <p>No tienes negocios aún. Crea uno nuevo.</p>
        ) : (
          <ul>
            {businesses.map((biz) => (
              <li key={biz.id}>{biz.id} - Rol: {biz.role}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Dashboard;