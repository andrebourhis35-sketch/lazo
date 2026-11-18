import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { now, token, digest, requireThat, text, phone, stages } from './core.js';

export function openStore(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS companies(id TEXT PRIMARY KEY,name TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS memberships(company_id TEXT NOT NULL REFERENCES companies(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('owner','admin','agent')),PRIMARY KEY(company_id,user_id));
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),company_id TEXT NOT NULL REFERENCES companies(id),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS invites(hash TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),email TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','agent')),expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS contacts(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),name TEXT NOT NULL,phone TEXT NOT NULL,email TEXT NOT NULL DEFAULT '',location TEXT NOT NULL DEFAULT '',stage TEXT NOT NULL DEFAULT 'Nuevo contacto',owner_id TEXT REFERENCES users(id),note TEXT NOT NULL DEFAULT '',resolved INTEGER NOT NULL DEFAULT 0,unread INTEGER NOT NULL DEFAULT 0,last_inbound INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL,updated INTEGER NOT NULL,UNIQUE(company_id,phone));
    CREATE INDEX IF NOT EXISTS contacts_company ON contacts(company_id,updated DESC);
    CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),contact_id TEXT NOT NULL REFERENCES contacts(id),direction TEXT NOT NULL,body TEXT NOT NULL,type TEXT NOT NULL,status TEXT NOT NULL,wa_id TEXT UNIQUE,client_id TEXT,error_code TEXT,created INTEGER NOT NULL,updated INTEGER NOT NULL,UNIQUE(company_id,client_id));
    CREATE INDEX IF NOT EXISTS messages_contact ON messages(company_id,contact_id,created);
    CREATE TABLE IF NOT EXISTS connections(company_id TEXT PRIMARY KEY REFERENCES companies(id),phone_id TEXT UNIQUE NOT NULL,waba_id TEXT NOT NULL,config TEXT NOT NULL,checked INTEGER NOT NULL DEFAULT 0,webhook_at INTEGER NOT NULL DEFAULT 0,verified INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS status_events(wa_id TEXT PRIMARY KEY,company_id TEXT NOT NULL,status TEXT NOT NULL,error_code TEXT,updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,company_id TEXT,actor_id TEXT,event TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS workspace_settings(company_id TEXT PRIMARY KEY REFERENCES companies(id),analytics_since INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS pipeline_stages(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),name TEXT NOT NULL,position INTEGER NOT NULL,is_won INTEGER NOT NULL DEFAULT 0,UNIQUE(company_id,name));
    CREATE TABLE IF NOT EXISTS quick_replies(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),title TEXT NOT NULL,shortcut TEXT NOT NULL,body TEXT NOT NULL,deleted INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL,updated INTEGER NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS quick_replies_shortcut ON quick_replies(company_id,shortcut) WHERE deleted=0;
    CREATE TABLE IF NOT EXISTS sale_events(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),contact_id TEXT NOT NULL REFERENCES contacts(id),kind TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sale_events_company ON sale_events(company_id,created);
    CREATE TABLE IF NOT EXISTS media_assets(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),wa_id TEXT,mime TEXT NOT NULL,filename TEXT NOT NULL,size INTEGER NOT NULL,sha256 TEXT NOT NULL DEFAULT '',content BLOB,state TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,retry_at INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS media_company ON media_assets(company_id,created);
    CREATE TABLE IF NOT EXISTS password_resets(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mail_jobs(id TEXT PRIMARY KEY,kind TEXT NOT NULL,company_id TEXT,user_id TEXT,proof TEXT,recipient TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL,expires INTEGER NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS mail_queue ON mail_jobs(state,created);
  `);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  // Additive migrations preserve existing contacts, conversations and sessions.
  tx(()=>{
    if(!all('PRAGMA table_info(contacts)').some(c=>c.name==='tags'))db.exec("ALTER TABLE contacts ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'");
    if(!all('PRAGMA table_info(messages)').some(c=>c.name==='attachment_id'))db.exec('ALTER TABLE messages ADD COLUMN attachment_id TEXT');
    for(const company of all('SELECT id FROM companies'))ensureWorkspace(company.id);
  });
  function ensureWorkspace(company) {
    if(get('SELECT 1 FROM workspace_settings WHERE company_id=?',company))return;
    run('INSERT INTO workspace_settings VALUES(?,?)',company,now());
    stages.forEach((name,i)=>run('INSERT INTO pipeline_stages VALUES(?,?,?,?,?)',randomUUID(),company,name,i,Number(i===stages.length-1)));
    // Preserve any pre-existing stage names instead of hiding their contacts.
    for(const c of all('SELECT DISTINCT stage FROM contacts WHERE company_id=?',company)) {
      if(!get('SELECT 1 FROM pipeline_stages WHERE company_id=? AND name=?',company,c.stage))
        run('INSERT INTO pipeline_stages VALUES(?,?,?,?,0)',randomUUID(),company,c.stage,100+all('SELECT id FROM pipeline_stages WHERE company_id=?',company).length);
    }
  }
  function tx(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  const audit = (company, user, event) => run('INSERT INTO audit(company_id,actor_id,event,created) VALUES(?,?,?,?)', company, user, event, now());
  function limit(key, max, ms) {
    run('DELETE FROM limits WHERE expires<?', now());
    const row = get('SELECT * FROM limits WHERE key=?', key);
    requireThat(!row || row.count < max, 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.', 429);
    run('INSERT INTO limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1', key, now()+ms);
  }
  function contact(company, id) {
    const row = get('SELECT * FROM contacts WHERE company_id=? AND id=?', company, id);
    requireThat(row, 'Contacto no encontrado.', 404);
    return row;
  }
  function ownerValid(company, id) {
    requireThat(!id || get('SELECT 1 FROM memberships WHERE company_id=? AND user_id=?', company, id), 'Responsable no disponible en esta empresa.');
  }
  function addContact(company, data, actor) {
    ensureWorkspace(company);
    const name=text(data.name,80,true), number=phone(data.phone),mail=text(data.email||'',254),location=text(data.location||'',100);
    if (mail) requireThat(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail), 'Revisa el correo.');
    ownerValid(company,data.ownerId);
    requireThat(!get('SELECT 1 FROM contacts WHERE company_id=? AND phone=?',company,number), 'Ese teléfono ya está en tus contactos.',409);
    const id=randomUUID();
    const first=get('SELECT name FROM pipeline_stages WHERE company_id=? AND is_won=0 ORDER BY position,id LIMIT 1',company);
    run('INSERT INTO contacts(id,company_id,name,phone,email,location,stage,owner_id,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?)',id,company,name,number,mail,location,first.name,data.ownerId||actor,now(),now());
    audit(company,actor,'contact.created');
    return contact(company,id);
  }
  function updateContact(company,id,data,actor) {
    ensureWorkspace(company);
    const c=contact(company,id);
    const beforeWon=Boolean(get('SELECT is_won FROM pipeline_stages WHERE company_id=? AND name=?',company,c.stage)?.is_won);
    if (data.stage!==undefined) {requireThat(get('SELECT 1 FROM pipeline_stages WHERE company_id=? AND name=?',company,data.stage),'Etapa no válida.');c.stage=data.stage;}
    if (data.note!==undefined) c.note=text(data.note,4000);
    if (data.name!==undefined) c.name=text(data.name,80,true);
    if (data.ownerId!==undefined) {ownerValid(company,data.ownerId);c.owner_id=data.ownerId||null;}
    if (data.resolved!==undefined) {requireThat(typeof data.resolved==='boolean','Estado no válido.');c.resolved=Number(data.resolved);}
    if(data.tags!==undefined) {
      requireThat(Array.isArray(data.tags)&&data.tags.length<=8,'Usa hasta ocho etiquetas por contacto.');
      const seen=new Set(),tags=[];
      for(const value of data.tags) {const tag=text(value,30,true),key=tag.toLocaleLowerCase('es');requireThat(!/[,\x00-\x1f]/.test(tag),'Usa etiquetas sin comas ni saltos de línea.');if(!seen.has(key)){seen.add(key);tags.push(tag);}}
      c.tags=JSON.stringify(tags);
    }
    const afterWon=Boolean(get('SELECT is_won FROM pipeline_stages WHERE company_id=? AND name=?',company,c.stage)?.is_won);
    tx(()=>{
      run('UPDATE contacts SET stage=?,note=?,name=?,owner_id=?,resolved=?,tags=?,updated=? WHERE company_id=? AND id=?',c.stage,c.note,c.name,c.owner_id,c.resolved,c.tags,now(),company,id);
      if(beforeWon!==afterWon)run('INSERT INTO sale_events VALUES(?,?,?,?,?)',randomUUID(),company,id,afterWon?'won':'reopened',now());
      audit(company,actor,'contact.updated');
    });
    return contact(company,id);
  }
  function assertCredential(user, proof={}) {
    if(proof.passwordHash!==undefined)requireThat(get('SELECT password FROM users WHERE id=?',user)?.password===proof.passwordHash,'El acceso cambió. Inicia sesión de nuevo.',401);
    if(proof.parentHash!==undefined)requireThat(member(proof.parentHash)?.user_id===user,'El acceso cambió. Inicia sesión de nuevo.',401);
  }
  function session(user,company,proof={}) {
    assertCredential(user,proof);
    requireThat(get('SELECT 1 FROM memberships WHERE company_id=? AND user_id=?',company,user),'Esta cuenta ya no tiene acceso a la empresa.',401);
    const secret=token(),csrf=token();
    run('DELETE FROM sessions WHERE expires<?',now());
    run('INSERT INTO sessions(hash,user_id,company_id,csrf,expires) VALUES(?,?,?,?,?)',digest(secret),user,company,csrf,now()+12*60*60*1000);
    return {secret,csrf};
  }
  function member(hash) {
    return get(`SELECT s.*,u.name,u.email,m.role,c.name AS company_name FROM sessions s JOIN users u ON u.id=s.user_id JOIN memberships m ON m.user_id=s.user_id AND m.company_id=s.company_id JOIN companies c ON c.id=s.company_id WHERE s.hash=? AND s.expires>?`,hash,now());
  }
  function purge() {
    const cutoff=now()-90*86400000;
    run('DELETE FROM messages WHERE created<?',cutoff);
    run('DELETE FROM media_assets WHERE created<? AND id NOT IN (SELECT attachment_id FROM messages WHERE attachment_id IS NOT NULL)',cutoff);
    run('DELETE FROM sale_events WHERE created<?',cutoff);
    run('DELETE FROM status_events WHERE updated<?',cutoff);
    run('DELETE FROM audit WHERE created<?',cutoff);
    run('DELETE FROM invites WHERE expires<? OR used=1',now()-86400000);
    run('DELETE FROM password_resets WHERE expires<?',now()-86400000);
    run("UPDATE mail_jobs SET state='expired',payload='' WHERE state='queued' AND expires<=?",now());
    run('DELETE FROM mail_jobs WHERE created<?',now()-7*86400000);
    run('DELETE FROM sessions WHERE expires<?',now());
  }
  return { db,run,get,all,tx,audit,limit,contact,addContact,updateContact,session,member,purge,ensureWorkspace,assertCredential,close:()=>db.close() };
}
