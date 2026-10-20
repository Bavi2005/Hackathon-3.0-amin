import {test,expect} from '@playwright/test';
import {contractFixture,id} from './contract-fixture';
test('UI contract: route publication saves configured stops and Malaysia timetable',async({page})=>{
 const f=await contractFixture(page,'manager');await f.login();await page.getByRole('navigation').getByRole('button',{name:'Transportation',exact:true}).click();
 const panel=page.getByRole('region',{name:'Transport routes'});await panel.getByLabel('Route name',{exact:true}).fill('Fictional daily shuttle');
 await panel.getByRole('combobox',{name:'Route origin',exact:true}).selectOption('Community Hub');await panel.getByRole('combobox',{name:'Route destination',exact:true}).selectOption('Demo Mall');
 await panel.getByLabel('Service starts',{exact:true}).fill('09:00');await panel.getByLabel('Service ends',{exact:true}).fill('17:00');await panel.getByLabel('Scheduled interval in minutes',{exact:true}).fill('30');
 await panel.getByLabel('Publish timetable to site members',{exact:true}).check();await panel.getByRole('button',{name:'Save route timetable',exact:true}).click();
 await expect(panel.getByText('09:00–17:00 · Every 30 minutes · Published',{exact:true})).toBeVisible();
 expect(f.calls.find(c=>c.name==='save_transport_route')?.args).toMatchObject({p_site:f.site,p_stops:['Community Hub','Demo Mall'],p_start:540,p_end:1020,p_headway:30,p_published:true});
});
test('UI contract: capacity recommendation is honest about unavailable ETA and rechecks server assignment',async({page})=>{
 const f=await contractFixture(page,'dispatcher');f.state.vehicles[0].shift_active=true;f.state.rides.push({id:id(800),pickup:'Community Hub',destination:'Demo Mall',status:'requested',accessible:false});await f.login();
 await page.getByRole('navigation').getByRole('button',{name:'Transportation',exact:true}).click();const panel=page.getByRole('region',{name:'Dispatch options'});
 await panel.getByRole('button',{name:'Review vehicle options',exact:true}).click();await expect(panel.getByText('ETA unavailable; routing provider not configured',{exact:true})).toBeVisible();
 f.state.reject.set('assign_ride','Vehicle full');await panel.getByRole('button',{name:'Assign to Fictional contract shuttle',exact:true}).click();await expect(panel.getByRole('alert')).toHaveText('Vehicle full');
 expect(f.state.rides[0].status).toBe('requested');f.state.reject.delete('assign_ride');await panel.getByRole('button',{name:'Assign to Fictional contract shuttle',exact:true}).click();await expect(page.getByText('assigned',{exact:true})).toBeVisible();
});
test('UI contract: reassignment requires a reason and sends selected replacement',async({page})=>{
 const f=await contractFixture(page,'dispatcher');f.state.vehicles[0].shift_active=true;f.state.vehicles.push({...f.state.vehicles[0],id:id(801),name:'Fictional replacement'});f.state.rides.push({id:id(800),vehicle_id:f.vehicle,pickup:'Community Hub',destination:'Demo Mall',status:'assigned',accessible:false});await f.login();
 await page.getByRole('navigation').getByRole('button',{name:'Transportation',exact:true}).click();const panel=page.getByRole('region',{name:'Dispatch options'});await panel.getByRole('button',{name:'Review vehicle options',exact:true}).click();
 await expect(panel.getByRole('button',{name:'Reassign to Fictional replacement',exact:true})).toBeDisabled();await panel.getByRole('combobox',{name:'Reassignment reason',exact:true}).selectOption('vehicle_offline');await panel.getByRole('button',{name:'Reassign to Fictional replacement',exact:true}).click();
 await expect.poll(()=>f.state.rides[0].vehicle_id).toBe(id(801));expect(f.calls.find(c=>c.name==='reassign_ride')?.args).toEqual({p_ride:id(800),p_vehicle:id(801),p_reason:'vehicle_offline'});
});
