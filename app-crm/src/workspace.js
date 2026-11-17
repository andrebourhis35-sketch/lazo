import { randomUUID } from 'node:crypto';
import { now, requireThat, text } from './core.js';

export function workspaceTools(store) {
  function pipeline(company) {
    store.ensureWorkspace(company);
    return store.all('SELECT p.*,(SELECT count(*) FROM contacts c WHERE c.company_id=p.company_id AND c.stage=p.name) AS contacts FROM pipeline_stages p WHERE p.company_id=? ORDER BY position,id',company);
  }
  function uniqueName(company,name,except='') {
    const key=name.toLocaleLowerCase('es');
    requireThat(!pipeline(company).some(p=>p.id!==except&&p.name.toLocaleLowerCase('es')===key),'Ya existe una etapa con ese nombre.',409);
  }
  function addStage(company,data,actor) {
    const list=pipeline(company),name=text(data.name,40,true);
    requireThat(list.length<12,'Puedes usar hasta doce etapas.');uniqueName(company,name);
    const id=randomUUID();
    store.run('INSERT INTO pipeline_stages VALUES(?,?,?,?,0)',id,company,name,Math.max(...list.map(p=>p.position))+1);
    store.audit(company,actor,'stage.created');return pipeline(company);
  }
  function updateStage(company,id,data,actor) {
    const old=pipeline(company).find(p=>p.id===id);requireThat(old,'Etapa no encontrada.',404);
    const name=data.name===undefined?old.name:text(data.name,40,true);uniqueName(company,name,id);
    requireThat(data.isWon===undefined||typeof data.isWon==='boolean','Estado de venta no válido.');
    requireThat(data.isWon!==false||!old.is_won,'Marca primero otra etapa como venta ganada.');
    store.tx(()=>{
      if(data.isWon===true)store.run('UPDATE pipeline_stages SET is_won=0 WHERE company_id=?',company);
      store.run('UPDATE pipeline_stages SET name=?,is_won=? WHERE company_id=? AND id=?',name,data.isWon===true?1:old.is_won,company,id);
      if(name!==old.name)store.run('UPDATE contacts SET stage=?,updated=? WHERE company_id=? AND stage=?',name,now(),company,old.name);
      store.audit(company,actor,'stage.updated');
    });
    return pipeline(company);
  }
  function orderStages(company,ids,actor) {
    const list=pipeline(company);
    requireThat(Array.isArray(ids)&&ids.length===list.length&&new Set(ids).size===list.length&&ids.every(id=>list.some(p=>p.id===id)),'El orden debe incluir todas las etapas de esta empresa.');
    store.tx(()=>{ids.forEach((id,i)=>store.run('UPDATE pipeline_stages SET position=? WHERE company_id=? AND id=?',i,company,id));store.audit(company,actor,'stage.reordered');});
    return pipeline(company);
  }
  function removeStage(company,id,actor) {
    const list=pipeline(company),stage=list.find(p=>p.id===id);requireThat(stage,'Etapa no encontrada.',404);
    requireThat(list.length>2&&!stage.is_won&&!stage.contacts,'Solo puedes eliminar etapas vacías que no sean la etapa ganada. Deben quedar al menos dos etapas.',409);
    store.run('DELETE FROM pipeline_stages WHERE company_id=? AND id=?',company,id);store.audit(company,actor,'stage.removed');
    return pipeline(company);
  }
  const replies=company=>store.all('SELECT id,title,shortcut,body,updated FROM quick_replies WHERE company_id=? AND deleted=0 ORDER BY title COLLATE NOCASE',company);
  function saveReply(company,id,data,actor) {
    const old=id?store.get('SELECT * FROM quick_replies WHERE id=? AND company_id=? AND deleted=0',id,company):null;
    requireThat(!id||old,'Respuesta no encontrada.',404);
    requireThat(old||replies(company).length<100,'Puedes guardar hasta cien respuestas rápidas.');
    const title=text(data.title,70,true),shortcut=text(data.shortcut,24,true).toLowerCase(),body=text(data.body,4000,true);
    requireThat(/^[a-z0-9_]{1,24}$/.test(shortcut),'Usa letras sin acentos, números y guion bajo en el atajo.');
    requireThat(!store.get('SELECT 1 FROM quick_replies WHERE company_id=? AND shortcut=? AND deleted=0 AND id<>?',company,shortcut,id||''),'Ese atajo ya está en uso.',409);
    const key=id||randomUUID();
    if(old)store.run('UPDATE quick_replies SET title=?,shortcut=?,body=?,updated=? WHERE company_id=? AND id=?',title,shortcut,body,now(),company,key);
    else store.run('INSERT INTO quick_replies(id,company_id,title,shortcut,body,created,updated) VALUES(?,?,?,?,?,?,?)',key,company,title,shortcut,body,now(),now());
    store.audit(company,actor,'reply.saved');return replies(company);
  }
  function removeReply(company,id,actor) {
    requireThat(store.get('SELECT 1 FROM quick_replies WHERE company_id=? AND id=? AND deleted=0',company,id),'Respuesta no encontrada.',404);
    store.run('UPDATE quick_replies SET deleted=1,updated=? WHERE company_id=? AND id=?',now(),company,id);
    store.audit(company,actor,'reply.removed');return replies(company);
  }
  function statistics(company,days) {
    requireThat([7,30,90].includes(days),'Elige un periodo de 7, 30 o 90 días.');store.ensureWorkspace(company);
    const day=86400000,offset=5*3600000,until=now(),today=Math.floor((until-offset)/day)*day+offset,since=today-(days-1)*day;
    const stats=store.get("SELECT sum(CASE WHEN direction='in' THEN 1 ELSE 0 END) AS incoming,sum(CASE WHEN direction='out' AND status IN ('accepted','sent','delivered','read') THEN 1 ELSE 0 END) AS outgoing,sum(CASE WHEN direction='out' AND status IN ('delivered','read') THEN 1 ELSE 0 END) AS delivered,sum(CASE WHEN direction='out' AND status='failed' THEN 1 ELSE 0 END) AS failed FROM messages WHERE company_id=? AND created>=? AND created<=?",company,since,until);
    for(const key of Object.keys(stats))stats[key]=Number(stats[key]||0);
    stats.newContacts=store.get('SELECT count(*) AS n FROM contacts WHERE company_id=? AND created>=? AND created<=?',company,since,until).n;
    stats.openConversations=store.get('SELECT count(*) AS n FROM contacts c WHERE c.company_id=? AND c.resolved=0 AND EXISTS(SELECT 1 FROM messages m WHERE m.company_id=c.company_id AND m.contact_id=c.id)',company).n;
    stats.registeredSales=store.get("SELECT count(DISTINCT contact_id) AS n FROM sale_events WHERE company_id=? AND kind='won' AND created>=? AND created<=?",company,since,until).n;
    // Measure one response per contiguous customer turn, not once per message.
    const response=store.get("WITH ordered AS (SELECT direction,created,lag(direction) OVER (PARTITION BY contact_id ORDER BY created,id) AS previous,min(CASE WHEN direction='out' THEN created END) OVER (PARTITION BY contact_id ORDER BY created,id ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING) AS answered FROM messages WHERE company_id=? AND (direction='in' OR status IN ('accepted','sent','delivered','read'))) SELECT avg(answered-created) AS average,count(*) AS answeredTurns FROM ordered WHERE direction='in' AND (previous IS NULL OR previous<>'in') AND answered IS NOT NULL AND created>=? AND created<=?",company,since,until);
    stats.averageResponseMs=response.average===null?null:Math.round(response.average);
    stats.answeredTurns=response.answeredTurns;
    const groups=store.all("SELECT strftime('%Y-%m-%d',created/1000-18000,'unixepoch') AS date,sum(CASE WHEN direction='in' THEN 1 ELSE 0 END) AS incoming,sum(CASE WHEN direction='out' AND status IN ('accepted','sent','delivered','read') THEN 1 ELSE 0 END) AS outgoing FROM messages WHERE company_id=? AND created>=? AND created<=? GROUP BY date",company,since,until);
    const daily=Array.from({length:days},(_,i)=>{const date=new Date(since+i*day-offset).toISOString().slice(0,10),row=groups.find(g=>g.date===date);return {date,incoming:Number(row?.incoming||0),outgoing:Number(row?.outgoing||0)};});
    const stages=pipeline(company).map(p=>({id:p.id,name:p.name,count:p.contacts,isWon:Boolean(p.is_won)}));
    const team=store.all('SELECT u.name,u.id,count(c.id) AS contacts,coalesce(sum(CASE WHEN c.resolved=0 THEN 1 ELSE 0 END),0) AS open,coalesce(sum(CASE WHEN p.is_won=1 THEN 1 ELSE 0 END),0) AS won FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN contacts c ON c.company_id=m.company_id AND c.owner_id=m.user_id LEFT JOIN pipeline_stages p ON p.company_id=c.company_id AND p.name=c.stage WHERE m.company_id=? GROUP BY u.id ORDER BY contacts DESC,u.name',company);
    const storage=store.get("SELECT coalesce(sum(size),0) AS bytes FROM media_assets WHERE company_id=? AND state IN ('ready','pending')",company).bytes;
    return {days,since,until,timezone:'America/Lima',analyticsSince:store.get('SELECT analytics_since FROM workspace_settings WHERE company_id=?',company).analytics_since,metrics:stats,daily,stages,team,storageBytes:storage};
  }
  return {pipeline,addStage,updateStage,orderStages,removeStage,replies,saveReply,removeReply,statistics};
}
