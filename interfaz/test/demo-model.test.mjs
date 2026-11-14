import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../demo-model.js';
const model = globalThis.LazoDemoModel;
const values = { name: 'Contacto de prueba', email: 'demo@example.com', location: 'Lima', owner: 'Andrea Castro' };
test('new contacts survive serialization with an empty conversation', () => {
  const contacts = [model.newContact(values, [])];
  contacts.push(model.newContact({ ...values, name: 'Segundo contacto' }, contacts));
  const reloaded = JSON.parse(JSON.stringify(contacts));
  assert.equal(model.validChats(reloaded), true);
  assert.notEqual(reloaded[0].id, reloaded[1].id);
  assert.deepEqual(reloaded[0].messages, []);
});
test('rejects corrupt storage instead of crashing the renderer', () => {
  const contact = model.newContact(values, []);
  for (const broken of [null, [], [contact, contact], [{ ...contact, messages: [null] }],
    [{ ...contact, tags: null }], [{ ...contact, stage: 'unknown' }],
    [{ ...contact, name: null }], [{ ...contact, color: 'url(example.com)' }]]) {
    assert.equal(model.validChats(broken), false);
  }
});
test('stage change moves the same contact without duplication', () => {
  const contact = model.newContact(values, []);
  contact.stage = 'Venta ganada';
  const columns = model.byStage([contact]);
  assert.equal(columns[0].contacts.length, 0);
  assert.equal(columns[3].contacts[0], contact);
  assert.equal(columns.reduce((count, column) => count + column.contacts.length, 0), 1);
});
test('validates fields and accepts an optional empty email', () => {
  assert.throws(() => model.newContact({ ...values, name: '  ' }, []));
  assert.throws(() => model.newContact({ ...values, email: 'invalid' }, []));
  assert.throws(() => model.newContact({ ...values, owner: 'unknown' }, []));
  assert.equal(model.validChats([model.newContact({ ...values, email: '' }, [])]), true);
});
