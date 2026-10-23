import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {visitorTemplates, type VisitorFormVersion} from '../../packages/contracts/visitor-forms';
import {contractFixture,id,type Role} from './contract-fixture';
test('UI contract: optional OTP failure, verification and registration use acknowledged server responses',async({page})=>{
 const f=await contractFixture(page,'resident');f.state.otpEnabled=true;
 await page.goto('/#invite='+ 'a'.repeat(64));
 await page.getByLabel('Guest name',{exact:true}).fill('Fictional OTP guest');
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Try OTP simulator',exact:true}).click();
 await expect(page.getByTestId('demo-otp')).toHaveText('123456');
 await expect(page.getByRole('button',{name:'Register visit',exact:true})).toBeDisabled();
 await page.getByLabel('Verification code',{exact:true}).fill('000000');
 await page.getByRole('button',{name:'Verify demo code',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveText('Invalid code');
 await expect(page.getByText('4 attempts remaining.')).toBeVisible();
 await page.getByLabel('Verification code',{exact:true}).fill('123456');
 await page.getByRole('button',{name:'Verify demo code',exact:true}).click();
 await expect(page.getByText('Demo code verified. Register before the code expires.')).toBeVisible();
 await page.getByRole('button',{name:'Register visit',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Registration recorded');
 expect(f.state.otpVerified).toBe(true);
});
test('UI contract: expired simulator code blocks registration and provider errors remain visible',async({page})=>{
 const f=await contractFixture(page,'resident');f.state.otpEnabled=true;
 await page.goto('/#invite='+ 'a'.repeat(64));await page.getByRole('button',{name:'Try OTP simulator',exact:true}).click();
 await expect(page.getByTestId('demo-otp')).toBeVisible();
 await page.clock.install();await page.clock.fastForward(301000);
 await expect(page.getByText(/Expired; request a new code/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Register visit',exact:true})).toBeDisabled();
 f.state.reject.set('request_visitor_otp','OTP provider unavailable');
 await page.getByRole('button',{name:'Request new demo code',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveText('OTP provider unavailable');
});
test('UI contract: guard assistance records reason and acknowledgement without automatic check-in',async({page})=>{
 const f=await contractFixture(page,'guard');await f.login();await open(page,'MyVisitor');
 const region=page.getByRole('region',{name:'Guard-assisted registration'});
 await region.getByLabel('Invitation token',{exact:true}).fill('a'.repeat(64));
 await region.getByRole('button',{name:'Load invitation for assistance',exact:true}).click();
 await region.getByLabel('Assisted guest name',{exact:true}).fill('Fictional assisted guest');
 await region.getByRole('combobox',{name:'Assistance reason',exact:true}).selectOption('weak_signal');
 for(const box of await region.getByRole('checkbox').all())await box.check();
 await region.getByRole('button',{name:'Record assisted registration',exact:true}).click();
 await expect(region.getByRole('status')).toContainText('Assisted registration recorded');
 expect(f.calls.find(c=>c.name==='register_assisted_visitor')?.args).toMatchObject({p_site:f.site,p_reason:'weak_signal',p_policy_checked:true,p_consent:true,p_answers:{}});
 expect(f.state.visits[0].status).toBe('pending_entry');
 await page.setViewportSize({width:360,height:900});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});
test('UI contract: unauthorized assistance resolution shows failure without opening a visitor form',async({page})=>{
 const f=await contractFixture(page,'guard');f.state.reject.set('resolve_assisted_invitation','Forbidden');await f.login();await open(page,'MyVisitor');
 const region=page.getByRole('region',{name:'Guard-assisted registration'});
 await region.getByLabel('Invitation token',{exact:true}).fill('b'.repeat(64));
 await region.getByRole('button',{name:'Load invitation for assistance',exact:true}).click();
 await expect(region.getByRole('alert')).toHaveText('Forbidden');
 await expect(region.getByLabel('Assisted guest name',{exact:true})).toHaveCount(0);
});
async function open(page:Page,name:string){
 await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();
 await expect(page.getByRole('combobox',{name:'Site',exact:true})).toHaveValue(id(20));
 await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Refreshed');
}
test('UI contract: invalid login shows failure without entering workspace',async({page})=>{
 const fixture=await contractFixture(page,'resident');fixture.state.failLogin=true;await fixture.login();
 await expect(page.getByRole('alert')).toContainText('Invalid login credentials');
 await expect(page.getByRole('button',{name:'Sign out',exact:true})).toHaveCount(0);
});
test('UI contract: invitation renders a real QR, guest submission and replay show actual fixture responses',async({page})=>{
 const fixture=await contractFixture(page,'resident');await fixture.login();await open(page,'MyVisitor');
 await page.getByRole('button',{name:'Create guest invitation'}).click();
 const qr=page.getByRole('img',{name:'Invitation QR code'});
 await expect(qr).toHaveAttribute('src',/^data:image\/png/);
 await page.getByRole('link',{name:'Open private guest registration'}).click();
 await page.getByLabel('Guest name').fill('Fictional contract guest');await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Register visit',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Registration recorded');
 expect(fixture.calls.find(call=>call.name==='submit_visitor_registration')?.args).toEqual({p_token:'a'.repeat(64),p_name:'Fictional contract guest',p_consent:true,p_answers:{}});
 await page.reload();await expect(page.getByRole('status')).toContainText('Registration recorded. Current status: pending entry.');
 await expect(page.getByLabel('Guest name')).toHaveCount(0);
});
test('UI contract: guard entry and exit send ordered visitor transitions',async({page})=>{
 const fixture=await contractFixture(page,'guard');fixture.state.visits.push({id:id(71),guest_name:'Fictional guard guest',status:'pending_entry',created_at:new Date().toISOString()});
 await fixture.login();await open(page,'MyVisitor');
 await page.getByRole('button',{name:'Verify & check in'}).click();await expect(page.getByText('onsite',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Check out',exact:true}).click();await expect(page.getByText('departed',{exact:true})).toBeVisible();
 expect(fixture.calls.filter(call=>call.name==='visit_transition').map(call=>call.args.p_status)).toEqual(['onsite','departed']);
});
test('UI contract: booking waits for server acknowledgement, preserves fields and supports cancellation',async({page})=>{
 const fixture=await contractFixture(page,'resident');let release!:()=>void;
 fixture.state.hold.set('request_ride',new Promise<void>(done=>{release=done;}));
 await fixture.login();await open(page,'Transportation');
 await page.getByRole('combobox',{name:'Pickup',exact:true}).selectOption('Community Hub');await page.getByRole('combobox',{name:'Destination',exact:true}).selectOption('Demo Mall');
 await page.getByLabel('Accessible vehicle needed').check();await page.getByRole('button',{name:'Request ride',exact:true}).click();
 await expect(page.getByRole('button',{name:'Request ride',exact:true})).toBeDisabled();await expect(page.getByRole('status')).toHaveCount(0);
 release();await expect(page.getByRole('status')).toContainText('Ride requested');
 const call=fixture.calls.find(call=>call.name==='request_ride')!;
 expect(call.args).toMatchObject({p_site:fixture.site,p_pickup:'Community Hub',p_destination:'Demo Mall',p_accessible:true});expect(call.args.p_id).toMatch(/^[0-9a-f-]{36}$/);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByText(/cancelled/,{exact:false})).toHaveCount(2);
});
test('UI contract: dispatcher sends selected ride and vehicle identifiers',async({page})=>{
 const fixture=await contractFixture(page,'dispatcher');fixture.state.vehicles[0].shift_active=true;fixture.state.rides.push({id:id(90),pickup:'Community Hub',destination:'Demo Mall',status:'requested',accessible:false});
 await fixture.login();await open(page,'Transportation');await page.getByRole('combobox',{name:'Assign vehicle',exact:true}).selectOption(fixture.vehicle);
 await page.getByRole('button',{name:'Assign with capacity check'}).click();await expect(page.getByText('assigned',{exact:true})).toBeVisible();
 expect(fixture.calls.find(call=>call.name==='assign_ride')?.args).toEqual({p_ride:id(90),p_vehicle:fixture.vehicle});
});
test('UI contract: driver shift and simulated GPS use the assigned vehicle',async({page})=>{
 const fixture=await contractFixture(page,'driver');fixture.state.rides.push({id:id(90),pickup:'Community Hub',destination:'Demo Mall',status:'assigned',vehicle_id:fixture.vehicle});await fixture.login();await open(page,'Transportation');
 await page.getByRole('button',{name:'Start shift',exact:true}).click();await page.getByRole('button',{name:'Send simulated GPS',exact:true}).click();
 await expect(page.getByText(/SIMULATED GPS/)).toBeVisible();await expect(page.getByText(/3.16, 101.51/)).toBeVisible();
 expect(fixture.calls.find(call=>call.name==='telemetry')?.args).toMatchObject({p_vehicle:fixture.vehicle,p_simulated:true});
 await page.getByRole('button',{name:'Confirm boarding',exact:true}).click();await page.getByRole('button',{name:'Complete ride',exact:true}).click();
 await expect(page.getByText('completed',{exact:true})).toBeVisible();
 expect(fixture.calls.filter(call=>call.name==='ride_transition').map(call=>call.args.p_status)).toEqual(['boarded','completed']);
 await page.getByRole('button',{name:'End shift',exact:true}).click();await expect(page.getByRole('button',{name:'Start shift',exact:true})).toBeVisible();
});
test('UI contract: parking starts unknown, accepts a simulated observation and expires it',async({page})=>{
 const fixture=await contractFixture(page,'parking');await fixture.login();await open(page,'Parking');await expect(page.getByText('Unknown',{exact:true})).toBeVisible();
 await page.getByLabel('Simulated occupied count').fill('12');await page.getByRole('button',{name:'Send sensor event'}).click();
 await expect(page.getByText('28 free',{exact:true})).toBeVisible();expect(fixture.calls.find(call=>call.name==='simulate_parking')?.args).toEqual({p_device:fixture.device,p_occupied:12});
 await page.clock.install();await page.clock.fastForward(125000);await expect(page.getByText('Unknown',{exact:true})).toBeVisible();
});
test('UI contract: a forbidden write shows error and no fake success',async({page})=>{
 const fixture=await contractFixture(page,'resident');fixture.state.reject.set('create_invitation','Forbidden');await fixture.login();await open(page,'MyVisitor');
 await page.getByRole('button',{name:'Create guest invitation'}).click();await expect(page.getByRole('alert')).toHaveText('Forbidden');
 await expect(page.getByRole('status')).toHaveCount(0);await expect(page.getByRole('link',{name:'Open private guest registration'})).toHaveCount(0);
});
for(const role of ['operator','admin','manager','guard','driver','resident'] as Role[])test(`UI contract: ${role} capability controls and authenticated mobile layout`,async({page},testInfo)=>{
 const fixture=await contractFixture(page,role);await fixture.login();
 if(role==='operator'){
  await expect(page.getByRole('region',{name:'Operator control centre'})).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('button',{name:'Platform',exact:true})).toHaveCount(1);
  await expect(page.getByRole('navigation').getByRole('button',{name:'MyVisitor',exact:true})).toHaveCount(0);
  await expect(page.getByRole('navigation').getByRole('button',{name:'Transportation',exact:true})).toHaveCount(0);
  for(const width of [360,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);}
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();return;
 }
 await open(page,'MyVisitor');
 await expect(page.getByRole('button',{name:'Create guest invitation'})).toHaveCount(role==='resident'?1:0);
 await expect(page.getByRole('button',{name:'Search records',exact:true})).toHaveCount(['admin','manager','guard'].includes(role)?1:0);
 await expect(page.getByRole('button',{name:'Export masked CSV',exact:true})).toHaveCount(['admin','manager'].includes(role)?1:0);
 await expect(page.getByRole('navigation').getByRole('button',{name:'Forms',exact:true})).toHaveCount(['admin','manager'].includes(role)?1:0);
 await open(page,'Transportation');await expect(page.getByRole('button',{name:'Request ride',exact:true})).toHaveCount(role==='resident'?1:0);
 await expect(page.getByRole('button',{name:'Start shift',exact:true})).toHaveCount(role==='driver'?1:0);
 await expect(page.getByRole('navigation').getByRole('button',{name:'Audit',exact:true})).toHaveCount(['operator','admin','manager'].includes(role)?1:0);
 if(['operator','admin','manager'].includes(role)){await open(page,'Audit');await expect(page.getByRole('heading',{name:'fixture.audit.event',exact:true})).toBeVisible();}
 for(const width of [360,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);if(['admin','resident'].includes(role))await page.screenshot({path:testInfo.outputPath(`${role}-${width}.png`),fullPage:true});}
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
});

test('UI contract: visitor search preserves filters, pages results, masks names and fits mobile',async({page})=>{
 const fixture=await contractFixture(page,'manager');
 for(let n=0;n<26;n++)fixture.state.records.push({id:id(100+n),masked_name:`F${n}***`,status:'departed',created_at:'2026-10-20T00:00:00Z',entered_at:null,exited_at:null});
 await fixture.login();await open(page,'MyVisitor');
 const records=page.getByRole('region',{name:'Visitor records'});
 await records.getByLabel('Registered from').fill('2026-10-20');await records.getByLabel('Registered through').fill('2026-10-20');
 await records.getByLabel('Visit status').selectOption('departed');await records.getByLabel('Name or reference').fill('Fictional');
 await records.getByRole('button',{name:'Search records',exact:true}).click();
 await expect(records.getByText('Showing records 1–25, newest first.')).toBeVisible();
 expect(fixture.calls.find(c=>c.name==='search_visitor_records')?.args).toEqual({p_site:fixture.site,p_from:'2026-10-19T16:00:00.000Z',p_until:'2026-10-20T16:00:00.000Z',p_status:'departed',p_query:'Fictional',p_limit:25,p_offset:0});
 await records.getByRole('button',{name:'Next records',exact:true}).click();await expect(records.getByText('Showing records 26–26, newest first.')).toBeVisible();
 await expect(records.getByRole('heading',{name:'F25***',exact:true})).toBeVisible();
 await records.getByRole('button',{name:'Previous records',exact:true}).click();await expect(records.getByText('Showing records 1–25, newest first.')).toBeVisible();
 for(const width of [360,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);}
 await records.getByLabel('Name or reference').fill('Changed filter');await expect(records.getByText('Showing records 1–25, newest first.')).toHaveCount(0);
 fixture.state.records=[];await records.getByRole('button',{name:'Search records',exact:true}).click();await expect(records.getByText('No records match these filters.')).toBeVisible();
});

test('UI contract: CSV waits for authorized server response and protects formula cells',async({page})=>{
 const fixture=await contractFixture(page,'admin');let release!:()=>void;
 fixture.state.records.push({id:id(71),masked_name:'=***',status:'onsite',created_at:'2026-10-20T00:00:00Z',entered_at:null,exited_at:null});
 fixture.state.hold.set('export_visitor_records',new Promise<void>(resolve=>{release=resolve;}));
 await fixture.login();await open(page,'MyVisitor');const records=page.getByRole('region',{name:'Visitor records'});
 await records.getByLabel('Export purpose').selectOption('operations_review');
 let downloads=0;page.on('download',()=>{downloads++;});
 await records.getByRole('button',{name:'Export masked CSV',exact:true}).click();
 await expect(records.getByRole('button',{name:'Export masked CSV',exact:true})).toBeDisabled();expect(downloads).toBe(0);
 const received=page.waitForEvent('download');release();const download=await received;
 const csv=await readFile((await download.path())!,'utf8');expect(csv).toContain('"\'=***"');expect(csv).toContain('Masked guest name');
 expect(fixture.calls.find(c=>c.name==='export_visitor_records')?.args.p_reason).toBe('operations_review');
 await expect(records.getByRole('status')).toContainText('Export authorized and audited: 1 masked records');
});

test('UI contract: denied visitor export creates no file or success and supports retry',async({page})=>{
 const fixture=await contractFixture(page,'manager');fixture.state.reject.set('export_visitor_records','Forbidden');
 await fixture.login();await open(page,'MyVisitor');const records=page.getByRole('region',{name:'Visitor records'});
 let downloads=0;page.on('download',()=>{downloads++;});await records.getByLabel('Export purpose').selectOption('incident_review');
 await records.getByRole('button',{name:'Export masked CSV',exact:true}).click();await expect(records.getByRole('alert')).toHaveText('Forbidden');
 expect(downloads).toBe(0);await expect(records.getByRole('status')).toHaveCount(0);
 fixture.state.reject.delete('export_visitor_records');const received=page.waitForEvent('download');
 await records.getByRole('button',{name:'Export masked CSV',exact:true}).click();await received;
 await expect(records.getByRole('status')).toContainText('0 masked records');
});

test('UI contract: visitor filter validation and service errors do not display stale results',async({page})=>{
 const fixture=await contractFixture(page,'guard');await fixture.login();await open(page,'MyVisitor');
 const records=page.getByRole('region',{name:'Visitor records'});
 await records.getByLabel('Registered from').fill('2026-01-01');await records.getByLabel('Registered through').fill('2026-03-01');
 await records.getByRole('button',{name:'Search records',exact:true}).click();await expect(records.getByRole('alert')).toContainText('at most 31 days');
 expect(fixture.calls.some(c=>c.name==='search_visitor_records')).toBe(false);
 await records.getByLabel('Registered through').fill('2026-01-01');fixture.state.reject.set('search_visitor_records','Records unavailable');
 await records.getByRole('button',{name:'Search records',exact:true}).click();await expect(records.getByRole('alert')).toHaveText('Records unavailable');
 await expect(records.getByText('No records match these filters.')).toHaveCount(0);
});

test('UI contract: leaving visitor records cancels an export before any download',async({page})=>{
 const fixture=await contractFixture(page,'admin');let release!:()=>void;
 fixture.state.hold.set('export_visitor_records',new Promise<void>(resolve=>{release=resolve;}));
 await fixture.login();await open(page,'MyVisitor');const records=page.getByRole('region',{name:'Visitor records'});
 let downloads=0;page.on('download',()=>{downloads++;});await records.getByLabel('Export purpose').selectOption('privacy_request');
 await records.getByRole('button',{name:'Export masked CSV',exact:true}).click();
 await expect.poll(()=>fixture.calls.filter(c=>c.name==='export_visitor_records').length).toBe(1);
 await page.getByRole('navigation').getByRole('button',{name:'Parking',exact:true}).click();release();
  await expect(records).toHaveCount(0);await expect(page.getByRole('region',{name:'Parking availability',exact:true})).toBeVisible();expect(downloads).toBe(0);
});

test('UI contract: manager publishes controlled form versions and can reopen history',async({page},testInfo)=>{
 const fixture=await contractFixture(page,'manager');await fixture.login();await open(page,'Forms');
 const manager=page.getByRole('region',{name:'Visitor form management'});
 await manager.getByLabel('Form title',{exact:true}).fill('Fictional contractor entry');await manager.getByRole('combobox',{name:'Form template',exact:true}).selectOption('contractor');
 await manager.getByRole('button',{name:'Publish form version',exact:true}).click();await expect(manager.getByRole('status')).toContainText('Version 1 published');
 expect(fixture.calls.find(call=>call.name==='publish_visitor_form')?.args).toMatchObject({p_site:fixture.site,p_expected:null,p_template:'contractor',p_fields:visitorTemplates.contractor});
 await manager.getByLabel('Form title',{exact:true}).fill('Fictional event entry');await manager.getByRole('combobox',{name:'Form template',exact:true}).selectOption('event');
 await manager.getByRole('button',{name:'Publish form version',exact:true}).click();await expect(manager.getByRole('status')).toContainText('Version 2 published');
 await manager.getByRole('button',{name:'Use version 1 as draft',exact:true}).click();await expect(manager.getByLabel('Form title',{exact:true})).toHaveValue('Fictional contractor entry');
 expect(fixture.state.activeForm?.version).toBe(2);expect(fixture.state.formHistory[1].title).toBe('Fictional contractor entry');
 for(const width of [360,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);if(width===360)await page.screenshot({path:testInfo.outputPath('visitor-form-builder-360.png'),fullPage:true});}
});

test('UI contract: form publishing waits for server, retains draft on failure and rejects stale edits',async({page})=>{
 const fixture=await contractFixture(page,'admin');let release!:()=>void;
 fixture.state.hold.set('publish_visitor_form',new Promise<void>(resolve=>{release=resolve;}));fixture.state.reject.set('publish_visitor_form','Forbidden');
 await fixture.login();await open(page,'Forms');const manager=page.getByRole('region',{name:'Visitor form management'});
 await manager.getByLabel('Form title',{exact:true}).fill('Unsaved fictional form');await manager.getByRole('button',{name:'Publish form version',exact:true}).click();
 await expect(manager.getByRole('button',{name:'Publish form version',exact:true})).toBeDisabled();await expect(manager.getByRole('status')).toHaveCount(0);
 release();await expect(manager.getByRole('alert')).toHaveText('Forbidden');await expect(manager.getByLabel('Form title',{exact:true})).toHaveValue('Unsaved fictional form');expect(fixture.state.formHistory).toHaveLength(0);
 fixture.state.reject.delete('publish_visitor_form');fixture.state.hold.delete('publish_visitor_form');
 fixture.state.activeForm={id:id(299),version:1,title:'Published elsewhere',template:'custom',fields:[],created_at:new Date().toISOString()};
 await manager.getByRole('button',{name:'Publish form version',exact:true}).click();await expect(manager.getByRole('alert')).toHaveText('Form changed; reload before publishing');
 const requests=fixture.calls.filter(call=>call.name==='publish_visitor_form');expect(requests[0].args.p_request).toBe(requests[1].args.p_request);
});

test('UI contract: guest renders invitation-pinned form and submits typed answers',async({page},testInfo)=>{
 const fixture=await contractFixture(page,'resident');
 const original:VisitorFormVersion={id:id(200),version:1,title:'Fictional contractor entry',template:'contractor',fields:visitorTemplates.contractor,created_at:new Date().toISOString()};
 fixture.state.activeForm=original;await fixture.login();await open(page,'MyVisitor');await page.getByRole('button',{name:'Create guest invitation'}).click();
 await expect(page.getByRole('link',{name:'Open private guest registration'})).toBeVisible();
 fixture.state.activeForm={...original,id:id(201),version:2,title:'New event form',template:'event',fields:visitorTemplates.event};
 await page.getByRole('link',{name:'Open private guest registration'}).click();await expect(page.getByText('Fictional contractor entry · Form version 1')).toBeVisible();
 await page.getByLabel('Guest name',{exact:true}).fill('Fictional form guest');await page.getByLabel('Company or organization (required)',{exact:true}).fill('Fictional company');
 await page.getByLabel('Planned arrival date (required)',{exact:true}).fill('2026-10-20');await page.getByLabel('I acknowledge the site safety instructions (required)',{exact:true}).check();
 await page.getByLabel(/I acknowledge the demo notice/).check();
 await page.setViewportSize({width:360,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('visitor-versioned-guest-360.png'),fullPage:true});
 await page.getByRole('button',{name:'Register visit',exact:true}).click();await expect(page.getByRole('status')).toContainText('Registration recorded');
 expect(fixture.calls.find(call=>call.name==='submit_visitor_registration')?.args.p_answers).toEqual({company:'Fictional company',arrival_date:'2026-10-20',safety_ack:true});
 expect(fixture.state.formResponses.get(id(71))?.form?.version).toBe(1);
});

test('UI contract: invitation resolution fails closed and can retry without showing a fake form',async({page})=>{
 const fixture=await contractFixture(page,'resident');fixture.state.reject.set('resolve_visitor_invitation','Invitation unavailable');
 await page.goto('/#invite='+'a'.repeat(64));await expect(page.getByRole('alert')).toHaveText('Invitation unavailable');await expect(page.getByLabel('Guest name')).toHaveCount(0);
 fixture.state.reject.delete('resolve_visitor_invitation');await page.getByRole('button',{name:'Retry invitation',exact:true}).click();await expect(page.getByLabel('Guest name')).toBeVisible();
});

test('UI contract: server validation errors preserve guest answers without recording success',async({page})=>{
 const fixture=await contractFixture(page,'resident');fixture.state.reject.set('submit_visitor_registration','Invalid visitor answers');
 fixture.state.invitationForm={id:id(200),version:1,title:'Fictional residential form',template:'residential',fields:visitorTemplates.residential,created_at:new Date().toISOString()};
 await page.goto('/#invite='+'a'.repeat(64));await page.getByLabel('Guest name',{exact:true}).fill('Fictional failed guest');
 await page.getByRole('combobox',{name:'Purpose of visit (required)',exact:true}).selectOption('Delivery');await page.getByLabel(/I acknowledge the demo notice/).check();
 await page.getByRole('button',{name:'Register visit',exact:true}).click();await expect(page.getByRole('alert')).toHaveText('Invalid visitor answers');
 await expect(page.getByLabel('Guest name',{exact:true})).toHaveValue('Fictional failed guest');await expect(page.getByRole('status')).toHaveCount(0);expect(fixture.state.redeemed).toBe(false);
});

test('UI contract: guard reads historical form answers and retention state through authorized RPC',async({page})=>{
 const fixture=await contractFixture(page,'guard');fixture.state.visits.push({id:id(71),guest_name:'Fictional historical guest',status:'departed',created_at:new Date().toISOString()});
 fixture.state.formResponses.set(id(71),{form:{id:id(200),version:1,title:'Historical contractor form',template:'contractor',fields:visitorTemplates.contractor,created_at:new Date().toISOString()},answers:{company:'Fictional historical company',arrival_date:'2026-10-20',safety_ack:true},acknowledged_at:new Date().toISOString(),anonymized_at:null});
 await fixture.login();await open(page,'MyVisitor');await page.getByRole('button',{name:'Show submitted form',exact:true}).click();
 await expect(page.getByText('Historical contractor form · Submitted form version 1')).toBeVisible();await expect(page.getByText('Company or organization: Fictional historical company')).toBeVisible();
 expect(fixture.calls.find(call=>call.name==='get_visit_form_response')?.args).toEqual({p_visit:id(71)});
 await page.getByRole('button',{name:'Hide submitted form',exact:true}).click();Object.assign(fixture.state.formResponses.get(id(71))!,{answers:{},anonymized_at:new Date().toISOString()});
 await page.getByRole('button',{name:'Show submitted form',exact:true}).click();await expect(page.getByText('Answers cleared under the retention policy.')).toBeVisible();await expect(page.getByText('Company or organization: Fictional historical company')).toHaveCount(0);
});
