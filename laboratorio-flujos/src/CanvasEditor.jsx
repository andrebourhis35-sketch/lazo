// Frame adapted from Astryx 0.7.16's canvas-editor template (Meta, MIT).
// LAZO content, workflow behavior and styling are original to this prototype.
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { HStack, VStack, Layout, LayoutHeader, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Section } from '@astryxdesign/core/Section';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap, Panel, BaseEdge, EdgeLabelRenderer, getSmoothStepPath, Handle, Position, MarkerType, useNodesState, useEdgesState, useReactFlow, useUpdateNodeInternals } from '@xyflow/react';
import { ArrowLeft, CircleDollarSign, PackageCheck, ShoppingBag, Check, CheckCheck, CircleCheck, Clock3, Copy, GitBranch, Lightbulb, Maximize2, MessageCircle, Moon, MousePointer2, Pause, Play, Plus, RotateCcw, Save, Search, Settings2, ShieldCheck, Sun, Tag, Trash2, UserRound, Zap } from 'lucide-react';
import { lazoTheme } from './theme.js';
import { connectFlowsServer } from './server-client.mjs';
import {readWorkspaceTheme,saveWorkspaceTheme,themeKey} from '../../app-crm/public/workspace-theme.js';
import { BLOCKS, DRAFT_KEY, chainedWelcomeFlow, connectNodes, connectionProblem, createNode, digitalSaleFlow, exampleFlow, outputsFor, parseDraft, simulateFlow, summarizeNode, traversedEdgeIds, validateFlow } from './flow-model.mjs';

const ICONS = { trigger: Zap, message: MessageCircle, plan: ShoppingBag, charge: CircleDollarSign, confirm: ShieldCheck, deliver: PackageCheck, ai: Lightbulb, buttons: GitBranch, condition: GitBranch, wait: Clock3, reminder: Clock3, handoff: UserRound, back: ArrowLeft, tag: Tag, assign: UserRound, end: CircleCheck };
const COLORS = { trigger: 'var(--lazo-mint)', message: 'var(--lazo-sky)', plan: 'var(--lazo-mint)', charge: 'var(--lazo-mint)', confirm: 'var(--lazo-sky)', deliver: 'var(--lazo-sky)', ai: 'var(--lazo-mint)', buttons: 'var(--lazo-sky)', condition: 'var(--color-accent)', wait: 'var(--lazo-mint)', reminder: 'var(--lazo-mint)', handoff: 'var(--lazo-sky)', back: 'var(--lazo-sky)', tag: 'var(--lazo-sky)', assign: 'var(--lazo-mint)', end: 'var(--color-text-secondary)' };
const stroke = 'var(--lazo-stroke) solid var(--color-border)';
const styles = {
  app: { height: '100dvh', minHeight: '30rem', overflow: 'hidden', background: 'var(--color-background-surface)', color: 'var(--color-text-primary)' },
  main: { flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' },
  brand: { width: '3rem', height: '2.25rem', objectFit: 'contain' },
  wordmark: { fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 },
  status: { color: 'var(--lazo-mint)', fontSize: '.8125rem', fontWeight: 700 },
  eyebrow: { fontSize: '.6875rem', letterSpacing: '.12em', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase' },
  canvas: { height: '100%', minHeight: 0, position: 'relative', background: 'radial-gradient(ellipse at 55% 30%, var(--lazo-glow), transparent 60%), var(--lazo-canvas)', '--xy-edge-stroke-default': 'var(--color-border-emphasized)', '--xy-edge-stroke-width-default': 2, '--xy-background-color-default': 'transparent', '--xy-controls-button-background-color-default': 'var(--color-background-surface)', '--xy-controls-button-color-default': 'var(--color-text-primary)', '--xy-controls-button-border-color-default': 'var(--color-border)', '--xy-minimap-background-color-default': 'var(--color-background-surface)', '--xy-minimap-mask-background-color-default': 'var(--lazo-glow)' },
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
  return <VStack padding={4} gap={3} style={{ ...styles.node, ...(selected ? styles.nodeSelected : {}), ...(data.running ? styles.nodeRun : {}), ...(data.stopped ? {outline:'2px solid var(--color-text-danger, var(--color-text-primary))'} : {}) }}>
    {data.kind !== 'trigger' && <Handle type="target" position={Position.Left} style={styles.handle} />}
    <HStack gap={3} vAlign="center">
      <HStack hAlign="center" vAlign="center" style={{ ...styles.iconWell, color: COLORS[data.kind] }}><Icon icon={Glyph} size="md" color="inherit" /></HStack>
      <VStack gap={1} style={{ minWidth: 0 }}><Text style={styles.eyebrow}>{BLOCKS[data.kind].name}</Text><Text style={styles.nodeLabel}>{data.label}</Text></VStack>
      {data.running && <Icon icon={Check} size="sm" color="success" />}
      {data.stopped && <Text size="sm" weight="semibold">Revisar</Text>}
    </HStack>
    <Text as="p" maxLines={3} style={styles.nodeBody}>{data.kind === 'assign' && data.assigneeLabel ? data.assigneeLabel : summarizeNode(data)}</Text>
    {data.kind === 'condition' ? <>
      <Text style={{ ...styles.outputLabel, top: '40%' }}>SÍ</Text><Handle type="source" id="yes" position={Position.Right} style={{ ...styles.handle, top: '42%', background: 'var(--lazo-mint)' }} />
      <Text style={{ ...styles.outputLabel, top: '78%', color: 'var(--color-text-secondary)' }}>NO</Text><Handle type="source" id="no" position={Position.Right} style={{ ...styles.handle, top: '80%', background: 'var(--color-text-secondary)' }} />
    </> : data.kind === 'ai' ? <>
      <Text style={{ ...styles.outputLabel, top: '38%' }}>RESPONDIÓ</Text>
      <Handle type="source" id="answered" position={Position.Right} style={{ ...styles.handle, top: '42%' }} />
      <Text style={{ ...styles.outputLabel, top: '76%' }}>ASESOR</Text>
      <Handle type="source" id="handoff" position={Position.Right} style={{ ...styles.handle, top: '80%' }} />
    </> : data.kind === 'buttons' ? data.choices.map((choice,index) => {
      const top = (35 + index * (49 / (choiceCount - 1))) + '%';
      return <Fragment key={index}><Text style={{ ...styles.outputLabel, top }}>{index + 1}</Text><Handle type="source" id={'option-' + (index + 1)} position={Position.Right} style={{ ...styles.handle, top }} aria-label={choice || 'Botón ' + (index + 1)} /></Fragment>;
    }) : !['end','handoff','back'].includes(data.kind) && <Handle type="source" id="next" position={Position.Right} style={styles.handle} />}
  </VStack>;
});
const nodeTypes = { lazo: FlowNode };

function InsertEdge({id,data,markerEnd,style,...geometry}) {
  const [path,x,y]=getSmoothStepPath(geometry);
  return <>
    <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
    <EdgeLabelRenderer>
      <IconButton label="Insertar bloque en esta conexión" size="sm" icon={<Icon icon={Plus} size="xsm" />}
        className="nodrag nopan" style={{position:'absolute',left:0,top:0,transform:'translate(-50%, -50%) translate('+x+'px,'+y+'px)',pointerEvents:'all'}}
        onClick={event=>{event.stopPropagation();data.insert(id);}} />
    </EdgeLabelRenderer>
  </>;
}
const edgeTypes={insertable:InsertEdge};
const canInsert=kind=>kind!=='trigger'&&outputsFor({kind,choices:[]})[0]==='next';

function Palette({ onAdd, count, inserting = false }) {
  const [query, setQuery] = useState('');
  return <VStack gap={3} padding={1}>
    <VStack gap={1}><Heading level={4}>{inserting?'Insertar bloque':'Agregar bloque'}</Heading><Text color="secondary" size="sm">{inserting?'La conexión se ajustará automáticamente.':'Elige un bloque y conéctalo.'}</Text></VStack>
    <TextInput label="Buscar bloques" isLabelHidden type="search" startIcon={Search} value={query} onChange={setQuery} placeholder="Buscar un bloque…" hasClear />
    {['Venta','Pago','Entrega','Entrada','Conversación','Lógica','Acciones'].map(group => {
      const blocks = Object.entries(BLOCKS).filter(([kind, item]) => item.group === group && (!inserting||canInsert(kind)) && (item.name + item.description).toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
      if (!blocks.length) return null;
      return <VStack key={group} gap={2}><Text style={styles.eyebrow}>{group}</Text>{blocks.map(([kind, item]) => <Button key={kind} variant="ghost" width="100%" style={{ height: 'auto', minHeight: '3.25rem', padding: 'var(--spacing-2)' }} label={`Añadir ${item.name}`} isDisabled={count >= 80} onClick={() => onAdd(kind)}>
        <HStack gap={3} vAlign="center" width="100%" style={{ textAlign: 'start' }}><HStack hAlign="center" vAlign="center" style={{ ...styles.iconWell, width: '2.1rem', height: '2.1rem', color: COLORS[kind] }}><Icon icon={ICONS[kind]} size="sm" color="inherit" /></HStack><VStack gap={1} style={{ flex: 1, minWidth: 0 }}><Text size="sm" weight="semibold">{item.name}</Text><Text size="sm" color="secondary" style={{ fontSize: '.75rem', fontWeight: 400, whiteSpace: 'normal', lineHeight: 1.5 }}>{item.description}</Text></VStack><Icon icon={Plus} size="xsm" color="secondary" /></HStack>
      </Button>)}</VStack>;
    })}
    {!Object.values(BLOCKS).some(item => (item.name + item.description).toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))) && <Text color="secondary" size="sm">No encontramos ese bloque.</Text>}
  </VStack>;
}

