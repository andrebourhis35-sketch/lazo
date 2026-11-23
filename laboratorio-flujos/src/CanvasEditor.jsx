// Frame adapted from Astryx 0.7.16's canvas-editor template (Meta, MIT).
// LAZO content, workflow behavior and styling are original to this prototype.
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { HStack, VStack, Layout, LayoutHeader, LayoutPanel, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Section } from '@astryxdesign/core/Section';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap, Panel, Handle, Position, MarkerType, useNodesState, useEdgesState, useReactFlow, useUpdateNodeInternals } from '@xyflow/react';
import { ArrowLeft, Check, CheckCheck, ChevronRight, CircleCheck, Clock3, Copy, GitBranch, Layers2, Lightbulb, Maximize2, MessageCircle, Moon, MousePointer2, MoveRight, Pause, Play, Plus, RotateCcw, Save, Search, Settings2, ShieldCheck, Sun, Tag, Trash2, UserRound, Workflow, Zap } from 'lucide-react';
import { lazoTheme } from './theme.js';
import { connectFlowsServer } from './server-client.mjs';
import { BLOCKS, DRAFT_KEY, chainedWelcomeFlow, connectNodes, connectionProblem, createNode, exampleFlow, parseDraft, simulateFlow, summarizeNode, traversedEdgeIds, validateFlow } from './flow-model.mjs';

