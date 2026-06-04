// backend/src/routes/stores.js
const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);

// Actualizar tienda
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  try {
    // Verificar que el usuario es dueño de la tienda
    const store = await supabaseService.getStoreById(id);
    if (!store || store.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta tienda' });
    }
    
    const updatedStore = await supabaseService.updateStore(id, updates);
    res.json({ store: updatedStore });
  } catch (error) {
    console.error('Error updating store:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;