import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execute=promisify(execFile),fixture=fileURLToPath(new URL('./recovery-race-fixture.mjs',import.meta.url));
for(const [mode,title] of [
  ['login','an in-progress login cannot open a session after its password was changed'],
  ['invitation','an in-progress invitation cannot consume a stale password or session'],
  ['connection','a provider check cannot save credentials after the initiating session was revoked'],
  ['body','requests waiting for a body cannot reuse a revoked session or mutate contacts']
])test(title,async()=>{
  const result=await execute(process.execPath,[fixture,mode],{
    env:{...process.env,UV_THREADPOOL_SIZE:'1'},timeout:60000,maxBuffer:16384});
  assert.deepEqual(JSON.parse(result.stdout.trim()),{ok:true,mode});
});
