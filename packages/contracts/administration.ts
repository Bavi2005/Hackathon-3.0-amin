export type StaffTemplate = 'guard' | 'parking' | 'dispatcher' | 'driver' | 'loader';
export const staffTemplates: {value: StaffTemplate; label: string}[] = [
  {value: 'guard', label: 'Visitor guard'}, {value: 'parking', label: 'Parking attendant'},
  {value: 'dispatcher', label: 'Transport dispatcher'}, {value: 'driver', label: 'Driver'},
  {value: 'loader', label: 'Mall loading coordinator'},
];
export type ManagedMember = {id: string; user_id: string; role: string; capabilities: string[]; active: boolean; revision: number};
export type ManagedVehicle = {id: string; name: string; capacity: number; accessible: boolean; driver_id: string | null; shift_active: boolean; revision: number};
export type ManagedZone = {id: string; name: string; capacity: number; occupied: number | null; revision: number};
export type ManagedDevice = {id: string; zone_id: string; active: boolean; last_sequence: number; revision: number};
export type StaffInvitation = {id: string; target_user: string; template: StaffTemplate; expires_at: string; accepted_at: string | null; revoked_at: string | null};
export type SiteAdministrationData = {members: ManagedMember[]; invitations: StaffInvitation[]; vehicles: ManagedVehicle[]; zones: ManagedZone[]; devices: ManagedDevice[]; stops: {id: string; name: string}[]};
export function memberTemplate(member: ManagedMember): StaffTemplate {
  if (member.role === 'LOADER' || member.capabilities.includes('loading.manage')) return 'loader';
  if (member.capabilities.includes('fleet.drive')) return 'driver';
  if (member.capabilities.includes('fleet.dispatch')) return 'dispatcher';
  if (member.capabilities.includes('parking.configure')) return 'parking';
  return 'guard';
}
