export type ParkingEvent = { eventId:string; deviceId:string; sequence:number; observedAt:string } &
  ({occupied:number; kind?: never; status?: never; schemaVersion?: never} | {schemaVersion:1; kind:'bay.occupancy'; status:'FREE'|'OCCUPIED'|'UNKNOWN'|'OUT_OF_SERVICE'; occupied?: never});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isParkingEvent(value:unknown):value is ParkingEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const e = value as Record<string,unknown>;
  const bay = e.kind === 'bay.occupancy';
  const fields = bay ? ['schemaVersion','kind','eventId','deviceId','sequence','status','observedAt'] : ['eventId','deviceId','sequence','occupied','observedAt'];
  if (Object.keys(e).length !== fields.length || fields.some(key => !(key in e))) return false;
  if (typeof e.eventId !== 'string' || !uuid.test(e.eventId) || typeof e.deviceId !== 'string' || !uuid.test(e.deviceId)) return false;
  if (typeof e.sequence !== 'number' || !Number.isSafeInteger(e.sequence) || e.sequence < 0) return false;
  if (bay) {
    if (e.schemaVersion !== 1 || typeof e.status !== 'string' || !['FREE','OCCUPIED','UNKNOWN','OUT_OF_SERVICE'].includes(e.status)) return false;
  } else if (typeof e.occupied !== 'number' || !Number.isInteger(e.occupied) || e.occupied < 0 || e.occupied > 2147483647) return false;
  if (typeof e.observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(e.observedAt)) return false;
  const date = new Date(e.observedAt);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,19) === e.observedAt.slice(0,19);
}
export const parkingEvent = {
  safeParse(value:unknown):{success:true;data:ParkingEvent}|{success:false} {
    return isParkingEvent(value) ? {success:true,data:value} : {success:false};
  }
};
