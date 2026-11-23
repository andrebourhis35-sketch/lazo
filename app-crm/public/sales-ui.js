import { mountSalesGlobe } from './sales-globe.js?v=20261123-fluido';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const amount=(cents,currency)=>new Intl.NumberFormat('es-PE',{style:'currency',currency,currencyDisplay:'code'}).format(cents/100);
const date=new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeZone:'America/Lima'});
const options=(items,selected)=>items.map(([id,label])=>`<option value="${esc(id)}"${id===selected?' selected':''}>${esc(label)}</option>`).join('');

export async function openSalesCatalog(api) {
  let {offers}=await api('/sales-catalog');
  const dialog=document.createElement('dialog');
  dialog.className='sales-catalog-dialog';
  dialog.setAttribute('aria-labelledby','sales-catalog-title');
  document.body.append(dialog);
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  function render(offer={}) {
    const select=(name,items,selected)=>`<select name="${name}">${options(items,selected)}</select>`;
    const input=(name,label,max,value='',extra='')=>`<label>${label}<input name="${name}" maxlength="${max}" value="${esc(value)}" required ${extra}></label>`;
    dialog.innerHTML=`
      <header class="section-heading"><h2 id="sales-catalog-title">Catálogo de ofertas</h2><button type="button" class="secondary" data-close>Cerrar</button></header>
      <section class="sales-catalog-list" aria-label="Ofertas guardadas">
        ${offers.map(row=>`<button type="button" class="secondary" data-edit="${esc(row.id)}"><strong>${esc(row.name)} · ${esc(row.plan)}</strong><span>${esc(row.market)} · ${amount(row.cents,row.currency)}</span></button>`).join('')||'<p>Todavía no hay ofertas.</p>'}
      </section>
      <form>
        <h3>${offer.id?'Editar oferta':'Nueva oferta'}</h3>
        <section class="sales-catalog-fields">
          ${input('name','Nombre del producto',100,offer.name)}
          ${input('product','Código del producto',50,offer.product,'pattern="[a-zA-Z0-9][a-zA-Z0-9_\\-]*"')}
          ${input('plan','Plan',100,offer.plan)}
          ${input('market','País o mercado',60,offer.market)}
          ${input('price','Precio',12,offer.cents?(offer.cents/100).toFixed(2):'','inputmode="decimal"')}
          <label>Moneda${select('currency',[['PEN','PEN'],['USD','USD'],['EUR','EUR']],offer.currency)}</label>
        </section>
        <label>Forma de pago${select('mode',[['prepaid','Pago anticipado'],['postpaid','Contra entrega']],offer.mode)}</label>
        <label>Bonos incluidos<textarea name="bonuses" rows="2" maxlength="900">${esc(offer.bonuses)}</textarea></label>
        <label>Instrucciones de pago<textarea name="instructions" rows="2" maxlength="1500">${esc(offer.instructions)}</textarea></label>
        ${input('link','Enlace privado de entrega',1500,offer.link,'type="url"')}
        <p role="alert" data-error></p>
        <footer class="dialog-actions">
          ${offer.id?'<button type="button" class="secondary" data-archive>Archivar</button><button type="button" class="secondary" data-new>Nueva oferta</button>':''}
          <button type="submit" class="send">Guardar oferta</button>
        </footer>
      </form>`;
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();
    dialog.querySelectorAll('[data-edit]').forEach(button=>{
      button.onclick=()=>render(offers.find(row=>row.id===button.dataset.edit));
    });
    const path='/sales-catalog'+(offer.id?'/'+offer.id:'');
    async function change(method,body) {
      const form=dialog.querySelector('form');
      form.inert=true;
      try {
        ({offers}=await api(path,{method,body}));
        if(dialog.open)render();
      }catch(error){if(dialog.open)form.querySelector('[data-error]').textContent=error.message;}
      finally{form.inert=false;}
    }
    const form=dialog.querySelector('form');
    form.onsubmit=event=>{
      event.preventDefault();
      void change(offer.id?'PUT':'POST',Object.fromEntries(new FormData(form)));
    };
    if(offer.id){
      dialog.querySelector('[data-new]').onclick=()=>render();
      dialog.querySelector('[data-archive]').onclick=()=>void change('DELETE',{});
    }
  }
  render();
  dialog.showModal();
}

