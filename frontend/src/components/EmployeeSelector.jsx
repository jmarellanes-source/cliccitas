// frontend/src/components/EmployeeSelector.jsx
function EmployeeSelector({ employees, selectedEmployee, onSelect, currentUserRole }) {
  if (currentUserRole !== 'owner') {
    return null;
  }

  return (
    <div style={styles.container}>
      <label style={styles.label}>Seleccionar Empleado:</label>
      <select
        value={selectedEmployee?.id || ''}
        onChange={(e) => {
          const emp = employees.find(e => e.id === e.target.value);
          onSelect(emp);
        }}
        style={styles.select}
      >
        {employees.map(emp => (
          <option key={emp.id} value={emp.id}>
            {emp.name} - Ext: {emp.number}
          </option>
        ))}
      </select>
    </div>
  );
}

const styles = {
  container: {
    marginBottom: '20px',
    padding: '16px',
    backgroundColor: '#f0f9ff',
    borderRadius: '8px',
    border: '1px solid #bae6fd'
  },
  label: {
    fontWeight: '500',
    marginRight: '12px'
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    minWidth: '250px'
  }
};

export default EmployeeSelector;