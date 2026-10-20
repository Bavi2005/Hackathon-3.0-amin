# Contracts

The main API is Supabase PostgREST (`/rest/v1/rpc/<function>`), authenticated with Supabase bearer JWTs. Anonymous access is limited to bearer-bound visitor resolution/registration, OTP simulation, public site-flow creation and minimal confirmation. PostgreSQL enforces every capability and transaction. Client validation is convenience only.

| RPC | Inputs | Authority |
|---|---|---|
| create_invitation | p_site UUID | visits.invite; 20/hour/account |
| redeem_invitation | p_token opaque hex, p_name ≤80 chars, p_consent true | Legacy wrapper around validated registration with empty answers; cannot bypass a form's required fields |
| get_site_visitor_forms | p_site | visits.forms.manage at exact site; active version and latest 20 historical versions |
| publish_visitor_form | p_site, p_request UUID, p_expected UUID/null, p_title, p_template, p_fields | visits.forms.manage; immutable version, optimistic concurrency and idempotent request |
| resolve_visitor_invitation | p_token opaque hex | Valid unused invitation only; site label, expiry, pinned form and notice metadata |
| submit_visitor_registration | p_token, p_name, p_consent, p_answers | Single-use invitation; server validation against pinned version; atomic visit, answers, consent and redemption |
| get_visit_form_response | p_visit | Active site membership plus invitation ownership OR visits.read.site; audited access to historical form and answers |
| visit_transition | p_id, p_status onsite/departed | visits.checkin at exact site; ordered lifecycle |
| search_visitor_records | p_site, p_from/p_until UTC timestamps, p_status, p_query, p_limit, p_offset | visits.read.site at exact tenant/site; masked output, audited access |
| export_visitor_records | p_site, p_from/p_until, p_reason, p_status, p_query | visits.read.site AND exports.visits; purpose allowlist, transactional audit, 10 exports/hour/account/site |
| request_ride | p_id UUID idempotency key, p_site, pickup/destination ≤100 chars, accessible | rides.request; own identity only; ≤3 active |
| assign_ride | p_ride, p_vehicle | fleet.dispatch; active shift, matching tenant/site, accessibility, locked capacity |
| ride_transition | p_id, p_status | Own cancellation before boarding; assigned active driver boards/completes |
| set_shift | p_vehicle, p_active | Assigned driver + fleet.drive; cannot end with active passengers |
| telemetry | p_vehicle, p_lat, p_lng, p_accuracy, p_observed, p_simulated | Assigned active driver; bounded coordinates/time/rate; simulated only demo tenant |
| simulate_parking | p_device, p_occupied | parking.simulate + server-side demo tenant |
| ingest_parking | device/event UUID, monotonic sequence, occupied, observed | service_role only; bridge binds device from verified HMAC |

Optional bridge: GET /healthz (process only), GET /readyz (configuration + active device/database), POST /v1/iot/events (JSON ≤4096 bytes). JSON body `{eventId,deviceId,sequence,occupied,observedAt}`. `x-timestamp` is Unix milliseconds, `x-signature` is lowercase hex HMAC-SHA256(secret, `${timestamp}.${exactRawBody}`). Timestamp drift ≤60 sec; observation drift -120/+30 sec; event UUID and sequence persistently reject replay. Device ID must match server provisioning. 120 attempts/minute per single bridge; DB uniqueness survives restarts, in-memory throttle does not.

Bridge responses include stable code and random correlationId. PostgREST uses its standard error envelope; no SQL stack traces are added. No CORS is enabled on the bridge (server/device access only). TLS terminates at Render; production bridge requires forwarded HTTPS. Raw bodies/signatures/secrets are never logged.

The bridge now uses native Node HTTPS with 5s readiness/8s ingestion timeouts. Dependency transport/authentication/rate-limit failures return retryable 503; valid requests rejected by database invariants return 409. Ingress content type must be application/json, body is bounded before persistence, and the strict shared contract rejects unsafe integers/invalid dates/unknown fields. Server secret must have at least 32 characters to become configured. Render's trusted HTTPS proxy is the production transport boundary; it must not be exposed as an untrusted direct HTTP origin.

Modern opaque Supabase publishable/secret keys are sent in the apikey header; they are not user Bearer JWTs. The shared header helper preserves a separate authenticated user's JWT and supports legacy anon/service-role JWT keys. Hosted migrations and pgTAP now connect through pg with certificate verification and a session connection, without local Docker; see SETUP_HOSTED.md.

`deployment_health()` is service_role-only and inspects RLS flags, client write grants, selected foreign keys and retention scheduling. It is a deployment diagnostic, not a security certificate. `npm run test:services` invokes it after real Auth/account workflows; this test is currently blocked, not green.

The Audit navigation item is shown only with audit.read. It reads site-filtered audit_events under the existing RLS policy and displays action/time/record/actor metadata, without invitation tokens, names or GPS. Driver UI actions also require fleet.drive and vehicle ownership; their SQL guards remain authoritative.

Local compiled-UI contract tests verify the SDK request names/arguments and server-acknowledged UI transitions for all three modules. They intercept explicitly fictional Supabase responses in test code only and do not prove the deployed endpoint is reachable or authorized. Native adapter tests exercise actual localhost HTTP and reject credential-bearing redirects. Hosted integration rejection assertions require exact expected SQLSTATE/status, rather than counting any HTTP error as success.

