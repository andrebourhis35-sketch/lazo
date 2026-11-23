import { randomUUID } from 'node:crypto';
import { now, requireThat } from './core.js';
import { amountInCents } from './flow-model.js';

function field(value,max) {
  const clean=typeof value==='string'?value.trim():'';
  requireThat(clean.length<=max,'Un campo de la oferta supera su longitud máxima.');
  return clean;
}

export function salesCatalog(store) {
  function list(company) {
    return store.all(`SELECT id,product,name,plan,market,currency,cents,bonuses,link,instructions,mode
      FROM sales_catalog WHERE company_id=? AND archived=0 ORDER BY name,plan,market,currency LIMIT 500`,company);
  }
  function save(company,id,data,actor) {
    const product=field(data.product,50).toLowerCase();
    const name=field(data.name,100),plan=field(data.plan,100),market=field(data.market,60);
    const currency=data.currency,mode=data.mode,cents=amountInCents(data.price);
    const bonuses=field(data.bonuses,900),instructions=field(data.instructions,1500),link=field(data.link,1500);
    requireThat(/^[a-z0-9][a-z0-9_-]*$/.test(product)&&name&&plan&&market,'Completa el código, producto, plan y mercado.');
    requireThat(['PEN','USD','EUR'].includes(currency)&&['prepaid','postpaid'].includes(mode),'Moneda o modalidad no válida.');
    requireThat(cents>0,'Introduce un precio mayor a cero.');
    const url=URL.canParse(link)&&new URL(link);
    requireThat(url&&url.protocol==='https:'&&!url.username&&!url.password,'Usa un enlace HTTPS de entrega sin credenciales.');
    return store.tx(()=>{
      if(id)requireThat(store.get('SELECT id FROM sales_catalog WHERE id=? AND company_id=? AND archived=0',id,company),'Oferta no disponible.',404);
      else requireThat(store.get('SELECT COUNT(*) AS n FROM sales_catalog WHERE company_id=? AND archived=0',company).n<500,'Se alcanzó el límite de ofertas.',409);
      const variant=store.get('SELECT id FROM sales_catalog WHERE company_id=? AND product=? AND plan=? AND market=? AND currency=? AND archived=0',company,product,plan,market,currency);
      requireThat(!variant||variant.id===id,'Ya existe una oferta para ese producto, plan, mercado y moneda.',409);
      const values=[product,name,plan,market,currency,cents,bonuses,link,instructions,mode,now()];
      if(id)store.run('UPDATE sales_catalog SET product=?,name=?,plan=?,market=?,currency=?,cents=?,bonuses=?,link=?,instructions=?,mode=?,updated=? WHERE id=? AND company_id=?',...values,id,company);
      else store.run('INSERT INTO sales_catalog(id,company_id,product,name,plan,market,currency,cents,bonuses,link,instructions,mode,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',randomUUID(),company,...values);
      store.audit(company,actor,'sale.catalog-saved');
      return list(company);
    });
  }
  function archive(company,id,actor) {
    return store.tx(()=>{
      requireThat(store.run('UPDATE sales_catalog SET archived=1,updated=? WHERE id=? AND company_id=? AND archived=0',now(),id,company).changes,'Oferta no disponible.',404);
      store.audit(company,actor,'sale.catalog-archived');
      return list(company);
    });
  }
  return {list,save,archive};
}
