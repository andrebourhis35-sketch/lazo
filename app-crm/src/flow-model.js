export const DRAFT_KEY = 'lazo.laboratorio.flujos.v1';
export const BLOCKS = {
  trigger: { name: 'Inicio', description: 'Cuando llega una palabra clave', group: 'Entrada' },
  message: { name: 'Mensaje', description: 'Texto con variables de contacto', group: 'Conversación' },
  buttons: { name: 'Botones de respuesta', description: 'Envía hasta tres opciones y sigue la elegida', group: 'Conversación' },
  condition: { name: 'Condición', description: 'Dos caminos según la respuesta', group: 'Lógica' },
  plan: { name: 'Oferta y plan', description: 'Define precio, moneda y contenido', group: 'Venta' },
  charge: { name: 'Cobrar', description: 'Envía el importe y las instrucciones', group: 'Pago' },
  confirm: { name: 'Confirmar pago', description: 'Espera la validación del abono', group: 'Pago' },
  deliver: { name: 'Entregar producto', description: 'Envía el enlace del plan elegido', group: 'Entrega' },
  ai: { name: 'Agente IA', description: 'Responde con información de tu negocio', group: 'Conversación' },
  reminder: { name: 'Esperar sin respuesta', description: 'Continúa solo si el cliente no responde', group: 'Lógica' },
  handoff: { name: 'Traspasar a asesor', description: 'Asigna el chat y pausa la automatización', group: 'Acciones' },
  back: { name: 'Volver al menú anterior', description: 'Regresa al menú previo de este recorrido', group: 'Lógica' },
  wait: { name: 'Espera', description: 'Pausa el recorrido durante un tiempo fijo', group: 'Lógica' },
  tag: { name: 'Etiqueta', description: 'Organiza el contacto', group: 'Acciones' },
  assign: { name: 'Asignar asesor', description: 'Continúa con una persona', group: 'Acciones' },
  end: { name: 'Finalizar', description: 'Cierra este recorrido', group: 'Acciones' },
};

export function createNode(kind, id, position = { x: 0, y: 0 }) {
  const defaults = {
    trigger: { label: 'Cuando llega un mensaje', value: 'hola' },
    message: { label: 'Enviar mensaje', value: 'Hola {{nombre}}, ¿cómo podemos ayudarte?' },
    buttons: { label: 'Elegir una opción', value: 'Hola {{nombre}}, ¿qué te gustaría consultar?', choices: ['Ver catálogo', 'Consultar horarios'] },
    condition: { label: '¿Qué necesita el contacto?', value: 'catálogo' },
    plan: { label: 'Elegir plan', value: '', sale: { product: '', price: '', currency: 'PEN', link: '', mode: 'prepaid', previousPlan: '' } },
    charge: { label: 'Enviar instrucciones de pago', value: '' },
    confirm: { label: 'Verificar abono', value: '' },
    deliver: { label: 'Enviar enlace de acceso', value: 'Aquí tienes el acceso a tu compra:' },
    ai: { label: 'Responder con IA', value: '' },
    reminder: { label: 'Esperar antes del seguimiento', value: '30' },
    handoff: { label: 'Traspasar al equipo', value: '' },
    back: { label: 'Volver al menú anterior', value: '' },
    wait: { label: 'Pausar antes del siguiente mensaje', value: '30' },
    tag: { label: 'Organizar contacto', value: 'Interesado' },
    assign: { label: 'Continuar con un asesor', value: 'Equipo comercial' },
    end: { label: 'Recorrido completo', value: '' },
  };
  return { id, type: 'lazo', position, data: { kind, ...defaults[kind] } };
}

export function buttonWelcomeFlow() {
  const nodes = [
    createNode('trigger', 'inicio', { x: 40, y: 150 }),
    createNode('buttons', 'bienvenida', { x: 340, y: 150 }),
    createNode('message', 'catalogo', { x: 640, y: 30 }),
    createNode('message', 'horarios', { x: 640, y: 255 }),
    createNode('message', 'pedido', { x: 640, y: 480 }),
    createNode('end', 'fin', { x: 940, y: 150 }),
  ];
  nodes[1].data.choices.push('Consultar pedido');
  nodes[4].data.value = 'Comparte tu número de pedido para que podamos revisar su estado.';
  nodes[2].data.value = 'Cuéntanos qué producto te interesa y te compartiremos las opciones.';
  nodes[3].data.value = '¿Qué día te gustaría consultar? Indícanos si prefieres la mañana o la tarde.';
  const edges = [
    ['inicio', 'bienvenida', 'next'], ['bienvenida', 'catalogo', 'option-1'],
    ['bienvenida', 'horarios', 'option-2'], ['catalogo', 'fin', 'next'], ['horarios', 'fin', 'next'],
    ['bienvenida', 'pedido', 'option-3'], ['pedido', 'fin', 'next'],
  ].map(([source, target, sourceHandle]) => ({ id: source + '-' + sourceHandle, source, target, sourceHandle, type: 'smoothstep' }));
  return { version: 1, name: 'Bienvenida con botones', nodes, edges };
}

