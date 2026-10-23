# Hosted Supabase setup — no local Docker

## Current setup order — 22/23 October 2026

Newer GitHub commits document a **separate SmartTownship development project** with 16 applied migrations and database health checks. Obtain access to that existing project; leave AppointHub's database and ports alone. Use **http://127.0.0.1:5174** for Auth Site URL and allowed redirect; keep Email/password enabled and disable public signups. The trusted seed creates confirmed fictional accounts. Keep the Data API's public schema enabled; do not expose private.

Collect the project URL, publishable API key, secret API key and **Session pooler PostgreSQL URI on port 5432** from the project's Connect/API Keys screens. The variable SUPABASE_SERVICE_ROLE_KEY accepts the current sb_secret_ key. Never put it in a VITE variable. Copy the exact pooler host/username and URL-encode special characters in the database password. These settings were checked against [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [API keys](https://supabase.com/docs/guides/getting-started/api-keys) and [Auth settings](https://supabase.com/docs/guides/auth/general-configuration).

Use the secure prompts in section 4 below, **also set `$env:DEMO_MODE = 'true'`**, then run each command separately, stopping on failure:

```powershell
Set-Location 'C:\Users\bavit\Documents\amin'
npm.cmd run db:migrate
npm.cmd run demo:configure
npm.cmd run test:integration
npm.cmd run db:seed:demo
npm.cmd run test:services
npm.cmd run test:e2e
```

The newer GitHub commits report **all 16 migrations applied** to development. The **300 authored SQL assertions** still await hosted execution. The migration command should recognize previously applied files; stop and reconcile ledger/hash differences if it does not. Seed once: repeated seeding adds new fictional tenants/accounts rather than resetting data. The database simulation flag must be enabled through demo:configure; an environment variable alone does not update it. Leave browser tests sole use of 5174 while they run.

After these pass, start the app from the same configured terminal:

```powershell
$env:VITE_SUPABASE_URL = $env:SUPABASE_URL
$env:VITE_SUPABASE_PUBLISHABLE_KEY = $env:SUPABASE_PUBLISHABLE_KEY
$demoAccounts = Get-Content -LiteralPath '.local/demo-fixture.json' -Raw | ConvertFrom-Json
$demoAccounts.tenants[0].accounts | Format-List
npm.cmd run dev
```

Open **http://127.0.0.1:5174** and use the generated account email plus the DEMO_PASSWORD you entered (at least 16 characters). Start with admin, resident, guard, driver, dispatcher or parking for the matching workflow. The first operator has explicit platform metadata permission. Do not share keys/passwords in chat. Keep **5173 and 5000** for AppointHub. Existing agent processes do not inherit secrets set in another terminal; run hosted commands in the terminal where you entered them.

Current local verification: **84 unit, 36 native runtime, 53 browser contract and 3 setup tests pass**, with lint/typecheck/build and HTTP smoke. The aggregate verification still exits 1 because SQL tests, real service and live audit gates are blocked in this workspace. Browser contract fixtures are not hosted proof. See CURRENT_SCOPE.md for functionality still pending and TEST_EVIDENCE.md for evidence. Older numerical checkpoints in this guide are superseded by this section.

Status on 2026-10-20: dependencies/lockfile, frontend/backend builds, TypeScript, lint, 63 Vitest tests, 28 native tests and 25 Edge UI contract tests pass locally; earlier 3 Edge setup tests also passed. Browser tests use port 5174 and synthetic responses; hosted database/account/Realtime workflows remain unverified. No cloud project or deployment was created. Use a dedicated development/demo project with fictional data only.

## Optional fictional pitch story after hosted acceptance

Once migrations, SQL tests, the one-time base seed, real service tests and hosted browser tests have passed, run `npm.cmd run demo:pitch` in the same configured terminal. Keep APP_ENV=test, DEMO_SEED_ACK=fictional-data-only and DEMO_MODE=true; demo:configure must also have enabled the database simulation setting. The script checks the project and demo tenant and adds three visitor states, a completed and a pending ride, a timetable and four simulated bays through real RPCs.

This new scenario has **not been executed against Supabase yet**. Its environment/target guards have local test coverage. It refuses active assigned/boarded trips or an active demo driver shift and stores an exclusive per-site receipt under .local. Do not rerun the base seed or remove the receipt blindly; a failed sequence can leave partial fictional records. Review completed steps and resolve open demo work first. Refresh simulated parking observations before the pitch; they expire after 120 seconds.

See [REDESIGN_AND_PITCH_REPORT.md](REDESIGN_AND_PITCH_REPORT.md) for the complete data inventory, preparation sequence, feature matrix and seven-minute demonstration.

## 1. Install dependencies in normal Windows PowerShell

Dependencies and package-lock.json are now installed and verified in the shared workspace. For a clean checkout, use the lockfile in normal Windows PowerShell:

```powershell
Set-Location 'C:\Users\bavit\Documents\amin'
npm.cmd ci
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:runtime
npm.cmd run build
npm.cmd run smoke:api
```

The lockfile dependency declarations match package.json. Keep it for reproducible CI/deployments. A fresh live dependency audit is still required: the sandbox advisory request failed, and an offline zero-findings response is not accepted as a security pass. Run `npm.cmd audit --audit-level=high` in normal PowerShell and share only redacted findings.

Playwright can use the already installed Edge browser:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd run test:e2e:setup
```

This passes three browser setup/layout tests at 360, 768 and 1440 pixels without Supabase credentials. `npm.cmd run test:e2e:contract` additionally passes 53 UI contract tests with explicit synthetic HTTP responses; those do not prove hosted Auth/RLS or tenant isolation. Both modes use strict port 5174, compile the production frontend into isolated `.local/browser-dist` paths and leave `apps/web/dist` unchanged. For bundled Chromium instead: `npx.cmd playwright install chromium`, then remove PLAYWRIGHT_CHANNEL from the process environment.

## 2. Access/configure the dedicated development Supabase project

Use the existing dedicated SmartTownship development project documented in GitHub; do not create a second project or change its password merely to follow this guide. Confirm its region, active status and connection details with the project owner. Configure Auth site URL `http://127.0.0.1:5174` and the intended Pages HTTPS origin when known. Port 5173 is reserved for the user's other application. Disable public email signups: fictional accounts are provisioned by the trusted seed. No SMS provider, external map key or hardware is needed.

Record these values securely:

| Setting | Where it is used | Sensitivity |
|---|---|---|
| Project URL | Browser, scripts, optional Render | Public project identifier |
| Publishable key (`sb_publishable_...`) or legacy anon JWT | Browser, Auth/guest API tests | Designed to be public; RLS still mandatory |
| Secret key (`sb_secret_...`) or legacy service_role JWT | Trusted seed/tests and optional Render only | Bypasses RLS; never in VITE variables, Pages, chat or source control |
| PostgreSQL **session pooler** connection URI, including DB password | Local migration/SQL-test process only | Secret; not the HTTP project URL or an API key |
| Database SSL certificate, if system trust is insufficient | Optional local test/migration CA file | Download official certificate; keep certificate verification enabled |
| Demo password, at least 16 characters | Newly generated fictional accounts | Secret; never printed or saved by seed |

Use the project Connect panel's **session pooler** on port 5432, which supports IPv4. The direct database endpoint also works if the client has IPv6 connectivity. Do not use the transaction pooler on port 6543 for migration locks/session-based SQL tests. URL-encode special characters in the DB password when substituting it into the connection URI. See [Supabase connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres) and [API key types](https://supabase.com/docs/guides/getting-started/api-keys).

## 3. Configure the browser — public values only

```powershell
if (-not (Test-Path 'apps/web/.env.local')) {
    Copy-Item -LiteralPath '.env.example' -Destination 'apps/web/.env.local'
}
notepad 'apps/web/.env.local'
```

Set only these two values there:

```dotenv
VITE_SUPABASE_URL=<project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<public publishable or anon key>
```

This file is ignored. Do not put a service/secret key, database connection string or password into it. Restart Vite after changing build environment values.

## 4. Configure trusted process variables securely

In normal Windows PowerShell, these prompts avoid recording actual secrets as command literals in terminal history:

```powershell
function Set-SessionSecret([string]$Name) {
    $secretValue = Read-Host $Name -AsSecureString
    $plainValue = [System.Net.NetworkCredential]::new('', $secretValue).Password
    [Environment]::SetEnvironmentVariable($Name, $plainValue, 'Process')
}
$env:APP_ENV = 'test'
$env:DEMO_MODE = 'true'
$env:DEMO_SEED_ACK = 'fictional-data-only'
$env:SUPABASE_URL = Read-Host 'Supabase project URL'
$env:SUPABASE_PUBLISHABLE_KEY = Read-Host 'Supabase public publishable/anon key'
Set-SessionSecret 'SUPABASE_SERVICE_ROLE_KEY'
Set-SessionSecret 'SUPABASE_DB_URL'
Set-SessionSecret 'DEMO_PASSWORD'
$env:PLAYWRIGHT_CHANNEL = 'msedge'
```

The SERVICE_ROLE variable accepts the modern secret API key as well as a legacy service-role JWT. Modern opaque keys are sent only in `apikey`; user access JWTs use `Authorization: Bearer`. The bridge/helper header behavior has native unit coverage, not a live hosted integration pass.

If certificate validation fails, download the project's official certificate and set SUPABASE_DB_CA_FILE to its `.crt`, `.cer` or `.pem` path. Alternatively configure the certificate text in SUPABASE_DB_CA_PEM (useful for CI). Never set rejectUnauthorized=false or NODE_TLS_REJECT_UNAUTHORIZED=0. The driver explicitly preserves certificate verification; [node-postgres documents how connection-string SSL parameters can otherwise override SSL configuration](https://node-postgres.com/features/ssl).

