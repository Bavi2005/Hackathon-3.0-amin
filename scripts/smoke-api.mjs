import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
const child=spawn(process.execPath,['dist/apps/api/server.mjs'],{
  env:{...process.env,PORT:'0',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',DEVICE_ID:'',DEVICE_HMAC_SECRET:''},
  stdio:['ignore','pipe','pipe']
});
let deadline;
try{
  const [chunk]=await Promise.race([
    once(child.stdout,'data'),
    once(child,'exit').then(()=>{throw Error('Built API exited before listening');}),
    new Promise((_resolve,reject)=>{deadline=setTimeout(()=>reject(Error('API startup timeout')),5000);})
  ]);
  const {port}=JSON.parse(chunk.toString('utf8'));
  const live=await fetch(`http://127.0.0.1:${port}/healthz`);
  const ready=await fetch(`http://127.0.0.1:${port}/readyz`);
  assert.equal(live.status,200);
  assert.equal((await live.json()).code,'ALIVE');
  assert.equal(ready.status,503);
  assert.equal((await ready.json()).code,'NOT_CONFIGURED');
  console.log('Built backend smoke PASS: process boots; HTTP liveness 200; absent Supabase configuration fails readiness with 503.');
}finally{
  clearTimeout(deadline);
  child.kill();
}
