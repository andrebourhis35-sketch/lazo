/* Shared validation for browser-only demo data. No customer data or API calls. */
globalThis.LazoDemoModel = (() => {
  const stages = ['Nuevo contacto', 'En conversación', 'Propuesta enviada', 'Venta ganada'];
  function validChats(value) {
    if (!Array.isArray(value) || !value.length || value.length > 1000) return false;
    const ids = new Set();
    return value.every(c => {
      if (!c || !Number.isSafeInteger(c.id) || c.id < 1 || ids.has(c.id)) return false;
      ids.add(c.id);
      return ['name', 'initials', 'email', 'location', 'owner', 'time', 'note'].every(k => typeof c[k] === 'string')
        && c.name.trim().length > 0 && /^#[a-f\d]{6}$/i.test(c.color)
        && stages.includes(c.stage) && Number.isInteger(c.unread) && c.unread >= 0
        && Array.isArray(c.tags) && c.tags.every(t => typeof t === 'string')
        && Array.isArray(c.messages) && c.messages.every(m => Array.isArray(m) && m.length === 3
          && ['in', 'out'].includes(m[0]) && typeof m[1] === 'string' && typeof m[2] === 'string');
    });
  }
  function newContact(values, contacts) {
    const name = values.name.trim();
    if (!name || name.length > 80) throw new Error('Escribe un nombre de hasta 80 caracteres.');
    const email = values.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Revisa el correo electrónico.');
    if (!['Andrea Castro', 'Miguel López'].includes(values.owner)) throw new Error('Selecciona un responsable.');
    if (contacts.length >= 1000) throw new Error('La demostración admite hasta 1.000 contactos.');
    return {
      id: Math.max(0, ...contacts.map(c => c.id)) + 1,
      name, email, location: values.location.trim(), owner: values.owner,
      initials: name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(),
      color: '#e4ebff', stage: stages[0], tags: ['Demo'], unread: 0,
      time: '', note: '', messages: [], resolved: false
    };
  }
  function byStage(contacts) {
    return stages.map(stage => ({ stage, contacts: contacts.filter(c => c.stage === stage) }));
  }
  return { stages, validChats, newContact, byStage };
})();
