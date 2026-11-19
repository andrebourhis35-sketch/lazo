import test from 'node:test';
import assert from 'node:assert/strict';
import { createNode, exampleFlow, simulateFlow, connectNodes, connectionProblem, parseDraft, traversedEdgeIds, validateFlow } from '../src/flow-model.mjs';

test('el catálogo sustituye variables, avanza el reloj virtual y etiqueta al contacto', () => {
  const result = simulateFlow(exampleFlow(), { name: 'Sofía', incoming: 'HOLA, necesito información', answer: 'Me interesa el CATALOGO' });
  assert.deepEqual(result.errors, []); assert.equal(result.minutes, 30);
  assert.deepEqual(result.tags, ['Catálogo enviado']);
  assert.ok(result.steps.find(step => step.id === 'bienvenida').detail.includes('Sofía'));
  assert.equal(result.steps.at(-1).kind, 'end');
});
test('la otra rama pasa al equipo y evita el seguimiento del catálogo', () => {
  const result = simulateFlow(exampleFlow(), { answer: 'Prefiero una persona' });
  assert.equal(result.assigned, 'Equipo comercial'); assert.equal(result.minutes, 0);
  assert.ok(!result.steps.some(step => step.id === 'catalogo'));
  assert.deepEqual(result.tags, []);
});
test('la palabra clave debe coincidir antes de simular el flujo', () => {
  assert.equal(simulateFlow(exampleFlow(), { incoming: 'Buenos días' }).steps.length, 0);
});
test('una nueva conexión reemplaza solo la salida elegida, sin duplicar ramas', () => {
  const flow = exampleFlow();
  const edges = connectNodes({ source: 'decision', target: 'fin', sourceHandle: 'yes' }, flow.nodes, flow.edges);
  assert.equal(edges.length, flow.edges.length);
  assert.equal(edges.filter(edge => edge.source === 'decision' && edge.sourceHandle === 'yes').length, 1);
  assert.equal(edges.find(edge => edge.source === 'decision' && edge.sourceHandle === 'no').target, 'asesor');
});
test('se rechazan ciclos, lazos y conexiones hacia Inicio', () => {
  const flow = exampleFlow();
  assert.ok(connectionProblem({ source: 'seguimiento', target: 'bienvenida', sourceHandle: 'next' }, flow.nodes, flow.edges));
  assert.throws(() => connectNodes({ source: 'bienvenida', target: 'bienvenida' }, flow.nodes, flow.edges));
  assert.throws(() => connectNodes({ source: 'bienvenida', target: 'inicio' }, flow.nodes, flow.edges));
});
test('un flujo incompleto explica qué salida falta y no simula envíos', () => {
  const flow = exampleFlow(); flow.edges = flow.edges.filter(edge => edge.source !== 'decision');
  assert.ok(validateFlow(flow).some(error => error.includes('«Sí»')));
  assert.equal(simulateFlow(flow).steps.length, 0);
});
test('borrador de ida y vuelta y datos de presentación descartados', () => {
  const flow = exampleFlow(); flow.nodes[0].selected = true; flow.nodes[0].data.private = 'no conservar';
  const restored = parseDraft(JSON.stringify(flow));
  assert.equal(restored.nodes.length, 9); assert.equal(restored.nodes[0].data.private, undefined);
  assert.equal(restored.nodes[0].selected, undefined); assert.deepEqual(validateFlow(restored), []);
});
test('un borrador manipulado no puede introducir nodos o conexiones arbitrarias', () => {
  const flow = exampleFlow(); flow.nodes[0].data.kind = '__proto__';
  assert.throws(() => parseDraft(JSON.stringify(flow)));
  const duplicate = exampleFlow(); duplicate.nodes.push(duplicate.nodes[0]);
  assert.throws(() => parseDraft(JSON.stringify(duplicate)));
  const broken = exampleFlow(); broken.edges[0].target = 'inexistente';
  assert.throws(() => parseDraft(JSON.stringify(broken)));
});
test('la espera inválida y el bloque desconectado detienen la simulación', () => {
  const flow = exampleFlow(); flow.nodes.find(node => node.id === 'espera').data.value = '-1';
  assert.ok(simulateFlow(flow).errors.length);
  const disconnected = exampleFlow(); disconnected.edges = disconnected.edges.filter(edge => edge.target !== 'catalogo');
  assert.ok(validateFlow(disconnected).some(error => error.includes('no se alcanzan')));
});
test('el límite de almacenamiento admite el máximo de bloques y textos del editor', () => {
  const nodes = [createNode('trigger', 'root'), ...Array.from({ length: 78 }, (_, index) => ({ ...createNode('message', `m${index}`), data: { kind: 'message', label: 'x'.repeat(90), value: '\n'.repeat(2000) + '' } })), createNode('end', 'end')];
  // Use visible text as well as escaped characters: it must remain a valid message.
  nodes.filter(node => node.data.kind === 'message').forEach(node => { node.data.value = 'a' + '\n'.repeat(1999); });
  const edges = nodes.slice(0, -1).map((node, index) => ({ id: `e${index}`, source: node.id, target: nodes[index + 1].id, sourceHandle: 'next', type: 'smoothstep' }));
  const flow = { version: 1, name: 'Máximo', nodes, edges };
  assert.deepEqual(validateFlow(flow), []); assert.equal(parseDraft(JSON.stringify(flow)).nodes.length, 80);
});
test('solo se resaltan las aristas realmente recorridas de cada condición', () => {
  const flow = exampleFlow();
  flow.edges = connectNodes({ source: 'decision', target: 'fin', sourceHandle: 'no' }, flow.nodes, flow.edges);
  flow.nodes = flow.nodes.filter(node => node.id !== 'asesor'); flow.edges = flow.edges.filter(edge => edge.source !== 'asesor');
  const result = simulateFlow(flow, { answer: 'Catálogo' });
  assert.deepEqual(result.errors, []);
  assert.ok(!traversedEdgeIds(result.steps, flow.edges).includes('decision-no-fin'));
  assert.ok(traversedEdgeIds(result.steps, flow.edges).includes('decision-yes-catalogo'));
});
