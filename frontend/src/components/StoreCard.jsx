// frontend/src/components/StoreCard.jsx
import { useState } from 'react';
import StoreConfigModal from './StoreConfigModal';
import EmployeesModal from './EmployeesModal';

function StoreCard({ store, onUpdate }) {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showEmployeesModal, setShowEmployeesModal] = useState(false);

  return (
    <>
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.storeInfo}>
            <div style={styles.storeIcon}>🏪</div>
            <div>
              <h3 style={styles.storeName}>{store.name}</h3>
              {store.slug && (
                <p style={styles.storeSlug}>/{store.slug}</p>
              )}
            </div>
          </div>
          <span style={styles.statusBadge}>
            {store.is_active ? '🟢 Activo' : '🔴 Inactivo'}
          </span>
        </div>

        <div style={styles.cardBody}>
          {store.description && (
            <p style={styles.description}>{store.description}</p>
          )}
          
          <div style={styles.detailsGrid}>
            {store.address && (
              <div style={styles.detailItem}>
                <span style={styles.detailIcon}>📍</span>
                <span style={styles.detailText}>{store.address}</span>
              </div>
            )}
            {store.phone && (
              <div style={styles.detailItem}>
                <span style={styles.detailIcon}>📞</span>
                <span style={styles.detailText}>{store.phone}</span>
              </div>
            )}
            {store.ownerNumber && (
              <div style={styles.detailItem}>
                <span style={styles.detailIcon}>🔢</span>
                <span style={styles.detailText}>Ext. {store.ownerNumber}</span>
              </div>
            )}
            <div style={styles.detailItem}>
              <span style={styles.detailIcon}>👥</span>
              <span style={styles.detailText}>{store.employeesCount} empleados</span>
            </div>
          </div>
        </div>

        <div style={styles.cardFooter}>
          <button 
            onClick={() => setShowEmployeesModal(true)} 
            style={styles.employeesBtn}
          >
            👥 Empleados
          </button>
          <button 
            onClick={() => setShowConfigModal(true)} 
            style={styles.configBtn}
          >
            ⚙️ Configurar
          </button>
        </div>
      </div>

      {showConfigModal && (
        <StoreConfigModal
          store={store}
          onClose={() => setShowConfigModal(false)}
          onUpdate={onUpdate}
        />
      )}

      {showEmployeesModal && (
        <EmployeesModal
          store={store}
          onClose={() => setShowEmployeesModal(false)}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
}

const styles = {
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    transition: 'box-shadow 0.2s',
    border: '1px solid #e5e7eb'
  },
  cardHeader: {
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  storeInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  storeIcon: {
    fontSize: '32px'
  },
  storeName: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827'
  },
  storeSlug: {
    margin: '4px 0 0 0',
    fontSize: '12px',
    color: '#6b7280'
  },
  statusBadge: {
    fontSize: '12px',
    padding: '4px 8px',
    borderRadius: '20px',
    backgroundColor: '#e0e7ff',
    color: '#4338ca'
  },
  cardBody: {
    padding: '16px'
  },
  description: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    color: '#4b5563',
    lineHeight: '1.5'
  },
  detailsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#6b7280'
  },
  detailIcon: {
    fontSize: '16px',
    width: '20px'
  },
  detailText: {
    flex: 1
  },
  cardFooter: {
    padding: '12px 16px',
    backgroundColor: '#f9fafb',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    gap: '8px'
  },
  employeesBtn: {
    flex: 1,
    padding: '8px',
    backgroundColor: 'white',
    border: '1px solid #8b5cf6',
    borderRadius: '6px',
    color: '#8b5cf6',
    cursor: 'pointer',
    fontWeight: '500'
  },
  configBtn: {
    flex: 1,
    padding: '8px',
    backgroundColor: '#3B82F6',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    cursor: 'pointer',
    fontWeight: '500'
  }
};

export default StoreCard;