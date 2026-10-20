import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function verifyExtensions({check,rpc,denied,clients,a,b,guest}) {
 const manager=clients['a.manager'],parking=clients['a.parking'],resident=clients['a.resident'];
 await check('OTP simulator uses real challenge persistence, failed attempts and one-time consumption',async()=>{
  const invitation=await rpc(resident,'create_invitation',{p_site:a.siteId});
  const resolved=await rpc(guest,'resolve_visitor_invitation',{p_token:invitation.token});
  assert.equal(resolved.otp_provider,'simulator','explicit development simulator configuration required');
  const challenge=await rpc(guest,'request_visitor_otp',{p_token:invitation.token,p_request:randomUUID()});
  assert.match(challenge.demo_code,/^[0-9]{6}$/,'simulator code format');
  const wrong=await rpc(guest,'verify_visitor_otp',{p_token:invitation.token,p_challenge:challenge.id,p_code:'invalid'});
  assert.equal(wrong.verified,false);assert.equal(wrong.attempts_remaining,4);
  await denied(guest,'submit_visitor_registration',{p_token:invitation.token,p_name:'Fictional OTP check',p_consent:true,p_answers:{party_size:2}},'22023');
  const verified=await rpc(guest,'verify_visitor_otp',{p_token:invitation.token,p_challenge:challenge.id,p_code:challenge.demo_code});assert.equal(verified.verified,true);
  assert.equal((await rpc(guest,'verify_visitor_otp',{p_token:invitation.token,p_challenge:challenge.id,p_code:challenge.demo_code})).verified,false);
  const answers=Object.fromEntries((resolved.form?.fields??[]).map(f=>[f.key,({party_size:2,purpose:'Delivery',arrival_date:'2026-10-20',company:'Fictional Co',safety_ack:true})[f.key]]));
  await rpc(guest,'submit_visitor_registration',{p_token:invitation.token,p_name:'Fictional OTP check',p_consent:true,p_answers:answers});
  await denied(guest,'resolve_visitor_invitation',{p_token:invitation.token},'P0001');
 });
 await check('guard-assisted registration enforces selected site, reason and idempotency',async()=>{
  const invitation=await rpc(resident,'create_invitation',{p_site:a.siteId});
  const resolved=await rpc(guest,'resolve_visitor_invitation',{p_token:invitation.token});
  const answers=Object.fromEntries((resolved.form?.fields??[]).map(f=>[f.key,({party_size:2,purpose:'Delivery',arrival_date:'2026-10-20',company:'Fictional Co',safety_ack:true})[f.key]]));
  const args={p_site:a.siteId,p_request:randomUUID(),p_token:invitation.token,p_name:'Fictional assisted check',p_consent:true,p_answers:answers,p_reason:'weak_signal',p_policy_checked:true};
  await denied(resident,'register_assisted_visitor',args);
  await denied(clients['b.guard'],'register_assisted_visitor',args);
  await denied(clients['a.guard'],'register_assisted_visitor',{...args,p_site:b.siteId});
  const visit=await rpc(clients['a.guard'],'register_assisted_visitor',args);
  assert.equal(await rpc(clients['a.guard'],'register_assisted_visitor',args),visit);
 });
 await check('administration rejects ordinary/foreign users and creates only scoped assets',async()=>{
  for(const client of [resident,clients['a.operator'],clients['b.manager']])await denied(client,'get_site_administration',{p_site:a.siteId});
  const args={p_site:a.siteId,p_id:randomUUID(),p_expected:0,p_name:'Fictional verification shuttle',p_capacity:4,p_accessible:true,p_driver:a.accounts.driver.id};
  await denied(resident,'save_site_vehicle',args);
  const vehicle=await rpc(manager,'save_site_vehicle',args);assert.equal(await rpc(manager,'save_site_vehicle',args),vehicle);
  await denied(manager,'save_site_vehicle',{...args,p_capacity:5},'22023');
  const result=await rpc(manager,'get_site_administration',{p_site:a.siteId});assert.ok(result.vehicles.some(v=>v.id===vehicle));
  const invitation=await rpc(manager,'invite_site_staff',{p_site:a.siteId,p_request:randomUUID(),p_user:randomUUID(),p_template:'guard'});
  await denied(resident,'accept_staff_invitation',{p_token:invitation.token});
  await rpc(manager,'revoke_staff_invitation',{p_site:a.siteId,p_id:invitation.id});
 });
 await check('parking hierarchy and bay simulation persist with authenticated source binding',async()=>{
  const facility=randomUUID(),level=randomUUID(),zone=randomUUID(),bay=randomUUID(),device=randomUUID();
  await rpc(parking,'create_parking_structure',{p_site:a.siteId,p_id:facility,p_type:'facility',p_parent:null,p_name:'Fictional verification mall',p_details:''});
  await rpc(parking,'create_parking_structure',{p_site:a.siteId,p_id:level,p_type:'level',p_parent:facility,p_name:'Level 1',p_details:''});
  await rpc(parking,'save_parking_zone',{p_site:a.siteId,p_id:zone,p_expected:0,p_name:'Fictional sensor zone',p_capacity:1});
  await rpc(parking,'configure_parking_zone',{p_zone:zone,p_level:level,p_kind:'bay',p_expected:1});
  await rpc(parking,'create_parking_bay',{p_zone:zone,p_id:bay,p_label:'B1',p_accessible:true});
  await rpc(parking,'create_bay_device',{p_bay:bay,p_id:device});
  await denied(parking,'simulate_parking_bay',{p_device:device,p_status:'FREE'},'P0001');
  await rpc(parking,'save_parking_device',{p_site:a.siteId,p_id:device,p_expected:1,p_zone:zone,p_active:true});
  await denied(resident,'simulate_parking_bay',{p_device:device,p_status:'FREE'});
  await denied(clients['b.parking'],'simulate_parking_bay',{p_device:device,p_status:'FREE'});
  await rpc(parking,'simulate_parking_bay',{p_device:device,p_status:'FREE'});
  const overview=await rpc(resident,'get_parking_overview',{p_site:a.siteId});
  assert.equal(overview.zones.find(z=>z.id===zone).bays[0].status,'FREE');assert.equal(overview.devices.length,0);
  await rpc(parking,'set_parking_override',{p_zone:a.zoneId,p_occupied:8,p_seconds:60,p_reason:'verified_count'});
  const manual=await rpc(resident,'get_parking_overview',{p_site:a.siteId});assert.equal(manual.zones.find(z=>z.id===a.zoneId).override.occupied,8);
  await rpc(parking,'clear_parking_override',{p_zone:a.zoneId});
 });
}
