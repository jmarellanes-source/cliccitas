// frontend/src/components/CreateBusinessModal.jsx
import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

function CreateBusinessModal({ onClose, onSuccess }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    businessName: '',
    ownerFirstName: '',
    ownerLastName: '',
    ownerEmail: '',
    ownerPassword: '',
    description: '',
    phone: '',
    address: '',
    theme_color: '#3B82F6'
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/departments`,
        {
          businessName: formData.businessName,
          ownerFirstName: formData.ownerFirstName,
          ownerLastName: formData.ownerLastName,
          ownerEmail: formData.ownerEmail,
          ownerPassword: formData.ownerPassword,
          description: formData.description,
          phone: formData.phone,
          address: formData.address,
          theme_color: formData.theme_color,
          language: 'ES'
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      onSuccess(response.data);
      onClose();
    } catch (err) {
      console.error('Error creating business:', err);
      setError(err.response?.data?.error || 'Error al crear el negocio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2>Crear Nuevo Negocio</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.formGroup}>
            <label>Nombre del Negocio *</label>
            <input
              type="text"
              name="businessName"
              value={formData.businessName}
              onChange={handleChange}
              required
              placeholder="Ej: Cafetería El Buen Sabor"
              style={styles.input}
            />
          </div>

          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label>Nombre del Propietario *</label>
              <input
                type="text"
                name="ownerFirstName"
                value={formData.ownerFirstName}
                onChange={handleChange}
                required
                placeholder="Nombre"
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label>Apellido *</label>
              <input
                type="text"
                name="ownerLastName"
                value={formData.ownerLastName}
                onChange={handleChange}
                required
                placeholder="Apellido"
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label>Email del Propietario *</label>
            <input
              type="email"
              name="ownerEmail"
              value={formData.ownerEmail}
              onChange={handleChange}
              required
              placeholder="correo@ejemplo.com"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label>Contraseña *</label>
            <input
              type="password"
              name="ownerPassword"
              value={formData.ownerPassword}
              onChange={handleChange}
              required
              placeholder="Mínimo 8 caracteres, 1 mayúscula, 1 número, 1 especial"
              style={styles.input}
            />
            <small style={styles.hint}>
              Debe contener al menos 8 caracteres, una mayúscula, un número y un carácter especial
            </small>
          </div>

          <div style={styles.formGroup}>
            <label>Descripción</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              placeholder="Describe tu negocio..."
              style={styles.textarea}
            />
          </div>

          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label>Teléfono</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+52 55 1234 5678"
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label>Color del Tema</label>
              <input
                type="color"
                name="theme_color"
                value={formData.theme_color}
                onChange={handleChange}
                style={styles.colorInput}
              />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label>Dirección</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Dirección del negocio"
              style={styles.input}
            />
          </div>

          <div style={styles.buttons}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? 'Creando...' : 'Crear Negocio'}
            </button>
          </div>
        </form>
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
  formGroup: {
    marginBottom: '16px'
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '500',
    color: '#374151'
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px'
  },
  textarea: {
    width: '100%',
    padding: '10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    resize: 'vertical'
  },
  colorInput: {
    width: '100%',
    height: '40px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  hint: {
    display: 'block',
    marginTop: '4px',
    fontSize: '12px',
    color: '#6b7280'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px',
    fontSize: '14px'
  },
  buttons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid #e5e7eb'
  },
  cancelBtn: {
    padding: '10px 20px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#374151'
  },
  submitBtn: {
    padding: '10px 20px',
    backgroundColor: '#3B82F6',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    color: 'white',
    fontWeight: '500'
  }
};

export default CreateBusinessModal;