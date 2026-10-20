import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
const mode=process.argv[2]??'hosted';
if(!['setup','hosted','contract'].includes(mode))throw Error('Unknown browser test mode');
const cli='node_modules/@playwright/test/cli.js';
if(!existsSync(cli))throw Error('Playwright is not installed. Run npm.cmd ci in normal Windows PowerShell.');
const cache=resolve('.local/playwright-cache');await mkdir(cache,{recursive:true});
const setupOnly=mode==='setup';
if(!setupOnly&&mode!=='contract'&&(!process.env.SUPABASE_URL||!process.env.SUPABASE_PUBLISHABLE_KEY||!process.env.DEMO_PASSWORD||!['test','development'].includes(process.env.APP_ENV??'')||process.env.DEMO_SEED_ACK!=='fictional-data-only'))throw Error('Hosted browser tests require the dedicated configured development project');
process.env.VITE_SUPABASE_URL=setupOnly?'':mode==='contract'?'https://supabase-contract.example.test':process.env.SUPABASE_URL;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY=setupOnly?'':mode==='contract'?'sb_publishable_contract_fixture':process.env.SUPABASE_PUBLISHABLE_KEY;
const {build,preview}=await import('vite');
const root=resolve('apps/web');
const outDir=resolve('.local/browser-dist',mode);
await build({root,configFile:false,build:{outDir,emptyOutDir:false}});
// Own the preview directly so Windows shell/task-tree shutdown cannot hang test teardown.
const server=await preview({root,configFile:false,build:{outDir},preview:{host:'127.0.0.1',port:5174,strictPort:true}});
try{
 const status=await new Promise((done,reject)=>{
  const child=spawn(process.execPath,[cli,'test'],{stdio:'inherit',windowsHide:true,env:{...process.env,PWTEST_CACHE_DIR:cache,SMARTTOWNSHIP_E2E_MODE:mode,SMARTTOWNSHIP_E2E_EXTERNAL_SERVER:'1',...(process.platform==='win32'&&!process.env.PLAYWRIGHT_CHANNEL?{PLAYWRIGHT_CHANNEL:'msedge'}:{})}});
  child.once('error',reject);child.once('exit',code=>done(code??1));
 });
 process.exitCode=status;
}finally{
 server.httpServer.closeAllConnections();
 await new Promise(done=>server.httpServer.close(done));
}
