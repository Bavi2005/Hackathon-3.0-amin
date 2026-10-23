import {test,expect} from '@playwright/test';
import {contractFixture,id} from './contract-fixture';
test('redesign: home uses actual scoped records and service shortcuts on desktop and mobile',async({page},testInfo)=>{
 const f=await contractFixture(page,'resident');const now=new Date().toISOString();
 f.state.rides.push({id:id(980),pickup:'Community Hub',destination:'Demo Mall',status:'assigned',resident_id:id(10),created_at:now,updated_at:now});
 f.state.visits.push({id:id(981),guest_name:'Fictional pitch visitor',status:'onsite',created_at:now});
 f.state.zones[0].occupied=12;f.state.zones[0].observed_at=now;f.state.zones[0].simulated=true;
 await f.login();await expect(page.getByRole('heading',{name:'Hello, neighbour.'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Recent activity'}).getByText('Community Hub → Demo Mall')).toBeVisible();
 await expect(page.getByRole('region',{name:'Your service snapshot'}).getByText('01',{exact:true})).toHaveCount(2);
 for(const width of [1440,768,390,360]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`home-${width}.png`),fullPage:true});}
 await page.getByRole('button',{name:'Open Transportation',exact:true}).click();await expect(page.getByRole('heading',{name:'Request a shuttle',exact:true})).toBeVisible();
 await page.getByRole('navigation').getByRole('button',{name:'Parking',exact:true}).click();await expect(page.getByText('28 free',{exact:true})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('parking-360.png'),fullPage:true});
});
test('redesign: mobile More menu exposes authorized tools and closes after navigation',async({page})=>{
 const f=await contractFixture(page,'admin');await page.setViewportSize({width:360,height:900});await f.login();
 const nav=page.getByRole('navigation');await expect(nav.getByRole('button',{name:'Administration',exact:true})).not.toBeVisible();
 await nav.getByRole('button',{name:'More services',exact:true}).click();await expect(nav.getByRole('button',{name:'More services',exact:true})).toHaveAttribute('aria-expanded','true');
 await nav.getByRole('button',{name:'Administration',exact:true}).click();await expect(page.getByRole('region',{name:'Site administration'})).toBeVisible();await expect(nav.getByRole('button',{name:'More services',exact:true})).toHaveAttribute('aria-expanded','false');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});
test('redesign: sign-in and empty dashboard do not fabricate activity',async({page},testInfo)=>{
 const f=await contractFixture(page,'resident');await page.goto('/');
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:testInfo.outputPath('login-1440.png'),fullPage:true});
 await f.login();await expect(page.getByText('A fresh start to your day.',{exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Your service snapshot'}).getByText('00',{exact:true})).toHaveCount(2);
 await page.getByRole('navigation').getByRole('button',{name:'Parking',exact:true}).click();await expect(page.getByText('Unknown',{exact:true})).toBeVisible();
});
