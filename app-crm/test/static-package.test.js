import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';

test('an app-only release serves every visual dependency without the demo checkout', async () => {
  const directory=mkdtempSync(join(tmpdir(),'lazo-static-package-'));
  const source=fileURLToPath(new URL('../',import.meta.url));
  const app=join(directory,'app-crm');
  let server;
  try {
    mkdirSync(app);
    for(const folder of ['src','public','node_modules'])cpSync(join(source,folder),join(app,folder),{recursive:true});
    cpSync(join(source,'package.json'),join(app,'package.json'));
    assert.equal(existsSync(join(directory,'interfaz')),false);
    const {createServer}=await import(pathToFileURL(join(app,'src/server.js')).href);
    let providerRequests=0;
    server=createServer({database:':memory:',origin:'http://127.0.0.1',secureCookies:false,
      masterKey:randomBytes(32).toString('base64'),bootstrapHash:'',testRecipient:'51900000001'},
      {fetchImpl:async()=>{providerRequests++;throw new Error('No provider request expected');}});
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const base=`http://127.0.0.1:${server.address().port}`;
    const assets={
      '/app/':'text/html','/app/styles.css?v=20261118':'text/css','/app/crm.css?v=20261118':'text/css',
      '/app/chat-compact.css':'text/css','/app/marca.svg':'image/svg+xml','/app/app.css':'text/css','/app/app.js':'text/javascript',
      '/app/workspace-theme.js':'text/javascript',
      '/app/sales.css':'text/css','/app/sales-ui.js':'text/javascript','/app/sales-map.js':'text/javascript','/app/sales-globe.js':'text/javascript',
      '/app/work-ui.js':'text/javascript','/app/connections-ui.js':'text/javascript','/app/meta-signup.js':'text/javascript','/app/visual-preview.css':'text/css',
      '/app/visual-preview.js':'text/javascript','/app/marca-volumen.svg':'image/svg+xml'
    };
    for(const [path,type] of Object.entries(assets)) {
      const response=await fetch(base+path);
      assert.equal(response.status,200,path);
      assert.ok(response.headers.get('content-type').startsWith(type),path);
      const body=await response.text();assert.ok(body.length>0,path);
      if(path.startsWith('/app/styles.css'))assert.match(body,/font-family\s*:\s*['"]?Manrope/i);
      if(type==='image/svg+xml')assert.match(body,/<svg\b/);
    }
    assert.equal((await fetch(base+'/app/.env')).status,404);
    assert.equal(providerRequests,0);
  } finally {
    if(server){await server.lazo.mail.stop();await new Promise(resolve=>server.close(resolve));server.lazo.store.close();}
    rmSync(directory,{recursive:true,force:true});
  }
});
