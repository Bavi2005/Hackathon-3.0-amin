import {cp,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const files=['apps/api/server.mjs','apps/api/handler.mjs','apps/api/security.mjs','apps/api/supabase.mjs','apps/api/headers.mjs','packages/contracts/parking-event.ts'];
for(const file of files){
  const check=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
  if(check.status!==0)process.exit(check.status??1);
}
await mkdir('dist/apps',{recursive:true});
await mkdir('dist/packages/contracts',{recursive:true});
await cp('apps/api','dist/apps/api',{recursive:true});
await cp('packages/contracts/parking-event.ts','dist/packages/contracts/parking-event.ts');
console.log('Backend built: dist/apps/api/server.mjs (Node 22.18+ native ESM/TypeScript stripping).');
