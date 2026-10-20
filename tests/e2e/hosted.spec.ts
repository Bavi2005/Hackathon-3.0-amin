import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
type Tenant={siteId:string;vehicleId:string;accounts:Record<string,{email:string;id:string}>};
test('hosted visitor, driver/dispatch, parking, role isolation and mobile flows without optional API',async({browser})=>{
 const fixture=JSON.parse(await readFile('.local/demo-fixture.json','utf8')) as {projectUrl:string;tenants:Tenant[]};
 expect(fixture.projectUrl).toBe(new URL(process.env.SUPABASE_URL!).origin);
 const [a,b]=fixture.tenants,contexts:BrowserContext[]=[];
 async function login(tenant:Tenant,role:string){
  const context=await browser.newContext({baseURL:'http://127.0.0.1:5174'});contexts.push(context);const page=await context.newPage();
  await page.goto('/');
  await page.getByLabel('Email',{exact:true}).fill(tenant.accounts[role].email);
  await page.getByLabel('Password',{exact:true}).fill(process.env.DEMO_PASSWORD!);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Site',exact:true})).toHaveValue(tenant.siteId);
  return page;
 }
 async function open(page:Page,name:string){
  await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Refreshed');
 }
 try{
  const resident=await login(a,'resident'),guard=await login(a,'guard'),admin=await login(a,'admin'),operator=await login(a,'operator'),driver=await login(a,'driver'),dispatch=await login(a,'dispatcher'),parking=await login(a,'parking'),foreign=await login(b,'resident');
  await open(admin,'Forms');const manager=admin.getByRole('region',{name:'Visitor form management'});
  await manager.getByLabel('Form title',{exact:true}).fill('Fictional browser event form');
  await manager.getByRole('combobox',{name:'Form template',exact:true}).selectOption('event');
  await manager.getByRole('button',{name:'Publish form version',exact:true}).click();await expect(manager.getByRole('status')).toContainText('published');
  await open(resident,'MyVisitor');
  await resident.getByRole('button',{name:'Create guest invitation'}).click();
  const link=resident.getByRole('link',{name:'Open private guest registration'});
  await expect(link).toBeVisible();
  await manager.getByRole('combobox',{name:'Form template',exact:true}).selectOption('residential');
  await manager.getByRole('button',{name:'Publish form version',exact:true}).click();await expect(manager.getByRole('status')).toContainText('published');
  const guestContext=await browser.newContext();contexts.push(guestContext);const guest=await guestContext.newPage();
  await guest.goto((await link.getAttribute('href'))!);
  const name=`Fictional Browser Guest ${Date.now()}`;
  await guest.getByLabel('Guest name',{exact:true}).fill(name);
  await guest.getByLabel('Number of visitors (required)',{exact:true}).fill('2');
  await guest.getByLabel('Planned arrival date (required)',{exact:true}).fill('2026-10-20');
  await guest.getByRole('checkbox').check();
  await guest.getByRole('button',{name:'Try OTP simulator',exact:true}).click();
  const demoCode=guest.getByTestId('demo-otp');await expect(demoCode).toBeVisible();
  await guest.getByLabel('Verification code',{exact:true}).fill((await demoCode.textContent())!);
  await guest.getByRole('button',{name:'Verify demo code',exact:true}).click();
  await expect(guest.getByText('Demo code verified. Register before the code expires.')).toBeVisible();
  await guest.getByRole('button',{name:'Register visit',exact:true}).click();
  await expect(guest.getByRole('status')).toHaveText(/Registration recorded/);
  await expect(guest.getByRole('button',{name:'Register visit',exact:true})).toBeDisabled();
  await open(guard,'MyVisitor');
  const visit=guard.locator('article').filter({has:guard.getByRole('heading',{name,exact:true})});
  await visit.getByRole('button',{name:'Verify & check in'}).click();
  await expect(visit.getByText('onsite',{exact:true})).toBeVisible();
  await visit.getByRole('button',{name:'Check out',exact:true}).click();
  await expect(visit.getByText('departed',{exact:true})).toBeVisible();
  await visit.getByRole('button',{name:'Show submitted form',exact:true}).click();await expect(visit.getByText('Number of visitors: 2')).toBeVisible();
  await open(admin,'MyVisitor');await expect(admin.getByRole('heading',{name,exact:true})).toBeVisible();
  const records=admin.getByRole('region',{name:'Visitor records'});
  await records.getByLabel('Name or reference').fill(name);
  await records.getByLabel('Visit status').selectOption('departed');
  await records.getByRole('button',{name:'Search records',exact:true}).click();
  await expect(records.getByText('Showing records 1–1, newest first.')).toBeVisible();
  await expect(records.getByRole('heading',{name:'F***',exact:true})).toBeVisible();
  await expect(records.getByText(name,{exact:true})).toHaveCount(0);
  await records.getByLabel('Export purpose').selectOption('operations_review');
  const received=admin.waitForEvent('download');
  await records.getByRole('button',{name:'Export masked CSV',exact:true}).click();
  const download=await received,csv=await readFile((await download.path())!,'utf8');
  expect(csv).toContain('"F***","departed"');expect(csv).not.toContain(name);
  await expect(records.getByRole('status')).toContainText('Export authorized and audited: 1 masked records');
  await expect(guard.getByRole('button',{name:'Export masked CSV',exact:true})).toHaveCount(0);
  for(const page of [operator,foreign]){await open(page,'MyVisitor');await expect(page.getByRole('heading',{name,exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Verify & check in'})).toHaveCount(0);}
  await open(driver,'Transportation');await driver.getByRole('button',{name:'Start shift',exact:true}).click();
  await expect(driver.getByRole('button',{name:'End shift',exact:true})).toBeVisible();
  await open(resident,'Transportation');
  await resident.getByRole('combobox',{name:'Pickup',exact:true}).selectOption({label:'Community Hub'});
  await resident.getByRole('combobox',{name:'Destination',exact:true}).selectOption({label:'Demo Mall'});
  await resident.getByRole('button',{name:'Request ride',exact:true}).click();
  await expect(resident.getByRole('status')).toHaveText(/Ride requested/);
  await open(dispatch,'Transportation');
  const request=dispatch.locator('article').filter({has:dispatch.getByRole('button',{name:'Assign with capacity check'})}).first();
  await request.getByRole('combobox',{name:'Assign vehicle',exact:true}).selectOption(a.vehicleId);
  await request.getByRole('button',{name:'Assign with capacity check'}).click();
  await expect(resident.getByText('assigned',{exact:true})).toBeVisible();
  await driver.getByRole('button',{name:'Send simulated GPS',exact:true}).click();
  await expect(resident.getByText(/SIMULATED GPS/)).toBeVisible();
  await expect(resident.getByText(/3.16, 101.51/)).toBeVisible();
  await driver.getByRole('button',{name:'Confirm boarding',exact:true}).click();
  await driver.getByRole('button',{name:'Complete ride',exact:true}).click();
  await driver.getByRole('button',{name:'End shift',exact:true}).click();
  await open(parking,'Parking');await parking.getByLabel('Simulated occupied count',{exact:true}).fill('12');
  await parking.getByRole('button',{name:'Send sensor event',exact:true}).click();
  await open(resident,'Parking');
  const counterZone=resident.getByRole('region',{name:'Parking availability'}).locator('article').filter({has:resident.getByRole('heading',{name:'Demo Mall - Level 1 - Zone A',exact:true})});
  await expect(counterZone.getByText('28 free',{exact:true})).toBeVisible();
  await resident.clock.install();await resident.clock.fastForward(125000);
  await expect(counterZone.getByText('Unknown',{exact:true})).toBeVisible();
  await open(admin,'Overview');
  for(const width of [360,768,1440]){
   await admin.setViewportSize({width,height:900});
   expect(await admin.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
   await admin.screenshot({path:`test-results/overview-${width}.png`,fullPage:true});
  }
 }finally{await Promise.all(contexts.map(context=>context.close()));}
});
