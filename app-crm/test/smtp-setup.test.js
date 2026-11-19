import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { verifySmtp } from '../deploy/verify-smtp.mjs';

const input = {host:'smtp.zoho.com',port:465,user:'fixture@example.test',password:'synthetic-private-password'};

test('SMTP setup verifies TLS and authentication without sending mail', async () => {
  let closed = false, sends = 0;
  const result = await verifySmtp(input, options => {
    assert.equal(options.secure, true);
    assert.equal(options.tls.rejectUnauthorized, true);
    assert.equal(options.auth.pass, input.password);
    return {verify:async()=>{},sendMail:async()=>{sends++;},close:()=>{closed=true;}};
  });
  assert.deepEqual(result,{ok:true});
  assert.equal(closed,true);
  assert.equal(sends,0);
});

test('SMTP setup returns only fixed error categories and closes failed transports', async () => {
  for (const [error, code] of [
    [{code:'EAUTH',responseCode:535},'smtp-auth'],
    [{code:'ERR_TLS_CERT_ALTNAME_INVALID'},'smtp-tls'],
    [{code:'ETIMEDOUT'},'smtp-connection'],
    [{responseCode:454},'smtp-temporary'],
    [{code:'EAUTH',responseCode:454},'smtp-temporary'],
    [{code:input.password,responseCode:input.password},'smtp-check']
  ]) {
    let closed = false;
    const result = await verifySmtp(input,()=>({
      verify:async()=>{throw {...error,message:input.password,response:input.password,auth:input};},
      close:()=>{closed=true;}
    }));
    assert.deepEqual(result,{ok:false,error:code});
    assert.equal(JSON.stringify(result).includes(input.password),false);
    assert.equal(closed,true);
  }
});

test('SMTP setup rejects invalid settings before any provider request', async () => {
  let requests = 0;
  const result = await verifySmtp({...input,host:'unapproved.example.test'},()=>{requests++;});
  assert.deepEqual(result,{ok:false,error:'smtp-settings'});
  assert.equal(requests,0);
});

test('SMTP verifier CLI also runs through the release symlink', {skip:process.platform==='win32'}, () => {
  const directory = mkdtempSync(join(tmpdir(),'lazo-smtp-cli-'));
  try {
    const link = join(directory,'verify-smtp.mjs');
    symlinkSync(fileURLToPath(new URL('../deploy/verify-smtp.mjs',import.meta.url)),link);
    const run = spawnSync(process.execPath,[link],{
      input:JSON.stringify({...input,host:'unapproved.example.test'}),encoding:'utf8',timeout:5000
    });
    assert.equal(run.status,1);
    assert.deepEqual(JSON.parse(run.stdout),{ok:false,error:'smtp-settings'});
    assert.equal(run.stderr.includes(input.password),false);
  } finally { rmSync(directory,{recursive:true,force:true}); }
});
