// Verifies recovery credentials locally without contacting Meta or printing secrets.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createDecipheriv, createHash } from 'node:crypto';

const directory = process.argv[2];
if (!directory) throw new Error('Falta la carpeta de recuperación aislada.');
const environment = readFileSync(join(directory, 'lazo-crm.env'), 'utf8');
const line = environment.split(/\r?\n/).find(s => s.startsWith('LAZO_MASTER_KEY='));
const encoded = line?.slice('LAZO_MASTER_KEY='.length).trim().replace(/^(?:"([^"]*)"|'([^']*)')$/, (_,a,b) => a ?? b);
const key = Buffer.from(encoded || '', 'base64');
if (key.length !== 32) throw new Error('La copia no contiene una clave maestra válida.');
function decrypt(value, context) {
  const cipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
  cipher.setAuthTag(value.subarray(12, 28));
  cipher.setAAD(Buffer.from(context));
  return Buffer.concat([cipher.update(value.subarray(28)), cipher.final()]);
}
const database = new DatabaseSync(join(directory, 'lazo.sqlite'), {readOnly:true});
try {
  let connections = 0, attachments = 0;
  for (const row of database.prepare('SELECT company_id,config FROM connections').all()) {
    const data = JSON.parse(decrypt(Buffer.from(row.config, 'base64'), row.company_id));
    if (!data.accessToken || !data.phoneId || !data.wabaId) throw new Error('Conexión recuperada incompleta.');
    connections++;
  }
  for (const row of database.prepare('SELECT id,company_id,content,sha256 FROM media_assets WHERE content IS NOT NULL').all()) {
    const plain = decrypt(Buffer.from(row.content), `media:${row.company_id}:${row.id}`);
    if (createHash('sha256').update(plain).digest('hex') !== row.sha256) throw new Error('Adjunto recuperado no válido.');
    attachments++;
  }
  console.log(JSON.stringify({ok:true,masterKeyMatches:true,connections,attachments,providerRequests:0}));
} finally { key.fill(0); database.close(); }
