import { randomUUID, createHash } from 'node:crypto';
import { HttpError, now, requireThat, vault } from './core.js';

export const mediaLimits = { 'image/jpeg':5*1024*1024, 'image/png':5*1024*1024, 'application/pdf':10*1024*1024 };
export function mediaFilename(value,mime) {
  const extension=mime==='application/pdf'?'.pdf':mime==='image/png'?'.png':'.jpg';
  let name=Array.from(String(value||'archivo').toWellFormed().replace(/[/\\<>\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g,'_').trim()).slice(0,120).join('')||'archivo';
  if(!(mime==='image/jpeg'?/\.jpe?g$/i:new RegExp('\\'+extension+'$','i')).test(name))name+=extension;
  return name;
}
export function validateMedia(bytes,mime) {
  const max=mediaLimits[mime];
  requireThat(max,'Elige una imagen JPG/PNG o un documento PDF.',415);
  requireThat(bytes.length>0&&bytes.length<=max,'Archivo demasiado grande. Máximo 5 MB por imagen y 10 MB por PDF.',413);
  const valid=mime==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':
    mime==='image/jpeg'?bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255:
    bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.subarray(12,16).toString()==='IHDR';
  requireThat(valid,'El contenido no coincide con el tipo del archivo.',415);
  if(mime==='image/png') {
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
    requireThat(width>0&&height>0&&width*height<=40000000,'La imagen tiene dimensiones demasiado grandes.');
  }
}
function trustedMediaUrl(value) {
  const url=new URL(value);
  requireThat(url.protocol==='https:'&&!url.username&&!url.password&&(!url.port||url.port==='443')&&
    (['lookaside.fbsbx.com','graph.facebook.com'].includes(url.hostname)||url.hostname.endsWith('.fbcdn.net')),
  'Meta devolvió una ubicación de archivo no admitida.',502);
  return url;
}
function matchesHash(bytes,hash) {
  if(!hash)return true;
  const actual=createHash('sha256').update(bytes).digest();
  return /^[a-f\d]{64}$/i.test(hash)?hash.toLowerCase()===actual.toString('hex'):
    hash.replace(/=$/,'')===actual.toString('base64').replace(/=$/,'');
}

export function mediaFiles(store,config,fetchImpl,credentials) {
  const secrets=vault(config.masterKey),pending=new Map();
  const companyLimit=config.mediaCompanyLimit||256*1024*1024,totalLimit=config.mediaTotalLimit||1024*1024*1024;
  let downloads=0,working=null,stopping=false;
  const context=a=>'media:'+a.company_id+':'+a.id;
  const find=(company,id)=>store.get('SELECT * FROM media_assets WHERE company_id=? AND id=?',company,id);
  function hasSpace(company,size,exclude='') {
    const total=store.get("SELECT coalesce(sum(size),0) AS n FROM media_assets WHERE id<>? AND state IN ('ready','pending')",exclude).n;
    const own=store.get("SELECT coalesce(sum(size),0) AS n FROM media_assets WHERE company_id=? AND id<>? AND state IN ('ready','pending')",company,exclude).n;
    return total+size<=totalLimit&&own+size<=companyLimit;
  }
  function saveUpload(company,file) {
    const bytes=Buffer.from(file.bytes),mime=file.mime;validateMedia(bytes,mime);
    const asset={id:randomUUID(),company_id:company};
    const filename=mediaFilename(file.filename,mime),hash=createHash('sha256').update(bytes).digest('hex');
    requireThat(hasSpace(company,bytes.length),'La empresa alcanzó su espacio disponible para archivos.',409);
    store.run("INSERT INTO media_assets(id,company_id,mime,filename,size,sha256,content,state,created) VALUES(?,?,?,?,?,?,?,'ready',?)",
      asset.id,company,mime,filename,bytes.length,hash,secrets.sealBytes(bytes,context(asset)),now());
    return asset.id;
  }
  function incoming(company,type,part,created) {
    if(!part||!['image','document'].includes(type)||!/^\d{1,60}$/.test(part.id||'')||!mediaLimits[part.mime_type])return null;
    if(type==='image'&&!part.mime_type.startsWith('image/')||type==='document'&&part.mime_type!=='application/pdf')return null;
    const id=randomUUID(),size=mediaLimits[part.mime_type],room=hasSpace(company,size);
    store.run("INSERT INTO media_assets(id,company_id,wa_id,mime,filename,size,sha256,state,created) VALUES(?,?,?,?,?,?,?,?,?)",
      id,company,part.id,part.mime_type,mediaFilename(part.filename||type,part.mime_type),room?size:0,String(part.sha256||'').slice(0,128),room?'pending':'unavailable',created);
    return id;
  }
  async function jsonResponse(response) {
    let value;try{value=await response.json();}catch{throw new HttpError(502,'Meta no pudo confirmar el archivo.');}
    if(!response.ok||value.error) {
      const error=new HttpError(502,'No se pudo obtener o subir el archivo a WhatsApp.');
      error.metaCode=String(value.error?.code||response.status);throw error;
    }
    return value;
  }
  async function upload(company,id,c) {
    const a=find(company,id);requireThat(a?.state==='ready','Archivo no disponible.',404);
    const form=new FormData();form.set('messaging_product','whatsapp');form.set('type',a.mime);
    form.set('file',new Blob([secrets.openBytes(a.content,context(a))],{type:a.mime}),a.filename);
    let result;
    try{result=await jsonResponse(await fetchImpl('https://graph.facebook.com/'+c.graphVersion+'/'+c.phone_id+'/media',
      {method:'POST',headers:{Authorization:'Bearer '+c.accessToken},body:form,signal:AbortSignal.timeout(15000)}));}
    catch(error){if(error instanceof HttpError)throw error;throw new HttpError(502,'No se pudo subir el archivo. El mensaje no se envió.');}
    requireThat(/^\d{1,60}$/.test(result.id||''),'Meta no confirmó el archivo.',502);
    store.run('UPDATE media_assets SET wa_id=? WHERE company_id=? AND id=?',result.id,company,id);
    return {id:result.id,filename:a.filename,mime:a.mime};
  }
  async function load(company,id) {
    let a=find(company,id);requireThat(a,'Archivo no encontrado.',404);
    if(a.state==='ready')return {bytes:secrets.openBytes(a.content,context(a)),mime:a.mime,filename:a.filename};
    const key=company+':'+id;
    if(pending.has(key))return pending.get(key);
    requireThat(downloads<2,'Hay otros archivos descargándose. Intenta nuevamente en unos segundos.',429);
    requireThat(a.wa_id&&a.created>now()-7*86400000,'El archivo ya no está disponible en WhatsApp. Pide al contacto que lo reenvíe.',410);
    requireThat(hasSpace(company,mediaLimits[a.mime],id),'La empresa alcanzó su espacio disponible para archivos.',409);
    const task=(async()=>{
      downloads++;store.run("UPDATE media_assets SET state='pending',size=?,attempts=attempts+1,retry_at=? WHERE company_id=? AND id=?",mediaLimits[a.mime],now()+60000,company,id);
      try {
        const c=credentials(company);requireThat(c,'Conecta WhatsApp para descargar este archivo.',409);
        const signal=AbortSignal.timeout(15000),authorization={Authorization:'Bearer '+c.accessToken};
        const info=await jsonResponse(await fetchImpl('https://graph.facebook.com/'+c.graphVersion+'/'+a.wa_id+'?phone_number_id='+c.phone_id,{headers:authorization,signal,redirect:'error'}));
        requireThat(String(info.id)===a.wa_id&&info.mime_type===a.mime&&Number(info.file_size)>0&&Number(info.file_size)<=mediaLimits[a.mime],'El archivo no cumple los límites admitidos.',413);
        requireThat(typeof info.sha256==='string'&&/^(?:[a-f\d]{64}|[A-Za-z\d+/]{43}=?)$/i.test(info.sha256),'Meta no confirmó la integridad del archivo.',502);
        let url=trustedMediaUrl(info.url),response;
        for(let redirects=0;redirects<=2;redirects++) {
          response=await fetchImpl(url.href,{headers:authorization,redirect:'manual',signal});
          if(![301,302,303,307,308].includes(response.status))break;
          await response.body?.cancel();requireThat(redirects<2,'No se pudo descargar el archivo.',502);
          url=trustedMediaUrl(new URL(response.headers.get('location')||'',url).href);
        }
        requireThat(response.ok&&response.body,'No se pudo descargar el archivo de WhatsApp.',502);
        const contentType=(response.headers.get('content-type')||'').split(';')[0].trim();
        requireThat(contentType===a.mime,'El contenido recibido no coincide con el archivo.',415);
        const chunks=[];let size=0;
        for await(const chunk of response.body) {size+=chunk.length;requireThat(size<=mediaLimits[a.mime],'Archivo demasiado grande.',413);chunks.push(chunk);}
        const bytes=Buffer.concat(chunks);validateMedia(bytes,a.mime);
        requireThat(bytes.length===Number(info.file_size)&&matchesHash(bytes,info.sha256)&&matchesHash(bytes,a.sha256),'No se pudo comprobar la integridad del archivo.',502);
        // The company quota was reserved before the asynchronous download.
        store.run("UPDATE media_assets SET content=?,size=?,state='ready',sha256=? WHERE company_id=? AND id=?",
          secrets.sealBytes(bytes,context(a)),bytes.length,createHash('sha256').update(bytes).digest('hex'),company,id);
        return {bytes,mime:a.mime,filename:a.filename};
      } catch(error) {
        a=find(company,id);
        store.run("UPDATE media_assets SET state=?,size=? WHERE company_id=? AND id=?",a.attempts>=3?'unavailable':'pending',a.attempts>=3?0:mediaLimits[a.mime],company,id);
        if(error instanceof HttpError)throw error;
        throw new HttpError(502,'No se pudo descargar el archivo. Intenta nuevamente.');
      } finally {downloads--;pending.delete(key);}
    })();
    pending.set(key,task);return task;
  }
  function warm() {
    if(working||stopping)return working||Promise.resolve();
    working=(async()=>{
      const rows=store.all("SELECT id,company_id FROM media_assets WHERE state='pending' AND attempts<3 AND retry_at<=? ORDER BY created DESC LIMIT 4",now());
      for(const a of rows) {if(stopping)break;try{await load(a.company_id,a.id);}catch{}}
    })().finally(()=>{working=null;});
    return working;
  }
  function describe(company,id) {
    if(!id)return null;
    const a=store.get('SELECT id,mime,filename,size,state FROM media_assets WHERE company_id=? AND id=?',company,id);
    return a||null;
  }
  async function forMessage(company,messageId) {
    const m=store.get('SELECT attachment_id FROM messages WHERE company_id=? AND id=?',company,messageId);
    requireThat(m?.attachment_id,'Archivo no encontrado.',404);
    return load(company,m.attachment_id);
  }
  async function stop() {stopping=true;await Promise.allSettled([working,...pending.values()].filter(Boolean));}
  return {saveUpload,incoming,upload,load,warm,describe,forMessage,stop};
}