function OfferPicker({offers,onUpdate}) {
  const [query,setQuery]=useState('');
  if(!offers?.length)return null;
  const matching=offers.filter(offer=>[offer.name,offer.plan,offer.market,offer.currency].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  return <VStack gap={2}>
    <TextInput label="Buscar oferta en el catálogo" type="search" value={query} onChange={setQuery} hasClear />
    {matching.slice(0,6).map(offer=><Button key={offer.id} size="sm" variant="secondary"
      label={`${offer.name} · ${offer.plan} · ${offer.market} · ${offer.currency} ${(offer.cents/100).toFixed(2)}`}
      onClick={()=>onUpdate({value:offer.plan,sale:{product:offer.product,price:(offer.cents/100).toFixed(2),currency:offer.currency,link:offer.link,mode:offer.mode,previousPlan:'',name:offer.name,bonuses:offer.bonuses}})} />)}
    {!matching.length&&<Text size="sm" color="secondary">No hay ofertas con esa búsqueda.</Text>}
  </VStack>;
}

function Inspector({ node, onUpdate, onDuplicate, onDelete, members, offers, thirdButtonConnected }) {
  if (!node) return <VStack padding={4} gap={4}><Icon icon={MousePointer2} color="accent" size="lg" /><Heading level={4}>Cada bloque tiene una función</Heading><Text color="secondary">Selecciona uno en el lienzo para editar sus propiedades.</Text></VStack>;
  const { kind, label, value } = node.data;
  const field = { trigger: 'Palabra clave', condition: 'La respuesta contiene', wait: 'Tiempo en minutos', reminder: 'Minutos sin respuesta', tag: 'Nombre de la etiqueta', assign: 'Equipo o asesor' }[kind];
  return <VStack gap={5} padding={4}>
    <HStack gap={3} vAlign="center"><HStack hAlign="center" vAlign="center" style={{ ...styles.iconWell, color: COLORS[kind] }}><Icon icon={ICONS[kind]} color="inherit" size="md" /></HStack><VStack gap={1}><Text style={styles.eyebrow}>Propiedades</Text><Heading level={4}>{BLOCKS[kind].name}</Heading></VStack></HStack>
    <TextInput label="Nombre del bloque" value={label} onChange={next => onUpdate({ label: next.slice(0, 90) })} />
    {kind === 'message' ? <VStack gap={3}><TextArea label="Contenido del mensaje" value={value} onChange={next => onUpdate({ value: next.slice(0, 2000) })} rows={6} maxLength={2000} description="Personaliza el texto con el nombre del contacto." /><Button label="Insertar nombre del contacto" variant="secondary" size="sm" onClick={() => onUpdate({ value: (value + ' {{nombre}}').slice(0, 2000) })}>{'{{nombre}}'}</Button></VStack> : ['assign','handoff'].includes(kind) && members ? <VStack gap={2}><Text weight="semibold">Responsable de la empresa</Text>{members.map(member => <Button key={member.id} label={member.name} variant={value === member.id ? 'primary' : 'secondary'} onClick={() => onUpdate({ value: member.id })} />)}</VStack> : field && <TextInput label={field} value={value} inputMode={['wait','reminder'].includes(kind) ? 'numeric' : 'text'} onChange={next => onUpdate({ value: next.slice(0, kind === 'wait' ? 5 : 100) })} description={kind === 'trigger' ? 'La activación real requiere una palabra clave.' : kind === 'condition' ? 'La comparación ignora mayúsculas y tildes.' : kind === 'wait' ? 'Para envíos reales, usa de 1 a 1380 minutos dentro de la ventana de WhatsApp. En el simulador, el reloj avanza al instante.' : undefined} />}
    {kind === 'message' && <VStack gap={3}><Text style={styles.eyebrow}>Así lo verá el contacto</Text><VStack gap={2} style={styles.bubble}><Text as="p" size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{value.replaceAll('{{nombre}}', 'Lucía') || 'Tu mensaje aparecerá aquí.'}</Text><HStack hAlign="end" gap={1} vAlign="center"><Text size="sm" color="secondary">Vista previa</Text><Icon icon={CheckCheck} size="xsm" color="accent" /></HStack></VStack></VStack>}
    {kind === 'plan' && <VStack gap={3}>
      <OfferPicker key={node.id} offers={offers} onUpdate={onUpdate} />
      <TextInput label="Código de producto" value={node.data.sale.product} onChange={next=>onUpdate({sale:{...node.data.sale,product:next.slice(0,50)}})} description="Usa el mismo código en los planes del mismo infoproducto. Ejemplo: recetas-rapidas." />
      <TextInput label="Nombre del plan" value={value} onChange={next=>onUpdate({value:next.slice(0,100)})} />
      <TextInput label="Importe" value={node.data.sale.price} inputMode="decimal" onChange={next=>onUpdate({sale:{...node.data.sale,price:next.slice(0,12)}})} />
      <HStack gap={2} wrap="wrap">{['PEN','USD','EUR'].map(currency=><Button key={currency} label={currency} variant={node.data.sale.currency===currency?'primary':'secondary'} onClick={()=>onUpdate({sale:{...node.data.sale,currency}})} />)}</HStack>
      <TextInput label="Enlace HTTPS de entrega" value={node.data.sale.link} onChange={next=>onUpdate({sale:{...node.data.sale,link:next.slice(0,1500)}})} />
      <HStack gap={2} wrap="wrap">{[['prepaid','Pago anticipado'],['postpaid','Contra entrega']].map(([mode,title])=><Button key={mode} label={title} variant={node.data.sale.mode===mode?'primary':'secondary'} onClick={()=>onUpdate({sale:{...node.data.sale,mode}})} />)}</HStack>
      <TextInput label="Plan previo requerido (opcional)" value={node.data.sale.previousPlan} onChange={next=>onUpdate({sale:{...node.data.sale,previousPlan:next.slice(0,100)}})} description="Para vender una mejora, configura aquí el nombre exacto del plan anterior y cobra solo la diferencia." />
    </VStack>}
    {['charge','deliver'].includes(kind) && <TextArea label={kind==='charge'?'Instrucciones para pagar':'Texto de entrega'} value={value} rows={5} maxLength={2000} onChange={next=>onUpdate({value:next.slice(0,2000)})} description={kind==='charge'?'LAZO añade el importe y la moneda del plan.':'LAZO añade el enlace configurado en el plan.'} />}
    {kind==='confirm' && <TextInput label="Recordatorio de pago en minutos (opcional)" value={value} inputMode="numeric" onChange={next=>onUpdate({value:next.slice(0,4)})} description="Un recordatorio mientras no haya comprobante ni abono confirmado. Verifica el abono desde el chat." />}
    {kind === 'ai' && <VStack gap={3}>
      <TextArea label="Información del negocio" value={value} rows={7} maxLength={2000} onChange={next => onUpdate({ value: next.slice(0,2000) })} description="Incluye horarios, precios y respuestas frecuentes. Conecta la salida Asesor a Traspasar a asesor." />
      <Text size="sm" color="secondary">Habilita la IA en Ajustes de LAZO. La simulación no llama a OpenAI.</Text>
    </VStack>}
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
  const [paymentConfirmed,setPaymentConfirmed]=useState(true);
  const [aiOutcome,setAiOutcome] = useState('answered');
  const [result, setResult] = useState(null);
  const run = (selection = answer) => { const next = simulateFlow(flow, { name, incoming, answer: selection, aiOutcome, paymentConfirmed }); setResult(next); onPath(next.steps,next.stoppedAt); };
  const play = () => { if (choices) { setAnswer(''); run(''); } else run(); };
  return <VStack padding={4} gap={5}>
    <VStack padding={3} gap={2} style={styles.note}><Pill>Prueba local con datos ficticios</Pill><Text size="sm" color="secondary">No usa tu WhatsApp ni envía mensajes. Las esperas se adelantan y las acciones se muestran en este recorrido.</Text></VStack>
    <TextInput label="Nombre del contacto de prueba" value={name} onChange={v => setName(v.slice(0, 80))} />
    <TextInput label="Mensaje que inicia el flujo" value={incoming} onChange={v => setIncoming(v.slice(0, 500))} />
    {!choices && <TextInput label="Respuesta del contacto" value={answer} onChange={v => setAnswer(v.slice(0,500))} />}
    {flow.nodes.some(node => node.data.kind === 'ai') && <HStack gap={2} wrap="wrap">
      <Button label="Simular respuesta de IA" variant={aiOutcome==='answered'?'primary':'secondary'} onClick={()=>setAiOutcome('answered')} />
      <Button label="Simular traspaso a asesor" variant={aiOutcome==='handoff'?'primary':'secondary'} onClick={()=>setAiOutcome('handoff')} />
    </HStack>}
    {flow.nodes.some(node=>node.data.kind==='confirm') && <HStack gap={2} wrap="wrap">
      <Button label="Simular abono confirmado" variant={paymentConfirmed?'primary':'secondary'} onClick={()=>setPaymentConfirmed(true)} />
      <Button label="Simular abono pendiente" variant={!paymentConfirmed?'primary':'secondary'} onClick={()=>setPaymentConfirmed(false)} />
    </HStack>}
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
    {result && !result.errors.length && <VStack gap={4} aria-live="polite"><HStack vAlign="center" hAlign="between"><Heading level={4}>{result.waiting ? 'Esperando una opción' : result.paymentPending ? 'Esperando abono' : 'Recorrido completado'}</Heading><Pill icon={Check}>{result.steps.length} pasos</Pill></HStack><VStack gap={5} style={styles.timeline}>{result.steps.map((step, index) => <VStack gap={2} key={step.id}><HStack gap={2} vAlign="center"><Icon icon={ICONS[step.kind]} size="sm" color="accent" /><Text weight="semibold" size="sm">{step.label}</Text><Text size="sm" color="secondary">+{step.minutes} min</Text></HStack><Text as="p" size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }} color={step.kind === 'message' ? 'primary' : 'secondary'}>{step.detail}</Text></VStack>)}</VStack>{result.tags.length > 0 && <Text size="sm">Etiquetas: {result.tags.join(', ')}</Text>}{result.assigned && <Text size="sm">Responsable: {result.assigned}</Text>}</VStack>}
  </VStack>;
}

