import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {supabaseHttp,required} from './lib/supabase-http.mjs';
const env=process.env;
if(env.DEMO_SEED_ACK!=='fictional-data-only'||!['development','test'].includes(env.APP_ENV))throw Error('Require APP_ENV=development/test and DEMO_SEED_ACK=fictional-data-only');
const {SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:key,DEMO_PASSWORD:password}=env;
if(!url||!key||!password||password.length<16)throw Error('Require SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD of at least 16 characters');
const request=supabaseHttp(url,key,key);
async function insert(table,body){
 const rows=await required(request,`/rest/v1/${table}`,{method:'POST',body,headers:{Prefer:'return=representation'}});
 return rows[0];
}
const fixture={version:1,projectUrl:new URL(url).origin,tenants:[]};
const run=randomBytes(4).toString('hex');
const roles={resident:['RESIDENT',['visits.invite','rides.request']],resident2:['RESIDENT',['visits.invite','rides.request']],guard:['STAFF',['visits.read.site','visits.checkin','visits.assist']],parking:['STAFF',['parking.configure','parking.update.manual','parking.simulate']],dispatcher:['STAFF',['fleet.dispatch']],driver:['DRIVER',['fleet.drive']],loader:['LOADER',['loading.manage']],manager:['SITE_MANAGER',['visits.read.site','exports.visits','visits.forms.manage','staff.manage','staff.invite','fleet.configure','privacy.review','privacy.hold','analytics.read','visits.checkin','visits.assist','parking.configure','parking.update.manual','parking.simulate','fleet.dispatch','audit.read']],admin:['TOWNSHIP_ADMIN',['sites.manage','visits.read.site','exports.visits','visits.forms.manage','staff.manage','staff.invite','fleet.configure','privacy.review','privacy.hold','analytics.read','visits.checkin','visits.assist','parking.configure','parking.update.manual','parking.simulate','fleet.dispatch','audit.read']],operator:['PLATFORM_OPERATOR',['audit.read']]};
for(const name of ['Demo Elmina','Unrelated Demo']){
 const tenant=await insert('tenants',{name:`${name} ${run}`,demo:true});
 const site=await insert('sites',{tenant_id:tenant.id,name:`${name} Community Hub`});
 const other=await insert('sites',{tenant_id:tenant.id,name:`${name} Restricted Site`});
 const record={tenantId:tenant.id,siteId:site.id,foreignSiteId:other.id,accounts:{}};
 for(const stop of ['Community Hub','Demo Mall'])await insert('stops',{tenant_id:tenant.id,site_id:site.id,name:stop});
 for(const [label,[role,capabilities]]of Object.entries(roles)){
  const email=`${label}.${name==='Demo Elmina'?'a':'b'}.${run}@example.test`;
  const account=await required(request,'/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true}});
  const user=account.user??account;
  await insert('memberships',{tenant_id:tenant.id,site_id:site.id,user_id:user.id,role,capabilities});
  record.accounts[label]={id:user.id,email};
  console.log(`${label}: ${email}`);
 }
 if(name==='Demo Elmina')await insert('platform_admins',{user_id:record.accounts.operator.id,active:true});
 record.vehicleId=(await insert('vehicles',{tenant_id:tenant.id,site_id:site.id,name:'Fictional Shuttle 01',capacity:2,accessible:true,driver_id:record.accounts.driver.id})).id;
 record.zoneId=(await insert('parking_zones',{tenant_id:tenant.id,site_id:site.id,name:'Demo Mall - Level 1 - Zone A',capacity:40})).id;
 record.deviceId=(await insert('iot_devices',{tenant_id:tenant.id,site_id:site.id,zone_id:record.zoneId})).id;
 fixture.tenants.push(record);
}
await mkdir('.local',{recursive:true});
await writeFile('.local/demo-fixture.json',JSON.stringify(fixture,null,2)+'\n',{mode:0o600});
console.log('Seed complete. Fictional account addresses and IDs saved to ignored .local/demo-fixture.json. No passwords, keys or tokens persisted.');
