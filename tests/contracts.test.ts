import {describe,it,expect} from 'vitest';
import {freshness,available,parkingEvent} from '../packages/contracts';
describe('source freshness',()=>{
 const now=Date.parse('2026-10-19T08:00:00Z');
 it('never displays stale or missing counts as availability',()=>{expect(available(40,4,null,now)).toBeNull();expect(available(40,4,'2026-10-19T07:57:59Z',now)).toBeNull();});
 it('labels delayed data and rejects implausible future timestamps',()=>{expect(freshness('2026-10-19T07:59:00Z',now)).toBe('delayed');expect(freshness('2026-10-19T08:02:00Z',now)).toBe('unknown');expect(freshness('invalid',now)).toBe('unknown');});
 it('calculates current available count',()=>expect(available(40,12,'2026-10-19T08:00:00Z',now)).toBe(28));
 it('rejects spoofed unrecognized event fields',()=>expect(parkingEvent.safeParse({eventId:crypto.randomUUID(),deviceId:crypto.randomUUID(),sequence:1,occupied:2,observedAt:'2026-10-19T08:00:00Z',tenantId:crypto.randomUUID()}).success).toBe(false));
});
