import nodemailer from 'nodemailer';
import { pathToFileURL } from 'node:url';
import { realpathSync } from 'node:fs';
import { smtpOptions } from '../src/mail.js';

// Only fixed categories leave this process. Never expose provider messages or objects.
function failure(error) {
  if ([421,450,451,452,454].includes(error?.responseCode)) return 'smtp-temporary';
  if (error?.code === 'EAUTH' || [534,535].includes(error?.responseCode)) return 'smtp-auth';
  if (error?.code === 'ETLS' || new Set(['CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT',
    'SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','ERR_TLS_CERT_ALTNAME_INVALID']).has(error?.code)) return 'smtp-tls';
  if (new Set(['ECONNECTION','ESOCKET','ETIMEDOUT','ECONNREFUSED','ECONNRESET',
    'ENOTFOUND','EAI_AGAIN','EHOSTUNREACH','EDNS']).has(error?.code)) return 'smtp-connection';
  return 'smtp-check';
}

export async function verifySmtp(input, factory = options => nodemailer.createTransport(options)) {
  let transport, options;
  try { options = smtpOptions(input); } catch { return {ok:false,error:'smtp-settings'}; }
  try {
    transport = factory(options);
    await transport.verify(); // TLS and authentication only: this does not send an email.
    return {ok:true};
  } catch (error) {
    return {ok:false,error:failure(error)};
  } finally { try { transport?.close(); } catch {} }
}

async function main() {
  let result;
  try {
    const chunks=[];let size=0;
    for await(const part of process.stdin){size+=part.length;if(size>8192)throw new Error('Input too large');chunks.push(part);}
    result = await verifySmtp(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch { result = {ok:false,error:'smtp-settings'}; }
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode=1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) await main();
