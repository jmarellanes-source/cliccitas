// backend/src/utils/slugify.js
function slugify(text) {
  return text
    .toString()
    .normalize('NFD')                   // Separa caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '')    // Elimina diacríticos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')               // Reemplaza espacios con -
    .replace(/[^\w\-]+/g, '')           // Elimina caracteres no válidos
    .replace(/\-\-+/g, '-')             // Reemplaza múltiples - con uno solo
    .replace(/^-+/, '')                 // Elimina - al inicio
    .replace(/-+$/, '');                // Elimina - al final
}

function generateBusinessName(businessId, customName = null) {
  if (customName) {
    return `${slugify(customName)}-${businessId}`;
  }
  return `business-${businessId}`;
}

module.exports = { slugify, generateBusinessName };