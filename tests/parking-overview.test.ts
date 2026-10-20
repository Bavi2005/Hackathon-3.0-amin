import {describe,it,expect} from 'vitest';
import {currentBayStatus,zoneAvailability,type ParkingBay,type ParkingZone} from '../packages/contracts/parking-overview';
const now=Date.parse('2026-10-20T01:00:00Z');
const bay:ParkingBay={id:'bay',label:'A1',accessible:false,status:'FREE',observed_at:new Date(now).toISOString(),simulated:false};
const zone:ParkingZone={id:'zone',name:'Test',capacity:2,occupied:1,observed_at:new Date(now).toISOString(),simulated:false,kind:'counter',revision:1,level_id:null,facility_name:null,level_name:null,bays:[],override:null};
describe('parking granularity and expiry',()=>{
 it('counter estimates never manufacture individual bays',()=>expect(zoneAvailability(zone,now).free).toBe(1));
 it('missing configured bays leave aggregate unknown',()=>expect(zoneAvailability({...zone,kind:'bay',bays:[bay]},now).free).toBeNull());
 it('one stale bay makes aggregate unknown',()=>expect(zoneAvailability({...zone,kind:'bay',bays:[bay,{...bay,id:'other',observed_at:new Date(now-120001).toISOString()}]},now).free).toBeNull());
 it('out of service bays are never counted free',()=>expect(zoneAvailability({...zone,kind:'bay',bays:[bay,{...bay,id:'other',status:'OUT_OF_SERVICE'}]},now).free).toBe(1));
 it('expired free bay becomes unknown',()=>expect(currentBayStatus(bay,now+120001)).toBe('UNKNOWN'));
 it('future bay observation is unknown',()=>expect(currentBayStatus({...bay,observed_at:new Date(now+30001).toISOString()},now)).toBe('UNKNOWN'));
 it('invalid observation date is unknown',()=>expect(currentBayStatus({...bay,observed_at:'invalid'},now)).toBe('UNKNOWN'));
 it('manual observation lasts its explicit duration beyond sensor TTL',()=>expect(zoneAvailability({...zone,override:{occupied:0,observed_at:new Date(now-180000).toISOString(),expires_at:new Date(now+1000).toISOString(),reason:'verified_count'}},now)).toMatchObject({free:2,source:'MANUAL OVERRIDE'}));
 it('expired manual count falls back to fresh sensor value',()=>expect(zoneAvailability({...zone,override:{occupied:0,observed_at:new Date(now-180000).toISOString(),expires_at:new Date(now).toISOString(),reason:'verified_count'}},now)).toMatchObject({free:1,source:'COUNTER'}));
 it('expired override plus stale sensor produces unknown',()=>expect(zoneAvailability({...zone,observed_at:new Date(now-120001).toISOString(),override:{occupied:0,observed_at:new Date(now-180000).toISOString(),expires_at:new Date(now).toISOString(),reason:'verified_count'}},now).free).toBeNull());
 it('manual counts cannot invent capacity',()=>expect(zoneAvailability({...zone,override:{occupied:3,observed_at:new Date(now).toISOString(),expires_at:new Date(now+1000).toISOString(),reason:'verified_count'}},now).free).toBe(1));
});
