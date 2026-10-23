# MyVisitor · Mall Loading · Parking — Hackathon handoff (23 October 2026)

## The actual problem being addressed
A guard-post paper logbook delays entry, is hard to search, and can expose details to the next person in line. Mall loading areas separately need an accountable vehicle arrival/departure workflow. Drivers/residents need to see available mall parking by location, floor and space, with stale/missing data clearly identified.

## End-to-end demonstration
1. **Site manager** signs in → **MyVisitor** → **Generate walk-in QR code**. The standard entrance poster registers ordinary guests; the **Mall loading entrance QR** points to the same time-limited, rotating, server-validated issuer but marks delivery intent.
2. **Delivery driver** scans loading QR in any browser without installing an app. The guest form uses the site's published version with Delivery preselected if Purpose is included; completion provides an ID and a timestamp. The guard still verifies entry. A scan does not automatically reserve or grant physical bay access.
3. **Site manager** invites a distinct staff member as **Mall loading coordinator** through Administration, and the intended existing account accepts its private invitation.
4. **LOADER** logs in → lands on **Loading Dock**, chooses mall and level, records vehicle and delivery references, then checks out when departure is confirmed. Only the server sets timestamps, with site-scoped authorization and audit events.
5. **Resident/user** opens **Parking** → chooses a mall/parking facility → chooses a level → sees zones and individual monitored bay states. Free, occupied, stale/unknown, and out-of-service are visually distinct. Counters **never** fabricate individual bay states.
6. **Township administrator/site manager** opens **Loading Dock** and exports audited loading CSV with an explicit purpose; **MyVisitor** already provides independently permission-checked masked visitor-record CSV. LOADER cannot export either admin-only data set.
7. **Platform operator** opens the platform dashboard for aggregate visitors, rides, mall loading and parking, then downloads a **per-site aggregate statistics CSV** without private identities or vehicle plate numbers.

## Trust and availability boundaries
- The demo/test environment has fictional malls, zones, ten configured individual bays and a demo-only timed simulation. It is **not live external IoT data**, a parking reservation or a verified geographic sensor.
- A completed visitor form is an entry request, **not** a guarantee of physical admission or a booked loading bay.
- Existing visitor exports are masked and audited; manager loading exports contain sensitive vehicle and delivery references and must be protected under a real retention policy.
- Current prototype OTP capability is a simulator only; production SMS provider, production AI form-writing service, location/geofence proof, real mall hardware and legally verified PDPA compliance are **not integrated**. The existing site form templates, version history, privacy review workflow, QR expiration and retention controls are functional building blocks, but **do not** constitute full compliance or a tamper-proof ledger.
- A standalone physical-world pilot needs consent/notice review, operating SOPs, sensor integration, identity/phone verification provider, threat modeling and guard interviews.

## New schema/API
- `supabase/migrations/202610230001_loader_operations.sql`: LOADER membership/template, private loading sessions, start, finish, read and restricted export RPCs.
- `supabase/migrations/202610230002_platform_loading_pulse.sql`: operator-authorized aggregated pulse.
- LOADER capabilities: `loading.manage` only. LOADER has no staff administration, exports, fleet dispatch, site visitor identities or unrestricted platform access.
- Loading export: `export_loading_records(p_site,p_reason)` — site managers/admins only, at most 1,000 most recent rows, explicit purpose, audited.
- Demo-only seed: `scripts/demo-loading-seed.sql`; simulation data must never be used in real records.
- Code/contract tests include `tests/e2e/loading-parking.spec.ts`, and the existing visitor/parking security contracts continue to run.

## Suggested judge narrative
**Scan to enter. Check in to unload. Know where to park.**
A QR replaces the exposed visitor book. The loading desk records who arrived and departed without paper; parking drilldowns tell a driver which monitored floors and bays are available. Site operators get audit trails and downloadable reports, while unverified data stays labelled as such.
