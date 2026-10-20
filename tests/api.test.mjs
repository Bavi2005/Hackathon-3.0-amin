import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHmac,randomBytes,randomUUID} from 'node:crypto';
import {createBridgeHandler} from '../apps/api/handler.mjs';
import {createSupabaseAdapter} from '../apps/api/supabase.mjs';
import {parkingEvent} from '../packages/contracts/parking-event.ts';

const secret=randomBytes(32).toString('hex'),deviceId=randomUUID();
const event=()=>({eventId:randomUUID(),deviceId,sequence:1,occupied:2,observedAt:new Date().toISOString()});
test('bay contract accepts only versioned statuses and no client-selected bay identity',()=>{
 const e={schemaVersion:1,kind:'bay.occupancy',eventId:randomUUID(),deviceId,sequence:1,status:'FREE',observedAt:new Date().toISOString()};
 assert.equal(parkingEvent.safeParse(e).success,true);
 for(const changed of [{...e,bayId:randomUUID()},{...e,occupied:1},{...e,status:'available'},{...e,schemaVersion:2},{...e,sequence:-1}])assert.equal(parkingEvent.safeParse(changed).success,false);
});
test('HTTP signed bay event preserves authenticated device binding',async()=>{
 let received;const e={schemaVersion:1,kind:'bay.occupancy',eventId:randomUUID(),deviceId,sequence:1,status:'OCCUPIED',observedAt:new Date().toISOString()};
 await bridge({adapter:{ingest:async value=>{received=value;return true;}}},async url=>{
  assert.equal((await post(url,JSON.stringify(e))).response.status,202);assert.deepEqual(received,e);
  assert.equal((await post(url,JSON.stringify({...e,deviceId:randomUUID()}))).response.status,403);
 });
});
test('bay adapter routes normalized status to service-only bay RPC without invented bay identity',async()=>{
 let requested;
 const adapter=createSupabaseAdapter('https://example.test','nonfunctional-fixture-key',async(url,options)=>{requested={url:String(url),body:JSON.parse(options.body)};return new globalThis.Response(null,{status:204});});
 const e={schemaVersion:1,kind:'bay.occupancy',eventId:randomUUID(),deviceId,sequence:4,status:'FREE',observedAt:new Date().toISOString()};
 assert.equal(await adapter.ingest(e),true);assert.equal(requested.url,'https://example.test/rest/v1/rpc/ingest_parking_bay');
 assert.deepEqual(requested.body,{p_device:deviceId,p_event:e.eventId,p_sequence:4,p_status:'FREE',p_observed:e.observedAt});
});
function signed(body,timestamp=String(Date.now())){
  return{'content-type':'application/json','x-timestamp':timestamp,'x-signature':createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex')};
}
async function listen(handler,run){
  const server=createServer(handler);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  try{return await run(`http://127.0.0.1:${server.address().port}`);}
  finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
async function bridge(options,run){
  return listen(createBridgeHandler({secret,deviceId,adapter:{ready:async()=>true,ingest:async()=>true},...options}),run);
}
async function post(url,body,headers=signed(body)){
  const response=await fetch(`${url}/v1/iot/events`,{method:'POST',headers,body});
  const result=await response.json();
  assert.match(result.correlationId,/^[a-f0-9-]{36}$/);
  return{response,...result};
}

test('HTTP liveness remains healthy while missing configuration reports not ready',()=>bridge({adapter:null},async url=>{
  const live=await fetch(`${url}/healthz`),ready=await fetch(`${url}/readyz`);
  assert.equal(live.status,200);assert.equal(ready.status,503);
  assert.equal((await ready.json()).code,'NOT_CONFIGURED');
}));
test('HTTP rejects unsupported method and path',()=>bridge({},async url=>{
  assert.equal((await fetch(`${url}/v1/iot/events`)).status,404);
  assert.equal((await fetch(`${url}/unknown`)).status,404);
}));
test('HTTP readiness reflects active-device dependency status',async()=>{
  await bridge({},async url=>assert.equal((await fetch(`${url}/readyz`)).status,200));
  await bridge({adapter:{ready:async()=>false}},async url=>assert.equal((await fetch(`${url}/readyz`)).status,503));
});
test('HTTP production ingress requires forwarded HTTPS',()=>bridge({production:true},async url=>{
  const body=JSON.stringify(event());
  assert.equal((await post(url,body)).code,'HTTPS_REQUIRED');
  assert.equal((await post(url,body,{...signed(body),'x-forwarded-proto':'https'})).response.status,202);
}));
test('HTTP accepts a signed event and forwards only validated fields',async()=>{
  let received;
  await bridge({adapter:{ingest:async value=>{received=value;return true;}}},async url=>{
    const e=event(),body=JSON.stringify(e);
    const result=await post(url,body);
    assert.equal(result.response.status,202);assert.deepEqual(received,e);
    assert.equal(result.response.headers.get('cache-control'),'no-store');
    assert.equal(result.response.headers.get('access-control-allow-origin'),null);
  });
});
test('HTTP forged, altered and expired messages never reach the persistence adapter',async()=>{
  let writes=0;
  await bridge({adapter:{ingest:async()=>{writes++;return true;}}},async url=>{
    const body=JSON.stringify(event());
    assert.equal((await post(url,body,{'content-type':'application/json'})).response.status,401);
    assert.equal((await post(url,body+' ',signed(body))).response.status,401);
    assert.equal((await post(url,body,signed(body,String(Date.now()-61000)))).response.status,401);
    assert.equal(writes,0);
  });
});
test('HTTP binds the credential to the configured device',()=>bridge({},async url=>{
  const result=await post(url,JSON.stringify({...event(),deviceId:randomUUID()}));
  assert.equal(result.response.status,403);assert.equal(result.code,'DEVICE_SCOPE');
}));
test('HTTP refuses invalid JSON, overflow, extra scope fields and wrong media type',()=>bridge({},async url=>{
  for(const body of ['{',JSON.stringify({...event(),tenantId:randomUUID()}),JSON.stringify({...event(),sequence:Number.MAX_SAFE_INTEGER+1}),JSON.stringify({...event(),occupied:2147483648})]){
    assert.equal((await post(url,body)).response.status,400);
  }
  const body=JSON.stringify(event());
  assert.equal((await post(url,body,{...signed(body),'content-type':'application/json-evil'})).response.status,415);
}));
test('HTTP bounds payload size before persistence',()=>bridge({},async url=>{
  const body=JSON.stringify({padding:'x'.repeat(5000)});
  assert.equal((await post(url,body)).response.status,413);
}));
test('HTTP maps database rejection to conflict without claiming a replay was saved',()=>bridge({adapter:{ingest:async()=>false}},async url=>{
  const result=await post(url,JSON.stringify(event()));assert.equal(result.response.status,409);assert.equal(result.code,'EVENT_REJECTED');
}));
test('HTTP maps transport outage to retryable 503 and hides internal details',()=>bridge({adapter:{ingest:async()=>{throw Error('private connection details');},ready:async()=>{throw Error('private');}}},async url=>{
  const result=await post(url,JSON.stringify(event()));
  assert.equal(result.response.status,503);assert.equal(result.code,'DEPENDENCY_UNAVAILABLE');
  assert.equal(JSON.stringify(result).includes('private'),false);
  assert.equal((await fetch(`${url}/readyz`)).status,503);
}));
test('HTTP throttle returns Retry-After and resets after the bounded interval',async()=>{
  let clock=Date.now();
  await bridge({limit:1,now:()=>clock},async url=>{
    const body=JSON.stringify(event());
    assert.equal((await post(url,body,signed(body,String(clock)))).response.status,202);
    const limited=await post(url,body,signed(body,String(clock)));
    assert.equal(limited.response.status,429);assert.equal(limited.response.headers.get('retry-after'),'60');
    clock+=60001;
    assert.equal((await post(url,body,signed(body,String(clock)))).response.status,202);
  });
});
test('shared event contract rejects impossible dates, lossy integers and missing fields',()=>{
  for(const bad of [{...event(),observedAt:'2026-02-31T00:00:00Z'},{...event(),sequence:NaN},{...event(),occupied:-1},{...event(),occupied:1.5},{...event(),observedAt:undefined},null,[]])assert.equal(parkingEvent.safeParse(bad).success,false);
  assert.equal(parkingEvent.safeParse(event()).success,true);
});
test('native Supabase adapter sends real HTTP requests to expected PostgREST routes (local stub, not database)',async()=>{
  const key=randomBytes(32).toString('hex');
  await listen(async(req,res)=>{
    assert.equal(req.headers.authorization,`Bearer ${key}`);
    res.setHeader('Content-Type','application/json');
    if(req.method==='GET'){
      const parsed=new URL(req.url,'http://localhost');
      assert.equal(parsed.pathname,'/rest/v1/iot_devices');assert.equal(parsed.searchParams.get('id'),`eq.${deviceId}`);
      return res.end(JSON.stringify([{id:deviceId}]));
    }
    assert.equal(req.url,'/rest/v1/rpc/ingest_parking');
    let raw='';for await(const chunk of req)raw+=chunk;
    const args=JSON.parse(raw);assert.equal(args.p_device,deviceId);assert.equal(args.p_occupied,2);
    res.writeHead(204);res.end();
  },async base=>{
    const adapter=createSupabaseAdapter(base,key);
    assert.equal(await adapter.ready(deviceId),true);assert.equal(await adapter.ingest(event()),true);
  });
});
test('native Supabase adapter distinguishes RPC rejection from service authentication/outage',async()=>{
  for(const status of [400,401,403,404,429,500])await listen((_req,res)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({code:status===400?'P0001':'UNAVAILABLE'}));},async base=>{
    const adapter=createSupabaseAdapter(base,'test-only');
    if(status===400)assert.equal(await adapter.ingest(event()),false);
    else await assert.rejects(()=>adapter.ingest(event()),/Supabase unavailable/);
    assert.equal(await adapter.ready(deviceId),false);
  });
});
test('native Supabase adapter never forwards credentials through HTTP redirects',async()=>{
 let leaked=false;
 await listen((_req,res)=>{leaked=true;res.end();},async target=>{
  await listen((_req,res)=>{res.writeHead(302,{Location:target});res.end();},async base=>{
   const adapter=createSupabaseAdapter(base,'unit-fixture-only');
   await assert.rejects(()=>adapter.ready(deviceId));
   await assert.rejects(()=>adapter.ingest(event()));
  });
 });
 assert.equal(leaked,false);
});
test('native Supabase adapter refuses non-TLS external configuration',()=>{
  assert.throws(()=>createSupabaseAdapter('http://example.test','test-only'),/HTTPS/);
});
