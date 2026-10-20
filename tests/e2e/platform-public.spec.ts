import {test,expect} from '@playwright/test';
import {contractFixture,id} from './contract-fixture';
test('UI contract: displayed site QR starts separate private registration',async({page})=>{
 const f=await contractFixture(page,'manager');await f.login();await page.getByRole('navigation').getByRole('button',{name:'Forms',exact:true}).click();const panel=page.getByRole('region',{name:'Public site check-in QR'});
 await panel.getByRole('button',{name:'Issue or rotate site QR',exact:true}).click();await expect(panel.getByRole('img',{name:'Displayed site check-in QR',exact:true})).toHaveAttribute('src',/^data:image\/png/);
 await panel.getByRole('link',{name:'Open public site check-in',exact:true}).click();await page.getByRole('button',{name:'Start visitor registration',exact:true}).click();
 await expect(page.getByLabel('Guest name',{exact:true})).toBeVisible();expect(f.calls.find(c=>c.name==='begin_site_checkin')?.args.p_token).toBe('d'.repeat(64));
 await page.getByLabel('Guest name',{exact:true}).fill('Fictional public QR guest');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Register visit',exact:true}).click();await expect(page.getByRole('status')).toContainText('Registration recorded');
});
test('UI contract: revoked site QR cannot open a private registration',async({page})=>{
 const f=await contractFixture(page,'manager');await f.login();await page.getByRole('navigation').getByRole('button',{name:'Forms',exact:true}).click();const panel=page.getByRole('region',{name:'Public site check-in QR'});
 await panel.getByRole('button',{name:'Issue or rotate site QR',exact:true}).click();await panel.getByRole('button',{name:'Revoke site QR',exact:true}).click();
 await expect(panel.getByRole('status')).toContainText('Site check-in link revoked.');
 await page.goto('/#checkin='+ 'd'.repeat(64));await page.getByRole('button',{name:'Start visitor registration',exact:true}).click();await expect(page.getByRole('alert')).toHaveText('Site check-in unavailable');await expect(page.getByLabel('Guest name',{exact:true})).toHaveCount(0);
});
test('UI contract: explicit platform grant creates tenant and designated administrator',async({page},testInfo)=>{
 const f=await contractFixture(page,'operator');await f.login();await page.getByRole('navigation').getByRole('button',{name:'Platform',exact:true}).click();const panel=page.getByRole('region',{name:'Platform administration'});
 await panel.getByLabel('Tenant name',{exact:true}).fill('Fictional new township');await panel.getByLabel('Initial site name',{exact:true}).fill('Fictional gate');await panel.getByLabel('Initial administrator account reference',{exact:true}).fill(id(99));await panel.getByRole('checkbox').check();
 await panel.getByRole('button',{name:'Create tenant and site',exact:true}).click();await expect(panel.getByRole('heading',{name:'Fictional new township',exact:true})).toBeVisible();expect(f.calls.find(c=>c.name==='create_platform_tenant')?.args.p_admin).toBe(id(99));
 await page.setViewportSize({width:360,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('platform-360.png'),fullPage:true});
});
test('UI contract: township admin creates scoped site and handles MFA rejection',async({page})=>{
 const f=await contractFixture(page,'admin');f.state.reject.set('create_township_site','Multi-factor step-up required');await f.login();await page.getByRole('navigation').getByRole('button',{name:'Administration',exact:true}).click();const panel=page.getByRole('form',{name:'Township site creation'});
 await panel.getByLabel('New site name',{exact:true}).fill('Fictional extra gate');await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Create township site',exact:true}).click();await expect(panel.getByRole('alert')).toHaveText('Multi-factor step-up required');await expect(panel.getByRole('status')).toHaveCount(0);
 f.state.reject.delete('create_township_site');await panel.getByRole('button',{name:'Create township site',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Site created');
});