const ICONS = { trigger: Zap, message: MessageCircle, buttons: GitBranch, condition: GitBranch, wait: Clock3, reminder: Clock3, handoff: UserRound, back: ArrowLeft, tag: Tag, assign: UserRound, end: CircleCheck };
const COLORS = { trigger: 'var(--lazo-mint)', message: 'var(--lazo-sky)', buttons: 'var(--lazo-sky)', condition: 'var(--color-accent)', wait: 'var(--lazo-mint)', reminder: 'var(--lazo-mint)', handoff: 'var(--lazo-sky)', back: 'var(--lazo-sky)', tag: 'var(--lazo-sky)', assign: 'var(--lazo-mint)', end: 'var(--color-text-secondary)' };
const stroke = 'var(--lazo-stroke) solid var(--color-border)';
const styles = {
  app: { height: '100dvh', minHeight: '30rem', overflow: 'hidden', background: 'var(--color-background-surface)', color: 'var(--color-text-primary)' },
  main: { flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' },
  rail: { width: '4.5rem', flexShrink: 0, borderInlineEnd: stroke, background: 'var(--color-background-muted)' },
  brand: { width: '3rem', height: '2.25rem', objectFit: 'contain' },
  wordmark: { fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 },
  status: { color: 'var(--lazo-mint)', fontSize: '.8125rem', fontWeight: 700 },
  eyebrow: { fontSize: '.6875rem', letterSpacing: '.12em', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase' },
  canvas: { height: '100%', minHeight: 0, position: 'relative', background: 'radial-gradient(ellipse at 55% 30%, var(--lazo-glow), transparent 60%), var(--lazo-canvas)', '--xy-edge-stroke-default': 'var(--color-border-emphasized)', '--xy-edge-stroke-width-default': 2, '--xy-background-color-default': 'transparent', '--xy-controls-button-background-color-default': 'var(--color-background-surface)', '--xy-controls-button-color-default': 'var(--color-text-primary)', '--xy-controls-button-border-color-default': 'var(--color-border)', '--xy-minimap-background-color-default': 'var(--color-background-surface)', '--xy-minimap-mask-background-color-default': 'var(--lazo-glow)' },
  boardNote: { border: stroke, borderRadius: 'var(--radius-element)', background: 'var(--color-background-surface)', boxShadow: 'var(--lazo-shadow)', maxWidth: '22rem' },
  node: { width: 'var(--lazo-node-width)', border: stroke, borderRadius: 'var(--lazo-radius)', background: 'linear-gradient(145deg, var(--color-background-surface), var(--lazo-node))', boxShadow: 'var(--lazo-shadow)', position: 'relative', overflow: 'visible', transition: 'box-shadow 160ms ease, border-color 160ms ease' },
  nodeSelected: { borderColor: 'var(--color-accent)', boxShadow: 'var(--lazo-selection-shadow)' },
  nodeRun: { borderColor: 'var(--lazo-mint)', boxShadow: 'var(--lazo-selection-shadow)' },
  iconWell: { width: '2.5rem', height: '2.5rem', flexShrink: 0, borderRadius: '.75rem', border: stroke, background: 'var(--lazo-highlight)', boxShadow: 'inset 0 .0625rem 0 rgba(255,255,255,.1), 0 .25rem .6rem rgba(0,0,0,.12)' },
  nodeLabel: { fontSize: '.875rem', fontWeight: 800, lineHeight: 1.4 },
  nodeBody: { fontSize: '.8125rem', lineHeight: 1.65, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' },
  handle: { width: '.65rem', height: '.65rem', border: '.125rem solid var(--lazo-canvas)', background: 'var(--color-accent)' },
  outputLabel: { position: 'absolute', insetInlineEnd: '1rem', fontSize: '.625rem', fontWeight: 800, color: 'var(--lazo-mint)' },
  paletteRow: { width: '100%', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-element)', border: 'var(--lazo-stroke) solid transparent' },
  note: { background: 'var(--color-background-muted)', border: stroke, borderRadius: 'var(--radius-element)' },
  bubble: { padding: 'var(--spacing-4)', borderRadius: 'var(--radius-container) var(--radius-container) var(--radius-container) var(--spacing-1)', border: stroke, background: 'var(--lazo-highlight)', lineHeight: 1.8 },
  timeline: { borderInlineStart: '.125rem solid var(--color-border)', paddingInlineStart: 'var(--spacing-4)', marginInlineStart: 'var(--spacing-2)' },
};

function useMedia(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => { const media = window.matchMedia(query); const update = () => setMatches(media.matches); media.addEventListener('change', update); update(); return () => media.removeEventListener('change', update); }, [query]);
  return matches;
}

function loadInitial() {
  try { const raw = localStorage.getItem(DRAFT_KEY); if (raw) return { flow: parseDraft(raw), restored: true, issue: '' }; }
  catch { return { flow: exampleFlow(), restored: false, issue: 'No se pudo leer el borrador guardado. Se abrió el ejemplo; puedes guardarlo de nuevo.' }; }
  return { flow: exampleFlow(), restored: false, issue: '' };
}

function Pill({ children, icon: Glyph = ShieldCheck }) {
  return <HStack gap={1.5} vAlign="center" style={styles.status}><Icon icon={Glyph} size="xsm" color="inherit" /><Text size="sm" color="inherit" weight="semibold">{children}</Text></HStack>;
}

const FlowNode = memo(function FlowNode({ id, data, selected }) {
  const updateNodeInternals = useUpdateNodeInternals();
  const choiceCount = data.choices?.length;
  useEffect(() => {
    if (choiceCount) updateNodeInternals(id);
  }, [id, choiceCount, updateNodeInternals]);
  const Glyph = ICONS[data.kind];
  return <VStack padding={4} gap={3} style={{ ...styles.node, ...(selected ? styles.nodeSelected : {}), ...(data.running ? styles.nodeRun : {}) }}>
    {data.kind !== 'trigger' && <Handle type="target" position={Position.Left} style={styles.handle} />}
    <HStack gap={3} vAlign="center">
      <HStack hAlign="center" vAlign="center" style={{ ...styles.iconWell, color: COLORS[data.kind] }}><Icon icon={Glyph} size="md" color="inherit" /></HStack>
      <VStack gap={1} style={{ minWidth: 0 }}><Text style={styles.eyebrow}>{BLOCKS[data.kind].name}</Text><Text style={styles.nodeLabel}>{data.label}</Text></VStack>
      {data.running && <Icon icon={Check} size="sm" color="success" />}
    </HStack>
    <Text as="p" maxLines={3} style={styles.nodeBody}>{data.kind === 'assign' && data.assigneeLabel ? data.assigneeLabel : summarizeNode(data)}</Text>
    {data.kind === 'condition' ? <>
      <Text style={{ ...styles.outputLabel, top: '40%' }}>SÍ</Text><Handle type="source" id="yes" position={Position.Right} style={{ ...styles.handle, top: '42%', background: 'var(--lazo-mint)' }} />
      <Text style={{ ...styles.outputLabel, top: '78%', color: 'var(--color-text-secondary)' }}>NO</Text><Handle type="source" id="no" position={Position.Right} style={{ ...styles.handle, top: '80%', background: 'var(--color-text-secondary)' }} />
    </> : data.kind === 'buttons' ? data.choices.map((choice,index) => {
      const top = (35 + index * (49 / (choiceCount - 1))) + '%';
      return <Fragment key={index}><Text style={{ ...styles.outputLabel, top }}>{index + 1}</Text><Handle type="source" id={'option-' + (index + 1)} position={Position.Right} style={{ ...styles.handle, top }} aria-label={choice || 'Botón ' + (index + 1)} /></Fragment>;
    }) : !['end','handoff','back'].includes(data.kind) && <Handle type="source" id="next" position={Position.Right} style={styles.handle} />}
  </VStack>;
});
const nodeTypes = { lazo: FlowNode };

function Palette({ onAdd, count }) {
  const [query, setQuery] = useState('');
  return <VStack gap={5} padding={2}>
    <VStack gap={2}><Heading level={4}>Construye tu flujo</Heading><Text color="secondary" size="sm">Elige un bloque y conéctalo.</Text></VStack>
    <TextInput label="Buscar bloques" isLabelHidden type="search" startIcon={Search} value={query} onChange={setQuery} placeholder="Buscar un bloque…" hasClear />
    {['Entrada', 'Conversación', 'Lógica', 'Acciones'].map(group => {
      const blocks = Object.entries(BLOCKS).filter(([kind, item]) => item.group === group && (item.name + item.description).toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
      if (!blocks.length) return null;
      return <VStack key={group} gap={2}><Text style={styles.eyebrow}>{group}</Text>{blocks.map(([kind, item]) => <Button key={kind} variant="ghost" width="100%" style={{ height: 'auto', minHeight: '4rem', padding: 'var(--spacing-2)' }} label={`Añadir ${item.name}`} isDisabled={count >= 80} onClick={() => onAdd(kind)}>
        <HStack gap={3} vAlign="center" width="100%" style={{ textAlign: 'start' }}><HStack hAlign="center" vAlign="center" style={{ ...styles.iconWell, width: '2.1rem', height: '2.1rem', color: COLORS[kind] }}><Icon icon={ICONS[kind]} size="sm" color="inherit" /></HStack><VStack gap={1} style={{ flex: 1, minWidth: 0 }}><Text size="sm" weight="semibold">{item.name}</Text><Text size="sm" color="secondary" style={{ fontSize: '.75rem', fontWeight: 400, whiteSpace: 'normal', lineHeight: 1.5 }}>{item.description}</Text></VStack><Icon icon={Plus} size="xsm" color="secondary" /></HStack>
      </Button>)}</VStack>;
    })}
    {!Object.values(BLOCKS).some(item => (item.name + item.description).toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))) && <Text color="secondary" size="sm">No encontramos ese bloque.</Text>}
    <VStack padding={3} gap={2} style={styles.note}><Icon icon={Lightbulb} color="accent" size="sm" /><Text size="sm" weight="semibold">De una conversación a una acción</Text><Text size="sm" color="secondary">Arrastra desde el punto de salida de un bloque hasta el punto de entrada del siguiente.</Text></VStack>
  </VStack>;
}

function Inspector({ node, onUpdate, onDuplicate, onDelete, members, thirdButtonConnected }) {
  if (!node) return <VStack padding={4} gap={4}><Icon icon={MousePointer2} color="accent" size="lg" /><Heading level={4}>Cada bloque tiene una función</Heading><Text color="secondary">Selecciona uno en el lienzo para editar sus propiedades.</Text></VStack>;
  const { kind, label, value } = node.data;
  const field = { trigger: 'Palabra clave', condition: 'La respuesta contiene', wait: 'Tiempo en minutos', reminder: 'Minutos sin respuesta', tag: 'Nombre de la etiqueta', assign: 'Equipo o asesor' }[kind];
  return <VStack gap={5} padding={4}>
    <HStack gap={3} vAlign="center"><HStack hAlign="center" vAlign="center" style={{ ...styles.iconWell, color: COLORS[kind] }}><Icon icon={ICONS[kind]} color="inherit" size="md" /></HStack><VStack gap={1}><Text style={styles.eyebrow}>Propiedades</Text><Heading level={4}>{BLOCKS[kind].name}</Heading></VStack></HStack>
    <TextInput label="Nombre del bloque" value={label} onChange={next => onUpdate({ label: next.slice(0, 90) })} />
    {kind === 'message' ? <VStack gap={3}><TextArea label="Contenido del mensaje" value={value} onChange={next => onUpdate({ value: next.slice(0, 2000) })} rows={6} maxLength={2000} description="Personaliza el texto con el nombre del contacto." /><Button label="Insertar nombre del contacto" variant="secondary" size="sm" onClick={() => onUpdate({ value: (value + ' {{nombre}}').slice(0, 2000) })}>{'{{nombre}}'}</Button></VStack> : ['assign','handoff'].includes(kind) && members ? <VStack gap={2}><Text weight="semibold">Responsable de la empresa</Text>{members.map(member => <Button key={member.id} label={member.name} variant={value === member.id ? 'primary' : 'secondary'} onClick={() => onUpdate({ value: member.id })} />)}</VStack> : field && <TextInput label={field} value={value} inputMode={['wait','reminder'].includes(kind) ? 'numeric' : 'text'} onChange={next => onUpdate({ value: next.slice(0, kind === 'wait' ? 5 : 100) })} description={kind === 'trigger' ? 'La activación real requiere una palabra clave.' : kind === 'condition' ? 'La comparación ignora mayúsculas y tildes.' : kind === 'wait' ? 'De 1 a 10080 minutos. En la prueba, el reloj avanza al instante.' : undefined} />}
    {kind === 'message' && <VStack gap={3}><Text style={styles.eyebrow}>Así lo verá el contacto</Text><VStack gap={2} style={styles.bubble}><Text as="p" size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{value.replaceAll('{{nombre}}', 'Lucía') || 'Tu mensaje aparecerá aquí.'}</Text><HStack hAlign="end" gap={1} vAlign="center"><Text size="sm" color="secondary">Vista previa</Text><Icon icon={CheckCheck} size="xsm" color="accent" /></HStack></VStack></VStack>}
    {kind === 'reminder' && <Text size="sm" color="secondary">Conecta este bloque a un mensaje. Si el cliente responde, compra o interviene un asesor, el seguimiento se cancela.</Text>}
    {kind === 'handoff' && <Text size="sm" color="secondary">El asesor recibe el chat. Puede reanudar la automatización desde la conversación.</Text>}
    {kind === 'back' && <Text size="sm" color="secondary">Conecta la opción «Volver» de un submenú a este bloque.</Text>}
    {kind === 'buttons' && <VStack gap={3}>
      <TextArea label="Mensaje de bienvenida" rows={4} value={value} maxLength={1024} onChange={next => onUpdate({ value: next.slice(0, 1024) })} />
      {node.data.choices.map((choice,index) => <TextInput key={index} label={'Botón ' + (index + 1)} value={choice} onChange={next => onUpdate({ choices: node.data.choices.map((item,i) => i === index ? next.slice(0,20) : item) })} />)}
      {node.data.choices.length === 2
        ? <Button label="Añadir tercer botón" variant="secondary" onClick={() => onUpdate({ choices: [...node.data.choices, ''] })} />
        : <Button label="Quitar tercer botón" variant="secondary" isDisabled={thirdButtonConnected} onClick={() => onUpdate({ choices: node.data.choices.slice(0, 2) })} />}
      {thirdButtonConnected && <Text size="sm" color="secondary">Para quitar el tercer botón, desconecta primero su salida.</Text>}
      <Text size="sm" color="secondary">Conecta cada salida numerada. El flujo esperará hasta 24 horas a que el contacto toque un botón.</Text>
    </VStack>}
    {kind === 'condition' && <VStack padding={3} gap={3} style={styles.note}><Pill icon={GitBranch}>Dos caminos posibles</Pill><Text size="sm" color="secondary">Sí: el texto contiene la expresión indicada. No: continúa por la otra salida.</Text></VStack>}
    {kind === 'end' && <Text color="secondary" size="sm">El recorrido termina aquí. Este bloque no necesita una salida.</Text>}
    <VStack gap={2} style={{ borderBlockStart: stroke, paddingBlockStart: 'var(--spacing-4)' }}><Button label="Duplicar bloque" icon={<Icon icon={Copy} size="sm" />} onClick={onDuplicate} /><Button label="Eliminar bloque" variant="ghost" icon={<Icon icon={Trash2} size="sm" />} onClick={onDelete} /></VStack>
    <Text size="sm" color="secondary">Los cambios se reflejan en el lienzo. Usa Guardar borrador para conservarlos en este navegador.</Text>
  </VStack>;
}

function Simulation({ flow, onPath }) {
  const [name, setName] = useState('Lucía');
  const [incoming, setIncoming] = useState('Hola, quiero información');
  const menus = flow.nodes.filter(node => node.data.kind === 'buttons');
  const choices = menus[0]?.data.choices;
  const [answer, setAnswer] = useState(choices ? '' : 'Quiero ver el catálogo');
  const [result, setResult] = useState(null);
  const run = (selection = answer) => { const next = simulateFlow(flow, { name, incoming, answer: selection }); setResult(next); onPath(next.steps); };
  const play = () => { if (choices) { setAnswer(''); run(''); } else run(); };
  return <VStack padding={4} gap={5}>
    <VStack padding={3} gap={2} style={styles.note}><Pill>Prueba local con datos ficticios</Pill><Text size="sm" color="secondary">No usa tu WhatsApp ni envía mensajes. Las esperas se adelantan y las acciones se muestran en este recorrido.</Text></VStack>
    <TextInput label="Nombre del contacto de prueba" value={name} onChange={v => setName(v.slice(0, 80))} />
    <TextInput label="Mensaje que inicia el flujo" value={incoming} onChange={v => setIncoming(v.slice(0, 500))} />
    {!choices && <TextInput label="Respuesta del contacto" value={answer} onChange={v => setAnswer(v.slice(0,500))} />}
    <Button label={result ? 'Reiniciar simulación' : 'Iniciar simulación'} variant="primary" icon={<Icon icon={result ? RotateCcw : Play} size="sm" />} onClick={play} />
    {result?.waiting && <VStack gap={2}>
      <Text weight="semibold">Elige una opción del menú</Text>
      <HStack gap={2} wrap="wrap">{result.waiting.map(choice => <Button key={choice} label={choice} onClick={() => {
        const next = [answer, choice].filter(Boolean).join('\n');
        setAnswer(next);
        run(next);
      }} />)}</HStack>
    </VStack>}
    {result?.errors.length > 0 && <VStack gap={2} role="alert"><Heading level={4}>Revisa el flujo</Heading>{result.errors.map(error => <Text as="p" size="sm" key={error}>{error}</Text>)}</VStack>}
    {result && !result.errors.length && <VStack gap={4} aria-live="polite"><HStack vAlign="center" hAlign="between"><Heading level={4}>{result.waiting ? 'Esperando una opción' : 'Recorrido completado'}</Heading><Pill icon={Check}>{result.steps.length} pasos</Pill></HStack><VStack gap={5} style={styles.timeline}>{result.steps.map((step, index) => <VStack gap={2} key={step.id}><HStack gap={2} vAlign="center"><Icon icon={ICONS[step.kind]} size="sm" color="accent" /><Text weight="semibold" size="sm">{step.label}</Text><Text size="sm" color="secondary">+{step.minutes} min</Text></HStack><Text as="p" size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }} color={step.kind === 'message' ? 'primary' : 'secondary'}>{step.detail}</Text></VStack>)}</VStack>{result.tags.length > 0 && <Text size="sm">Etiquetas: {result.tags.join(', ')}</Text>}{result.assigned && <Text size="sm">Responsable: {result.assigned}</Text>}</VStack>}
  </VStack>;
}

