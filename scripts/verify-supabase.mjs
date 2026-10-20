// Real disposable Supabase integration, never an in-memory database substitute.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import {createServer} from 'node:http';
import {URLSearchParams} from 'node:url';
import {supabaseHttp,required} from './lib/supabase-http.mjs';
import {createSupabaseAdapter} from '../apps/api/supabase.mjs';
import {createBridgeHandler} from '../apps/api/handler.mjs';
import {expectSqlRejection} from './lib/expect-rejection.mjs';
import {verifyExtensions} from './verify-extensions.mjs';

const env=process.env;
if(!['development','test'].includes(env.APP_ENV)||env.DEMO_SEED_ACK!=='fictional-data-only')throw Error('Use APP_ENV=test/development and DEMO_SEED_ACK=fictional-data-only for a disposable project');
const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,SUPABASE_SERVICE_ROLE_KEY:serviceKey,DEMO_PASSWORD:password}=env;
if(!url||!key||!serviceKey||!password)throw Error('Required: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD. Never paste secrets into chat.');
const fixture=JSON.parse(await readFile('.local/demo-fixture.json','utf8'));
assert.equal(fixture.projectUrl,new URL(url).origin,'fixture belongs to configured project');
const [a,b]=fixture.tenants;
const clients={};const tokens=[];let checks=0;
const admin=supabaseHttp(url,serviceKey,serviceKey);
async function check(label,run){await run();checks++;console.log(`PASS ${label}`);}
async function rpc(client,name,args){return required(client,`/rest/v1/rpc/${name}`,{method:'POST',body:args});}
async function denied(client,name,args,code='42501'){const result=await client(`/rest/v1/rpc/${name}`,{method:'POST',body:args});expectSqlRejection(result,code);}
async function rows(client,table,filter={}){return required(client,`/rest/v1/${table}?${new URLSearchParams({select:'*',...filter,limit:'100'})}`);}
try{
 for(const [tenant,label]of [[a,'a'],[b,'b']])for(const [role,account]of Object.entries(tenant.accounts)){
   const auth=await required(supabaseHttp(url,key),'/auth/v1/token?grant_type=password',{method:'POST',body:{email:account.email,password}});
   assert.equal(auth.user.id,account.id);
   tokens.push(auth.access_token);clients[`${label}.${role}`]=supabaseHttp(url,key,auth.access_token);
 }
 await check('all separately provisioned roles sign in through Supabase Auth',async()=>assert.ok(tokens.length>=18));
 for(const [label,tenant]of [['a',a],['b',b]])for(const role of Object.keys(tenant.accounts)){
   const client=clients[`${label}.${role}`];
   await check(`${label}.${role}: exact tenant/site and immutable self membership`,async()=>{
     const sites=await rows(client,'sites'),members=await rows(client,'memberships');
     assert.equal(sites.length,1);assert.equal(sites[0].id,tenant.siteId);
     assert.equal(members.length,1);assert.equal(members[0].user_id,tenant.accounts[role].id);
     const write=await client(`/rest/v1/memberships?id=eq.${members[0].id}`,{method:'PATCH',body:{role:members[0].role}});
     expectSqlRejection(write);
   });
 }
 await check('operator has no implicit visitor, dispatch, device or GPS access',async()=>{
   for(const table of ['visits','rides','vehicles','iot_devices','iot_events','gps_observations'])assert.equal((await rows(clients['a.operator'],table)).length,0);
 });
 await check('cross-site and cross-tenant invitation operations denied',async()=>{
   await denied(clients['a.resident'],'create_invitation',{p_site:a.foreignSiteId});
   await denied(clients['a.resident'],'create_invitation',{p_site:b.siteId});
 });
 let form,visit;
 await check('form publishing is scoped, versioned and idempotent',async()=>{
   const current=await rpc(clients['a.manager'],'get_site_visitor_forms',{p_site:a.siteId});
   const publish={p_site:a.siteId,p_request:randomUUID(),p_expected:current.active?.id??null,p_title:'Fictional integration form',p_template:'custom',p_fields:[{key:'party_size',required:true}]};
   for(const role of ['resident','guard','operator','parking','driver','dispatcher']){
     await denied(clients[`a.${role}`],'get_site_visitor_forms',{p_site:a.siteId});
     await denied(clients[`a.${role}`],'publish_visitor_form',publish);
   }
   for(const site of [a.foreignSiteId,b.siteId]){
     await denied(clients['a.manager'],'get_site_visitor_forms',{p_site:site});
     await denied(clients['a.manager'],'publish_visitor_form',{...publish,p_site:site});
   }
   await denied(clients['a.manager'],'publish_visitor_form',{...publish,p_fields:[{key:'passport',required:true}]},'22023');
   form=await rpc(clients['a.manager'],'publish_visitor_form',publish);
   assert.equal((await rpc(clients['a.manager'],'publish_visitor_form',publish)).id,form.id);
   await denied(clients['a.manager'],'publish_visitor_form',{...publish,p_request:randomUUID()},'22023');
 });
 await check('visitor invitation and anonymous one-use QR redemption persist',async()=>{
   const invite=await rpc(clients['a.resident'],'create_invitation',{p_site:a.siteId});
   assert.ok(typeof invite.token==='string'&&/^[a-f0-9]{64}$/.test(invite.token),'Invitation token format must be valid; token value suppressed');
   await rpc(clients['a.manager'],'publish_visitor_form',{p_site:a.siteId,p_request:randomUUID(),p_expected:form.id,p_title:'Fictional next form',p_template:'custom',p_fields:[{key:'purpose',required:true}]});
   const resolved=await rpc(supabaseHttp(url,key),'resolve_visitor_invitation',{p_token:invite.token});
   assert.equal(resolved.form.id,form.id);
   await denied(supabaseHttp(url,key),'redeem_invitation',{p_token:invite.token,p_name:'Fictional E2E Guest',p_consent:true},'22023');
   visit=await rpc(supabaseHttp(url,key),'submit_visitor_registration',{p_token:invite.token,p_name:'Fictional E2E Guest',p_consent:true,p_answers:{party_size:2}});
   await denied(supabaseHttp(url,key),'redeem_invitation',{p_token:invite.token,p_name:'Replay',p_consent:true},'P0001');
   assert.equal((await rows(clients['a.resident'],'visits',{id:`eq.${visit}`})).length,1);
   assert.equal((await rows(clients['a.resident2'],'visits',{id:`eq.${visit}`})).length,0);
   assert.equal((await rows(clients['b.guard'],'visits',{id:`eq.${visit}`})).length,0);
   for(const role of ['a.operator','a.resident2','b.guard'])await denied(clients[role],'get_visit_form_response',{p_visit:visit});
   const answer=await rpc(clients['a.guard'],'get_visit_form_response',{p_visit:visit});
   assert.equal(answer.form.id,form.id);assert.deepEqual(answer.answers,{party_size:2});
 });
 await check('guard entry/exit and admin read; resident and operator cannot check in',async()=>{
   for(const role of ['resident','operator','parking','driver'])await denied(clients[`a.${role}`],'visit_transition',{p_id:visit,p_status:'onsite'});
   assert.equal((await rows(clients['a.admin'],'visits',{id:`eq.${visit}`})).length,1);
   await rpc(clients['a.guard'],'visit_transition',{p_id:visit,p_status:'onsite'});
   await denied(clients['a.guard'],'visit_transition',{p_id:visit,p_status:'onsite'},'P0001');
   await rpc(clients['a.guard'],'visit_transition',{p_id:visit,p_status:'departed'});
   assert.equal((await rows(clients['a.resident'],'visits',{id:`eq.${visit}`}))[0].status,'departed');
 });
 await check('visitor records search/export enforce scope, masking and transactional audit',async()=>{
   const range={p_site:a.siteId,p_from:new Date(Date.now()-86400000).toISOString(),p_until:new Date(Date.now()+86400000).toISOString(),p_query:visit,p_status:'all'};
   const exported={...range,p_reason:'operations_review'};
   for(const role of ['resident','operator','parking','driver'])await denied(clients[`a.${role}`],'search_visitor_records',range);
   for(const role of ['resident','guard','operator','parking','driver','dispatcher'])await denied(clients[`a.${role}`],'export_visitor_records',exported);
   for(const site of [a.foreignSiteId,b.siteId]){
     await denied(clients['a.manager'],'search_visitor_records',{...range,p_site:site});
     await denied(clients['a.manager'],'export_visitor_records',{...exported,p_site:site});
   }
   const found=await rpc(clients['a.manager'],'search_visitor_records',range);
   assert.equal(found.records.length,1);assert.equal(found.records[0].id,visit);assert.equal(found.records[0].masked_name,'F***');
   assert.deepEqual(Object.keys(found.records[0]).sort(),['created_at','entered_at','exited_at','id','masked_name','status']);
   await denied(clients['a.manager'],'export_visitor_records',{...exported,p_reason:'unapproved'},'22023');
   const output=await rpc(clients['a.manager'],'export_visitor_records',exported);
   assert.equal(output.count,1);assert.equal(output.records[0].masked_name,'F***');
   const audit=await rows(clients['a.manager'],'audit_events',{action:'eq.visitors.exported',actor:`eq.${a.accounts.manager.id}`});
   assert.ok(audit.some(event=>event.metadata.reason==='operations_review'&&event.metadata.count===1));
   assert.ok(audit.every(event=>!Object.hasOwn(event.metadata,'query')));
 });
 await check('driver starts only own assigned shift',async()=>{
   await denied(clients['b.driver'],'set_shift',{p_vehicle:a.vehicleId,p_active:true});
   await denied(clients['a.resident'],'set_shift',{p_vehicle:a.vehicleId,p_active:true});
   await rpc(clients['a.driver'],'set_shift',{p_vehicle:a.vehicleId,p_active:true});
 });
 const requested=[];
 for(let i=0;i<3;i++){
   const role=i===1?'resident2':'resident',id=randomUUID();requested.push({id,role});
   await rpc(clients[`a.${role}`],'request_ride',{p_id:id,p_site:a.siteId,p_pickup:'Community Hub',p_destination:'Demo Mall',p_accessible:false});
 }
 const assigned=[];
 await check('three concurrent assignments never exceed two-seat vehicle capacity',async()=>{
   const results=await Promise.all(requested.map(r=>clients['a.dispatcher']('/rest/v1/rpc/assign_ride',{method:'POST',body:{p_ride:r.id,p_vehicle:a.vehicleId}})));
   assert.equal(results.filter(x=>x.status<400).length,2);
   for(const rejected of results.filter(x=>x.status>=400))expectSqlRejection(rejected,'P0001','Vehicle full');
   for(let i=0;i<results.length;i++)if(results[i].status<400)assigned.push(requested[i]);
   assert.equal((await rows(clients['a.dispatcher'],'rides',{vehicle_id:`eq.${a.vehicleId}`,status:'in.(assigned,boarded)'})).length,2);
 });
 await check('driver simulated GPS persists, throttles and is scoped to active riders',async()=>{
   const args={p_vehicle:a.vehicleId,p_lat:3.16,p_lng:101.51,p_accuracy:12,p_observed:new Date().toISOString(),p_simulated:true};
   await denied(clients['a.guard'],'telemetry',args);
   await rpc(clients['a.driver'],'telemetry',args);
   await denied(clients['a.driver'],'telemetry',args,'P0001');
   const tracked=await rows(clients[`a.${assigned[0].role}`],'vehicles',{id:`eq.${a.vehicleId}`});
   assert.equal(tracked[0].lat,3.16);assert.equal(tracked[0].simulated,true);
   assert.equal((await rows(clients['b.resident'],'vehicles',{id:`eq.${a.vehicleId}`})).length,0);
 });
 await check('assigned driver completes rides and stops shift; off-shift GPS rejected',async()=>{
   for(const ride of assigned){await rpc(clients['a.driver'],'ride_transition',{p_id:ride.id,p_status:'boarded'});await rpc(clients['a.driver'],'ride_transition',{p_id:ride.id,p_status:'completed'});}
   for(const ride of requested.filter(r=>!assigned.some(a=>a.id===r.id)))await rpc(clients[`a.${ride.role}`],'ride_transition',{p_id:ride.id,p_status:'cancelled'});
   await rpc(clients['a.driver'],'set_shift',{p_vehicle:a.vehicleId,p_active:false});
   await denied(clients['a.driver'],'telemetry',{p_vehicle:a.vehicleId,p_lat:3.16,p_lng:101.51,p_accuracy:12,p_observed:new Date().toISOString(),p_simulated:true});
 });
 await check('parking simulator writes real state; resident cannot simulate',async()=>{
   await denied(clients['a.resident'],'simulate_parking',{p_device:a.deviceId,p_occupied:12});
   await rpc(clients['a.parking'],'simulate_parking',{p_device:a.deviceId,p_occupied:12});
   const zone=(await rows(clients['a.resident'],'parking_zones',{id:`eq.${a.zoneId}`}))[0];
   assert.equal(zone.occupied,12);assert.equal(zone.simulated,true);
 });
 await check('signed localhost bridge → real Supabase ingestion rejects signature and persisted replay',async()=>{
   const secret=randomBytes(32).toString('hex');
   const server=createServer(createBridgeHandler({secret,deviceId:a.deviceId,adapter:createSupabaseAdapter(url,serviceKey)}));
   await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
   try{
     const device=(await rows(clients['a.parking'],'iot_devices',{id:`eq.${a.deviceId}`}))[0];
     const body=JSON.stringify({eventId:randomUUID(),deviceId:a.deviceId,sequence:device.last_sequence+1,occupied:14,observedAt:new Date().toISOString()});
     const timestamp=String(Date.now()),headers={'content-type':'application/json','x-timestamp':timestamp,'x-signature':createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex')};
     const endpoint=`http://127.0.0.1:${server.address().port}/v1/iot/events`;
     assert.equal((await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body})).status,401);
     assert.equal((await fetch(endpoint,{method:'POST',headers,body})).status,202);
     assert.equal((await fetch(endpoint,{method:'POST',headers,body})).status,409);
     assert.equal((await rows(clients['a.resident'],'parking_zones',{id:`eq.${a.zoneId}`}))[0].occupied,14);
   }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 });
 await verifyExtensions({check,rpc,denied,clients,a,b,guest:supabaseHttp(url,key)});
 await check('schema health: all tables RLS protected, client writes denied and retention scheduled',async()=>{
   const health=await rpc(admin,'deployment_health',{});
   assert.equal(health.tables,20);assert.equal(health.unprotected,0);assert.equal(health.client_mutable,0);
   assert.equal(health.site_foreign_keys,true);assert.equal(health.retention_scheduled,true);
 });
 console.log(`Real Supabase integration PASS: ${checks} checks. Browser/Realtime/retention execution are separate gates.`);
}finally{
 await Promise.allSettled(tokens.map(token=>supabaseHttp(url,key,token)('/auth/v1/logout?scope=local',{method:'POST'})));
}
