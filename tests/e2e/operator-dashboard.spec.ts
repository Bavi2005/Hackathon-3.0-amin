import {test,expect} from '@playwright/test';
import {contractFixture} from './contract-fixture';

test('platform-granted operator gets meaningful township, mall, visitor and loading metrics',async({page},testInfo)=>{
 const f=await contractFixture(page,'operator');
 await f.login();
 const dashboard=page.getByRole('region',{name:'Operator control centre'});
 await expect(dashboard).toBeVisible();
 await expect(dashboard.getByRole('heading',{name:'Your network at a glance'})).toBeVisible();
 await expect(dashboard.getByRole('heading',{name:'Last 7 days'})).toBeVisible();
 await expect(dashboard.getByRole('heading',{name:'Townships & properties'})).toBeVisible();
 await expect(dashboard.getByRole('heading',{name:'Parking facilities'})).toBeVisible();
 await expect(dashboard.getByRole('heading',{name:'Integration readiness'})).toBeVisible();
 await expect(dashboard.getByRole('heading',{name:'Recent operations'})).toBeVisible();
 await expect(dashboard.locator('.op-metric').filter({hasText:'VISITOR ARRIVALS TODAY'}).locator('strong')).toHaveText('6');
 await expect(dashboard.locator('.op-metric').filter({hasText:'DELIVERIES LOADING NOW'}).locator('strong')).toHaveText('2');
 await expect(dashboard.locator('.op-metric').filter({hasText:'KNOWN FREE COUNTER SPACES'}).locator('strong')).toHaveText('34');
 await expect(dashboard.getByRole('heading',{name:'Demo Elmina Community Hub'})).toBeVisible();
 await expect(dashboard.getByRole('heading',{name:'Fictional Test Mall'})).toBeVisible();
 await expect(dashboard.getByRole('img',{name:/Daily visitor arrivals and loading sessions/})).toBeVisible();
 await expect(dashboard).not.toContainText('Fictional private guest name');
 await page.setViewportSize({width:360,height:900});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('operator-dashboard-360.png'),fullPage:true});
 expect(f.calls.some(c=>c.name==='get_platform_activity')).toBe(true);
});

test('authorized operator exports privacy-safe per-site CSV and can open management',async({page})=>{
 await contractFixture(page,'operator').then(f=>f.login());
 const dashboard=page.getByRole('region',{name:'Operator control centre'});
 const download=page.waitForEvent('download');
 await dashboard.getByRole('button',{name:'Export operations CSV'}).click();
 expect((await download).suggestedFilename()).toMatch(/^operator-township-overview-\d{4}-\d{2}-\d{2}\.csv$/);
 await dashboard.getByRole('button',{name:'Manage platform'}).click();
 await expect(page.getByRole('region',{name:'Platform administration'})).toBeVisible();
});

test('operator role without separate platform grant sees a clear restricted-access state',async({page})=>{
 const f=await contractFixture(page,'operator',undefined,{platformGranted:false});
 await f.login();
 await expect(page.getByRole('region',{name:'Operator access status'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Operator dashboard access not enabled.'})).toBeVisible();
 await expect(page.getByRole('navigation').getByRole('button',{name:'Platform',exact:true})).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Operator control centre'})).toHaveCount(0);
 expect(f.calls.some(c=>c.name==='get_platform_activity')).toBe(false);
});
