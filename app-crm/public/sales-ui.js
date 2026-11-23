import { mapPaths } from './sales-map.js?v=20261123';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const amount=(cents,currency)=>new Intl.NumberFormat('es-PE',{style:'currency',currency,currencyDisplay:'code'}).format(cents/100);
const date=new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeZone:'America/Lima'});
const options=(items,selected)=>items.map(([id,label])=>`<option value="${esc(id)}"${id===selected?' selected':''}>${esc(label)}</option>`).join('');

function map(markets,active) {
  const data=new Map(markets.map(row=>[row.country,row]));
  const paths=Object.entries(mapPaths).map(([code,d])=>{
    const market=data.get(code);
    const theme=code===active?'market-selected':market?'market-active':'market-empty';
    return `<path class="${theme}" d="${d}">${market?`<title>${esc(market.name)}: ${market.orders} pedidos</title>`:''}</path>`;
  }).join('');
  // Keep small markets, such as Panama, visible at the world map's scale.
  const points={PAN:[-80,8.5],ECU:[-78.5,-1.5],PER:[-75,-9],CRI:[-84,10],SLV:[-89,14],PRT:[-8,39.5]};
  const markers=Object.entries(points).filter(([code])=>data.has(code)).map(([code,[lon,lat]])=>
    `<circle class="${code===active?'market-selected':'market-active'}" cx="${(lon+180)*2}" cy="${(85-lat)*2}" r="3"><title>${esc(data.get(code).name)}</title></circle>`).join('');
  return `<svg class="sales-map" viewBox="0 0 720 287" role="img" aria-label="Mapa de países con pedidos"><g fill-rule="evenodd">${paths}</g>${markers}</svg>`;
}

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
        ${map(data.markets,filters.country)}
        ${data.markets.length?`<ul class="sales-country-list">${data.markets.map(row=>`<li><button type="button" class="secondary" data-country="${esc(row.country)}" aria-pressed="${filters.country===row.country}"><span>${esc(row.name)}</span><strong>${row.orders}</strong></button></li>`).join('')}</ul>`:'<p class="sales-muted">El mapa se resaltará cuando haya pedidos.</p>'}
      </section>
    </div>
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
    </section>`;
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
