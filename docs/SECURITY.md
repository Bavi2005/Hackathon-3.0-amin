# Threat model and access matrix

Prototype pending independent security review. Trust boundaries: untrusted browser/device → Supabase JWT/RLS or HMAC bridge → transactional database. Assets: guest name, movement history, membership privileges, device secret and service-role key.

| Actor | Site scope | Rights |
|---|---|---|
| Anonymous | None | Redeem exact unexpired one-use token only |
| Resident | Explicit membership | Own rides/invitations/visits; site parking; assigned ride vehicle |
| Guard | Explicit membership | Site visitor queue and entry/exit via capability |
| Parking staff | Explicit membership | Device metadata and demo simulation only with grants |
| Dispatcher | Explicit membership | Site rides/vehicles; capacity-safe assignment |
| Driver | Explicit membership + vehicle assignment | Own vehicle, own assigned rides, active-shift GPS |
| Manager/admin | Explicit membership | Only capabilities installed in membership; no implicit role bypass |
| Platform operator | Explicit membership | Audit only in seed, no default visitor PII access |
| Bridge | Single configured device | Service-role invocation, exact device signature binding |

Tenant swapping/IDOR: RLS denies unauthorized selects, RPCs check database membership and site, composite foreign keys deny foreign links. Role/capability mutations have no client grants. RLS policies and definer helpers have pinned search_path. Public function execution privileges are explicitly revoked before selective grants.

QR abuse: 256-bit random tokens, SHA256 hashes at rest, single-use row lock, 24-hour expiry, issuance quota. Tokens use URL fragment so they are not sent as URL/query logs/referrers. React escapes names. No rich HTML. CSP disallows third-party scripts and frames. No real PII collection authorized. Cookie CSRF does not apply to the bearer-token RPCs; XSS token theft remains a risk requiring review.

IoT forgery/replay: HMAC of raw payload + timestamp; constant-time comparison; exact device binding; SQL active device/sequence/UUID/drift/capacity checks under locks. GPS spoofing cannot be prevented by browser consent alone; data quality labels and device attestation remain future work. MQTT is disabled, no unauthenticated broker is provisioned.

Limitations requiring release review: Supabase session persistence uses SDK browser storage; privileged MFA enrollment/step-up, distributed abuse limits for public QR, staff provisioning UI, comprehensive policy matrix tests, browser pen test, revocation timing, database/Storage audit, key rotation and retention legal holds. Service-role credential is powerful: keep only in trusted local seed process/Render secret store, never Pages variables. Rotate device secret and service key if compromised; suspend device in database; revoke sessions and membership for account incidents.

## Visitor search/export boundary

Migration 006 adds scoped search requiring `visits.read.site` and export requiring both that grant and `exports.visits`. Role names alone never authorize export. Read filters are date/length/page bounded; literal substring matching avoids user-supplied SQL or pattern evaluation. Exports fail above 1,000 rows and serialize the 10/hour quota on the membership row. An audit record with purpose/window/status/count commits with the export response; no raw name or search query is audited. Audit metadata has the same RLS and client write denial as existing audit records. Names are masked, and CSV output uses an explicit field allowlist, quoting, and formula-prefix neutralization.

The frontend cancels pending records requests on unmount/site/account changes and does not download late responses. This is a UX/privacy safeguard, not a substitute for SQL authorization. Export logs attest that the server authorized/released a result, not that a person saved or opened the file. Downloaded copies need operational retention controls. Search still permits authorized staff to find names; masked exports are not anonymized datasets. Existing authorized queues retain their minimum identification fields. Hosted scope/rate/audit/negative tests are authored but remain unexecuted without development configuration.

## Versioned form boundary

Migration 007 adds RLS-protected version/response tables with no client table grants. Management RPCs require visits.forms.manage at the exact site; published versions and invitation version bindings are immutable. Expected-version and request-ID checks protect stale edits and retry duplication. The approved field catalog fixes labels/types/options; API callers cannot request national IDs, phone numbers, plates or arbitrary fields by editing JSON. Submission validates all types, keys and bounds against the invitation's captured schema, and the legacy endpoint delegates to that validation. Reads of answers require current site membership plus ownership or visits.read.site and are audited. Composite foreign keys and response triggers prevent cross-site/version mismatches. Retention clears answers after 30 days without rewriting historical schema.

The new public form resolver exposes only token-bound metadata and has uniform unavailable errors. Token secrecy and single-use redemption are enforced; distributed abuse throttling, real privacy review, OTP and live deployment remain release gaps. Do not treat local UI fixtures or authored SQL tests as proof that hosted enforcement passed.