const runStates={pending:'En cola',running:'En ejecución',waiting:'Esperando una opción',scheduled:'Seguimiento programado',
  delayed:'Pausa programada',agent_wait:'Esperando más datos',payment_wait:'Esperando confirmar abono',
  done:'Recorrido completado',failed:'Detenido por un error',cancelled:'Cancelado',interrupted:'Interrumpido'};
const messageStates={accepted:'Aceptado por Meta',sent:'Enviado',delivered:'Entregado',read:'Leído',received:'Recibido',
  failed:'Falló',unknown:'Sin confirmación',queued:'En cola'};

function RunHistory({runs,onFocus}) {
  const [expanded,setExpanded]=useState(null);
  if(!runs.length)return <Text>No hay ejecuciones de este flujo.</Text>;
  return runs.map(run=><VStack key={run.id} gap={2} padding={3} style={styles.note}>
    <Text weight="semibold">{runStates[run.state]||run.state} · {run.contact}</Text>
    <Text size="sm" color="secondary">{new Date(run.created).toLocaleString('es-PE')}</Text>
    {run.block&&<Text size="sm">Bloque: {run.block}</Text>}
    {run.reason&&<Text size="sm">{run.reason}</Text>}
    {run.due&&['delayed','scheduled','payment_wait'].includes(run.state)&&<Text size="sm">Próxima acción: {new Date(run.due).toLocaleString('es-PE')}</Text>}
    <HStack gap={2} wrap="wrap">
      {run.steps?.length>0&&<Button size="sm" label={expanded===run.id?'Ocultar recorrido':'Ver recorrido'} onClick={()=>setExpanded(expanded===run.id?null:run.id)}/>}
      {run.step&&<Button size="sm" label="Ubicar bloque" onClick={()=>onFocus(run)}/>}
    </HStack>
    {expanded===run.id&&<VStack gap={3} style={styles.timeline}>{run.steps.map((step,index)=><VStack key={index} gap={1}>
      <Text size="sm" weight="semibold">{step.label}</Text><Text size="sm">{step.detail}</Text>
      {step.status&&<Text size="sm" color="secondary">{messageStates[step.status]||step.status}</Text>}
    </VStack>)}</VStack>}
  </VStack>);
}

