export async function connectFlowsServer() {
  const response=await fetch('/api/crm/session',{credentials:'same-origin'});
  if(!response.ok)throw new Error(response.status===401?'Inicia sesión en LAZO para guardar y activar flujos. Puedes seguir simulando sin iniciar sesión.':'No se pudo conectar con tu empresa. Recarga para reintentar.');
  const identity=await response.json();
  const request=async(path,method='GET',data)=>{
    const result=await fetch('/api/crm'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-Lazo-Client':'1','X-CSRF-Token':identity.csrf,'X-Lazo-Company':identity.company.id,'X-Lazo-User':identity.user.id},body:data===undefined?undefined:JSON.stringify(data)});
    let body;try{body=await result.json();}catch{throw new Error('El servidor no devolvió una respuesta válida.');}
    if(!result.ok){const error=new Error(body.error||'No se pudo completar la operación.');error.contextChanged=[401,403].includes(result.status)||body.code==='CONTEXT_CHANGED';throw error;}
    return body;
  };
  const [flows,members,catalog]=await Promise.all([request('/flows'),request('/members'),request('/sales-catalog')]);
  return {identity,request,flows:flows.flows,members:members.members,offers:catalog.offers};
}

export function welcomeFlow(memberId) {
  const kinds=['trigger','message','tag','assign','end'];
  const values=['hola','Hola {{nombre}}, gracias por escribir a LAZO. Hemos recibido tu mensaje y un asesor te atenderá pronto.','Interesado',memberId,''];
  const labels=['Mensaje recibido','Dar la bienvenida','Etiquetar contacto','Asignar asesor','Finalizar recorrido'];
  const nodes=kinds.map((kind,i)=>({id:'welcome-'+i,type:'lazo',position:{x:40+i*300,y:150},data:{kind,label:labels[i],value:values[i]}}));
  return {version:1,name:'Bienvenida automática',nodes,edges:nodes.slice(0,-1).map((node,i)=>({id:'welcome-edge-'+i,source:node.id,target:nodes[i+1].id,sourceHandle:'next',type:'smoothstep'}))};
}