function Editor() {
  const initial = useRef(null); if (!initial.current) initial.current = loadInitial();
  const [nodes, setNodes, applyNodes] = useNodesState(initial.current.flow.nodes);
  const [edges, setEdges, applyEdges] = useEdgesState(initial.current.flow.edges);
  const [name, setName] = useState(initial.current.flow.name);
  const [selectedId, setSelectedId] = useState('bienvenida');
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState(initial.current.issue || (initial.current.restored ? 'Borrador recuperado de este navegador.' : 'Ejemplo listo para explorar.'));
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('lazo.lab.theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } });
  const [panel, setPanel] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [path, setPath] = useState([]);
  const [isRestoreConfirm, setRestoreConfirm] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [serverDoc, setServerDoc] = useState(null);
  const [serverLoading, setServerLoading] = useState(true);
  const [serverBusy, setServerBusy] = useState(false);
  const [savedFlows, setSavedFlows] = useState([]);
  const [runHistory, setRunHistory] = useState([]);
  const editEpoch = useRef(0);
  const compact = useMedia('(max-width: 1199px)');
  const mobile = useMedia('(max-width: 719px)');
  const prefersReduced = useMedia('(prefers-reduced-motion: reduce)');
  const [still, setStill] = useState(false);
  const motion = !(still || prefersReduced);
  const api = useReactFlow();
  const flow = useMemo(() => ({ version: 1, name, nodes, edges }), [name, nodes, edges]);
  const issues = useMemo(() => validateFlow(flow), [flow]);
  const selected = nodes.find(node => node.id === selectedId);
  const mutate = () => { editEpoch.current++; setDirty(true); setPath([]); };
  const onNodesChange = useCallback(changes => { const events = changes.toArray(); applyNodes(changes); setSelectedId(previous => { const picked = events.find(change => change.type === 'select' && change.selected); return picked ? picked.id : events.some(change => change.type === 'select' && !change.selected && change.id === previous) ? null : previous; }); if (events.some(change => ['position', 'remove', 'add'].includes(change.type))) { editEpoch.current++; setDirty(true); setPath([]); } }, [applyNodes]);
  const onEdgesChange = useCallback(changes => { const events = changes.toArray(); applyEdges(changes); if (events.some(change => change.type !== 'select')) { editEpoch.current++; setDirty(true); setPath([]); } }, [applyEdges]);
  function showDocument(doc) { const next=parseDraft(JSON.stringify(doc.graph));setNodes(next.nodes);setEdges(next.edges);setName(next.name);setServerDoc(doc);setDirty(false);setPath([]);setSelectedId(next.nodes[1]?.id||null);editEpoch.current++; }
  useEffect(() => {
    let cancelled=false;
    connectFlowsServer().then(info=>{
      if(cancelled)return;setServerInfo(info);setSavedFlows(info.flows);
      if(editEpoch.current===0) { if(info.flows.length)showDocument(info.flows.find(item=>item.active)||info.flows[0]);else {const next=chainedWelcomeFlow();setNodes(next.nodes);setEdges(next.edges);setName(next.name);setSelectedId(next.nodes[1].id);} }
      setStatus(`Conectado a ${info.identity.company.name}. Guarda el borrador antes de activar.`);
    }).catch(error=>{if(!cancelled)setStatus(error.message);}).finally(()=>{if(!cancelled)setServerLoading(false);});
    return ()=>{cancelled=true;};
  }, []);
  function serverFailure(error) {setStatus(error.message);if(error.contextChanged){setServerInfo(null);setServerDoc(null);setSavedFlows([]);setRunHistory([]);const next=exampleFlow();setNodes(next.nodes);setEdges(next.edges);setName(next.name);setDirty(false);setStatus('La sesión o empresa cambió. Recarga esta página para confirmar tu acceso.');}}
  async function saveServer() {
    if(serverBusy)return;
    if(!serverInfo)return saveLocal();
    setServerBusy(true);const epoch=editEpoch.current;
    try {const graph=parseDraft(JSON.stringify(flow));const result=await serverInfo.request(serverDoc?'/flows/'+serverDoc.id:'/flows',serverDoc?'PUT':'POST',{graph,revision:serverDoc?.revision});setServerDoc(result);setSavedFlows(current=>[result,...current.filter(item=>item.id!==result.id)]);setDirty(editEpoch.current!==epoch);setStatus(`Borrador guardado en ${serverInfo.identity.company.name}. ${result.active?'La versión activa sigue funcionando.':'Todavía no está activo.'}`);}catch(error){serverFailure(error);}finally{setServerBusy(false);}
  }
  async function activation(action) {
    if(!serverInfo||!serverDoc||serverBusy)return;
    if(action==='activate'&&dirty)return setStatus('Guarda los cambios antes de activar la nueva versión.');
    setServerBusy(true);
    try{const result=await serverInfo.request('/flows/'+serverDoc.id+'/'+action,'POST',{revision:serverDoc.revision});setServerDoc(result);setSavedFlows(current=>[result,...current.filter(item=>item.id!==result.id)]);setStatus(action==='pause'?'Flujo pausado. No iniciará nuevas ejecuciones.':'Flujo activo para los nuevos mensajes de la cuenta de prueba.');}catch(error){serverFailure(error);}finally{setServerBusy(false);}
  }
  async function openSaved() {if(!serverInfo||serverBusy)return;setServerBusy(true);try{const result=await serverInfo.request('/flows');setSavedFlows(result.flows);setPanel('saved');}catch(error){serverFailure(error);}finally{setServerBusy(false);}}
  async function openHistory() {if(!serverInfo||!serverDoc||serverBusy)return;setServerBusy(true);try{const result=await serverInfo.request('/flows/'+serverDoc.id+'/runs');setRunHistory(result.runs);setPanel('history');}catch(error){serverFailure(error);}finally{setServerBusy(false);}}
  function newServerFlow() {if(dirty||serverBusy)return setStatus('Guarda el borrador actual antes de crear otro.');const graph=chainedWelcomeFlow();showDocument({graph});setServerDoc(null);setDirty(true);setPanel('');setStatus('Nueva bienvenida preparada. Guarda y revisa el texto antes de activarla.');}
  useEffect(() => { const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  useEffect(() => { if (!compact && ['palette', 'inspector'].includes(panel)) setPanel(''); }, [compact, panel]);
  const update = patch => { setNodes(current => current.map(node => node.id === selectedId ? { ...node, data: { ...node.data, ...patch } } : node)); mutate(); };
  const add = kind => {
    if (nodes.length >= 80) return setStatus('El laboratorio admite hasta 80 bloques.');
    if (kind === 'trigger' && nodes.some(node => node.data.kind === 'trigger')) return setStatus('Ya hay un Inicio. Selecciónalo para cambiar su palabra clave.');
    const position = api.screenToFlowPosition({ x: window.innerWidth * (compact ? .45 : .52), y: window.innerHeight * .46 });
    const node = createNode(kind, crypto.randomUUID(), position);
    setNodes(current => [...current.map(item => ({ ...item, selected: false })), { ...node, selected: true }]);
    setSelectedId(node.id); mutate(); setPanel(compact ? 'inspector' : ''); setStatus(`${BLOCKS[kind].name} añadido. Conecta sus puntos para incluirlo en el recorrido.`);
  };
  const duplicate = () => { if (!selected || nodes.length >= 80) return; if (selected.data.kind === 'trigger') return setStatus('El flujo admite un solo Inicio.'); const node = { ...selected, id: crypto.randomUUID(), position: { x: selected.position.x + 35, y: selected.position.y + 150 }, data: { ...selected.data, label: `${selected.data.label.slice(0, 80)} (copia)` }, selected: true }; setNodes(current => [...current.map(item => ({ ...item, selected: false })), node]); setSelectedId(node.id); mutate(); setStatus('Bloque duplicado. Conéctalo para usarlo.'); };
  const remove = () => { if (!selected) return; setNodes(current => current.filter(node => node.id !== selectedId)); setEdges(current => current.filter(edge => edge.source !== selectedId && edge.target !== selectedId)); setSelectedId(null); mutate(); setStatus('Bloque eliminado del borrador.'); };
  const saveLocal = () => { try { const clean = parseDraft(JSON.stringify(flow)); localStorage.setItem(DRAFT_KEY, JSON.stringify(clean)); setDirty(false); setStatus(issues.length ? 'Borrador guardado en este navegador. Completa las conexiones antes de simular.' : 'Borrador guardado en este navegador.'); } catch { setStatus('No se pudo guardar. Comprueba el espacio o los permisos de almacenamiento del navegador.'); } };
  const restore = () => { const next = exampleFlow(); setNodes(next.nodes); setEdges(next.edges); setName(next.name); setSelectedId('bienvenida'); setRestoreConfirm(false); mutate(); setStatus('Ejemplo restaurado. Guarda para reemplazar el borrador anterior.'); requestAnimationFrame(() => api.fitView({ padding: '12%', duration: motion ? 250 : 0 })); };
  const onConnect = connection => { try { const next = connectNodes(connection, nodes, edges); setEdges(next); mutate(); setStatus('Conexión creada. Cada salida tiene un único destino.'); } catch (error) { setStatus(error.message); } };
  const showSimulation = () => { try { setSnapshot(parseDraft(JSON.stringify(flow))); setPath([]); setPanel('simulation'); } catch { setStatus('No se puede simular este borrador. Reduce su tamaño o mueve los bloques más cerca del inicio.'); } };
  const changeMode = () => { const next = mode === 'dark' ? 'light' : 'dark'; setMode(next); try { localStorage.setItem('lazo.lab.theme', next); } catch { /* La apariencia de esta sesión sigue funcionando. */ } };
  const renderedNodes = useMemo(() => nodes.map(node => ({ ...node, selected: node.id === selectedId, data: { ...node.data, assigneeLabel:serverInfo?.members.find(member=>member.id===node.data.value)?.name, running: path.some(step => step.id === node.id) } })), [nodes, selectedId, path,serverInfo]);
  const renderedEdges = useMemo(() => { const visited = new Set(traversedEdgeIds(path, edges)); return edges.map(edge => ({ ...edge, animated: motion, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: visited.has(edge.id) ? 'var(--lazo-mint)' : 'var(--color-border-emphasized)' } })); }, [edges, motion, path]);
  const palette = <Palette onAdd={add} count={nodes.length} />;
  const inspector = <Inspector node={selected} onUpdate={update} onDuplicate={duplicate} onDelete={remove} members={serverInfo?.members} thirdButtonConnected={edges.some(edge => edge.source === selectedId && edge.sourceHandle === 'option-3')} />;
  const selectNode = (_, node) => { setSelectedId(node.id); if (compact) setPanel('inspector'); };

  return <Theme theme={lazoTheme} mode={mode}><VStack style={styles.app} gap={0}>
    <HStack paddingInline={mobile ? 3 : 5} paddingBlock={3} vAlign="center" hAlign="between" gap={3} style={{ borderBlockEnd: stroke, flexShrink: 0 }}>
      <HStack gap={3} vAlign="center"><img src="./marca.svg" alt="" style={styles.brand} /><Text style={styles.wordmark}>lazo</Text>{!mobile && <Text color="secondary" size="sm" style={{ borderInlineStart: stroke, paddingInlineStart: 'var(--spacing-3)' }}>Estudio de automatizaciones</Text>}</HStack>
      <HStack gap={2} vAlign="center">{!mobile && <Pill>{serverInfo?'Conectado a tu empresa':'Simulación local'}</Pill>}<IconButton label={mode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} variant="ghost" icon={<Icon icon={mode === 'dark' ? Sun : Moon} size="sm" />} onClick={changeMode} /><Button label="Abrir CRM" variant="ghost" size="sm" href="https://lazo.espacio-sereno.com/app/" target="_blank" rel="noopener noreferrer" icon={<Icon icon={ArrowLeft} size="sm" />} /></HStack>
    </HStack>
    <HStack gap={0} style={styles.main}>
      {!mobile && <VStack as="nav" aria-label="Navegación del laboratorio" padding={2} gap={3} hAlign="center" vAlign="between" style={styles.rail}><VStack gap={3} hAlign="center"><IconButton label="Editor de flujos" variant="primary" icon={<Icon icon={Workflow} size="md" />} onClick={() => setPanel('')} /><IconButton label="Biblioteca de bloques" variant="ghost" icon={<Icon icon={Layers2} size="md" />} onClick={() => setPanel('palette')} /><IconButton label="Simular el recorrido" variant="ghost" icon={<Icon icon={Play} size="md" />} onClick={showSimulation} /></VStack><Icon icon={ShieldCheck} size="md" color="secondary" /></VStack>}
      <VStack style={styles.main} gap={0}><Layout height="fill" padding={0} header={<LayoutHeader hasDivider padding={0}><VStack paddingInline={mobile ? 3 : 5} paddingBlock={4} gap={4}>
        <HStack gap={2} vAlign="center"><Text style={styles.eyebrow}>Automatizaciones</Text><Icon icon={ChevronRight} color="secondary" size="xsm" /><Text style={styles.eyebrow}>Editor de flujos</Text></HStack>
        <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap"><VStack gap={2} style={{ minWidth: mobile ? '100%' : 0, flex: 1 }}><Heading level={2} style={{ fontSize: mobile ? '1.25rem' : '1.625rem', lineHeight: 1.35 }}>Diseña conexiones que avanzan.</Heading><Text color="secondary" size="sm">Una conversación. Diferentes caminos. Todo en un mismo lienzo.</Text></VStack><HStack gap={2} vAlign="center"><Button label={serverInfo ? "Guardar en servidor" : "Guardar borrador local"} isDisabled={serverBusy || serverLoading} size={mobile ? 'sm' : 'md'} icon={<Icon icon={Save} size="sm" />} onClick={saveServer} /><Button label="Probar flujo" size={mobile ? 'sm' : 'md'} variant="primary" icon={<Icon icon={Play} size="sm" />} onClick={showSimulation} /></HStack></HStack>
        {serverInfo && <HStack gap={2} wrap="wrap" vAlign="center"><Pill icon={serverDoc?.active ? Zap : Pause}>{serverDoc?.active ? `Activo · versión ${serverDoc.publishedRevision}` : 'Sin activar'}</Pill><Button label="Mis flujos" size="sm" onClick={openSaved} isDisabled={serverBusy} /><Button label="Nuevo flujo" size="sm" onClick={newServerFlow} isDisabled={serverBusy || dirty} /><Button label="Activar versión guardada" size="sm" variant="primary" onClick={()=>activation('activate')} isDisabled={serverBusy || !serverDoc || dirty || (serverDoc.active && serverDoc.publishedRevision === serverDoc.revision)} />{serverDoc?.active && <Button label="Pausar flujo" size="sm" onClick={()=>activation('pause')} isDisabled={serverBusy} />}<Button label="Historial de ejecuciones" size="sm" onClick={openHistory} isDisabled={serverBusy || !serverDoc} /><Text size="sm" color="secondary">Cuenta de prueba · Una bienvenida por minuto y contacto</Text></HStack>}
      </VStack></LayoutHeader>} footer={<LayoutFooter hasDivider padding={2}><HStack hAlign="between" vAlign="center" gap={3} wrap="wrap"><Text size="sm" role="status" aria-live="polite" style={{ fontSize: '.75rem' }}>{status}</Text><Text size="sm" color="secondary" style={{ fontSize: '.75rem' }}>{dirty ? 'Cambios sin guardar' : serverInfo ? 'Empresa: '+serverInfo.identity.company.name : 'Solo en este navegador'} · {nodes.length} bloques · {edges.length} conexiones</Text></HStack></LayoutFooter>}>
        <LayoutContent padding={0} isScrollable={false}><Layout height="fill" padding={0} start={!compact ? <LayoutPanel width="var(--lazo-palette-width)" hasDivider padding={2} label="Biblioteca de bloques">{palette}</LayoutPanel> : undefined} end={!compact ? <LayoutPanel width="var(--lazo-inspector-width)" hasDivider padding={0} label="Propiedades del bloque">{inspector}</LayoutPanel> : undefined}>
          <LayoutContent padding={0} isScrollable={false}><VStack style={styles.canvas} gap={0}>
            <ReactFlow nodes={renderedNodes} edges={renderedEdges} nodeTypes={nodeTypes} style={{ background: 'transparent' }} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} isValidConnection={connection => !connectionProblem(connection, nodes, edges)} onNodeClick={selectNode} onPaneClick={() => setSelectedId(null)} defaultViewport={{ x: 20, y: 135, zoom: .9 }} nodeExtent={[[-10000, -10000], [10000, 10000]]} multiSelectionKeyCode={null} minZoom={.25} maxZoom={1.6} forceColorMode={mode} deleteKeyCode={['Backspace', 'Delete']} onNodesDelete={deleted => { if (deleted.some(node => node.id === selectedId)) setSelectedId(null); }} proOptions={{ hideAttribution: true }} ariaLabelConfig={{ 'controls.zoomIn.ariaLabel': 'Acercar el lienzo', 'controls.zoomOut.ariaLabel': 'Alejar el lienzo', 'controls.fitView.ariaLabel': 'Ajustar todo el flujo', 'controls.interactive.ariaLabel': 'Bloquear o desbloquear el lienzo', 'minimap.ariaLabel': 'Mapa del flujo' }}>
              <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--lazo-dot)" style={{ background: 'transparent' }} />
              <Controls showInteractive={false} position="bottom-left" />
              {!mobile && <MiniMap nodeColor={node => COLORS[node.data.kind]} nodeStrokeColor="var(--color-border)" pannable zoomable position="bottom-right" style={{ width: '9rem', height: '5.5rem', border: stroke, borderRadius: 'var(--radius-element)', overflow: 'hidden' }} />}
              <Panel position="top-left"><VStack gap={3} padding={3} style={styles.boardNote}>
                <HStack gap={2} vAlign="center"><Icon icon={Workflow} size="sm" color="accent" /><Text size="sm" weight="bold">Tu primer flujo</Text><Text size="sm" color="secondary">· Borrador</Text></HStack>
                <TextInput label="Nombre del flujo" isLabelHidden value={name} onChange={next => { setName(next.slice(0, 100)); mutate(); }} width={mobile ? '12rem' : '18rem'} size="sm" />
                <HStack gap={2} vAlign="center"><Pill icon={issues.length ? Settings2 : CircleCheck}>{issues.length ? `${issues.length} ajustes pendientes` : 'Listo para simular'}</Pill></HStack>
              </VStack></Panel>
              <Panel position="top-right"><VStack gap={2}><IconButton label="Ver todo el flujo" icon={<Icon icon={Maximize2} size="sm" />} onClick={() => api.fitView({ padding: '12%', duration: motion ? 300 : 0 })} /><IconButton label={motion ? 'Reducir animaciones' : 'Activar animaciones'} icon={<Icon icon={motion ? Pause : Play} size="sm" />} onClick={() => setStill(current => !current)} /><IconButton label="Restaurar ejemplo" icon={<Icon icon={RotateCcw} size="sm" />} onClick={() => setRestoreConfirm(true)} />{compact && <><IconButton label="Abrir biblioteca de bloques" icon={<Icon icon={Plus} size="sm" />} onClick={() => setPanel('palette')} /><IconButton label="Abrir propiedades" icon={<Icon icon={Settings2} size="sm" />} onClick={() => setPanel('inspector')} /></>}</VStack></Panel>
              <Panel position="bottom-center"><HStack gap={2} padding={2} style={styles.boardNote}><Icon icon={MoveRight} size="sm" color="secondary" /><Text size="sm" color="secondary" style={{ fontSize: '.75rem' }}>Mueve los bloques · Conecta los puntos · Prueba tu recorrido</Text></HStack></Panel>
            </ReactFlow>
          </VStack></LayoutContent>
        </Layout></LayoutContent>
      </Layout></VStack>
    </HStack>
    <Drawer isOpen={panel === 'palette'} onOpenChange={open => !open && setPanel('')} label="Biblioteca de bloques" side="start" width="20rem" padding={0}><Layout height="fill" header={<LayoutHeader padding={3}><DrawerHeader title="Bloques del flujo" onOpenChange={() => setPanel('')} /></LayoutHeader>}><LayoutContent padding={3}>{palette}</LayoutContent></Layout></Drawer>
    <Drawer isOpen={panel === 'inspector'} onOpenChange={open => !open && setPanel('')} label="Propiedades del bloque" width="22rem" padding={0}><Layout height="fill" header={<LayoutHeader padding={3}><DrawerHeader title="Configurar bloque" onOpenChange={() => setPanel('')} /></LayoutHeader>}><LayoutContent padding={0}>{inspector}</LayoutContent></Layout></Drawer>
    <Drawer isOpen={panel === 'simulation'} onOpenChange={open => !open && setPanel('')} label="Simular el flujo" width="30rem" padding={0}><Layout height="fill" header={<LayoutHeader padding={4} hasDivider><DrawerHeader title="Prueba tu conversación" subtitle="Una vista previa de cómo avanza el flujo" onOpenChange={() => setPanel('')} /></LayoutHeader>}><LayoutContent padding={0}>{snapshot && <Simulation key={snapshot.name + JSON.stringify(snapshot.nodes)} flow={snapshot} onPath={setPath} />}</LayoutContent></Layout></Drawer>
    <Drawer isOpen={panel === 'saved'} onOpenChange={open=>!open&&setPanel('')} label="Flujos guardados" width="26rem"><VStack gap={4}><DrawerHeader title="Flujos de tu empresa" onOpenChange={()=>setPanel('')} />{savedFlows.length ? savedFlows.map(doc=><Button key={doc.id} label={doc.graph.name+(doc.active?' · Activo':' · Pausado')} isDisabled={dirty || serverBusy} onClick={()=>{showDocument(doc);setPanel('');setStatus('Borrador recuperado del servidor.');}} />):<Text>Todavía no guardaste ningún flujo.</Text>}{dirty&&<Text>Guarda los cambios actuales antes de abrir otro flujo.</Text>}</VStack></Drawer>
    <Drawer isOpen={panel === 'history'} onOpenChange={open=>!open&&setPanel('')} label="Historial de ejecuciones" width="28rem"><VStack gap={4}><DrawerHeader title="Últimas ejecuciones" subtitle="El mensaje aceptado se comprueba como entregado en Conversaciones." onOpenChange={()=>setPanel('')} />{runHistory.length ? runHistory.map(run=><VStack key={run.id} gap={2} padding={3} style={styles.note}><Text weight="semibold">{({pending:'En cola',running:'En ejecución',waiting:'Esperando una opción',scheduled:'Seguimiento programado',done:'Recorrido completado',failed:'Detenido por un error',cancelled:'Cancelado',interrupted:'Interrumpido; revisar antes de repetir'})[run.state]||run.state}</Text><Text size="sm" color="secondary">{new Date(run.created).toLocaleString('es-PE')}</Text>{run.reason&&<Text size="sm">{run.reason}</Text>}</VStack>):<Text>Aquí aparecerán las ejecuciones de mensajes nuevos que coincidan con la palabra clave.</Text>}</VStack></Drawer>
    <Drawer isOpen={isRestoreConfirm} onOpenChange={setRestoreConfirm} label="Restaurar ejemplo" width="24rem"><VStack gap={5}><DrawerHeader title="¿Volver al ejemplo inicial?" onOpenChange={setRestoreConfirm} /><Text>Reemplazará lo que ves en el lienzo. Tu borrador guardado se conserva hasta que vuelvas a guardar.</Text><Button label="Restaurar ejemplo inicial" onClick={restore} /><Button label="Seguir editando" variant="ghost" onClick={() => setRestoreConfirm(false)} /></VStack></Drawer>
  </VStack></Theme>;
}

export default function CanvasEditor() { return <ReactFlowProvider><Editor /></ReactFlowProvider>; }
