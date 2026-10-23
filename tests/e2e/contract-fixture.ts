// UI contract fixture only. Never used by application builds or counted as RLS/Auth proof.
import type {Page} from '@playwright/test';
import type {VisitorRecord} from '../../packages/contracts/visitor-records';
import type {VisitorFormVersion, VisitorField, VisitorTemplate, VisitFormResponse} from '../../packages/contracts/visitor-forms';
import type {SiteAdministrationData} from '../../packages/contracts/administration';
import type {ParkingOverview,ParkingBay,ParkingZone} from '../../packages/contracts/parking-overview';
export type Role='resident'|'driver'|'guard'|'parking'|'dispatcher'|'manager'|'admin'|'operator'|'loader';
type Row=Record<string,string|number|boolean|null>;
export const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const roles:Record<Role,[string,string[]]>={
 loader:['LOADER',['loading.manage']],resident:['RESIDENT',['visits.invite','rides.request']],driver:['DRIVER',['fleet.drive']],
 guard:['STAFF',['visits.read.site','visits.checkin','visits.assist']],parking:['STAFF',['parking.configure','parking.update.manual','parking.simulate']],
 dispatcher:['STAFF',['fleet.dispatch']],manager:['SITE_MANAGER',['visits.read.site','exports.visits','visits.forms.manage','staff.manage','staff.invite','fleet.configure','privacy.review','privacy.hold','analytics.read','visits.checkin','fleet.dispatch','parking.configure','parking.update.manual','parking.simulate','audit.read']],
 admin:['TOWNSHIP_ADMIN',['sites.manage','visits.read.site','exports.visits','visits.forms.manage','staff.manage','staff.invite','fleet.configure','privacy.review','privacy.hold','analytics.read','visits.checkin','fleet.dispatch','parking.configure','parking.update.manual','parking.simulate','audit.read']],operator:['PLATFORM_OPERATOR',['audit.read']]
};
export async function contractFixture(page:Page,role:Role,identity?:{user:string;email:string}){
 const calls:{name:string;args:Record<string,unknown>}[]=[];
 const user=identity?.user??id(10),site=id(20),tenant=id(30),vehicle=id(40),device=id(50);
 const state={
  rides:[] as Row[],visits:[] as Row[],records:[] as VisitorRecord[],
  activeForm:null as VisitorFormVersion|null,formHistory:[] as VisitorFormVersion[],invitationForm:null as VisitorFormVersion|null,
  formResponses:new Map<string,VisitFormResponse>(),
  vehicles:[{id:vehicle,tenant_id:tenant,site_id:site,name:'Fictional contract shuttle',capacity:2,accessible:true,driver_id:user,shift_active:false,lat:null,lng:null,accuracy:null,observed_at:null,simulated:false}] as Row[],
  zones:[{id:id(60),tenant_id:tenant,site_id:site,name:'Fictional contract zone',capacity:40,occupied:null,observed_at:null,simulated:false}] as Row[],
  loadingSessions:[] as {id:string;facility_id:string;level_id:string;vehicle_ref:string;delivery_ref:string;status:'loading'|'departed';checked_in_at:string;checked_out_at:string|null;facility_name:string;level_name:string}[],
  redeemed:false,failLogin:false,otpEnabled:false,otpVerified:false,otpAttempts:5,
  administration:{members:[],invitations:[],vehicles:[],zones:[],devices:[],stops:[]} as SiteAdministrationData,
  facilities:[] as ParkingOverview['facilities'],levels:[] as ParkingOverview['levels'],bays:[] as (ParkingBay&{zone_id:string})[],
  parkingDevices:[] as ParkingOverview['devices'],overrides:new Map<string,ParkingZone['override']>(),
  mfaFactors:[] as {id:string;friendly_name:string;factor_type:string;status:string;created_at:string;updated_at:string}[],
  routes:[] as {id:string;name:string;stop_names:string[];start_minute:number;end_minute:number;headway_minutes:number;published:boolean;revision:number}[],
  privacyRequests:[] as {id:string;visit_id:string;requester:string;kind:string;status:string;proposed_name:string|null;decision_reason:string|null;hold_until:string|null;hold_reason:string|null;created_at:string}[],
  platformTenants:[] as {id:string;name:string;demo:boolean;sites:number;active_memberships:number}[],siteQrRevoked:false,
  reject:new Map<string,string>(),
  hold:new Map<string,Promise<void>>()
 };
 const now=()=>new Date().toISOString();
 const [roleName,capabilities]=roles[role];
 const account={id:user,aud:'authenticated',role:'authenticated',email:identity?.email??'fictional-contract@example.test',app_metadata:{provider:'email'},user_metadata:{},created_at:now(),factors:state.mfaFactors};
 const jwt=[{alg:'HS256',typ:'JWT'},{sub:user,role:'authenticated',aud:'authenticated',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600}].map(value=>Buffer.from(JSON.stringify(value)).toString('base64url')).join('.')+'.'+Buffer.from('not-a-real-signature').toString('base64url');
 await page.routeWebSocket('wss://supabase-contract.example.test/**',socket=>socket.close());
 await page.route('https://supabase-contract.example.test/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
  const send=(body:unknown,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(url.pathname==='/auth/v1/factors'){
   state.mfaFactors.push({id:id(700),friendly_name:'Fictional authenticator',factor_type:'totp',status:'unverified',created_at:now(),updated_at:now()});
   return send({id:id(700),type:'totp',totp:{uri:'otpauth://totp/Fictional?secret=JBSWY3DPEHPK3PXP&issuer=Fictional',qr_code:'',secret:'JBSWY3DPEHPK3PXP'}});
  }
  if(url.pathname.endsWith('/challenge'))return send({id:id(701),type:'totp',expires_at:Math.floor(Date.now()/1000)+300});
  if(url.pathname.endsWith('/verify')){
   if(req.postDataJSON().code!=='123456')return send({code:'mfa_verification_failed',msg:'Invalid authenticator code'},422);
   state.mfaFactors[0].status='verified';
   const verifiedJwt=[{alg:'HS256',typ:'JWT'},{sub:user,role:'authenticated',aud:'authenticated',aal:'aal2',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600}].map(value=>Buffer.from(JSON.stringify(value)).toString('base64url')).join('.')+'.'+Buffer.from('not-a-real-signature').toString('base64url');
   return send({access_token:verifiedJwt,refresh_token:'nonfunctional-fixture-refresh',token_type:'bearer',expires_in:3600,user:account});
  }
  if(url.pathname==='/auth/v1/token'){
   if(state.failLogin)return send({error:'invalid_grant',error_description:'Invalid login credentials'},400);
   return send({access_token:jwt,refresh_token:'nonfunctional-fixture-refresh',token_type:'bearer',expires_in:3600,user:account});
  }
  if(url.pathname==='/auth/v1/user')return send(account);
  if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204,headers});
  if(url.pathname.includes('/rpc/')){
   const name=url.pathname.split('/').at(-1)!,args=req.postDataJSON() as Record<string,unknown>;
   calls.push({name,args});
   if(state.hold.has(name))await state.hold.get(name);
   if(state.reject.has(name))return send({code:'42501',message:state.reject.get(name)},403);
   switch(name){
    case 'get_visitor_confirmation':return state.redeemed?send({reference:id(71),status:state.visits[0]?.status??'pending_entry',site_name:'Fictional contract site',expires_at:new Date(Date.now()+3600000).toISOString()}):send({code:'P0001',message:'Confirmation unavailable'},400);
    case 'get_platform_overview':return send({tenants:state.platformTenants,audit:[],simulation_enabled:true,integrations:{sms:'Simulator only',routing:'Unavailable',iot:'Signed adapter'}});
    case 'get_platform_activity':return send({visitors:0,onsite:0,visitors_today:0,rides:0,ride_requests:0,shuttles:1,routes:0,parking_zones:1,parking_capacity:40,fresh_parking_zones:0,known_free_parking:0,parking_facilities:state.facilities.length,loading_total:state.loadingSessions.length,loading_active:state.loadingSessions.filter(s=>s.status==='loading').length,loading_completed:state.loadingSessions.filter(s=>s.status==='departed').length,locations:[],activity:[]});
    case 'get_loading_dashboard':if(!['loader','manager','admin'].includes(role))return send({code:'42501',message:'Forbidden'},403);return send({sessions:state.loadingSessions,active:state.loadingSessions.filter(s=>s.status==='loading').length,today:state.loadingSessions.length,departed:state.loadingSessions.filter(s=>s.status==='departed').length,server_time:now()});
    case 'start_loading_session':{
      if(!['loader','manager','admin'].includes(role))return send({code:'42501',message:'Forbidden'},403);
      const level=state.levels.find(l=>l.id===args.p_level && l.facility_id===args.p_facility);
      if(!level)return send({code:'22023',message:'Choose a valid mall and level'},400);
      const facility=state.facilities.find(f=>f.id===level.facility_id)!;
      state.loadingSessions.push({id:String(args.p_request),facility_id:facility.id,level_id:level.id,vehicle_ref:String(args.p_vehicle),delivery_ref:String(args.p_delivery),status:'loading',checked_in_at:now(),checked_out_at:null,facility_name:facility.name,level_name:level.name});return send(args.p_request);
    }
    case 'finish_loading_session':{const row=state.loadingSessions.find(x=>x.id===args.p_id)!;row.status='departed';row.checked_out_at=now();return send(null);}
    case 'export_loading_records':if(!['manager','admin'].includes(role))return send({code:'42501',message:'Forbidden'},403);return send({count:state.loadingSessions.length,records:state.loadingSessions.map(x=>({id:x.id,vehicle_ref:x.vehicle_ref,delivery_ref:x.delivery_ref,facility:x.facility_name,level:x.level_name,status:x.status,checked_in_at:x.checked_in_at,checked_out_at:x.checked_out_at}))});

    case 'create_platform_tenant':state.platformTenants.push({id:String(args.p_id),name:String(args.p_name),demo:true,sites:1,active_memberships:1});return send(args.p_id);
    case 'create_township_site':return send(args.p_id);
    case 'create_site_checkin_link':state.siteQrRevoked=false;return send({id:id(950),token:'d'.repeat(64),expires_at:new Date(Date.now()+86400000).toISOString()});
    case 'revoke_site_checkin_link':state.siteQrRevoked=true;return send(null);
    case 'begin_site_checkin':if(state.siteQrRevoked)return send({code:'P0001',message:'Site check-in unavailable'},400);state.invitationForm=state.activeForm;return send({token:'a'.repeat(64),expires_at:new Date(Date.now()+1800000).toISOString()});
    case 'list_privacy_requests':return send(state.privacyRequests);
    case 'request_visit_privacy':state.privacyRequests.push({id:String(args.p_id),visit_id:String(args.p_visit),requester:user,kind:String(args.p_kind),status:'requested',proposed_name:args.p_name as string|null,decision_reason:null,hold_until:null,hold_reason:null,created_at:now()});return send(args.p_id);
    case 'review_privacy_request':{const r=state.privacyRequests.find(r=>r.id===args.p_id)!;r.status=args.p_approve?'approved':'rejected';r.decision_reason=String(args.p_reason);return send(null);}
    case 'set_visitor_hold':{for(const r of state.privacyRequests.filter(r=>r.visit_id===args.p_visit)){r.hold_until=Number(args.p_days)>0?new Date(Date.now()+Number(args.p_days)*86400000).toISOString():null;r.hold_reason=String(args.p_reason);}return send(null);}
    case 'fulfill_privacy_request':{const r=state.privacyRequests.find(r=>r.id===args.p_id)!;if(r.hold_until)return send({code:'22023',message:'Record is on site or under active hold; changes blocked'},400);r.status='completed';return send(r.kind==='access'?{visit_id:r.visit_id,guest_name:'Fictional authorized guest',answers:{}}:{status:'completed',kind:r.kind});}
    case 'get_site_analytics':return send({generated_at:now(),definitions:'Fixture report uses persisted-cohort contract; parking is a current snapshot.',visitors:{registrations:4,entered:3,departed:2,onsite_in_cohort:1,assisted_registrations:1,average_registration_to_entry_minutes:2},transport:{requests:3,completed:1,cancelled:1,active:1,wait_sample_size:0,average_wait_minutes:null},parking_now:{zones:1,counter_zones:1,bay_zones:0,stale_counter_zones:1,active_manual_overrides:0,bays:0,unknown_or_stale_bays:0,active_devices:1,suspended_devices:0},daily_visitors:[{date:'2026-10-20',registrations:4}]});
    case 'save_transport_route':{state.routes.push({id:String(args.p_id),name:String(args.p_name),stop_names:args.p_stops as string[],start_minute:Number(args.p_start),end_minute:Number(args.p_end),headway_minutes:Number(args.p_headway),published:Boolean(args.p_published),revision:1});return send(args.p_id);}
    case 'get_dispatch_recommendations':return send({candidates:state.vehicles.filter(v=>v.shift_active).map(v=>({id:v.id,name:v.name,capacity:v.capacity,occupied:0,spare:v.capacity,accessible:v.accessible,eta_minutes:null,quality:'ETA unavailable; routing provider not configured',reason:'Compatible active vehicle; ranked by spare capacity'})),generated_at:now(),quality:'Capacity-only recommendation; no route ETA available'});
    case 'reassign_ride':{const r=state.rides.find(r=>r.id===args.p_ride)!;r.vehicle_id=String(args.p_vehicle);return send(null);}
    case 'clear_parking_override':state.overrides.delete(String(args.p_zone));return send(null);
    case 'get_parking_overview':return send({zones:state.zones.map(z=>({...z,kind:z.kind??'counter',revision:1,level_id:z.level_id??null,facility_name:state.facilities.find(f=>state.levels.some(l=>l.id===z.level_id && l.facility_id===f.id))?.name??null,level_name:state.levels.find(l=>l.id===z.level_id)?.name??null,override:state.overrides.get(String(z.id))??null,bays:state.bays.filter(b=>b.zone_id===z.id)})),devices:capabilities.includes('parking.configure')?[{id:device,zone_id:id(60),bay_id:null,active:true,last_sequence:0},...state.parkingDevices]:[],facilities:state.facilities,levels:state.levels});
    case 'set_parking_override':state.overrides.set(String(args.p_zone),{occupied:Number(args.p_occupied),observed_at:now(),expires_at:new Date(Date.now()+Number(args.p_seconds)*1000).toISOString(),reason:String(args.p_reason)});return send(null);
    case 'create_parking_structure':if(args.p_type==='facility')state.facilities.push({id:String(args.p_id),name:String(args.p_name),details:String(args.p_details)});else state.levels.push({id:String(args.p_id),facility_id:String(args.p_parent),name:String(args.p_name)});return send(args.p_id);
    case 'configure_parking_zone':state.zones.find(z=>z.id===args.p_zone)!.kind=String(args.p_kind);return send(null);
    case 'create_parking_bay':state.bays.push({id:String(args.p_id),zone_id:String(args.p_zone),label:String(args.p_label),accessible:Boolean(args.p_accessible),status:'UNKNOWN',observed_at:null,simulated:false});return send(args.p_id);
    case 'create_bay_device':{const b=state.bays.find(b=>b.id===args.p_bay)!;state.parkingDevices.push({id:String(args.p_id),bay_id:b.id,zone_id:b.zone_id,active:false,last_sequence:-1});return send(args.p_id);}
    case 'simulate_parking_bay':{const d=state.parkingDevices.find(d=>d.id===args.p_device)!,b=state.bays.find(b=>b.id===d.bay_id)!;b.status=args.p_status as ParkingBay['status'];b.observed_at=now();b.simulated=true;return send(null);}
    case 'get_site_administration':return send(state.administration);
    case 'invite_site_staff':state.administration.invitations.push({id:id(400),target_user:String(args.p_user),template:args.p_template as 'guard',expires_at:new Date(Date.now()+86400000).toISOString(),accepted_at:null,revoked_at:null});return send({id:id(400),token:'c'.repeat(64),expires_at:new Date(Date.now()+86400000).toISOString()});
    case 'revoke_staff_invitation':state.administration.invitations.find(i=>i.id===args.p_id)!.revoked_at=now();return send(null);
    case 'accept_staff_invitation':return send(id(401));
    case 'set_staff_membership':{const m=state.administration.members.find(m=>m.id===args.p_id)!;m.active=Boolean(args.p_active);m.revision++;return send(null);}
    case 'save_site_vehicle':{
     const previous=state.administration.vehicles.find(v=>v.id===args.p_id);
     const value={id:String(args.p_id),name:String(args.p_name),capacity:Number(args.p_capacity),accessible:Boolean(args.p_accessible),driver_id:args.p_driver as string|null,shift_active:false,revision:previous?previous.revision+1:1};
     if(previous)Object.assign(previous,value);else state.administration.vehicles.push(value);return send(args.p_id);
    }
    case 'add_site_stop':state.administration.stops.push({id:id(410),name:String(args.p_name)});return send(id(410));
    case 'save_parking_zone':state.administration.zones.push({id:String(args.p_id),name:String(args.p_name),capacity:Number(args.p_capacity),occupied:null,revision:1});return send(args.p_id);
    case 'save_parking_device':state.administration.devices.push({id:String(args.p_id),zone_id:String(args.p_zone),active:Boolean(args.p_active),last_sequence:-1,revision:1});return send(args.p_id);
    case 'get_site_visitor_forms':return send({active:state.activeForm,history:state.formHistory});
    case 'publish_visitor_form': {
     if((state.activeForm?.id??null)!==args.p_expected)return send({code:'22023',message:'Form changed; reload before publishing'},400);
     const form:VisitorFormVersion={id:id(200+state.formHistory.length),version:state.formHistory.length+1,title:String(args.p_title),template:args.p_template as VisitorTemplate,fields:args.p_fields as VisitorField[],created_at:now()};
     state.activeForm=form;state.formHistory.unshift(form);return send(form);
    }
    case 'create_invitation':state.invitationForm=state.activeForm;return send({id:id(70),token:'a'.repeat(64),expires_at:new Date(Date.now()+86400000).toISOString()});
    case 'resolve_assisted_invitation':
    case 'resolve_visitor_invitation': {
     if(state.redeemed)return send({code:'P0001',message:'Invitation unavailable'},400);
     return send({site_name:'Fictional contract site',expires_at:new Date(Date.now()+86400000).toISOString(),form:state.invitationForm,notice_version:'demo-notice-v1',demo:true,otp_provider:state.otpEnabled?'simulator':'unavailable'});
    }
    case 'request_visitor_otp':return send({id:id(300),provider:'simulator',expires_at:new Date(Date.now()+300000).toISOString(),demo_code:'123456',replayed:false});
    case 'verify_visitor_otp': {
     if(args.p_code!=='123456'){state.otpAttempts--;return send({verified:false,message:'Invalid code',attempts_remaining:state.otpAttempts});}
     state.otpVerified=true;return send({verified:true,provider:'simulator',expires_at:new Date(Date.now()+300000).toISOString()});
    }
    case 'register_assisted_visitor':
    case 'submit_visitor_registration':
    case 'redeem_invitation':{
     if(state.redeemed)return send({code:'P0001',message:'Invitation unavailable'},400);
     state.redeemed=true;state.visits.push({id:id(71),guest_name:String(args.p_name),status:'pending_entry',created_at:now()});
     state.formResponses.set(id(71),{form:state.invitationForm,answers:(args.p_answers??{}) as VisitFormResponse['answers'],acknowledged_at:now(),anonymized_at:null});return send(id(71));
    }
    case 'get_visit_form_response':return send(state.formResponses.get(String(args.p_visit))??{form:null,answers:{},acknowledged_at:null,anonymized_at:null});
    case 'visit_transition':{const visit=state.visits.find(row=>row.id===args.p_id)!;visit.status=String(args.p_status);return send(null);}
    case 'search_visitor_records': {
     const offset=Number(args.p_offset),limit=Number(args.p_limit);
     return send({records:state.records.slice(offset,offset+limit),has_more:state.records.length>offset+limit,offset});
    }
    case 'export_visitor_records':return send({records:state.records,count:state.records.length,generated_at:now()});
    case 'request_ride':state.rides.push({id:String(args.p_id),resident_id:user,pickup:String(args.p_pickup),destination:String(args.p_destination),accessible:Boolean(args.p_accessible),status:'requested',updated_at:now()});return send(args.p_id);
    case 'assign_ride':{const ride=state.rides.find(row=>row.id===args.p_ride)!;ride.status='assigned';ride.vehicle_id=vehicle;return send(null);}
    case 'ride_transition':{const ride=state.rides.find(row=>row.id===args.p_id)!;ride.status=String(args.p_status);return send(null);}
    case 'set_shift':state.vehicles[0].shift_active=Boolean(args.p_active);state.vehicles[0].observed_at=null;return send(null);
    case 'telemetry':Object.assign(state.vehicles[0],{lat:args.p_lat,lng:args.p_lng,accuracy:args.p_accuracy,observed_at:args.p_observed,simulated:args.p_simulated});return send(null);
    case 'simulate_parking':Object.assign(state.zones[0],{occupied:args.p_occupied,observed_at:now(),simulated:true});return send(null);
    default:return send({code:'PGRST202',message:'Unhandled contract RPC'},404);
   }
  }
  const table=url.pathname.split('/').at(-1);
  const tables:Record<string,unknown[]>={
   memberships:[{id:id(80),tenant_id:tenant,site_id:site,user_id:user,role:roleName,capabilities}],
   sites:[{id:site,name:'Fictional contract site'}],stops:[{id:id(81),name:'Community Hub'},{id:id(82),name:'Demo Mall'}],
   visits:state.visits,rides:state.rides,vehicles:state.vehicles,parking_zones:state.zones,
   transport_routes:state.routes,
   platform_admins:role==='operator'?[{user_id:user,active:true}]:[],
   iot_devices:capabilities.includes('parking.configure')?[{id:device,zone_id:id(60)}]:[]
   ,audit_events:capabilities.includes('audit.read')?[{id:id(95),action:'fixture.audit.event',created_at:now(),record_id:id(71),actor:user}]:[]
  };
  if(!table||!(table in tables))return send({code:'NOT_FOUND',message:'Unhandled contract request'},404);
  return send(tables[table]);
 });
 return{state,calls,user,site,vehicle,device,login:async()=>{
  await page.goto('/');
  await page.getByLabel('Email',{exact:true}).fill(account.email);
  await page.getByLabel('Password',{exact:true}).fill('nonfunctional-contract-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
 }};
}
