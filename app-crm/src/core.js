import { randomBytes, createHash, scrypt, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';
import { promisify } from 'node:util';

export const stages = ['Nuevo contacto', 'En conversación', 'Propuesta enviada', 'Venta ganada'];
export const now = () => Date.now();
export const token = () => randomBytes(32).toString('base64url');
export const digest = value => createHash('sha256').update(value).digest('hex');
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function requireThat(condition, message, status = 400) {
  if (!condition) throw new HttpError(status, message);
}
export function text(value, max, required = false) {
  requireThat(typeof value === 'string', 'Revisa los campos del formulario.');
  const result = value.trim();
  requireThat(result.length <= max && (!required || result.length > 0), `Revisa el texto (máximo ${max} caracteres).`);
  return result;
}
export function email(value) {
  const result = text(value, 254, true).toLowerCase();
  requireThat(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result), 'Revisa el correo electrónico.');
  return result;
}
export function phone(value) {
  const result = text(value, 30).replace(/[+\s()-]/g, '');
  requireThat(/^\d{8,15}$/.test(result), 'Usa un teléfono internacional de 8 a 15 dígitos.');
  return result;
}
const scryptAsync = promisify(scrypt);
export async function passwordHash(password) {
  requireThat(typeof password === 'string' && password.length >= 12 && password.length <= 128,
    'Usa una contraseña de entre 12 y 128 caracteres.');
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 });
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function passwordMatches(password, stored) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [, salt, hash] = (stored || `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
  const actual = await scryptAsync(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 });
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}
export function vault(masterKey) {
  const key = Buffer.from(masterKey, 'base64');
  if (key.length !== 32) throw new Error('LAZO_MASTER_KEY debe contener una clave de 32 bytes en base64.');
  return {
    sealBytes(value, context) {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(context));
      const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    },
    openBytes(value, context) {
      const data = Buffer.from(value), cipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
      cipher.setAuthTag(data.subarray(12, 28)); cipher.setAAD(Buffer.from(context));
      return Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]);
    },
    seal(value, context) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(context));
      const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
    },
    open(value, context) {
      const data = Buffer.from(value, 'base64');
      const cipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
      cipher.setAuthTag(data.subarray(12, 28));
      cipher.setAAD(Buffer.from(context));
      return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString());
    }
  };
}
