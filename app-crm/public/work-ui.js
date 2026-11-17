const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function dialog(title,html) {
  const box=document.createElement('dialog');box.className='work-dialog';
  box.innerHTML=`<div class="section-heading"><h2>${esc(title)}</h2><button class="icon close" aria-label="Cerrar" type="button">×</button></div>${html}`;
  document.body.append(box);box.querySelector('.close').onclick=()=>box.close();
  box.addEventListener('close',()=>box.remove());box.showModal();return box;
}
export function replyPicker(replies,onChoose) {
  const box=dialog('Respuestas rápidas',`<label class="search"><input placeholder="Buscar título o atajo" aria-label="Buscar respuesta rápida"></label><div class="reply-picker"></div><p class="muted dialog-footnote">Se inserta en tu borrador. Tú decides cuándo enviarla.</p>`);
  const list=box.querySelector('.reply-picker');
  function draw(term='') {
    list.innerHTML=replies.filter(r=>(r.title+' '+r.shortcut).toLowerCase().includes(term.toLowerCase())).map(r=>`<button type="button" data-reply="${r.id}"><strong>${esc(r.title)} <small>/${esc(r.shortcut)}</small></strong><p>${esc(r.body)}</p></button>`).join('')||'<p class="empty">No hay respuestas con esa búsqueda. Un administrador puede crearlas en Ajustes.</p>';
  }
  box.querySelector('input').oninput=e=>draw(e.target.value);
  list.onclick=e=>{const button=e.target.closest('[data-reply]');if(button){onChoose(replies.find(r=>r.id===button.dataset.reply).body);box.close();}};
  draw();
}
export function mountManagement(root,context) {
  const {api,notice,getStages,getReplies,onStages,onReplies}=context;
  const run=async action=>{try{await action();}catch(error){notice(error.message,true);}};
  function replyEditor(value=null) {
    const box=dialog(value?'Editar respuesta':'Nueva respuesta rápida',`<form class="work-form"><label>Título<input name="title" maxlength="70" value="${esc(value?.title||'')}" required></label><label>Atajo<input name="shortcut" maxlength="24" pattern="[a-z0-9_]+" placeholder="saludo" value="${esc(value?.shortcut||'')}" required><small>Sin espacios ni acentos. Por ejemplo: saludo.</small></label><label>Mensaje<textarea name="body" maxlength="4000" rows="6" required>${esc(value?.body||'')}</textarea></label><button class="send" type="submit">Guardar respuesta</button></form>`);
    box.querySelector('form').onsubmit=async e=>{
      e.preventDefault();const submit=e.submitter;submit.disabled=true;
      await run(async()=>{const r=await api('/quick-replies'+(value?'/'+value.id:''),{method:value?'PATCH':'POST',body:Object.fromEntries(new FormData(e.target))});onReplies(r.replies);box.close();draw();notice('Respuesta guardada para tu empresa.');});
      submit.disabled=false;
    };
  }
  async function stageAction(path,options) {const r=await api(path,options);await onStages(r.stages);draw();}
  function draw() {
    if(!root.isConnected)return;
    const stages=getStages(),replies=getReplies();
    root.innerHTML=`<section class="settings-card"><div class="tool-heading"><div><h2>Etapas de ventas</h2><p class="muted">Ponles tus nombres y ordénalas según tu proceso. La etapa marcada con estrella cuenta como venta ganada.</p></div></div><div class="stage-manager">${stages.map((s,i)=>`<form data-stage-form="${s.id}" class="stage-editor"><span class="stage-position">${i+1}</span><label><span class="sr-only">Nombre de la etapa ${i+1}</span><input name="name" maxlength="40" value="${esc(s.name)}" required></label><span class="stage-use">${s.contacts} contactos</span><button type="submit" class="secondary">Guardar</button><button type="button" class="secondary stage-won ${s.is_won?'selected':''}" data-won="${s.id}" aria-label="Marcar ${esc(s.name)} como venta ganada" aria-pressed="${Boolean(s.is_won)}">★</button><button type="button" class="icon" data-up="${s.id}" aria-label="Subir ${esc(s.name)}" ${i===0?'disabled':''}>↑</button><button type="button" class="icon" data-down="${s.id}" aria-label="Bajar ${esc(s.name)}" ${i===stages.length-1?'disabled':''}>↓</button><button type="button" class="icon danger" data-delete-stage="${s.id}" aria-label="Eliminar ${esc(s.name)}" ${s.contacts||s.is_won||stages.length<=2?'disabled':''}>×</button></form>`).join('')}</div><p class="muted">Para eliminar una etapa, mueve sus contactos a otra y deja al menos dos etapas. La etapa ganada se conserva.</p><form id="add-stage" class="inline-tool-form"><label>Nueva etapa<input name="name" maxlength="40" placeholder="Por ejemplo: Seguimiento" required></label><button class="send" type="submit" ${stages.length>=12?'disabled':''}>Añadir etapa</button></form></section><section class="settings-card"><div class="tool-heading"><div><h2>Respuestas rápidas</h2><p class="muted">Mensajes compartidos con los asesores de esta empresa.</p></div><button type="button" id="add-reply" class="secondary">+ Nueva respuesta</button></div><div class="saved-replies">${replies.map(r=>`<article><div><strong>${esc(r.title)}</strong><span class="shortcut">/${esc(r.shortcut)}</span><p>${esc(r.body)}</p></div><div class="reply-actions"><button type="button" class="secondary" data-edit-reply="${r.id}">Editar</button><button type="button" class="secondary danger" data-remove-reply="${r.id}">Retirar</button></div></article>`).join('')||'<p class="muted">Crea tu primera respuesta. Podrás insertarla desde cualquier conversación.</p>'}</div></section>`;
    root.querySelector('#add-reply').onclick=()=>replyEditor();
    root.querySelector('#add-stage').onsubmit=e=>{e.preventDefault();const name=new FormData(e.target).get('name');run(()=>stageAction('/pipeline/stages',{method:'POST',body:{name}}));};
    for(const form of root.querySelectorAll('[data-stage-form]'))form.onsubmit=e=>{e.preventDefault();run(()=>stageAction('/pipeline/stages/'+form.dataset.stageForm,{method:'PATCH',body:{name:new FormData(form).get('name')}}));};
  }
  root.onclick=e=>{
    const target=e.target.closest('button');if(!target)return;
    const data=target.dataset;
    if(data.editReply)replyEditor(getReplies().find(r=>r.id===data.editReply));
    if(data.removeReply)run(async()=>{onReplies((await api('/quick-replies/'+data.removeReply,{method:'DELETE',body:{}})).replies);draw();notice('Respuesta retirada.');});
    if(data.won)run(()=>stageAction('/pipeline/stages/'+data.won,{method:'PATCH',body:{isWon:true}}));
    if(data.deleteStage)run(()=>stageAction('/pipeline/stages/'+data.deleteStage,{method:'DELETE',body:{}}));
    if(data.up||data.down) {
      const ids=getStages().map(s=>s.id),index=ids.indexOf(data.up||data.down),next=index+(data.up?-1:1);
      if(next>=0&&next<ids.length){[ids[index],ids[next]]=[ids[next],ids[index]];run(()=>stageAction('/pipeline/order',{method:'PUT',body:{ids}}));}
    }
  };
  draw();
}
function responseTime(ms) {
  if(ms===null)return '—';
  const minutes=Math.round(ms/60000);return minutes<1?'< 1 min':minutes<60?minutes+' min':Math.floor(minutes/60)+' h '+minutes%60+' min';
}
export function renderStatistics(root,data,onRange) {
  const {metrics:m,daily,stages,team}=data,max=Math.max(1,...daily.flatMap(d=>[d.incoming,d.outgoing]));
  const points=key=>daily.map((d,i)=>(44+i*(672/Math.max(1,daily.length-1))).toFixed(1)+','+(205-d[key]/max*165).toFixed(1)).join(' ');
  const total=daily.reduce((n,d)=>n+d.incoming+d.outgoing,0);
  const cards=[[m.incoming,'Mensajes recibidos'],[m.outgoing,'Envíos aceptados por Meta'],[m.delivered,'Entregados o leídos'],[responseTime(m.averageResponseMs),'Tiempo medio de respuesta'],[m.newContacts,'Contactos nuevos'],[m.registeredSales,'Ventas registradas']];
  root.innerHTML=`<div class="crm-intro"><div><span class="eyebrow">TU EMPRESA, EN NÚMEROS</span><h2>Una vista de lo que está pasando</h2><p class="muted">Datos reales de esta empresa · Días según la hora de Perú.</p></div><label class="period-picker">Periodo<select id="stats-period"><option value="7" ${data.days===7?'selected':''}>Últimos 7 días</option><option value="30" ${data.days===30?'selected':''}>Últimos 30 días</option><option value="90" ${data.days===90?'selected':''}>Últimos 90 días</option></select></label></div><div class="metric-grid stats-metrics">${cards.map(([value,label])=>`<article class="metric"><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`).join('')}</div><div class="analytics-grid"><section class="chart-card"><div class="tool-heading"><h2>Actividad de WhatsApp</h2><div class="chart-legend"><span class="incoming-key">Recibidos</span><span class="outgoing-key">Envíos aceptados</span></div></div>${total?`<svg viewBox="0 0 750 245" role="img" aria-label="Mensajes por día: ${m.incoming} recibidos y ${m.outgoing} envíos aceptados"><path d="M44 40V205H716" class="chart-axis"/><path d="M44 122H716M44 40H716" class="chart-grid"/><text x="30" y="209" text-anchor="end">0</text><text x="30" y="44" text-anchor="end">${max}</text><polyline points="${points('incoming')}" class="chart-line incoming-line"/><polyline points="${points('outgoing')}" class="chart-line outgoing-line"/><text x="44" y="232">${esc(daily[0].date.slice(5))}</text><text x="716" y="232" text-anchor="end">${esc(daily.at(-1).date.slice(5))}</text></svg>`:'<div class="chart-empty"><strong>Todo empieza con una conversación</strong><p>Cuando recibas o envíes mensajes, aparecerán aquí.</p></div>'}<details class="chart-data"><summary>Ver datos por día</summary><div class="table-scroll"><table><thead><tr><th>Día</th><th>Recibidos</th><th>Envíos aceptados</th></tr></thead><tbody>${daily.map(d=>`<tr><td>${esc(d.date)}</td><td>${d.incoming}</td><td>${d.outgoing}</td></tr>`).join('')}</tbody></table></div></details></section><section class="chart-card"><h2>Contactos por etapa</h2><p class="muted">Situación actual de todos tus contactos.</p><div class="stage-bars">${stages.map(s=>`<label><span>${esc(s.name)} ${s.isWon?'★':''}<strong>${s.count}</strong></span><meter min="0" max="${Math.max(1,...stages.map(v=>v.count))}" value="${s.count}" aria-label="${esc(s.name)}: ${s.count} contactos"></meter></label>`).join('')}</div><p class="muted">${m.openConversations} conversaciones abiertas.</p></section></div><section class="chart-card team-statistics"><h2>Distribución actual del equipo</h2><div class="table-scroll"><table><thead><tr><th>Asesor</th><th>Contactos asignados</th><th>Sin resolver</th><th>En etapa ganada</th></tr></thead><tbody>${team.map(p=>`<tr><td>${esc(p.name)}</td><td>${p.contacts}</td><td>${p.open}</td><td>${p.won}</td></tr>`).join('')}</tbody></table></div></section><p class="analytics-note muted">Las ventas registradas cuentan contactos que pasaron a una etapa ganada durante el periodo. El historial de movimientos se registra desde ${esc(new Intl.DateTimeFormat('es-PE',{dateStyle:'short',timeZone:'America/Lima'}).format(data.analyticsSince))}. El tiempo de respuesta mide el primer envío aceptado después de cada grupo de mensajes del contacto, con ${m.answeredTurns} turnos respondidos en este periodo. Un envío aceptado todavía puede no haberse entregado. Los registros se conservan hasta 90 días.</p>`;
  root.querySelector('#stats-period').onchange=e=>onRange(Number(e.target.value));
}