export function chainedWelcomeFlow() {
  const nodes = [
    createNode('trigger', 'inicio', { x: 40, y: 150 }),
    createNode('buttons', 'bienvenida', { x: 340, y: 150 }),
    createNode('buttons', 'catalogo', { x: 640, y: 30 }),
    createNode('message', 'horarios', { x: 640, y: 255 }),
    createNode('message', 'pedido', { x: 640, y: 480 }),
    createNode('end', 'fin', { x: 1240, y: 290 }),
    createNode('message', 'novedades', { x: 940, y: 30 }),
    createNode('message', 'ofertas', { x: 940, y: 240 }),
    createNode('back', 'volver', { x: 940, y: -180 }),
  ];
  nodes[1].data.choices.push('Consultar pedido');
  nodes[4].data.value = 'Comparte tu número de pedido para que podamos revisar su estado.';
  nodes[2].data.value = '¿Qué quieres ver del catálogo?';
  nodes[2].data.choices = ['Novedades', 'Ofertas', 'Volver'];
  nodes[6].data.value = 'Cuéntanos qué tipo de producto buscas y te compartiremos las novedades.';
  nodes[7].data.value = 'Dinos qué producto te interesa y revisaremos las ofertas disponibles.';
  nodes[3].data.value = '¿Qué día te gustaría consultar? Indícanos si prefieres la mañana o la tarde.';
  const edges = [
    ['inicio', 'bienvenida', 'next'], ['bienvenida', 'catalogo', 'option-1'],
    ['bienvenida', 'horarios', 'option-2'], ['catalogo', 'novedades', 'option-1'], ['catalogo', 'ofertas', 'option-2'],
    ['catalogo', 'volver', 'option-3'], ['novedades', 'fin', 'next'], ['ofertas', 'fin', 'next'], ['horarios', 'fin', 'next'],
    ['bienvenida', 'pedido', 'option-3'], ['pedido', 'fin', 'next'],
  ].map(([source, target, sourceHandle]) => ({ id: source + '-' + sourceHandle, source, target, sourceHandle, type: 'smoothstep' }));
  return { version: 1, name: 'Bienvenida con botones', nodes, edges };
}

export function digitalSaleFlow(mode = 'prepaid') {
  const checkout = mode === 'postpaid' ? ['deliver','charge','confirm'] : ['charge','confirm','deliver'];
  const nodes = [
    createNode('trigger','inicio',{x:40,y:150}),
    createNode('buttons','oferta',{x:340,y:150}),
    createNode('plan','basico',{x:640,y:20}),
    createNode('plan','premium',{x:640,y:280}),
    ...checkout.map((kind,index)=>createNode(kind,kind,{x:940+index*300,y:150})),
    createNode('end','fin',{x:1840,y:150}),
  ];
  nodes[0].data.value = 'quiero el ebook';
  nodes[1].data.value = 'Elige tu plan: Básico S/ 10 o Premium S/ 20 con bonos.';
  nodes[1].data.choices = ['Básico','Premium'];
  for (const [node,title,price] of [[nodes[2],'Básico','10'],[nodes[3],'Premium','20']]) {
    node.data.value=title;
    Object.assign(node.data.sale,{price,mode});
  }
  const links = [
    ['inicio','oferta','next'], ['oferta','basico','option-1'], ['oferta','premium','option-2'],
    ['basico',checkout[0],'next'], ['premium',checkout[0],'next'],
    ...checkout.map((kind,index)=>[kind,checkout[index+1]||'fin','next']),
  ];
  return {version:1,name:mode==='postpaid'?'Venta contra entrega digital':'Venta con pago anticipado',
    nodes,edges:links.map(([source,target,sourceHandle])=>({id:source+'-'+sourceHandle,source,target,sourceHandle,type:'smoothstep'}))};
}