export function renderSales(root,data,filters,{onFilter,onChat,onPipeline,onNewContact,onCatalog}) {
  const totals=data.currencies.reduce((sum,row)=>({
    orders:sum.orders+row.orders,confirmed:sum.confirmed+row.confirmed_orders,
    pending:sum.pending+row.pending_orders,sent:sum.sent+row.access_sent,review:sum.review+row.review_orders,
  }),{orders:0,confirmed:0,pending:0,sent:0,review:0});
  const countryOptions=data.markets.map(row=>[row.country,row.name]);
  if(filters.country&&!countryOptions.some(([code])=>code===filters.country))countryOptions.push([filters.country,filters.countryLabel||filters.country]);
  root.innerHTML=`
    <header class="sales-toolbar">
      <div class="sales-filters">
        <label>Período<select data-filter="days">${options([['7','Últimos 7 días'],['30','Últimos 30 días'],['90','Últimos 90 días'],['all','Todo el historial']],filters.days)}</select></label>
        <label>Moneda<select data-filter="currency">${options([['','Todas las monedas'],['PEN','PEN · Soles'],['USD','USD · Dólares'],['EUR','EUR · Euros']],filters.currency)}</select></label>
        <label>País estimado<select data-filter="country">${options([['','Todos los países'],...countryOptions],filters.country)}</select></label>
      </div>
      <div class="sales-actions">${onCatalog?'<button type="button" class="secondary" id="sales-catalog-open">Catálogo</button>':''}<button type="button" class="secondary" id="sales-pipeline">Ver embudo</button><button type="button" class="send" id="sales-new-contact">Nuevo contacto</button></div>
    </header>
    <nav class="sales-queue" aria-label="Pedidos que requieren atención">
      ${[['collect','Por cobrar'],['review','Por verificar'],['deliver','Por entregar']].map(([id,label])=>`<button type="button" class="secondary" data-queue="${id}" aria-pressed="${filters.queue===id}"><strong>${data.queues[id]}</strong> ${label}</button>`).join('')}
      ${filters.queue?'<button type="button" class="secondary" data-queue="">Todos los pedidos</button>':''}
    </nav>
    <div class="sales-metrics">
      ${[[totals.orders,'Pedidos'],[totals.confirmed,'Abonos confirmados'],[totals.pending,'Por cobrar'],[totals.sent,'Accesos enviados']].map(([n,label])=>`<article class="sales-card"><strong>${n}</strong><span>${label}</span></article>`).join('')}
    </div>
    <div class="sales-grid">
      <section class="sales-card sales-money">
        <h2>Cobros por moneda</h2>
        <p class="sales-muted">Importes de los pedidos creados en el período. Sin conversión entre monedas.</p>
        ${data.currencies.length?data.currencies.map(row=>`<article class="sales-currency">
          <h3>${esc(row.currency)}</h3>
          <dl><dt>Confirmado</dt><dd>${amount(row.confirmed_cents,row.currency)}</dd><dt>Pendiente</dt><dd>${amount(row.pending_cents,row.currency)}</dd></dl>
          <div class="sales-money-bar" aria-hidden="true"><progress value="${row.confirmed_cents}" max="${Math.max(1,row.confirmed_cents+row.pending_cents)}"></progress></div>
        </article>`).join(''):'<p class="sales-empty">Todavía no hay pedidos con estos filtros.</p>'}
        ${totals.review?`<p class="sales-review">${totals.review} con comprobante por revisar.</p>`:''}
      </section>
      <section class="sales-card sales-geography">
        <h2>Pedidos por país</h2>
        <p class="sales-muted">Estimado por el prefijo del teléfono del cliente.</p>
        <div class="sales-globe-stage">
          <canvas width="640" height="640" tabindex="0" aria-label="Globo de pedidos por país" aria-describedby="globe-help"></canvas>
          <div class="sales-globe-controls">
            <button type="button" class="secondary" data-globe-left aria-label="Girar el globo a la izquierda">←</button>
            <button type="button" class="secondary" data-globe-home>Centrar en América</button>
            <button type="button" class="secondary" data-globe-right aria-label="Girar el globo a la derecha">→</button>
          </div>
        </div>
        <p class="sales-globe-help" id="globe-help">Arrastra el globo para explorar.</p>
        ${data.markets.length?`<ul class="sales-country-list">${data.markets.map(row=>`<li><button type="button" class="secondary" data-country="${esc(row.country)}" aria-pressed="${filters.country===row.country}"><span>${esc(row.name)}</span><strong>${row.orders}</strong></button></li>`).join('')}</ul>`:''}
      </section>
    <section class="sales-card sales-orders" id="sales-order-list">
      <h2>${({collect:'Pedidos por cobrar',review:'Comprobantes por verificar',deliver:'Pedidos por entregar'})[filters.queue]||'Pedidos recientes'}</h2>
      ${data.recent.length?`<div class="table-scroll"><table>
        <thead><tr><th>Cliente</th><th>Plan</th><th>País estimado</th><th>Importe</th><th>Pago</th><th>Acceso</th><th>Fecha</th></tr></thead>
        <tbody>${data.recent.map(row=>`<tr>
          <td><button type="button" class="open-chat" data-sales-contact="${esc(row.contact_id)}" data-sales-order="${esc(row.id)}">${esc(row.contact)}</button></td>
          <td>${esc(row.plan)}</td><td>${esc(row.countryName)}</td><td>${amount(row.cents,row.currency)}</td>
          <td>${row.confirmed_at?'Confirmado':row.has_proof?'Por verificar':row.charged?'Pendiente':'Sin cobrar'}</td>
          <td>${({failed:'Falló',unknown:'Sin confirmar',queued:'En cola'})[row.delivery_status]||(row.access_sent?'Enviado':'Pendiente')}</td><td>${date.format(row.created)}</td>
        </tr>`).join('')}</tbody></table></div>`:'<p class="sales-muted">Los pedidos de tus flujos de venta aparecerán aquí.</p>'}
    </section>
    </div>`;
  mountSalesGlobe(root.querySelector('.sales-globe-stage'),data.markets,filters.country);
  root.onchange=event=>{
    const key=event.target.dataset.filter;
    if(key)onFilter(key,event.target.value,event.target.selectedOptions[0]?.text);
  };
  root.onclick=event=>{
    const button=event.target.closest('button');
    if(button?.id==='sales-catalog-open')onCatalog();
    if(button?.hasAttribute('data-queue'))onFilter('queue',button.dataset.queue);
    if(!button)return;
    if(button.id==='sales-pipeline')onPipeline();
    else if(button.id==='sales-new-contact')onNewContact();
    else if(button.dataset.salesContact)onChat(button.dataset.salesContact,button.dataset.salesOrder);
    else if(button.dataset.country)onFilter('country',button.dataset.country===filters.country?'':button.dataset.country,button.querySelector('span').textContent);
  };
}
