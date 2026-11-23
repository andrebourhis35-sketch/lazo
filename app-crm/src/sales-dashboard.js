import { now, requireThat } from './core.js';

// Countries with unambiguous prefixes in the markets supported by this view.
const regions = [
  ['ECU','Ecuador','593'], ['PAN','Panamá','507'], ['BOL','Bolivia','591'],
  ['PRY','Paraguay','595'], ['URY','Uruguay','598'], ['CRI','Costa Rica','506'],
  ['GTM','Guatemala','502'], ['SLV','El Salvador','503'], ['HND','Honduras','504'],
  ['NIC','Nicaragua','505'], ['PER','Perú','51'], ['MEX','México','52'],
  ['ARG','Argentina','54'], ['BRA','Brasil','55'], ['CHL','Chile','56'],
  ['COL','Colombia','57'], ['VEN','Venezuela','58'], ['ESP','España','34'],
  ['FRA','Francia','33'], ['ITA','Italia','39'], ['PRT','Portugal','351'],
];
const names = new Map(regions.map(([code,name])=>[code,name]));
names.set('unknown','Sin país identificado');
const countryExpr = 'CASE '+regions.map(([code,,prefix])=>"WHEN c.phone LIKE '"+prefix+"%' THEN '"+code+"' ").join('')+"ELSE 'unknown' END";

export function salesDashboard(store, company, query) {
  const period=query.get('days')||'30';
  const currency=query.get('currency')||'';
  const country=query.get('country')||'';
  requireThat(['7','30','90','all'].includes(period),'Período no válido.');
  requireThat(['','PEN','USD','EUR'].includes(currency),'Moneda no válida.');
  requireThat(!country||names.has(country),'País no válido.');
  const cutoff=period==='all'?0:now()-Number(period)*86400000;

  const orders=`SELECT o.id,o.contact_id,c.name AS contact,o.plan,o.product,o.currency,o.cents,o.created,
    o.charged_at,o.confirmed_at,o.proof_id,o.delivery_id,${countryExpr} AS country
    FROM flow_orders o JOIN contacts c ON c.id=o.contact_id AND c.company_id=o.company_id
    WHERE o.company_id=? AND o.created>=? AND (?='' OR o.currency=?)`;
  const args=[company,cutoff,currency,currency];
  const currencies=store.all(`SELECT currency,COUNT(*) AS orders,
    SUM(CASE WHEN confirmed_at IS NOT NULL THEN cents ELSE 0 END) AS confirmed_cents,
    SUM(CASE WHEN charged_at IS NOT NULL AND confirmed_at IS NULL THEN cents ELSE 0 END) AS pending_cents,
    COUNT(confirmed_at) AS confirmed_orders,
    SUM(CASE WHEN charged_at IS NOT NULL AND confirmed_at IS NULL THEN 1 ELSE 0 END) AS pending_orders,
    SUM(CASE WHEN confirmed_at IS NULL AND proof_id IS NOT NULL THEN 1 ELSE 0 END) AS review_orders,
    COUNT(delivery_id) AS access_sent
    FROM (${orders}) WHERE (?='' OR country=?) GROUP BY currency ORDER BY currency`,...args,country,country);
  const markets=store.all(`SELECT country,COUNT(*) AS orders,COUNT(confirmed_at) AS confirmed
    FROM (${orders}) GROUP BY country ORDER BY orders DESC,country`,...args)
    .map(row=>({...row,name:names.get(row.country)}));
  const recent=store.all(`SELECT id,contact_id,contact,plan,product,currency,cents,created,country,confirmed_at,
    proof_id IS NOT NULL AS has_proof,charged_at IS NOT NULL AS charged,delivery_id IS NOT NULL AS access_sent
    FROM (${orders}) WHERE (?='' OR country=?) ORDER BY created DESC,id DESC LIMIT 40`,...args,country,country)
    .map(row=>({...row,countryName:names.get(row.country)}));
  return {currencies,markets,recent};
}
