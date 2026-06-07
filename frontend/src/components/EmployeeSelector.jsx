// frontend/src/components/EmployeeSelector.jsx
function EmployeeSelector({ employees, selectedEmployee, onSelect, currentUserRole }) {
  if (currentUserRole !== 'owner') {
    return null;
  } 

  const handleSelectChange = (e) => {
    const selectedValue = e.target.value;
    console.log('Selected value:', selectedValue);
    
    // Buscar por id, asegurando comparación correcta (string vs number)
    const emp = employees.find(e => String(e.id) === selectedValue);
    console.log('Found employee:', emp);
    
    if (emp) {
      onSelect(emp);
    }
  };

  // Determinar el valor actual del select
  const currentValue = selectedEmployee?.id ? String(selectedEmployee.id) : '';

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <span style={styles.icon}>👥</span>
        <div style={styles.info}>
          <label style={styles.label}>Seleccionar empleado:</label>
          <select
            value={currentValue}
            onChange={handleSelectChange}
            style={styles.select}
          >
            {/* <option value="" disabled>-- Selecciona un empleado --</option> */}
            {employees.map(emp => (
              <option key={emp.id} value={String(emp.id)}>
                {emp.name} - Ext: {emp.number} {emp.role === 'owner' ? '👑' : '👥'} {emp.calendar_id ? '✅' : '⚠️'}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    margin: '20px 24px',
    backgroundColor: '#eff6ff',
    borderRadius: '12px',
    border: '1px solid #bfdbfe'
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    flexWrap: 'wrap'
  },
  icon: {
    fontSize: '24px'
  },
  info: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap'
  },
  label: {
    fontWeight: '500',
    color: '#1e40af'
  },
  select: {
    padding: '8px 16px',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: 'white',
    minWidth: '250px',
    cursor: 'pointer'
  }
};

export default EmployeeSelector;