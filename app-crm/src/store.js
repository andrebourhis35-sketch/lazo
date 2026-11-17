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
  `);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
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
    const name=text(data.name,80,true), number=phone(data.phone),mail=text(data.email||'',254),location=text(data.location||'',100);
    if (mail) requireThat(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail), 'Revisa el correo.');
    ownerValid(company,data.ownerId);
    requireThat(!get('SELECT 1 FROM contacts WHERE company_id=? AND phone=?',company,number), 'Ese teléfono ya está en tus contactos.',409);
    const id=randomUUID();
    run('INSERT INTO contacts(id,company_id,name,phone,email,location,owner_id,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',id,company,name,number,mail,location,data.ownerId||actor,now(),now());
    audit(company,actor,'contact.created');
    return contact(company,id);
  }
  function updateContact(company,id,data,actor) {
    const c=contact(company,id);
    if (data.stage!==undefined) {requireThat(stages.includes(data.stage),'Etapa no válida.');c.stage=data.stage;}
    if (data.note!==undefined) c.note=text(data.note,4000);
    if (data.name!==undefined) c.name=text(data.name,80,true);
    if (data.ownerId!==undefined) {ownerValid(company,data.ownerId);c.owner_id=data.ownerId||null;}
    if (data.resolved!==undefined) {requireThat(typeof data.resolved==='boolean','Estado no válido.');c.resolved=Number(data.resolved);}
    run('UPDATE contacts SET stage=?,note=?,name=?,owner_id=?,resolved=?,updated=? WHERE company_id=? AND id=?',c.stage,c.note,c.name,c.owner_id,c.resolved,now(),company,id);
    audit(company,actor,'contact.updated');return contact(company,id);
  }
  function session(user,company) {
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
    run('DELETE FROM status_events WHERE updated<?',cutoff);
    run('DELETE FROM audit WHERE created<?',cutoff);
    run('DELETE FROM invites WHERE expires<? OR used=1',now()-86400000);
    run('DELETE FROM sessions WHERE expires<?',now());
  }
  return { db,run,get,all,tx,audit,limit,contact,addContact,updateContact,session,member,purge,close:()=>db.close() };
}
