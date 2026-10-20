import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const npm=process.env.npm_execpath;
if(!npm)throw Error('Run through npm run verify:local');
const checks=[
 ['backend-build',['run','build:api']],
 ['built-backend-smoke',['run','smoke:api']],
 ['native-http-and-domain-tests',['run','test:runtime']],
 ['typescript',['run','typecheck']],
 ['eslint',['run','lint']],
 ['vitest',['test']],
 ['frontend-build',['run','build:web']],
 ['browser-setup-and-mobile',['run','test:e2e:setup']],
 ['browser-module-contracts',['run','test:e2e:contract']],
 ['database-pgtap',['run','test:integration']],
 ['supabase-account-and-workflow-integration',['run','test:services']],
 ['dependency-audit',['audit','--audit-level=high','--cache','.npm-cache']]
];
const results=[];
for(const [name,args]of checks){
 const start=Date.now();
 console.log(`\nCHECK ${name}`);
 if(name==='dependency-audit'&&process.argv.includes('--audit-unavailable')){
  console.log('BLOCKED: live audit endpoint was denied. Run npm audit --audit-level=high in normal PowerShell. This is not a security pass.');
  results.push({name,exitCode:null,signal:null,error:'AUDIT_ENDPOINT_UNAVAILABLE',elapsedMs:0});continue;
 }
 const result=spawnSync(process.execPath,[npm,...args],{encoding:'utf8',timeout:name.startsWith('browser-')?300000:120000});
 if(result.stdout)process.stdout.write(result.stdout);
 if(result.stderr)process.stderr.write(result.stderr);
 results.push({name,exitCode:result.status,signal:result.signal,error:result.error?.code??null,elapsedMs:Date.now()-start});
}
await mkdir('.local',{recursive:true});
await writeFile('.local/verification-results.json',JSON.stringify({at:new Date().toISOString(),node:process.version,results},null,2)+'\n');
const failures=results.filter(result=>result.exitCode!==0);
console.log(`\nVerification: ${results.length-failures.length} passed, ${failures.length} failed/blocked. Results: .local/verification-results.json`);
process.exitCode=failures.length?1:0;
