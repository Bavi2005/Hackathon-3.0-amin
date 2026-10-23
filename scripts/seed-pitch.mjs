// Additive, fictional pitch scenario through the same authenticated RPCs as the UI.
// No real providers; no hard-coded availability in the frontend; no destructive reset.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {supabaseHttp,required} from './lib/supabase-http.mjs';
import {pitchConfig,assertPitchTarget} from './lib/pitch-config.mjs';
const config=pitchConfig(process.env),fixture=JSON.parse(await readFile('.local/demo-fixture.json','utf8'));
if(fixture.projectUrl!==config.url)throw Error('Seed fixture belongs to another project');
const a=fixture.tenants[0],admin=supabaseHttp(config.url,config.serviceKey,config.serviceKey),clients={},tokens=[];
const rpc=(role,name,body)=>required(clients[role],`/rest/v1/rpc/${name}`,{method:'POST',body});
const records={version:1,projectUrl:config.url,tenantId:a.tenantId,siteId:a.siteId,simulated:true,startedAt:new Date().toISOString(),status:'preflight',steps:[]};
const receipt=`.local/pitch-${a.siteId}.json`;
async function checkpoint(label){records.steps.push(label);await writeFile(receipt,JSON.stringify(records,null,2)+'\n');console.log(`DONE ${label}`);}
try{
 for(const role of ['resident','guard','manager','driver','parking','operator']){
  const login=await required(supabaseHttp(config.url,config.key),'/auth/v1/token?grant_type=password',{method:'POST',body:{email:a.accounts[role].email,password:config.password}});
  if(login.user.id!==a.accounts[role].id)throw Error('Seed account mismatch');tokens.push(login.access_token);clients[role]=supabaseHttp(config.url,config.key,login.access_token);
 }
 const tenants=await required(admin,`/rest/v1/tenants?id=eq.${a.tenantId}&select=id,demo`);
 assertPitchTarget(fixture,config,tenants[0],await rpc('operator','get_platform_overview',{}));
 const vehicles=await required(clients.driver,`/rest/v1/vehicles?id=eq.${a.vehicleId}&select=id,shift_active`);
 if(vehicles.length!==1||vehicles[0].shift_active)throw Error('End the fictional driver shift before preparing pitch data; current work will not be interrupted');
 const rides=await required(clients.manager,`/rest/v1/rides?site_id=eq.${a.siteId}&status=in.(assigned,boarded)&select=id&limit=1`);
 if(rides.length)throw Error('Site has assigned/boarded rides; finish those before creating the pitch scenario');
 await mkdir('.local',{recursive:true});
 // Exclusive marker prevents parallel or accidental duplicate runs. Partial progress needs review.
 try{await writeFile(receipt,JSON.stringify({...records,status:'running'},null,2)+'\n',{flag:'wx'});}catch(error){if(error.code==='EEXIST')throw Error('Pitch scenario receipt already exists for this site. Use existing records; refresh parking through the UI. Review partial receipts before rerunning.');throw error;}
 records.status='running';
 const suffix=a.siteId.slice(0,8);
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'});
 for(const [index,status]of ['pending_entry','onsite','departed'].entries()){
  const invitation=await rpc('resident','create_invitation',{p_site:a.siteId});
  const guest=supabaseHttp(config.url,config.key);
  const resolved=await required(guest,'/rest/v1/rpc/resolve_visitor_invitation',{method:'POST',body:{p_token:invitation.token}});
  const values={party_size:2,purpose:'Delivery',arrival_date:today,company:'Fictional Demo Company',safety_ack:true};
  const answers=Object.fromEntries((resolved.form?.fields??[]).map(f=>[f.key,values[f.key]]));
  const visit=await required(guest,'/rest/v1/rpc/submit_visitor_registration',{method:'POST',body:{p_token:invitation.token,p_name:`Fictional Guest ${index+1} ${suffix}`,p_consent:true,p_answers:answers}});
  if(status!=='pending_entry')await rpc('guard','visit_transition',{p_id:visit,p_status:'onsite'});
  if(status==='departed')await rpc('guard','visit_transition',{p_id:visit,p_status:'departed'});
  await checkpoint(`fictional visitor ${index+1}: ${status}`);
 }
 const completedRide=randomUUID();
 await rpc('driver','set_shift',{p_vehicle:a.vehicleId,p_active:true});await checkpoint('fictional driver shift started');
 await rpc('resident','request_ride',{p_id:completedRide,p_site:a.siteId,p_pickup:'Community Hub',p_destination:'Demo Mall',p_accessible:false});
 await rpc('manager','assign_ride',{p_ride:completedRide,p_vehicle:a.vehicleId});
 await rpc('driver','telemetry',{p_vehicle:a.vehicleId,p_lat:3.16,p_lng:101.51,p_accuracy:12,p_observed:new Date().toISOString(),p_simulated:true});
 await rpc('driver','ride_transition',{p_id:completedRide,p_status:'boarded'});
 await rpc('driver','ride_transition',{p_id:completedRide,p_status:'completed'});
 await rpc('driver','set_shift',{p_vehicle:a.vehicleId,p_active:false});await checkpoint('fictional ride completed through dispatcher and driver; shift ended');
 await rpc('resident','request_ride',{p_id:randomUUID(),p_site:a.siteId,p_pickup:'Community Hub',p_destination:'Demo Mall',p_accessible:false});await checkpoint('fictional request awaiting dispatcher');
 await rpc('manager','save_transport_route',{p_site:a.siteId,p_id:randomUUID(),p_expected:0,p_name:'Fictional Hub–Mall loop',p_stops:['Community Hub','Demo Mall'],p_start:480,p_end:1080,p_headway:20,p_published:true});await checkpoint('fictional daily timetable published');
 const facility=randomUUID(),level=randomUUID(),zone=randomUUID();
 await rpc('parking','create_parking_structure',{p_site:a.siteId,p_id:facility,p_type:'facility',p_parent:null,p_name:'Fictional Community Mall',p_details:'Pitch demonstration only. No real facility connection.'});
 await rpc('parking','create_parking_structure',{p_site:a.siteId,p_id:level,p_type:'level',p_parent:facility,p_name:'Demo level 1',p_details:''});
 await rpc('parking','save_parking_zone',{p_site:a.siteId,p_id:zone,p_expected:0,p_name:'Fictional East Wing',p_capacity:4});
 await rpc('parking','configure_parking_zone',{p_zone:zone,p_level:level,p_kind:'bay',p_expected:1});
 for(let i=0;i<4;i++){
  const bay=randomUUID(),device=randomUUID();
  await rpc('parking','create_parking_bay',{p_zone:zone,p_id:bay,p_label:`D${i+1}`,p_accessible:i===0});
  await rpc('parking','create_bay_device',{p_bay:bay,p_id:device});
  await rpc('parking','save_parking_device',{p_site:a.siteId,p_id:device,p_expected:1,p_zone:zone,p_active:true});
  await rpc('parking','simulate_parking_bay',{p_device:device,p_status:i%2===0?'FREE':'OCCUPIED'});
 }
 await rpc('parking','simulate_parking',{p_device:a.deviceId,p_occupied:12});await checkpoint('simulated counter and four device-bound bays observed');
 records.status='complete';records.completedAt=new Date().toISOString();await checkpoint('pitch preparation complete');
 console.log('Fictional scenario saved through real RPCs. Availability expires after 120 seconds: refresh with parking simulators during your pitch. No real SMS, routing, sensors or vehicles are connected.');
}catch(error){console.error(error.message);console.error('No reset performed. If a receipt exists, inspect its completed step names and resolve any open demo ride/shift in the app before further setup.');process.exitCode=1;}
finally{await Promise.allSettled(tokens.map(token=>supabaseHttp(config.url,config.key,token)('/auth/v1/logout?scope=local',{method:'POST'})));}
