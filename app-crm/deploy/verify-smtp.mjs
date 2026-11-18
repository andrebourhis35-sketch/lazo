import nodemailer from 'nodemailer';
import { smtpOptions } from '../src/mail.js';

let transport;
try {
  const chunks=[];let size=0;
  for await(const part of process.stdin){size+=part.length;if(size>8192)throw new Error('Input too large');chunks.push(part);}
  transport=nodemailer.createTransport(smtpOptions(JSON.parse(Buffer.concat(chunks).toString('utf8'))));
  await transport.verify(); // TLS and authentication only: this does not send an email.
  console.log(JSON.stringify({ok:true}));
} catch {
  console.error('LAZO: no se pudo comprobar la conexión segura con Zoho Mail.');process.exitCode=1;
} finally {try {transport?.close();} catch {}}