export function amountInCents(value) {
  if (typeof value !== 'string' || !/^\d{1,6}([.,]\d{1,2})?$/.test(value.trim())) return 0;
  const [whole, fraction = ''] = value.trim().split(/[.,]/);
  return Number(whole)*100 + Number(fraction.padEnd(2,'0'));
}

export function validDeliveryLink(value) {
  try { const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password; } catch {return false;}
}

export function exampleFlow() {
  const definitions = [
    ['inicio', 'trigger', 40, 150, 'Mensaje recibido', 'hola'],
    ['bienvenida', 'message', 340, 150, 'Dar la bienvenida', 'Hola {{nombre}} 👋 Soy el asistente de LAZO. ¿Quieres ver el catálogo o prefieres hablar con nuestro equipo?'],
    ['decision', 'condition', 640, 150, '¿Quiere ver el catálogo?', 'catálogo'],
    ['catalogo', 'message', 940, 35, 'Compartir catálogo', 'Perfecto, {{nombre}}. Aquí verías el catálogo de tu empresa. En esta prueba no enviamos archivos ni enlaces reales.'],
    ['asesor', 'assign', 940, 350, 'Pasar al equipo', 'Equipo comercial'],
    ['espera', 'wait', 1240, 35, 'Esperar una respuesta', '30'],
    ['seguimiento', 'message', 1540, 35, 'Retomar la conversación', '{{nombre}}, ¿encontraste lo que buscabas? Estamos aquí para ayudarte.'],
    ['etiqueta', 'tag', 1840, 35, 'Marcar interés', 'Catálogo enviado'],
    ['fin', 'end', 2140, 150, 'Finalizar recorrido', ''],
  ];
  const nodes = definitions.map(([id, kind, x, y, label, value]) => ({ ...createNode(kind, id, { x, y }), data: { kind, label, value } }));
  const link = (source, target, sourceHandle = 'next') => ({ id: `${source}-${sourceHandle}-${target}`, source, target, sourceHandle, type: 'smoothstep' });
  return { version: 1, name: 'Bienvenida y primer contacto', nodes, edges: [link('inicio', 'bienvenida'), link('bienvenida', 'decision'), link('decision', 'catalogo', 'yes'), link('decision', 'asesor', 'no'), link('catalogo', 'espera'), link('espera', 'seguimiento'), link('seguimiento', 'etiqueta'), link('etiqueta', 'fin'), link('asesor', 'fin')] };
}

const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
export const summarizeNode = data => ['wait', 'reminder'].includes(data.kind) ? `${data.value || '0'} minutos` : data.kind === 'end' ? 'El contacto sale del flujo' : data.value;
export function outputsFor({kind, choices}) {
  if (kind === 'buttons') return choices.map((_, index) => 'option-' + (index + 1));
  if (kind === 'ai') return ['answered','handoff'];
  if (kind === 'condition') return ['yes', 'no'];
  return ['end', 'handoff', 'back'].includes(kind) ? [] : ['next'];
}

export function connectionProblem(connection, nodes, edges) {
  const source = nodes.find(node => node.id === connection.source);
  const target = nodes.find(node => node.id === connection.target);
  if (!source || !target) return 'Selecciona dos bloques del lienzo.';
  if (source.id === target.id) return 'Un bloque debe conectarse con otro bloque.';
  if (target.data.kind === 'trigger') return 'Inicio no puede recibir conexiones.';
  if (!outputsFor(source.data).includes(connection.sourceHandle || 'next')) return 'Elige una salida disponible del bloque.';
  const remaining = edges.filter(edge => !(edge.source === source.id && (edge.sourceHandle || 'next') === (connection.sourceHandle || 'next')));
  const pending = [target.id], visited = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (current === source.id) return 'Esta conexión crearía un ciclo. Usa un recorrido con principio y fin.';
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...remaining.filter(edge => edge.source === current).map(edge => edge.target));
  }
  return '';
}

export function connectNodes(connection, nodes, edges) {
  const problem = connectionProblem(connection, nodes, edges);
  if (problem) throw new Error(problem);
  const sourceHandle = connection.sourceHandle || 'next';
  const next = edges.filter(edge => !(edge.source === connection.source && (edge.sourceHandle || 'next') === sourceHandle));
  return [...next, { id: `${connection.source}-${sourceHandle}-${connection.target}`, source: connection.source, target: connection.target, sourceHandle, type: 'smoothstep' }];
}

