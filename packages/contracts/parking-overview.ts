import {available} from './freshness';
export type BayStatus = 'FREE' | 'OCCUPIED' | 'UNKNOWN' | 'OUT_OF_SERVICE';
export type ParkingBay = {id: string; label: string; accessible: boolean; status: BayStatus; observed_at: string | null; simulated: boolean};
export type ParkingZone = {id: string; name: string; capacity: number; occupied: number | null; observed_at: string | null; simulated: boolean; kind: 'counter' | 'bay'; revision: number; level_id: string | null; facility_name: string | null; level_name: string | null; bays: ParkingBay[]; override: {occupied: number; observed_at: string; expires_at: string; reason: string} | null};
export type ParkingOverview = {zones: ParkingZone[]; devices: {id: string; zone_id: string; bay_id: string | null; active: boolean; last_sequence: number}[]; facilities: {id: string; name: string; details: string}[]; levels: {id: string; facility_id: string; name: string}[]};
export function currentBayStatus(bay: ParkingBay, now: number): BayStatus {
  const observed = bay.observed_at ? Date.parse(bay.observed_at) : NaN;
  if (!Number.isFinite(observed) || observed > now + 30000 || now - observed > 120000) return 'UNKNOWN';
  return bay.status;
}
export function zoneAvailability(zone: ParkingZone, now: number): {free: number | null; source: string; observed: string | null} {
  if (zone.kind === 'bay') {
    const statuses = zone.bays.map(b => currentBayStatus(b, now));
    return {free: zone.bays.length !== zone.capacity || statuses.includes('UNKNOWN') ? null : statuses.filter(s => s === 'FREE').length, source: zone.bays.some(b => b.simulated) ? 'SIMULATED BAYS' : 'BAY SENSORS', observed: null};
  }
  const override = zone.override;
  if (override && Date.parse(override.expires_at) > now && Date.parse(override.observed_at) <= now && override.occupied >= 0 && override.occupied <= zone.capacity) {
    return {free: zone.capacity - override.occupied, source: 'MANUAL OVERRIDE', observed: override.observed_at};
  }
  return {free: available(zone.capacity, zone.occupied, zone.observed_at, now), source: zone.simulated ? 'SIMULATED' : 'COUNTER', observed: zone.observed_at};
}
