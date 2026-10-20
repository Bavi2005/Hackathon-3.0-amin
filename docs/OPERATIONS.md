# Operations

Prototype targets, not measured guarantees: critical RPC p95 <500 ms at 10 concurrent demo users; Realtime propagation <3 s; reconnect refetch within 15 s; no availability from data older than 120 s. Load/restore drills have not run. Free tiers do not provide the reliability expected of guardhouse/transport operations.

Before the demo: verify Supabase is active, Cron job last success, Auth login, tenant denial tests, Realtime enablement and quota usage. Check Cloudflare `/health.json` (static assets only), then sign in and query site data (database health). Optional Render `/healthz` is liveness only; `/readyz` verifies device and database reachability. Never infer database health from static health.json.

During outages: show query error, retry/refresh; do not queue optimistic successes. Old parking data expires locally; no interpolation. Core workflows do not call Render. Real provider must buffer/retry signed observations with new current timestamps and durable monotonic sequence; no bridge-local disk persistence. Do not add artificial keepalive traffic to bypass provider free-tier policy.

Monitor database size, egress, Realtime connections, storage, Auth rate limits and Cron `job_run_details`. Detailed GPS default rate ≥5 s can exhaust free quotas: run brief demo sessions and stop sharing at shift end. Hourly retention bounds duration, not total event rate. Review projected volume before extending to real fleet.

Recovery: retain versioned migrations and approved encrypted database backups outside this repo; test restore into an isolated project and rerun policy tests before opening access. Do not reset an existing database. Migration rollback: prefer forward corrective additive migrations; take backup and review dependencies first. No destructive rollback scripts supplied. Restore drill, incident alerting and backup automation are release blockers.
