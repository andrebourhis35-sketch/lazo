import { randomUUID } from 'node:crypto';
import { digest, now, requireThat } from './core.js';
import { amountInCents } from './flow-model.js';

const windowMs=24*60*60*1000;
const okStatuses=new Set(['accepted','sent','delivered','read']);

export function flowSales(store,wa) {
  const orderFor=run=>store.get('SELECT * FROM flow_orders WHERE run_id=? AND company_id=? AND contact_id=?',run.id,run.company_id,run.contact_id);
  const pendingFor=(company,contact)=>store.get(`SELECT o.*,r.state FROM flow_orders o JOIN flow_runs r ON r.id=o.run_id
    WHERE o.company_id=? AND o.contact_id=? AND o.charged_at IS NOT NULL AND r.state='payment_wait'
    ORDER BY o.created DESC LIMIT 1`,company,contact);
  const format=o=>o.currency+' '+(o.cents/100).toFixed(2);

  function enqueue(message) {
    const {company_id:company,contact_id:contact}=message;
    const order=pendingFor(company,contact);
    if(!order){
      if(message.attachmentId&&['image','document'].includes(message.type)){
        const manual=store.get(`SELECT id,charged_at FROM flow_orders WHERE company_id=? AND contact_id=?
          AND run_id LIKE 'manual:%' AND charged_at IS NOT NULL AND confirmed_at IS NULL ORDER BY charged_at DESC LIMIT 1`,company,contact);
        if(manual&&message.created>=Math.floor(manual.charged_at/1000)*1000){
          store.run('UPDATE flow_orders SET proof_id=? WHERE id=? AND confirmed_at IS NULL',message.id,manual.id);
          return true;
        }
      }
      return false;
    }
    if(order.confirmed_at) {
      resume(order);
      return true;
    }
    if(message.attachmentId&&['image','document'].includes(message.type)&&message.created>=Math.floor(order.charged_at/1000)*1000) {
      store.run('UPDATE flow_orders SET proof_id=? WHERE id=? AND confirmed_at IS NULL',message.id,order.id);
      store.run("UPDATE flow_runs SET reason='Comprobante recibido. Falta verificar el abono.',due=NULL,updated=? WHERE id=? AND state='payment_wait'",now(),order.run_id);
    }
    return true;
  }
  function resume(order) {
    const contact=store.contact(order.company_id,order.contact_id);
    if(contact.automation_paused||contact.last_inbound<=now()-windowMs)return false;
    return Boolean(store.run("UPDATE flow_runs SET state='pending',due=NULL,reason='',updated=? WHERE id=? AND state='payment_wait'",now(),order.run_id).changes);
  }
  function list(company,contact) {
    return store.all(`SELECT o.id,o.product,o.plan,o.cents,o.currency,o.mode,o.created,o.proof_id,o.charged_at,o.confirmed_at,o.reference,o.delivery_id,
      o.run_id LIKE 'manual:%' AS manual,r.state AS flow_state,r.reason AS flow_reason,r.due AS next_action,p.type AS proof_type,
      m.status AS delivery_status,m.created AS delivery_created,p.created AS proof_created FROM flow_orders o LEFT JOIN flow_runs r ON r.id=o.run_id
      LEFT JOIN messages m ON m.id=o.delivery_id AND m.company_id=o.company_id
      LEFT JOIN messages p ON p.id=o.proof_id AND p.company_id=o.company_id
      WHERE o.company_id=? AND o.contact_id=? ORDER BY o.created DESC,o.id DESC LIMIT 15`,company,contact);
  }
  function confirm(company,contact,id,data,actor) {
    const reference=typeof data.reference==='string'?data.reference.trim().toUpperCase():'';
    requireThat(/^[A-Z0-9][A-Z0-9 ._/-]{2,63}$/.test(reference),'Introduce la referencia de la operación.');
    const cents=amountInCents(data.amount);
    return store.tx(()=>{
      const order=store.get('SELECT * FROM flow_orders WHERE company_id=? AND contact_id=? AND id=?',company,contact,id);
      requireThat(order,'Pedido no encontrado.',404);
      requireThat(order.charged_at,'Primero envía las instrucciones de cobro.',409);
      requireThat(cents===order.cents,'El importe verificado debe coincidir con el pedido.');
      if(order.confirmed_at) {
        requireThat(order.reference===reference,'El pedido ya tiene un abono registrado.',409);
        return {confirmed:true,resumed:false,manual:order.run_id.startsWith('manual:')};
      }
      requireThat(!store.get('SELECT 1 FROM flow_orders WHERE company_id=? AND currency=? AND reference=?',company,order.currency,reference),'La referencia ya fue registrada.',409);
      store.run('UPDATE flow_orders SET confirmed_at=?,reference=?,confirmed_by=? WHERE id=?',now(),reference,actor,id);
      const resumed=resume(order);
      if(!resumed)store.run("UPDATE flow_runs SET due=NULL,reason='Abono confirmado. Esperando un mensaje para reabrir la ventana de WhatsApp.',updated=? WHERE id=? AND state='payment_wait'",now(),order.run_id);
      store.audit(company,actor,'sale.payment-confirmed');
      return {confirmed:true,resumed,manual:order.run_id.startsWith('manual:')};
    });
  }
  function plan(run,node) {
    const existing=orderFor(run);
    requireThat(!existing,'Este recorrido ya tiene un plan.');
    const {product,price,currency,link,mode,previousPlan,name,bonuses}=node.data.sale;
    if(previousPlan.trim())requireThat(store.get("SELECT 1 FROM flow_orders WHERE company_id=? AND contact_id=? AND product=? AND plan=? AND confirmed_at IS NOT NULL AND delivery_id IS NOT NULL",run.company_id,run.contact_id,product,previousPlan.trim()),'Este contacto aún no tiene el plan requerido para la mejora.');
    store.run('INSERT INTO flow_orders(id,company_id,contact_id,run_id,product,plan,cents,currency,link,mode,created,offer_text) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
      randomUUID(),run.company_id,run.contact_id,run.id,product,node.data.value.trim(),amountInCents(price),currency,link,mode,now(),[name,bonuses].filter(Boolean).join('\n'));
  }
  async function send(run,actor,key,text) {
    const result=await wa.send(run.company_id,run.contact_id,{type:'text',clientId:'sale-'+digest(run.id+':'+key),text},actor,{flow:true});
    requireThat(okStatuses.has(result.status),'El envío del pedido no quedó confirmado.',409);
    return result.id;
  }
  async function deliver(order,run,actor,text) {
    try{
      const id=await send(run,actor,'delivery',text);
      store.run('UPDATE flow_orders SET delivery_id=? WHERE id=?',id,order.id);
      return id;
    }catch(error){
      const attempt=store.get('SELECT id FROM messages WHERE company_id=? AND client_id=?',run.company_id,'sale-'+digest(run.id+':delivery'));
      if(attempt)store.run('UPDATE flow_orders SET delivery_id=? WHERE id=? AND delivery_id IS NULL',attempt.id,order.id);
      throw error;
    }
  }
  async function execute(run,node,actor) {
    const kind=node.data.kind;
    if (kind==='plan') {plan(run,node);return {detail:'Plan registrado'};}
    const order=orderFor(run);
    requireThat(order,'Conecta un bloque Oferta y plan antes de los pasos del pedido.');
    if(kind==='charge') {
      requireThat(!order.charged_at,'El cobro ya fue enviado.');
      if(order.mode==='postpaid')requireThat(order.delivery_id,'Entrega primero el producto de este pedido.');
      const messageId=await send(run,actor,'charge',['Plan '+order.plan+' · '+format(order),order.offer_text,node.data.value.trim(),'Si tienes un comprobante, envíalo en este chat.'].filter(Boolean).join('\n\n'));
      store.run('UPDATE flow_orders SET charged_at=? WHERE id=?',now(),order.id);
      return {detail:'Instrucciones de pago enviadas',messageId};
    }
    if(kind==='confirm') {
      requireThat(order.charged_at,'Conecta Cobrar antes de Confirmar pago.');
      if(order.confirmed_at)return {detail:'Abono verificado por el equipo'};
      const proof=store.get("SELECT id FROM messages WHERE company_id=? AND contact_id=? AND direction='in' AND type IN ('image','document') AND created>=? AND attachment_id IS NOT NULL ORDER BY created DESC,id DESC LIMIT 1",run.company_id,run.contact_id,Math.floor(order.charged_at/1000)*1000);
      if(proof&&!order.proof_id)store.run('UPDATE flow_orders SET proof_id=? WHERE id=?',proof.id,order.id);
      const due=!proof&&!order.proof_id&&node.data.value.trim()?now()+Number(node.data.value)*60000:null;
      store.run("UPDATE flow_runs SET state='payment_wait',due=?,reason=?,updated=? WHERE id=? AND state='running'",due,proof||order.proof_id?'Comprobante recibido. Falta verificar el abono.':'Pendiente de verificar el abono.',now(),run.id);
      return {detail:'Esperando validación del abono',pause:true};
    }
    requireThat(order.mode==='postpaid'||order.confirmed_at,'Confirma el abono antes de entregar.');
    if(order.delivery_id)return {detail:'La entrega ya estaba registrada',messageId:order.delivery_id};
    const messageId=await deliver(order,run,actor,(node.data.value.trim()||'Acceso a tu compra:')+'\n'+order.link);
    return {detail:'Acceso enviado',messageId};
  }
  async function remind(run) {
    const order=orderFor(run);
    const active=store.get(`SELECT f.actor_id FROM flows f JOIN memberships m ON m.company_id=f.company_id AND m.user_id=f.actor_id
      WHERE f.id=? AND f.company_id=? AND f.active=1 AND f.activation=? AND f.published_revision=? AND m.role IN ('owner','admin')`,
      run.flow_id,run.company_id,run.activation,run.revision);
    const claimed=store.run("UPDATE flow_runs SET due=NULL WHERE id=? AND state='payment_wait' AND due<=?",run.id,now());
    if(!claimed.changes||!active||!order||order.confirmed_at||order.proof_id)return;
    const contact=store.contact(run.company_id,run.contact_id);
    if(contact.automation_paused||contact.last_inbound<=now()-windowMs||!wa.credentials(run.company_id)?.testRecipient)return;
    await send(run,active.actor_id,'payment-reminder','Tu pedido '+order.plan+' sigue pendiente de pago ('+format(order)+'). Si ya abonaste, envíanos tu comprobante.');
  }
  async function resend(company,contact,id,requestId,actor) {
    requireThat(typeof requestId==='string'&&/^[a-f0-9-]{36}$/.test(requestId),'Solicitud de reenvío no válida.');
    const order=store.get('SELECT * FROM flow_orders WHERE company_id=? AND contact_id=? AND id=?',company,contact,id);
    requireThat(order?.delivery_id&&(order.confirmed_at||order.mode==='postpaid'),'Primero completa la entrega original.',409);
    requireThat(order.run_id.startsWith('manual:')||wa.credentials(company)?.testRecipient,'La entrega por flujo usa la cuenta de prueba.');
    store.limit('sale-resend:'+id,4,3600000);
    const messageId=await send({company_id:company,contact_id:contact,id:order.run_id},actor,'resend:'+requestId,'Acceso a tu compra:\n'+order.link);
    store.run('UPDATE flow_orders SET delivery_id=? WHERE id=?',messageId,order.id);
    store.audit(company,actor,'sale.delivery-resent');
    return {resent:true};
  }

  async function offer(company,contact,data,actor) {
    requireThat(typeof data.requestId==='string'&&/^[a-f\d-]{36}$/.test(data.requestId),'Solicitud de oferta no válida.');
    const runId='manual:'+company+':'+contact+':'+data.requestId;
    const order=store.tx(()=>{
      const old=store.get('SELECT * FROM flow_orders WHERE run_id=?',runId);
      if(old)return old;
      requireThat(!store.get(`SELECT id FROM flow_orders WHERE company_id=? AND contact_id=?
        AND run_id LIKE 'manual:%' AND confirmed_at IS NULL`,company,contact),'Ya hay un pedido manual pendiente para este contacto.',409);
      const selected=store.get('SELECT * FROM sales_catalog WHERE company_id=? AND id=? AND archived=0',company,data.offerId);
      requireThat(selected,'Oferta no disponible.',404);
      requireThat(selected.instructions,'Agrega instrucciones de pago a esta oferta.');
      const message=[selected.name+' · '+selected.plan+' · '+format(selected),selected.bonuses,
        selected.mode==='postpaid'?'Pago contra entrega: abona cuando recibas el acceso.':'',selected.instructions,
        'Si ya pagaste, envíanos el comprobante por este chat.'].filter(Boolean).join('\n\n');
      const id=randomUUID();
      store.run(`INSERT INTO flow_orders(id,company_id,contact_id,run_id,product,plan,cents,currency,link,mode,created,offer_text)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,id,company,contact,runId,selected.product,selected.plan,selected.cents,selected.currency,selected.link,selected.mode,now(),message);
      return store.get('SELECT * FROM flow_orders WHERE id=?',id);
    });
    if(order.charged_at)return {offered:true};
    try{
      await send({id:runId,company_id:company,contact_id:contact},actor,'charge',order.offer_text);
    }catch(error){
      const sent=store.get('SELECT status FROM messages WHERE company_id=? AND client_id=?',company,'sale-'+digest(runId+':charge'));
      if(!sent||sent.status==='failed')store.run('DELETE FROM flow_orders WHERE id=? AND charged_at IS NULL',order.id);
      throw error;
    }
    if(store.run('UPDATE flow_orders SET charged_at=? WHERE id=? AND charged_at IS NULL',now(),order.id).changes)store.audit(company,actor,'sale.offer-sent');
    return {offered:true};
  }
  async function deliverManual(company,contact,id,actor) {
    const order=store.get("SELECT * FROM flow_orders WHERE company_id=? AND contact_id=? AND id=? AND run_id LIKE 'manual:%'",company,contact,id);
    requireThat(order?.charged_at&&(order.confirmed_at||order.mode==='postpaid'),'Envía primero la oferta y, en pago anticipado, confirma el abono.',409);
    if(order.delivery_id)return {delivered:true};
    await deliver(order,{id:order.run_id,company_id:company,contact_id:contact},actor,'Acceso a tu compra:\n'+order.link);
    store.audit(company,actor,'sale.manual-delivered');
    return {delivered:true};
  }
  return {list,confirm,enqueue,execute,remind,resend,offer,deliverManual};
}
