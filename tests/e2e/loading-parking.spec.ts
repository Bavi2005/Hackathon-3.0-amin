import {test,expect} from '@playwright/test';
import {contractFixture,id} from './contract-fixture';

test('loader role signs in to mall desk, records an arrival and checks it out without admin access',async({page})=>{
 const f=await contractFixture(page,'loader');
 f.state.facilities.push({id:id(120),name:'Fictional Test Mall',details:'Contract loading entrance'});
 f.state.levels.push({id:id(121),facility_id:id(120),name:'Service Level 1'});
 await f.login();
 await expect(page.getByRole('heading',{name:'Loading dock operations.'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Loading dock operations'})).toBeVisible();
 expect(await page.getByRole('navigation').getByRole('button',{name:'Administration',exact:true}).count()).toBe(0);
 await page.getByRole('combobox',{name:'Mall / venue'}).selectOption(id(120));
 await page.getByRole('combobox',{name:'Parking level / loading location'}).selectOption(id(121));
 await page.getByRole('textbox',{name:'Vehicle registration'}).fill('DEMO 1234');
 await page.getByRole('textbox',{name:'Delivery / job reference'}).fill('ORDER-123');
 await page.getByRole('button',{name:'Check in vehicle →'}).click();
 await expect(page.getByRole('region',{name:'Loading dock operations'}).getByText('DEMO 1234')).toBeVisible();
 expect(f.calls.find(c=>c.name==='start_loading_session')?.args.p_facility).toBe(id(120));
 expect(f.calls.find(c=>c.name==='start_loading_session')?.args.p_level).toBe(id(121));
 await page.getByRole('button',{name:'Check out'}).click();
 await expect(page.getByText('✓ Departed')).toBeVisible();
 expect(f.calls.some(c=>c.name==='finish_loading_session')).toBe(true);
});

test('site manager exports permission-gated loading CSV while loader cannot',async({page})=>{
 const f=await contractFixture(page,'manager');
 f.state.facilities.push({id:id(120),name:'Fictional Test Mall',details:'Goods entrance'});
 f.state.levels.push({id:id(121),facility_id:id(120),name:'Service Level 1'});
 f.state.loadingSessions.push({id:id(130),facility_id:id(120),level_id:id(121),vehicle_ref:'TEST-VAN',delivery_ref:'DEMO-ORDER',status:'loading',checked_in_at:new Date().toISOString(),checked_out_at:null,facility_name:'Fictional Test Mall',level_name:'Service Level 1'});
 await f.login();await page.getByRole('navigation').getByRole('button',{name:'Loading',exact:true}).click();
 await expect(page.getByRole('region',{name:'Loading record export'})).toBeVisible();
 await page.getByRole('combobox',{name:'Reason for export'}).selectOption('operations_review');
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download loading CSV ↓'}).click();
 expect((await downloaded).suggestedFilename()).toMatch(/^loading-dock-\d{4}-\d{2}-\d{2}\.csv$/);
 expect(f.calls.find(c=>c.name==='export_loading_records')?.args.p_reason).toBe('operations_review');
});

test('parking opens mall overview then floor and displays only genuinely configured bay states',async({page})=>{
 const f=await contractFixture(page,'resident'),at=new Date().toISOString();
 f.state.facilities.push({id:id(120),name:'Fictional Test Mall',details:'Visitor parking'});
 f.state.levels.push({id:id(121),facility_id:id(120),name:'P1 Retail'});
 Object.assign(f.state.zones[0],{level_id:id(121),occupied:12,observed_at:at,simulated:true});
 f.state.zones.push({id:id(122),tenant_id:id(30),site_id:id(20),name:'Sensor Bays',capacity:2,kind:'bay',level_id:id(121),occupied:null,observed_at:null,simulated:true});
 f.state.bays.push({id:id(123),zone_id:id(122),label:'P1-01',accessible:false,status:'FREE',observed_at:at,simulated:true},{id:id(124),zone_id:id(122),label:'P1-02',accessible:false,status:'OCCUPIED',observed_at:at,simulated:true});
 await f.login();await page.getByRole('navigation').getByRole('button',{name:'Parking',exact:true}).click();
 const explorer=page.getByRole('region',{name:'Mall parking explorer'});
 await expect(explorer.getByRole('heading',{name:'Malls & parking locations'})).toBeVisible();
 await explorer.getByRole('button',{name:'View Fictional Test Mall parking levels'}).click();
 await expect(explorer.getByRole('heading',{name:'Fictional Test Mall'})).toBeVisible();
 await explorer.getByRole('button',{name:'View P1 Retail bays'}).click();
 await expect(explorer.getByRole('heading',{name:'Sensor Bays'})).toBeVisible();
 await expect(explorer.getByText('P1-01',{exact:true})).toBeVisible();
 await expect(explorer.getByText('P1-02',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});


test('delivery entrance QR preserves loading intent through private no-app guest registration',async({page})=>{
 const f=await contractFixture(page,'manager');
 f.state.activeForm={id:id(850),version:1,title:'Mall visitor and delivery check-in',template:'office',fields:[{key:'purpose',required:true}],created_at:new Date().toISOString()};
 await f.login();await page.getByRole('navigation').getByRole('button',{name:'MyVisitor',exact:true}).click();
 const issuer=page.getByRole('region',{name:'Public site check-in QR'});
 await issuer.getByRole('button',{name:'Generate walk-in QR code'}).click();
 await expect(page.getByRole('region',{name:'Mall loading entrance QR'}).getByRole('img',{name:'Mall loading entrance QR for delivery visitor registration'})).toHaveAttribute('src',/^data:image\/png/);
 await page.getByRole('link',{name:'Test delivery check-in ↗'}).click();
 await expect(page.getByRole('heading',{name:'Mall delivery & loading entry'})).toBeVisible();
 await page.getByRole('button',{name:'Start visitor registration'}).click();
 await expect(page.getByRole('heading',{name:'Delivery & loading registration'})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Purpose of visit (required)'})).toHaveValue('Delivery');
 expect(f.calls.find(c=>c.name==='begin_site_checkin')?.args.p_token).toBe('d'.repeat(64));
});