## Visitor records contracts (migration 006; hosted verification pending)

`search_visitor_records` accepts a half-open UTC registration interval `[p_from, p_until)` spanning at most 31 days; both timestamps must be finite. `p_status` is `all` (default), `pending_entry`, `onsite` or `departed`. `p_query` defaults to empty and is at most 80 characters: a case-insensitive **literal** substring of guest name or reference, with no wildcard/query-language interpolation. `p_limit` defaults to 25 and is 1–100; `p_offset` defaults to 0 and is 0–10,000. Results sort by registration timestamp then UUID descending. Response: `{records, has_more, offset}`. Narrow filters if the offset limit is reached; concurrent new registrations can shift offset pages.

Every record exposes only `id`, `masked_name`, `status`, `created_at`, `entered_at`, `exited_at`. Names are first character plus `***`; previously anonymized names retain their anonymization marker. No owner IDs, invitation tokens, raw guest names or phone data are exported. Existing authorized guard/owner queue access is unchanged.

`export_visitor_records` uses the same filters and requires `p_reason` to be `operations_review`, `incident_review` or `privacy_request`. It returns `{records, count, generated_at}` only after recording `visitors.exported` in the same database transaction. More than 1,000 matches fails with `22023` instead of silently truncating. A membership row lock serializes the 10/hour export quota. Each completed request is separately audited; repeat requests are new exports. Audit metadata contains purpose/date window/status/count, never search text or names. `visitors.searched` records minimal read metadata. Failed transactions produce no successful export audit.

Missing/foreign/inactive membership or missing grants returns `42501 / Forbidden`; invalid filters or purpose returns `22023`; export quota returns `P0001 / Export rate limit`. Anonymous roles cannot execute either RPC, and API roles cannot execute the private query helper. Existing memberships are not upgraded by migration. Newly seeded fictional managers/admins have `exports.visits`; guards and operators do not.

The browser converts inclusive Malaysia calendar dates to UTC, displays paginated masked results, and serializes the authorized export to a quoted UTF-8 CSV with UTC timestamp headers. CSV formula/control prefixes are neutralized and fields are explicitly allowlisted. No file is created on service failure; leaving the component/site/session aborts an outstanding request and suppresses late downloads. A server transaction may already have committed before cancellation, so its audit may exist even when no browser download occurs. Downloads remain outside server retention; this is a masked operational report, not a complete data-subject-access response.

## Controlled visitor forms (migration 007; hosted verification pending)

The form builder offers residential, office, contractor and event templates, plus a custom selection of the approved catalog. Every field configuration has exactly `{key, required}`; arbitrary labels, options, fields or additional properties are rejected. Available keys are `purpose` (allowlisted select), `party_size` (integer 1–20), `arrival_date` (valid calendar date in 2000–2099), `company` (text up to 80 characters), and `safety_ack` (boolean, true when required). At most five distinct fields are accepted. Guest name and notice acknowledgement remain required outside the catalog. Unreviewed phone, vehicle plate, identity-document and arbitrary custom fields are blocked.

Publishing uses a site row lock, the expected current version and a client-generated request UUID. Repeating an identical request returns the same version; changed payload with the same request is rejected. A stale expected version returns `22023 / Form changed; reload before publishing`. Changing fields always adds an immutable version. New invitations capture the active version under a site lock. Existing invitations cannot be repointed, and historical version rows cannot be updated/deleted. No applied migration is edited or existing membership upgraded; fresh fictional manager/admin seed grants include visits.forms.manage.

Public resolution accepts only a correctly formatted, unexpired and unused invitation token. It returns `{site_name, expires_at, form, notice_version, demo}`; `form` is null for name-only invitations, otherwise `{id, version, title, template, fields, created_at}`. Invalid/expired/used tokens share the same unavailable error. Resolution does not reveal owner IDs, raw tokens or other visitor records. Unknown notices/schemas fail closed in the guest UI. Distributed anonymous request throttling still requires release hardening.

Submission accepts typed answers with exactly the configured keys. Required fields must be present; nulls, coercible strings, extra fields, invalid dates, unlisted options and out-of-range/fractional numbers are rejected server-side. Optional unanswered fields may be omitted; required acknowledgements must be true. Answer JSON is bounded to 2 KiB. Invalid submissions do not consume the token. Token consumption, visit, version-bound answers, notice timestamp and audit commit atomically. The old name-only RPC delegates to this path and therefore cannot skip required fields.

Raw answers reside in a separate RLS-enabled table with no client table grants. Only the audited `get_visit_form_response` RPC returns `{form, answers, acknowledged_at, anonymized_at}` to the owner or authorized site reader. Database constraints/triggers tie responses to the original invitation and form. Thirty-day retention clears answers and records anonymization while retaining the immutable schema. CSV reports deliberately exclude these additional answers. Form publishing and answer reads are audited without copying answer values.

Unavailable: SMS OTP, MQTT broker, automatic dispatch optimizer, guard-assisted/public-location QR registration, arbitrary/sensitive field design, account invitation/admin UI, complete privacy-request handling, full REST OpenAPI mapping. No UI controls pretend these are available.