export function validateFlow(flow) {
  const errors = [];
  const nodes = flow.nodes, edges = flow.edges;
  if (!nodes.length) return ['Añade un bloque de inicio.'];
  const starts = nodes.filter(node => node.data.kind === 'trigger');
  if (starts.length !== 1) errors.push('El flujo necesita exactamente un bloque de inicio.');
  for (const node of nodes) {
    if (!node.data.label.trim()) errors.push('Todos los bloques necesitan un nombre.');
    if (['message', 'condition', 'tag', 'assign', 'handoff', 'ai', 'plan', 'charge'].includes(node.data.kind) && !node.data.value.trim()) errors.push(`Completa el contenido de «${node.data.label || BLOCKS[node.data.kind].name}».`);
    if (node.data.kind === 'plan' && (!/^[a-z0-9][a-z0-9_-]{0,49}$/.test(node.data.sale.product) || !amountInCents(node.data.sale.price) || !validDeliveryLink(node.data.sale.link))) errors.push('Completa el código de producto, el importe y el enlace HTTPS de «'+node.data.label+'».');
    if (node.data.kind === 'confirm' && node.data.value.trim() && (!/^\d+$/.test(node.data.value) || +node.data.value<1 || +node.data.value>1380)) errors.push('El recordatorio de pago debe ser de 1 a 1380 minutos.');
    if (node.data.kind === 'reminder' && (!/^\d+$/.test(node.data.value) || Number(node.data.value) < 1 || Number(node.data.value) > 1380)) errors.push('La espera sin respuesta debe ser de 1 a 1380 minutos.');
    if (node.data.kind === 'wait' && (!/^\d+$/.test(node.data.value) || Number(node.data.value) < 1 || Number(node.data.value) > 10080)) errors.push(`La espera de «${node.data.label}» debe ser de 1 a 10080 minutos.`);
    if (node.data.kind === 'buttons') {
      const choices = node.data.choices.map(choice => choice.trim());
      if (!node.data.value.trim() || node.data.value.length > 1024) errors.push('Escribe un mensaje de hasta 1024 caracteres para los botones.');
      if (choices.length < 2 || choices.length > 3 || choices.some(choice => !choice || choice.length > 20 || /[\r\n]/.test(choice)) || new Set(choices.map(normalize)).size !== choices.length) errors.push('Escribe dos o tres opciones distintas, de hasta 20 caracteres cada una.');
    }
    for (const output of outputsFor(node.data)) {
      const targets = edges.filter(edge => edge.source === node.id && (edge.sourceHandle || 'next') === output);
      if (targets.length !== 1) errors.push(`Conecta ${output === 'yes' ? 'la salida «Sí»' : output === 'no' ? 'la salida «No»' : output === 'answered' ? 'la salida «Respondió»' : output === 'handoff' ? 'la salida «Asesor»' : output.startsWith('option-') ? 'el botón ' + output.slice(-1) : 'la salida'} de «${node.data.label}».`);
    }
  }
  for (const edge of edges) {
    const issue = connectionProblem(edge, nodes, edges.filter(item => item.id !== edge.id));
    if (issue) errors.push(issue);
  }
  if (starts.length === 1) {
    const visited = new Set(), pending = [starts[0].id];
    while (pending.length) {
      const id = pending.pop();
      if (visited.has(id)) continue;
      visited.add(id); pending.push(...edges.filter(edge => edge.source === id).map(edge => edge.target));
    }
    const byId = new Map(nodes.map(node => [node.id, node]));
    const contexts = [[starts[0].id, 0]], seen = new Set();
    while (contexts.length) {
      const [id, depth] = contexts.pop(), key = id + ':' + depth;
      if (seen.has(key)) continue;
      seen.add(key);
      const kind = byId.get(id)?.data.kind;
      if (kind === 'back' && depth < 2) errors.push('Conecta «Volver al menú anterior» desde un submenú.');
      for (const edge of edges.filter(edge => edge.source === id)) contexts.push([edge.target, Math.min(2, depth + Number(kind === 'buttons'))]);
    }
    validateSalePaths(starts[0].id,nodes,edges,errors);
    if (nodes.some(node => !visited.has(node.id))) errors.push('Hay bloques que no se alcanzan desde Inicio. Conéctalos o retíralos.');
  }
  return [...new Set(errors)];
}

