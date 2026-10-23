# Production release blocked — prototype

- [ ] All core multi-role flows verified on real Supabase and deployed browser, including Render-down operation.
- [ ] Full two-tenant/two-site policy matrix and concurrency races verified.
- [ ] Privileged MFA, session revocation, invitations and step-up reviewed.
- [ ] QR abuse limits, replay/expiry and privacy consent reviewed.
- [ ] IoT HMAC, key rotation, drift, replay, revocation and load verified with real provider.
- [ ] Real GPS consent, disclosure scope, background behavior and retention approved.
- [ ] Cron retention verified including backup copies and legal holds.
- [ ] Privacy/legal notices and pilot stakeholder approval received.
- [ ] Lint/typecheck/unit/integration/E2E/build/dependency and security review pass in CI.
- [ ] Performance, disconnection, provider failure and restore drills documented.
- [ ] Backups, alerting, incident response and secrets rotation tested.
- [ ] Domain/TLS, CSP/CORS, rate limits and Storage policies externally reviewed.
- [ ] Provider quota/cost/reliability and external map/SMS/device approvals confirmed.

Free-tier deployment is a hackathon prototype. No production reliability or security certification is claimed.

## Local gates verified on 2026-10-22 (not hosted release approval)

- [x] Declared dependency installation and lockfile consistency checked.
- [x] Frontend/backend production builds, TypeScript and lint pass locally.
- [x] 84 Vitest and 36 native HTTP/security/configuration tests pass.
- [x] 53 synthetic-response Edge UI contract tests and 3 setup/responsive tests pass on 5174.
- [ ] Versioned form publishing, answer validation and retention verified on hosted PostgreSQL (53 new SQL assertions authored, unexecuted).
- [ ] Visitor records migration/audit/export/authorization verified on hosted PostgreSQL (36 new SQL assertions authored, unexecuted).
- [ ] Live advisory scan: sandbox endpoint denied; offline result is insufficient.
- [ ] Real hosted database/role/browser/Realtime tests: configuration pending.
- [ ] Hosted provider deployment and pinned runtime execution: not performed.