function FlowLibrary({info,flows,loading,busy,onWorkspace,onOpen,onNew,onDemo,status,number,mode,changeMode}) {
  const [query,setQuery]=useState('');
  const selected=info?.workspaces.find(space=>space.id===info.identity.company.id);
  const visible=flows.filter(doc=>doc.graph.name.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')));
  return <Layout height="fill" header={<LayoutHeader hasDivider padding={3}>
    <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
      <HStack gap={2} vAlign="center"><img src="./marca.svg" alt="LAZO" style={styles.brand}/><Heading level={2}>Flujos</Heading></HStack>
      <HStack gap={2} vAlign="center"><IconButton label={mode==='dark'?'Cambiar a modo claro':'Cambiar a modo oscuro'} variant="ghost" icon={<Icon icon={mode==='dark'?Sun:Moon} size="sm"/>} onClick={changeMode}/>
        <Button label="Volver al CRM" variant="ghost" href="/app/" /></HStack>
    </HStack>
  </LayoutHeader>}>
    <LayoutContent padding={4}><VStack gap={4} width="100%" style={{maxWidth:'68rem',marginInline:'auto'}}>
      {info&&<>
        <HStack gap={3} wrap="wrap" hAlign="between" vAlign="end">
          <Selector label="Número de WhatsApp o espacio" value={selected?.id} width="min(100%, 23rem)"
            isDisabled={busy} hasSearch={info.workspaces.length>8} presentation="adaptive"
            options={info.workspaces.map(space=>({value:space.id,label:space.name+' · '+(space.id===selected?.id&&number?.number?number.number:space.phoneId?'ID Meta …'+space.phoneId.slice(-6):'Sin número conectado')}))}
            onChange={onWorkspace} />
          <Button label="Nuevo flujo" icon={<Icon icon={Plus} size="sm" />} variant="primary" isDisabled={busy} onClick={onNew}/>
        </HStack>
        {selected?.phoneId&&!number?.canActivate&&number&&<Text color="secondary" size="sm">Puedes preparar borradores en este espacio. La activación está disponible para cuentas de prueba verificadas.</Text>}
        {!selected?.phoneId&&<Text color="secondary" size="sm">Vincula el número desde Conexiones del CRM para usar WhatsApp en este espacio.</Text>}
        <TextInput label="Buscar un flujo" type="search" value={query} onChange={setQuery} hasClear />
        <VStack gap={2} aria-label="Flujos guardados">
          {visible.map(doc=><HStack key={doc.id} gap={3} padding={3} hAlign="between" vAlign="center" wrap="wrap" style={styles.note}>
            <VStack gap={1}><Text weight="semibold">{doc.graph.name}</Text>
              <Text size="sm" color="secondary">{doc.active?'Activo':doc.publishedRevision?'Pausado':'Borrador'} · {doc.graph.nodes.length} bloques</Text></VStack>
            <Button label={'Editar '+doc.graph.name} size="sm" isDisabled={busy} onClick={()=>onOpen(doc)}/>
          </HStack>)}
          {!visible.length&&<Text color="secondary">{flows.length?'No encontramos un flujo con ese nombre.':'Este espacio todavía no tiene flujos guardados.'}</Text>}
        </VStack>
      </>}
      {!info&&!loading&&<Button label="Abrir simulador" onClick={onDemo} />}
      <Text size="sm" color="secondary" role="status">{loading?'Cargando tus flujos…':status}</Text>
    </VStack></LayoutContent>
  </Layout>;
}

function Editor() {
  const initial = useRef(null); if (!initial.current) initial.current = loadInitial();
  const [nodes, setNodes, applyNodes] = useNodesState(initial.current.flow.nodes);
  const [edges, setEdges, applyEdges] = useEdgesState(initial.current.flow.edges);
  const [name, setName] = useState(initial.current.flow.name);
  const [selectedId, setSelectedId] = useState('bienvenida');
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState(initial.current.issue || (initial.current.restored ? 'Borrador recuperado de este navegador.' : 'Ejemplo listo para explorar.'));
  const [mode, setMode] = useState(readWorkspaceTheme);
  const [library,setLibrary]=useState(true);
  const [number,setNumber]=useState(null);
  const [panel, setPanel] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [path, setPath] = useState([]);
  const [stoppedAt,setStoppedAt]=useState(null);
  const [isRestoreConfirm, setRestoreConfirm] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [serverDoc, setServerDoc] = useState(null);
  const [serverLoading, setServerLoading] = useState(true);
  const [serverBusy, setServerBusy] = useState(false);
  const [savedFlows, setSavedFlows] = useState([]);
  const [runHistory, setRunHistory] = useState([]);
  const editEpoch = useRef(0);
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
      setStatus('');
    }).catch(error=>{if(!cancelled)setStatus(error.message);}).finally(()=>{if(!cancelled)setServerLoading(false);});
    return ()=>{cancelled=true;};
  }, []);
  useEffect(()=>{
    let cancelled=false;
    if(serverInfo?.workspaces.some(space=>space.id===serverInfo.identity.company.id&&space.phoneId)){
      serverInfo.request('/flow-number').then(result=>{if(!cancelled)setNumber(result);}).catch(()=>{});
    }
    return ()=>{cancelled=true;};
  },[serverInfo]);
  useEffect(()=>{
    const sync=event=>{if(event.type==='pageshow'||event.key===themeKey)setMode(readWorkspaceTheme());};
    window.addEventListener('storage',sync);
    window.addEventListener('pageshow',sync);
    return ()=>{window.removeEventListener('storage',sync);window.removeEventListener('pageshow',sync);};
  },[]);
  async function switchWorkspace(companyId) {
    if(!serverInfo||serverBusy||dirty||!companyId||companyId===serverInfo.identity.company.id)return;
    setServerBusy(true);
    try{
      await serverInfo.request('/companies/switch','POST',{companyId});
      setServerInfo(null);setSavedFlows([]);setServerDoc(null);setNumber(null);
      const info=await connectFlowsServer();
      setServerInfo(info);setSavedFlows(info.flows);setStatus('');
    }catch(error){serverFailure(error);}
    finally{setServerBusy(false);}
  }
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
  async function openSaved() {
    if(dirty){setStatus('Guarda los cambios actuales antes de volver a tus flujos.');return;}
    setLibrary(true);setPanel('');
    if(!serverInfo||serverBusy)return;
    setServerBusy(true);
    try{const result=await serverInfo.request('/flows');setSavedFlows(result.flows);setStatus('');}
    catch(error){serverFailure(error);}
    finally{setServerBusy(false);}
  }
  async function openHistory() {if(!serverInfo||!serverDoc||serverBusy)return;setServerBusy(true);try{const result=await serverInfo.request('/flows/'+serverDoc.id+'/runs');setRunHistory(result.runs);setPanel('history');}catch(error){serverFailure(error);}finally{setServerBusy(false);}}
  function newServerFlow(graph=chainedWelcomeFlow()) {if(dirty||serverBusy)return setStatus('Guarda el borrador actual antes de crear otro.');showDocument({graph});setServerDoc(null);setDirty(true);setPanel('');setLibrary(false);setStatus('Plantilla preparada. Completa los datos y guarda el borrador.');}
  useEffect(() => { const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  const update = patch => { setNodes(current => current.map(node => node.id === selectedId ? { ...node, data: { ...node.data, ...patch } } : node)); mutate(); };
  const [insertion,setInsertion]=useState(null);
  const openInsert=useCallback(id=>{setInsertion(id);setPanel('insert');},[]);
  const add = kind => {
    if (nodes.length >= 80) return setStatus('El laboratorio admite hasta 80 bloques.');
    if (kind === 'trigger' && nodes.some(node => node.data.kind === 'trigger')) return setStatus('Ya hay un Inicio. Selecciónalo para cambiar su palabra clave.');
    const position = api.screenToFlowPosition({ x: window.innerWidth * .50, y: window.innerHeight * .46 });
    const node = createNode(kind, crypto.randomUUID(), position);
    if(panel==='insert') {
      const edge=edges.find(item=>item.id===insertion);
      if(!edge||!canInsert(kind))return setStatus('Elige un bloque con una entrada y una salida.');
      const source=nodes.find(item=>item.id===edge.source),target=nodes.find(item=>item.id===edge.target);
      if(!source||!target)return;
      node.position={x:(source.position.x+target.position.x)/2,y:(source.position.y+target.position.y)/2+160};
      const next=[...nodes,node];
      const first=connectNodes({source:source.id,target:node.id,sourceHandle:edge.sourceHandle},next,edges.filter(item=>item.id!==edge.id));
      setEdges(connectNodes({source:node.id,target:target.id},next,first));
      setInsertion(null);
    }
    setNodes(current => [...current.map(item => ({ ...item, selected: false })), { ...node, selected: true }]);
    setSelectedId(node.id); mutate(); setPanel('inspector'); setStatus(panel==='insert'?'Bloque insertado y conectado.':`${BLOCKS[kind].name} añadido. Conecta sus puntos para incluirlo en el recorrido.`);
  };
  const duplicate = () => { if (!selected || nodes.length >= 80) return; if (selected.data.kind === 'trigger') return setStatus('El flujo admite un solo Inicio.'); const node = { ...selected, id: crypto.randomUUID(), position: { x: selected.position.x + 35, y: selected.position.y + 150 }, data: { ...selected.data, label: `${selected.data.label.slice(0, 80)} (copia)` }, selected: true }; setNodes(current => [...current.map(item => ({ ...item, selected: false })), node]); setSelectedId(node.id); mutate(); setStatus('Bloque duplicado. Conéctalo para usarlo.'); };
  const remove = () => { if (!selected) return; setNodes(current => current.filter(node => node.id !== selectedId)); setEdges(current => current.filter(edge => edge.source !== selectedId && edge.target !== selectedId)); setSelectedId(null); mutate(); setStatus('Bloque eliminado del borrador.'); };
  const saveLocal = () => { try { const clean = parseDraft(JSON.stringify(flow)); localStorage.setItem(DRAFT_KEY, JSON.stringify(clean)); setDirty(false); setStatus(issues.length ? 'Borrador guardado en este navegador. Completa las conexiones antes de simular.' : 'Borrador guardado en este navegador.'); } catch { setStatus('No se pudo guardar. Comprueba el espacio o los permisos de almacenamiento del navegador.'); } };
  const restore = () => { const next = exampleFlow(); setNodes(next.nodes); setEdges(next.edges); setName(next.name); setSelectedId('bienvenida'); setRestoreConfirm(false); mutate(); setStatus('Ejemplo restaurado. Guarda para reemplazar el borrador anterior.'); requestAnimationFrame(() => api.fitView({ padding: '12%', duration: motion ? 250 : 0 })); };
  const onConnect = connection => { try { const next = connectNodes(connection, nodes, edges); setEdges(next); mutate(); setStatus('Conexión creada. Cada salida tiene un único destino.'); } catch (error) { setStatus(error.message); } };
  const showSimulation = () => { try { setSnapshot(parseDraft(JSON.stringify(flow))); setPath([]); setStoppedAt(null); setPanel('simulation'); } catch { setStatus('No se puede simular este borrador. Reduce su tamaño o mueve los bloques más cerca del inicio.'); } };
  const changeMode = () => { const next = mode === 'dark' ? 'light' : 'dark'; saveWorkspaceTheme(next);setMode(next); };
  const renderedNodes = useMemo(() => nodes.map(node => ({ ...node, selected: node.id === selectedId, data: { ...node.data, assigneeLabel:serverInfo?.members.find(member=>member.id===node.data.value)?.name, running: path.some(step => step.id === node.id),stopped:node.id===stoppedAt } })), [nodes, selectedId, path,stoppedAt,serverInfo]);
  const renderedEdges = useMemo(() => { const visited = new Set(traversedEdgeIds(path, edges)); return edges.map(edge => ({ ...edge, type:'insertable', data:{insert:openInsert}, animated: motion&&visited.has(edge.id), markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: visited.has(edge.id) ? 'var(--lazo-mint)' : 'var(--color-border-emphasized)',strokeWidth:visited.has(edge.id)?3:2 } })); }, [edges, motion, path,openInsert]);
  const palette = <Palette onAdd={add} count={nodes.length} />;
  const inspector = <Inspector node={selected} onUpdate={update} onDuplicate={duplicate} onDelete={remove} members={serverInfo?.members} offers={serverInfo?.offers} thirdButtonConnected={edges.some(edge => edge.source === selectedId && edge.sourceHandle === 'option-3')} />;
  const selectNode = (_, node) => setSelectedId(node.id);
  const editNode = (_, node) => { setSelectedId(node.id); setPanel('inspector'); };
  const markSimulation=(steps,stopped)=>{
    setPath(steps);
    setStoppedAt(stopped||null);
    if(stopped)api.fitView({nodes:[{id:stopped}],maxZoom:1,padding:.35,duration:motion?280:0});
  };
  function locateRun(run) {
    if(!nodes.some(node=>node.id===run.step)||serverDoc?.revision!==run.revision||dirty){
      setPanel('');
      setStatus('La ejecución pertenece a otra versión del flujo. El recorrido queda visible en Historial.');
      return;
    }
    setSelectedId(run.step);
    setStoppedAt(run.state==='failed'?run.step:null);
    setPanel('');
    api.fitView({nodes:[{id:run.step}],maxZoom:1,padding:.35,duration:motion?280:0});
  }

  const templates=<Drawer isOpen={panel==='templates'} onOpenChange={open=>!open&&setPanel('')} label="Elegir plantilla" width="24rem">
    <VStack gap={3}><DrawerHeader title="Nuevo flujo" subtitle={serverInfo?.identity.company.name} onOpenChange={()=>setPanel('')} />
      <Button label="Bienvenida con botones" onClick={()=>newServerFlow()} />
      <Button label="Venta con pago anticipado" onClick={()=>newServerFlow(digitalSaleFlow())} />
      <Button label="Venta contra entrega digital" onClick={()=>newServerFlow(digitalSaleFlow('postpaid'))} />
    </VStack>
  </Drawer>;
  if(library)return <Theme theme={lazoTheme} mode={mode}><VStack style={styles.app} gap={0}>
    <FlowLibrary info={serverInfo} flows={savedFlows} loading={serverLoading} busy={serverBusy}
      onWorkspace={switchWorkspace} onNew={()=>setPanel('templates')} onDemo={()=>setLibrary(false)}
      onOpen={doc=>{showDocument(doc);setLibrary(false);setStatus('');}} status={status} number={number} mode={mode} changeMode={changeMode}/>
    {templates}
  </VStack></Theme>;
  return <Theme theme={lazoTheme} mode={mode}><VStack style={styles.app} gap={0}>
      <Layout height="fill" padding={0} header={<LayoutHeader hasDivider padding={0}>
        <VStack paddingInline={3} paddingBlock={2} gap={2}>
          <HStack gap={2} wrap="wrap" hAlign="between" vAlign="center">
            <HStack gap={2} vAlign="center" style={{minWidth:0}}>
              <img src="./marca.svg" alt="LAZO" style={styles.brand} />
              <TextInput label="Nombre del flujo" isLabelHidden value={name} onChange={next=>{setName(next.slice(0,100));mutate();}} width={mobile?'11rem':'17rem'} size="sm" />
              {!mobile&&<Pill>{serverDoc?.active?'Activo':serverInfo?'Borrador':'Simulación local'}</Pill>}
            </HStack>
            <HStack gap={2} wrap="wrap" vAlign="center">
              <Button label="Agregar bloque" size="sm" variant="primary" icon={<Icon icon={Plus} size="sm" />} onClick={()=>setPanel('palette')} />
              <IconButton label="Editar bloque seleccionado" isDisabled={!selected} icon={<Icon icon={Settings2} size="sm" />} onClick={()=>setPanel('inspector')} />
              <Button label="Guardar" size="sm" isDisabled={serverBusy||serverLoading} icon={<Icon icon={Save} size="sm" />} onClick={saveServer} />
              <Button label="Probar" size="sm" icon={<Icon icon={Play} size="sm" />} onClick={showSimulation} />
              <IconButton label={mode==='dark'?'Cambiar a modo claro':'Cambiar a modo oscuro'} variant="ghost" icon={<Icon icon={mode==='dark'?Sun:Moon} size="sm" />} onClick={changeMode} />
              <Button label="Mis flujos" variant="ghost" size="sm" onClick={openSaved} isDisabled={serverBusy} />
            </HStack>
          </HStack>
          {serverInfo&&<HStack gap={2} wrap="wrap" vAlign="center">
            <Button label="Nuevo flujo" size="sm" onClick={()=>setPanel('templates')} isDisabled={serverBusy||dirty} />
            <Button label="Activar versión guardada" size="sm" onClick={()=>activation('activate')} isDisabled={serverBusy||!serverDoc||dirty||!number?.canActivate||(serverDoc.active&&serverDoc.publishedRevision===serverDoc.revision)} />
            {serverDoc?.active&&<Button label="Pausar flujo" size="sm" onClick={()=>activation('pause')} isDisabled={serverBusy} />}
            <Button label="Historial de ejecuciones" size="sm" onClick={openHistory} isDisabled={serverBusy||!serverDoc} />
            <Text size="sm" color="secondary">{serverInfo.identity.company.name}{number?.number?' · '+number.number:''}{number?.canActivate?' · Cuenta de prueba':''}</Text>
          </HStack>}
        </VStack>
      </LayoutHeader>} footer={<LayoutFooter hasDivider padding={2}>
        <HStack hAlign="between" gap={2} wrap="wrap">
          <Text size="sm" role="status" aria-live="polite">{status}</Text>
          <Text size="sm" color="secondary">{issues.length?`${issues.length} ajustes pendientes · `:''}{dirty?'Cambios sin guardar · ':''}{nodes.length} bloques · {edges.length} conexiones</Text>
        </HStack>
      </LayoutFooter>}>
          <LayoutContent padding={0} isScrollable={false}><VStack style={styles.canvas} gap={0}>
            <ReactFlow nodes={renderedNodes} edges={renderedEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} style={{ background: 'transparent' }} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} isValidConnection={connection => !connectionProblem(connection, nodes, edges)} onNodeClick={selectNode} onNodeDoubleClick={editNode} onPaneClick={() => setSelectedId(null)} fitView fitViewOptions={{padding:'12%',maxZoom:.94}} nodeExtent={[[-10000, -10000], [10000, 10000]]} multiSelectionKeyCode={null} minZoom={.12} maxZoom={1.6} forceColorMode={mode} deleteKeyCode={['Backspace', 'Delete']} onNodesDelete={deleted => { if (deleted.some(node => node.id === selectedId)) setSelectedId(null); }} proOptions={{ hideAttribution: true }} ariaLabelConfig={{ 'controls.zoomIn.ariaLabel': 'Acercar el lienzo', 'controls.zoomOut.ariaLabel': 'Alejar el lienzo', 'controls.fitView.ariaLabel': 'Ajustar todo el flujo', 'controls.interactive.ariaLabel': 'Bloquear o desbloquear el lienzo', 'minimap.ariaLabel': 'Mapa del flujo' }}>
              <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--lazo-dot)" style={{ background: 'transparent' }} />
              <Controls showInteractive={false} position="bottom-left" />
              {!mobile && <MiniMap nodeColor={node => COLORS[node.data.kind]} nodeStrokeColor="var(--color-border)" pannable zoomable position="bottom-right" style={{ width: '9rem', height: '5.5rem', border: stroke, borderRadius: 'var(--radius-element)', overflow: 'hidden' }} />}
              <Panel position="top-right"><VStack gap={2}>
                <IconButton label="Ver todo el flujo" icon={<Icon icon={Maximize2} size="sm" />} onClick={()=>api.fitView({padding:'12%',duration:motion?300:0})} />
                <IconButton label={motion?'Reducir animaciones':'Activar animaciones'} icon={<Icon icon={motion?Pause:Play} size="sm" />} onClick={()=>setStill(current=>!current)} />
                <IconButton label="Restaurar ejemplo" icon={<Icon icon={RotateCcw} size="sm" />} onClick={()=>setRestoreConfirm(true)} />
              </VStack></Panel>
            </ReactFlow>
          </VStack></LayoutContent>
      </Layout>
    {templates}
    <Drawer isOpen={panel==='insert'} onOpenChange={open=>!open&&setPanel('')} label="Insertar bloque" side="start" width="20rem">
      <Layout height="fill" header={<LayoutHeader padding={3}><DrawerHeader title="Insertar en la conexión" onOpenChange={()=>setPanel('')} /></LayoutHeader>}>
        <LayoutContent padding={3}><Palette onAdd={add} count={nodes.length} inserting /></LayoutContent>
      </Layout>
    </Drawer>
    <Drawer isOpen={panel === 'palette'} onOpenChange={open => !open && setPanel('')} label="Biblioteca de bloques" side="start" width="20rem" padding={0}><Layout height="fill" header={<LayoutHeader padding={3}><DrawerHeader title="Bloques del flujo" onOpenChange={() => setPanel('')} /></LayoutHeader>}><LayoutContent padding={3}>{palette}</LayoutContent></Layout></Drawer>
    <Drawer isOpen={panel === 'inspector'} onOpenChange={open => !open && setPanel('')} label="Propiedades del bloque" width="22rem" padding={0}><Layout height="fill" header={<LayoutHeader padding={3}><DrawerHeader title="Configurar bloque" onOpenChange={() => setPanel('')} /></LayoutHeader>}><LayoutContent padding={0}>{inspector}</LayoutContent></Layout></Drawer>
    <Drawer isOpen={panel === 'simulation'} onOpenChange={open => !open && setPanel('')} label="Simular el flujo" width="30rem" padding={0}><Layout height="fill" header={<LayoutHeader padding={4} hasDivider><DrawerHeader title="Prueba tu conversación" subtitle="Una vista previa de cómo avanza el flujo" onOpenChange={() => setPanel('')} /></LayoutHeader>}><LayoutContent padding={0}>{snapshot && <Simulation key={snapshot.name + JSON.stringify(snapshot.nodes)} flow={snapshot} onPath={markSimulation} />}</LayoutContent></Layout></Drawer>
    <Drawer isOpen={panel === 'history'} onOpenChange={open=>!open&&setPanel('')} label="Historial de ejecuciones" width="28rem"><VStack gap={4}><DrawerHeader title="Últimas ejecuciones" subtitle="El mensaje aceptado se comprueba como entregado en Conversaciones." onOpenChange={()=>setPanel('')} /><RunHistory runs={runHistory} onFocus={locateRun} /></VStack></Drawer>
    <Drawer isOpen={isRestoreConfirm} onOpenChange={setRestoreConfirm} label="Restaurar ejemplo" width="24rem"><VStack gap={5}><DrawerHeader title="¿Volver al ejemplo inicial?" onOpenChange={setRestoreConfirm} /><Text>Reemplazará lo que ves en el lienzo. Tu borrador guardado se conserva hasta que vuelvas a guardar.</Text><Button label="Restaurar ejemplo inicial" onClick={restore} /><Button label="Seguir editando" variant="ghost" onClick={() => setRestoreConfirm(false)} /></VStack></Drawer>
  </VStack></Theme>;
}

export default function CanvasEditor() { return <ReactFlowProvider><Editor /></ReactFlowProvider>; }