function validateSalePaths(start,nodes,edges,errors) {
  if(!nodes.some(node=>['plan','charge','confirm','deliver'].includes(node.data.kind)))return;
  const byId=new Map(nodes.map(node=>[node.id,node.data]));
  const pending=[[start,'',false,false,false]],seen=new Set();
  while(pending.length) {
    let [id,mode,charged,confirmed,delivered]=pending.pop();
    const key=JSON.stringify([id,mode,charged,confirmed,delivered]);
    if(seen.has(key))continue;
    seen.add(key);
    const node=byId.get(id);
    if(!node)continue;
    if(node.kind==='plan') {
      if(mode)errors.push('Cada recorrido de venta admite un plan.');
      mode=node.sale.mode;
    } else if(node.kind==='charge') {
      if(!mode||charged||mode==='postpaid'&&!delivered)errors.push('Conecta Cobrar después de elegir un plan y, en contra entrega, después de Entregar producto.');
      charged=true;
    } else if(node.kind==='confirm') {
      if(!charged||confirmed)errors.push('Conecta un solo Confirmar pago después de Cobrar.');
      confirmed=true;
    } else if(node.kind==='deliver') {
      if(!mode||delivered||mode==='prepaid'&&!confirmed)errors.push('En pago anticipado, conecta Entregar producto después de Confirmar pago.');
      delivered=true;
    } else if(node.kind==='back'&&mode) {
      errors.push('Conecta Volver antes de registrar el plan de un pedido.');
    }
    for(const edge of edges.filter(edge=>edge.source===id))pending.push([edge.target,mode,charged,confirmed,delivered]);
  }
}

export function parseDraft(raw) {
  if (typeof raw !== 'string' || raw.length > 2000000) throw new Error('El borrador supera el tamaño permitido.');
  const flow = JSON.parse(raw);
  if (!flow || flow.version !== 1 || typeof flow.name !== 'string' || flow.name.length > 100 || !Array.isArray(flow.nodes) || !Array.isArray(flow.edges) || flow.nodes.length > 80 || flow.edges.length > 160) throw new Error('El borrador tiene un formato incompatible.');
  const ids = new Set();
  const nodes = flow.nodes.map(node => {
    if (!node || typeof node.id !== 'string' || !/^[\w-]{1,80}$/.test(node.id) || ids.has(node.id) || !Object.hasOwn(BLOCKS, node.data?.kind) || typeof node.data.label !== 'string' || node.data.label.length > 90 || typeof node.data.value !== 'string' || node.data.value.length > 2000 || !Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y) || Math.abs(node.position.x) > 20000 || Math.abs(node.position.y) > 20000) throw new Error('El borrador contiene un bloque incompatible.');
    const { kind, label, value, choices, sale } = node.data;
    if (kind === 'buttons' && (!Array.isArray(choices) || (choices.length < 2 || choices.length > 3) || choices.some(choice => typeof choice !== 'string' || choice.length > 20))) throw new Error('El borrador contiene botones incompatibles.');
    let cleanSale;
    if (kind === 'plan') {
      if (!sale || typeof sale.product!=='string' || sale.product.length>50 || typeof sale.price!=='string' || sale.price.length>12 || !['PEN','USD','EUR'].includes(sale.currency) || typeof sale.link!=='string' || sale.link.length>1500 || !['prepaid','postpaid'].includes(sale.mode) || typeof sale.previousPlan!=='string' || sale.previousPlan.length>100) throw new Error('El plan de venta tiene un formato incompatible.');
      cleanSale={product:sale.product,price:sale.price,currency:sale.currency,link:sale.link,mode:sale.mode,previousPlan:sale.previousPlan};
    }
    ids.add(node.id);
    return { id: node.id, type: 'lazo', position: { x: node.position.x, y: node.position.y }, data: { kind, label, value, ...(kind === 'buttons' ? { choices } : {}), ...(cleanSale ? {sale:cleanSale} : {}) } };
  });
  const edgeIds = new Set();
  const edges = flow.edges.map(edge => {
    if (!edge || typeof edge.id !== 'string' || edge.id.length > 180 || edgeIds.has(edge.id) || !ids.has(edge.source) || !ids.has(edge.target) || !['next', 'yes', 'no', 'option-1', 'option-2', 'option-3', 'answered', 'handoff'].includes(edge.sourceHandle || 'next')) throw new Error('El borrador contiene una conexión incompatible.');
    edgeIds.add(edge.id);
    return { id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle || 'next', type: 'smoothstep' };
  });
  return { version: 1, name: flow.name, nodes, edges };
}

