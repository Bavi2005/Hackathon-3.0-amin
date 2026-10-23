# SmartTownship — hackathon submission checklist (23 October 2026)

Independent People-challenge concept. All seeded data, parking observations, residents and vehicles are **fictional**, not official Sime Darby Property records or connected transport/sensor readings.

## Data and visual polish completed

- [x] Reuse existing Demo Elmina development tenant and role accounts (no production users).
- [x] Add 15 fictional visitor visits, 22 ride records, 3 published route schedules, additional stops and vehicles.
- [x] Add two parking facilities, levels, 6 zones, 10 simulated bays and device bindings.
- [x] Set up development-only SQL parking pulse to update simulated readings every minute.
- [x] Publish a default welcome visitor form for the site.
- [x] Polish public QR issuer, resident parking digital twin, mobility route network and platform operator KPIs.
- [ ] Verify the latest deploy in real logged-in browsers; database changes alone are not full end-to-end verification.

## Acceptance matrix: requested versus delivered

| Module | Requested | Status / important gaps |
|---|---|---|
| Resident home | Connected service shortcuts, activity and summary | Implemented with authenticated records; recheck on Render |
| Operator | Township portfolio, busy platform monitoring, activity | Added aggregated platform pulse, not private visitor/GPS access |
| Walk-in MyVisitor | **Site QR code for first-time visitors** | Admin/manager can generate, print, rotate, revoke and test public site QR from MyVisitor; guests get separate private form, no app/account |
| Invitation MyVisitor | Resident personal invitation QR | Already implemented and separate from public site QR |
| Visitor lifecycle | Form, consent, optional OTP, guard check-in/out | Backend/UI source + browser contract tests; OTP simulator only, no SMS provider |
| Admin forms | Template selection, publish and historical versions | Implemented and a fictional form published on demo site |
| Records | Search, masked results, export, audit and privacy | Source present, CSV export not XLSX; independent privacy review still missing |
| Visitor AI/anti-fraud | AI form generator, natural-language search, geographic location check | **NOT SHIPPED**; cannot claim this is complete |
| Parking | Facility > level > zone > bay with simulated sensor updates | Source and demo data present; test-only minute pulse + authorized manual simulators |
| Parking integrity | Unknown/stale expiry and no guaranteed reservations | Implemented data freshness; no real sensors, physical device health or guaranteed parking |
| Transport | Request ride, dispatch, cancellation, shift, completion | Source present, fictional service history populated; hosted multi-role verification pending |
| Mobility planning | Timetables, capacity, operational route comparison | Source and fictional schedules; deterministic offline comparison available |
| Live transport | Map with moving vans, reliable ETA, continuous GPS | **NOT SHIPPED**; UI must not invent locations or estimates |
| Analytics | Site aggregated dashboard and operator oversight | Source + new operator read-only aggregates; deployed flow unverified |
| Hosting | Latest Render deployment working for judges | **UNVERIFIED** — GitHub push alone does not establish successful Render deploy |
| Verification | Green CI + hosted RLS/tests + responsive mobile | **PENDING** for final commit; older CI failed home-page horizontal overflow |
| Slides | Ten-slide pitch | **NOT PREPARED** — user preparing later |
| Research | User interviews, real pilot cost, provider approvals | **MISSING**, do not invent measurements or partnerships |

## Six-minute live judge walkthrough

1. Resident Home: fictional service activity and smooth navigation.
2. Parking: choose a facility, level, zone and bay; show color-coded simulated FREE/OCCUPIED and automatic pulse. Explain stale data honestly.
3. Manager/admin MyVisitor: generate *public* QR. Scan using a second phone/profile, submit fiction-only data with consent, then guard checks in.
4. Resident Transportation: show routes, request a trip; use dispatcher and driver profiles for assignment/boarding if hosted verification succeeds.
5. Operator Home: show township-wide counts and integration status without revealing private personal data.
6. Discuss fixed-route versus adaptive simulator measurements and realistic pilot roadmap. State that provider integrations remain future work.

## Must-check before submitting

- [ ] Final GitHub Actions verify green for the latest main commit, including Playwright 360px checks.
- [ ] Render page is using that exact final commit; login and redirect work.
- [ ] Test resident, manager/admin, guard, driver, parking staff and operator accounts in different browser profiles.
- [ ] Test new QR -> scan -> form submit -> guard check-in/out, not a previously used QR.
- [ ] Test parking simulator data changes and stale/unknown state; never state fake sensor readings are real.
- [ ] Verify second-tenant isolation and role permissions.
- [ ] Prepare submission slides and fallback screen recording.

## Safety and operations

Demo pulse implementation: scripts/demo-parking-pulse.sql. It only updates pre-marked fictional test records and does not disable the 120-second freshness policy. To stop, trusted project operator executes cron.unschedule('smarttownship-demo-parking-pulse') in the test project. Keep it disabled when no live demonstration is intended.

Project scope: no payments, no real public parking reservation, no physical sensors, no route-provider ETA, no official Sime Darby data. This is a hackathon prototype.
