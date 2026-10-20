import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {contractFixture,id} from './contract-fixture';
test('UI contract: resident submits privacy request without self-review controls',async({page})=>{
 const f=await contractFixture(page,'resident');await f.login();await page.getByRole('navigation').getByRole('button',{name:'Privacy',exact:true}).click();
 const panel=page.getByRole('region',{name:'Visitor privacy requests'});await panel.getByLabel('Visitor reference',{exact:true}).fill(id(71));await panel.getByRole('combobox',{name:'Request type',exact:true}).selectOption('erasure');
 await panel.getByRole('button',{name:'Submit privacy request',exact:true}).click();await expect(panel.getByRole('heading',{name:'erasure · requested',exact:true})).toBeVisible();
 await expect(panel.getByRole('button',{name:'Record privacy review',exact:true})).toHaveCount(0);await expect(panel.getByRole('button',{name:'Save hold decision',exact:true})).toHaveCount(0);
 expect(f.calls.find(c=>c.name==='request_visit_privacy')?.args).toMatchObject({p_visit:id(71),p_kind:'erasure',p_name:null});
});
test('UI contract: privacy review and fulfillment respect server hold rejection',async({page})=>{
 const f=await contractFixture(page,'manager');f.state.privacyRequests.push({id:id(900),visit_id:id(71),requester:id(91),kind:'erasure',status:'requested',proposed_name:null,decision_reason:null,hold_until:new Date(Date.now()+86400000).toISOString(),hold_reason:'incident_review',created_at:new Date().toISOString()});
 await f.login();await page.getByRole('navigation').getByRole('button',{name:'Privacy',exact:true}).click();const panel=page.getByRole('region',{name:'Visitor privacy requests'});
 await panel.getByRole('combobox',{name:'Review decision',exact:true}).selectOption('verified_authority');await panel.getByLabel('I completed the required identity and authority review.',{exact:true}).check();await panel.getByRole('button',{name:'Record privacy review',exact:true}).click();
 await panel.getByLabel('I confirm this approved action and the current retention obligations.',{exact:true}).check();await panel.getByRole('button',{name:'Apply approved record change',exact:true}).click();
 await expect(panel.getByRole('alert')).toContainText('under active hold');expect(f.state.privacyRequests[0].status).toBe('approved');
 await panel.getByLabel('Hold visitor reference',{exact:true}).fill(id(71));await panel.getByLabel('Hold days (0 releases the hold)',{exact:true}).fill('0');await panel.getByLabel('I confirm the authorized retention decision.',{exact:true}).check();await panel.getByRole('button',{name:'Save hold decision',exact:true}).click();
 await panel.getByRole('button',{name:'Apply approved record change',exact:true}).click();await expect(panel.getByRole('heading',{name:'erasure · completed',exact:true})).toBeVisible();
 await page.setViewportSize({width:360,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});
test('UI contract: approved privacy access downloads only after server fulfillment',async({page})=>{
 const f=await contractFixture(page,'manager');f.state.privacyRequests.push({id:id(900),visit_id:id(71),requester:id(91),kind:'access',status:'approved',proposed_name:null,decision_reason:'verified_authority',hold_until:null,hold_reason:null,created_at:new Date().toISOString()});await f.login();await page.getByRole('navigation').getByRole('button',{name:'Privacy',exact:true}).click();const panel=page.getByRole('region',{name:'Visitor privacy requests'});
 await panel.getByLabel('I confirm this approved action and the current retention obligations.',{exact:true}).check();const download=page.waitForEvent('download');await panel.getByRole('button',{name:'Download approved record',exact:true}).click();
 const file=await download;const content=JSON.parse(await readFile((await file.path())!,'utf8'));expect(content.guest_name).toBe('Fictional authorized guest');await expect(panel.getByRole('status')).toContainText('access audited');
});
test('UI contract: scoped report shows actual response counts and missing timestamp samples honestly',async({page})=>{
 const f=await contractFixture(page,'manager');await f.login();await page.getByRole('navigation').getByRole('button',{name:'Analytics',exact:true}).click();const panel=page.getByRole('region',{name:'Site analytics'});
 await panel.getByLabel('Report from',{exact:true}).fill('2026-10-20');await panel.getByLabel('Report through',{exact:true}).fill('2026-10-20');await panel.getByRole('button',{name:'Load site report',exact:true}).click();
 await expect(panel.getByText('4 registrations · 3 entered · 2 departed',{exact:true})).toBeVisible();await expect(panel.getByText('Average wait: Not enough timestamped records',{exact:true})).toBeVisible();
 expect(f.calls.find(c=>c.name==='get_site_analytics')?.args).toEqual({p_site:f.site,p_from:'2026-10-19T16:00:00.000Z',p_until:'2026-10-20T16:00:00.000Z'});
 f.state.reject.set('get_site_analytics','Forbidden');await panel.getByRole('button',{name:'Load site report',exact:true}).click();await expect(panel.getByRole('alert')).toHaveText('Forbidden');await expect(panel.getByText('4 registrations · 3 entered · 2 departed',{exact:true})).toHaveCount(0);
});
test('UI contract: resident cannot navigate to aggregate analytics',async({page})=>{const f=await contractFixture(page,'resident');await f.login();await expect(page.getByRole('navigation').getByRole('button',{name:'Analytics',exact:true})).toHaveCount(0);});