export function simulateFlow(flow, { aiOutcome = 'answered', paymentConfirmed = true, name = 'Lucía', incoming = 'Hola', answer = 'Quiero el catálogo' } = {}) {
  const errors = validateFlow(flow);
  if (errors.length) return { errors, steps: [], tags: [], assigned: '', minutes: 0 };
  const steps = [], tags = new Set(); let assigned = '', minutes = 0, plan = null;
  const answers = String(answer).split('\n').map(item => item.trim()).filter(Boolean);
  const menus = [];
  let answerIndex = 0;
  let current = flow.nodes.find(node => node.data.kind === 'trigger');
  if (current.data.value.trim() && !normalize(incoming).includes(normalize(current.data.value))) return { errors: ['El mensaje de prueba no coincide con la palabra clave de Inicio.'], steps, tags: [], assigned, minutes };
  for (let count = 0; current && count < 90; count++) {
    const { kind, label, value } = current.data;
    let detail = '', output = 'next';
    if (kind === 'trigger') detail = `Mensaje recibido: «${incoming}»`;
    if (kind === 'message') detail = value.replaceAll('{{nombre}}', name.trim() || 'Contacto');
    if (kind === 'buttons') {
      const index = current.data.choices.findIndex(choice => normalize(choice) === normalize(answers[answerIndex] || ''));
      detail = value.replaceAll('{{nombre}}', name.trim() || 'Contacto');
      if (index < 0) {
        steps.push({ id: current.id, kind, label, detail, minutes, output: '' });
        return { errors: [], waiting: current.data.choices, steps, tags: [...tags], assigned, minutes };
      }
      answerIndex++;
      menus.push(current.id);
      output = 'option-' + (index + 1);
      detail += ' · Opción elegida: ' + current.data.choices[index];
    }
    if (kind === 'condition') { output = normalize(answer).includes(normalize(value)) ? 'yes' : 'no'; detail = `Respuesta: «${answer}». Camino: ${output === 'yes' ? 'Sí' : 'No'}.`; }
    if (kind === 'wait') { minutes += Number(value); detail = `Se adelantan ${value} minutos. La prueba no espera en tiempo real.`; }
    if (kind === 'plan') { plan=current.data.sale; detail='Plan '+value+' · '+plan.currency+' '+plan.price; }
    if (kind === 'charge') detail=plan?'Cobro simulado · '+plan.currency+' '+plan.price:'Falta elegir un plan.';
    if (kind === 'confirm') {
      detail=paymentConfirmed?'Abono verificado en la simulación.':'Pedido pendiente. La confirmación libera la siguiente etapa.';
      if(!paymentConfirmed) {
        steps.push({id:current.id,kind,label,detail,minutes,output:''});
        return {errors:[],paymentPending:true,steps,tags:[...tags],assigned,minutes};
      }
    }
    if (kind === 'deliver') detail='Probar entrega del enlace del plan elegido. No se envió ningún archivo.';
    if (kind === 'ai') {
      output = aiOutcome === 'handoff' ? 'handoff' : 'answered';
      detail = output === 'handoff' ? 'Simulación: se necesita un asesor.' : 'Simulación: el agente responde con la información del negocio.';
    }
    if (kind === 'reminder') { minutes += Number(value); detail = 'Sin respuesta en ' + value + ' minutos simulados.'; }
    if (kind === 'back') {
      menus.pop();
      const previous = menus.pop();
      if (!previous) return { errors: ['Todavía no hay un menú anterior.'], steps, tags: [...tags], assigned, minutes };
      steps.push({ id: current.id, kind, label, detail: 'Volver al menú anterior', minutes, output: '' });
      current = flow.nodes.find(node => node.id === previous);
      continue;
    }
    if (kind === 'tag') { tags.add(value); detail = `Etiqueta añadida: ${value}`; }
    if (kind === 'assign' || kind === 'handoff') { assigned = value; detail = `Asignado a ${value}`; }
    if (kind === 'end') detail = 'Simulación terminada. Ningún mensaje fue enviado.';
    steps.push({ id: current.id, kind, label, detail, minutes, output });
    if (kind === 'end' || kind === 'handoff') return { errors: [], steps, tags: [...tags], assigned, minutes };
    const edge = flow.edges.find(item => item.source === current.id && (item.sourceHandle || 'next') === output);
    current = flow.nodes.find(node => node.id === edge?.target);
  }
  return { errors: ['El recorrido no llega a un bloque Finalizar.'], steps: [], tags: [], assigned: '', minutes: 0 };
}

export function traversedEdgeIds(steps, edges) {
  return steps.slice(0, -1).flatMap((step, index) => edges.filter(edge => edge.source === step.id && edge.target === steps[index + 1].id && (edge.sourceHandle || 'next') === step.output).map(edge => edge.id));
}