These variables exist only in that terminal and its children. An already running agent process will not inherit them automatically. If sandbox outbound access remains blocked, run the hosted commands in this normal terminal and share only redacted results, not keys/passwords/connection strings.

## 5. Apply and test all migrations without Docker

```powershell
npm.cmd run db:migrate
npm.cmd run demo:configure
npm.cmd run test:integration
npm.cmd run db:seed:demo
npm.cmd run test:services
npm.cmd run test:e2e
```

`db:migrate` uses pg over verified TLS, an advisory lock, an RLS-protected private migration ledger and hashes. It recognizes the 16 migrations reported as already applied, rejects edited applied migrations and performs no reset/drop. It is intended for this dedicated development project. If migrations were already installed manually/by CLI, do not blindly reapply or fabricate ledger entries; reconcile migration history first. Migration 006 adds masked search/export and audit metadata; 007 adds immutable form versions and retained answer storage. Neither changes existing membership grants.

`test:integration` connects to hosted PostgreSQL directly, executes the 300 authored pgTAP assertions and rejects failing, skipped or mismatched plans. Each test's fictional fixture transaction rolls back. A dedicated development DB admin connection is required because role/tenant isolation tests create fixtures and SET ROLE. None of these assertions has run in this workspace yet.

`db:seed:demo` is additive: creates two fictional tenants, separate accounts and minimal assets. It saves only fictional IDs/emails to ignored `.local/demo-fixture.json`, no passwords/keys/tokens. Repeat seed runs create additional data; no destructive reset exists.

Fresh fictional manager/admin memberships include `exports.visits`, `visits.forms.manage` and `visits.read.site`; guards/operators have no export or form-management grant. Existing fixtures do not gain permissions from migration. Create a new additive seed for this test suite, or explicitly provision only intended development memberships using the trusted administrator workflow. Service/browser tests require these grants and must fail if they are missing.

`test:services` uses actual Auth/account sessions, PostgreSQL RPCs and signed bridge ingestion. `test:e2e` uses separate browser contexts for the real hosted demo accounts and exercises visitor registration/check-in/out, dispatch, GPS simulation, parking, forbidden roles and mobile overflow. Screenshots are restricted to setup/overview, and traces/videos are disabled to avoid recording invitation links/tokens. These checks have not run successfully in this environment.

Migration 1 enables Realtime publication for visits/rides/vehicles/zones; migration 2 schedules hourly retention. Verify publication and `cron.job`/`cron.job_run_details` on the project after applying. Native/source checks do not establish that scheduling or Realtime works. Confirm real browser updates, denied GPS and disconnection/reconnection behavior before presenting the demo as verified.

## 6. Cloudflare Pages configuration

| Field | Value |
|---|---|
| Root | Repository root |
| Build | `npm ci && npm run build:web` after a reviewed lockfile exists |
| Output | `apps/web/dist` |
| Node | 22.18+ compatible LTS; current pinned target needs its own execution check |
| Build variables | VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY only |
| Backend dependency | None for core services |

The lockfile is present and CI uses npm ci. Cloudflare serves the static `_headers` and `/health.json`; that health file proves assets only. Confirm Supabase login/data separately. Configure Auth site URL and exact HTTPS redirect allowlist for the approved Pages domain. Preview-domain access should be explicitly allowed only when intended. Do not place service keys or DB secrets in Pages variables. Hosted `*.supabase.co` endpoints are allowed by CSP; review changes for custom domains. Local browser preview does not establish that deployed Cloudflare headers/TLS are correct.

## 7. Optional Render configuration

Review `render.yaml`: Free Node service, build `node scripts/build-api.mjs`, start `node dist/apps/api/server.mjs`, health `/healthz`. Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server secret), DEVICE_ID from the seeded fixture, and a newly generated high-entropy DEVICE_HMAC_SECRET of at least 32 characters. NODE_ENV=production requires the Render HTTPS proxy. No database password or public browser key is needed on Render.

Check `/readyz` separately: it verifies active device/database access. A sleeping bridge affects external device ingestion only. The main application and local database-backed simulators connect directly to Supabase. Test with the Render service stopped; stale parking becomes unknown. Do not claim free-tier production reliability. Real device secrets/connections require a reviewed provider integration. No deployment has been approved or performed by these instructions.

## 8. Final verification and cleanup

Run `npm.cmd run verify:local` for a nonzero-on-failure report. Real hosted browser tests run separately via test:e2e. Keep actual test evidence; do not interpret missing configuration as a pass. Run dependency audit once the lockfile exists. Close the trusted terminal or remove its secret environment variables after verification. Never paste service/DB credentials into chat.
