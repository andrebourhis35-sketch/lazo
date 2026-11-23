import { mountSalesGlobe } from './sales-globe.js?v=20261123-fluido';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const amount=(cents,currency)=>new Intl.NumberFormat('es-PE',{style:'currency',currency,currencyDisplay:'code'}).format(cents/100);
const date=new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeZone:'America/Lima'});
const options=(items,selected)=>items.map(([id,label])=>`<option value="${esc(id)}"${id===selected?' selected':''}>${esc(label)}</option>`).join('');

export function renderSales(root,data,filters,{onFilter,onChat,onPipeline,onNewContact}) {
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
      <div class="sales-actions"><button type="button" class="secondary" id="sales-pipeline">Ver embudo</button><button type="button" class="send" id="sales-new-contact">Nuevo contacto</button></div>
    </header>
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
    <section class="sales-card sales-orders">
      <h2>Pedidos recientes</h2>
      ${data.recent.length?`<div class="table-scroll"><table>
        <thead><tr><th>Cliente</th><th>Plan</th><th>País estimado</th><th>Importe</th><th>Pago</th><th>Acceso</th><th>Fecha</th></tr></thead>
        <tbody>${data.recent.map(row=>`<tr>
          <td><button type="button" class="open-chat" data-sales-contact="${esc(row.contact_id)}">${esc(row.contact)}</button></td>
          <td>${esc(row.plan)}</td><td>${esc(row.countryName)}</td><td>${amount(row.cents,row.currency)}</td>
          <td>${row.confirmed_at?'Confirmado':row.has_proof?'Por verificar':row.charged?'Pendiente':'Sin cobrar'}</td>
          <td>${row.access_sent?'Enviado':'Pendiente'}</td><td>${date.format(row.created)}</td>
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
    if(!button)return;
    if(button.id==='sales-pipeline')onPipeline();
    else if(button.id==='sales-new-contact')onNewContact();
    else if(button.dataset.salesContact)onChat(button.dataset.salesContact);
    else if(button.dataset.country)onFilter('country',button.dataset.country===filters.country?'':button.dataset.country,button.querySelector('span').textContent);
  };
}
