import {test,expect} from '@playwright/test';
import {contractFixture,id} from './contract-fixture';
test('UI contract: authenticator enrollment requires successful provider verification',async({page})=>{
 const f=await contractFixture(page,'manager');await f.login();await page.getByRole('navigation').getByRole('button',{name:'Account',exact:true}).click();
 const panel=page.getByRole('region',{name:'Account security'});
 await panel.getByRole('button',{name:'Set up authenticator',exact:true}).click();await expect(panel.getByRole('img',{name:'Private authenticator setup QR'})).toBeVisible();
 await panel.getByLabel('Authenticator code',{exact:true}).fill('000000');await panel.getByRole('button',{name:'Verify authenticator code',exact:true}).click();
 await expect(panel.getByRole('alert')).toHaveText('Invalid authenticator code');await expect(panel.getByText('Multi-factor session verified',{exact:true})).toHaveCount(0);
 await panel.getByLabel('Authenticator code',{exact:true}).fill('123456');await panel.getByRole('button',{name:'Verify authenticator code',exact:true}).click();
 await expect(panel.getByText('Multi-factor session verified',{exact:true})).toBeVisible();await expect(panel.getByRole('img',{name:'Private authenticator setup QR'})).toHaveCount(0);
 await panel.getByRole('button',{name:'Sign out other devices',exact:true}).click();await expect(panel.getByRole('status')).toHaveText('Other refresh sessions ended.');
});
test('UI contract: manager creates vehicle, stop, parking zone and suspended device',async({page})=>{
 const f=await contractFixture(page,'manager');await f.login();await page.getByRole('navigation').getByRole('button',{name:'Administration',exact:true}).click();
 const region=page.getByRole('region',{name:'Site administration'});
 const vehicle=region.getByRole('form',{name:'Vehicle',exact:true});
 await vehicle.getByLabel('Vehicle name',{exact:true}).fill('Fictional accessible shuttle');
 await vehicle.getByLabel('Passenger capacity',{exact:true}).fill('8');
 await vehicle.getByLabel('Assigned driver account reference',{exact:true}).fill(id(90));
 await vehicle.getByLabel('Accessible vehicle',{exact:true}).check();
 await vehicle.getByRole('button',{name:'Save vehicle',exact:true}).click();
 await expect(region.getByText('Fictional accessible shuttle · 8 seats · Off shift')).toBeVisible();
 expect(f.calls.find(c=>c.name==='save_site_vehicle')?.args).toMatchObject({p_site:f.site,p_expected:0,p_capacity:8,p_accessible:true,p_driver:id(90)});
 await region.getByLabel('Stop name',{exact:true}).fill('Fictional new pickup');await region.getByRole('button',{name:'Save stop',exact:true}).click();
 await expect(region.getByRole('listitem').filter({hasText:'Fictional new pickup'})).toBeVisible();
 await region.getByLabel('Zone name',{exact:true}).fill('Fictional Level 2');await region.getByLabel('Parking capacity',{exact:true}).fill('30');
 await region.getByRole('button',{name:'Save parking zone',exact:true}).click();await expect(region.getByText('Fictional Level 2 · Capacity 30')).toBeVisible();
 await region.getByRole('combobox',{name:'Device zone',exact:true}).selectOption({label:'Fictional Level 2'});
 await region.getByRole('button',{name:'Save parking device',exact:true}).click();
 await expect(region.getByText(/Suspended · Last sequence -1/)).toBeVisible();
 expect(f.calls.find(c=>c.name==='save_parking_device')?.args.p_active).toBe(false);
 for(const width of [360,768,1440]) {await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);}
});
test('UI contract: failed asset save preserves input and request identity for retry',async({page})=>{
 const f=await contractFixture(page,'manager');f.state.reject.set('save_site_vehicle','Vehicle changed; reload before saving');await f.login();
 await page.getByRole('navigation').getByRole('button',{name:'Administration',exact:true}).click();
 const region=page.getByRole('region',{name:'Site administration'});
 await region.getByLabel('Vehicle name',{exact:true}).fill('Fictional retry vehicle');
 await region.getByRole('button',{name:'Save vehicle',exact:true}).click();await expect(region.getByRole('alert')).toContainText('Vehicle changed');
 await expect(region.getByLabel('Vehicle name',{exact:true})).toHaveValue('Fictional retry vehicle');await expect(region.getByRole('status')).toHaveCount(0);
 f.state.reject.delete('save_site_vehicle');await region.getByRole('button',{name:'Save vehicle',exact:true}).click();
 await expect(region.getByRole('status')).toContainText('Changes saved');
 const calls=f.calls.filter(c=>c.name==='save_site_vehicle');expect(calls[0].args.p_id).toBe(calls[1].args.p_id);
});
test('UI contract: manager invites existing account, revokes invitation and disables staff',async({page})=>{
 const f=await contractFixture(page,'manager');f.state.administration.members.push({id:id(450),user_id:id(90),role:'STAFF',capabilities:['visits.checkin'],active:true,revision:1});
 await f.login();await page.getByRole('navigation').getByRole('button',{name:'Administration',exact:true}).click();
 const region=page.getByRole('region',{name:'Site administration'}),invite=region.locator('form').filter({has:page.getByLabel('Recipient account reference',{exact:true})});
 await invite.getByLabel('Recipient account reference',{exact:true}).fill(id(91));await invite.getByRole('combobox',{name:'Staff assignment',exact:true}).selectOption('driver');
 await invite.getByRole('checkbox').check();await invite.getByRole('button',{name:'Create staff invitation',exact:true}).click();
 await expect(region.getByRole('link',{name:'Private staff invitation',exact:true})).toHaveAttribute('href',/#staff=c{64}$/);
 await region.getByRole('button',{name:'Revoke invitation',exact:true}).click();await expect(region.getByText('Revoked',{exact:true})).toBeVisible();
 const membership=region.getByRole('form',{name:'Staff membership',exact:true});
 await membership.getByLabel('Site access enabled',{exact:true}).uncheck();await membership.getByLabel('I confirm this staff access change.',{exact:true}).check();
 await membership.getByRole('button',{name:'Save staff membership',exact:true}).click();await expect(region.getByText(/Disabled · Revision 2/)).toBeVisible();
 expect(f.calls.find(c=>c.name==='set_staff_membership')?.args).toMatchObject({p_site:f.site,p_id:id(450),p_expected:1,p_active:false});
});
test('UI contract: staff invitation requires server acceptance and handles rejection',async({page})=>{
 const f=await contractFixture(page,'resident');f.state.reject.set('accept_staff_invitation','Staff invitation unavailable');await f.login();await page.goto('/#staff='+ 'c'.repeat(64));
 await page.getByRole('button',{name:'Accept staff access',exact:true}).click();await expect(page.getByRole('alert')).toHaveText('Staff invitation unavailable');
 await expect(page.getByRole('button',{name:'Open workspace',exact:true})).toHaveCount(0);
 f.state.reject.delete('accept_staff_invitation');await page.getByRole('button',{name:'Accept staff access',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Site membership recorded.');
});
test('UI contract: ordinary resident cannot open administrative controls',async({page})=>{
 const f=await contractFixture(page,'resident');await f.login();await expect(page.getByRole('navigation').getByRole('button',{name:'Administration',exact:true})).toHaveCount(0);
 expect(f.calls.some(c=>c.name==='get_site_administration')).toBe(false);
});
