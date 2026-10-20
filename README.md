# SmartTownship

Visitor registration, transport operations and parking share Supabase identity and tenant/site authorization. **Prototype: hosted verification and release gates remain open.** The user confirmed on 2026-10-20 that a development Supabase project is not configured yet.

Start with the Windows [setup guide](docs/SETUP_HOSTED.md). SmartTownship uses **http://127.0.0.1:5174**, strict port. Leave **5173 and 5000** for AppointHub. Core workflows need hosted Supabase; the optional device bridge uses 3001 and is not required for the demo.

## Local checks

Dependencies and lockfile are present. Use npm ci for a clean checkout. Node 22.18+ is the target; this workspace's checks used Node 25.5.0, so target-runtime qualification remains pending.

```sh
npm run verify:local -- --audit-unavailable
npm run simulate:dispatch
```

The verification command runs build, actual local HTTP smoke, TypeScript, lint, unit/runtime and production-browser checks serially. It then attempts hosted checks and records a nonzero result for missing configuration. The audit flag explicitly marks the previously unavailable advisory endpoint as blocked; it never means a security pass. Run npm audit --audit-level=high in normal PowerShell when available.

Current evidence and any failures: [TEST_EVIDENCE.md](docs/TEST_EVIDENCE.md). Unit/runtime and synthetic browser responses do not prove database enforcement. Vitest uses at most two workers to avoid excessive local resource use.

## Hosted development command order

After setting the variables in the setup guide, including APP_ENV=test, DEMO_SEED_ACK=fictional-data-only and DEMO_MODE=true:

```sh
npm run db:migrate
npm run demo:configure
npm run test:integration
npm run db:seed:demo
npm run test:services
npm run test:e2e
npm run dev
```

Run each command only after the previous one succeeds. There are **16 migration files and 300 authored pgTAP assertions**, none executed here. Migration ledger hashes prevent silently editing applied history. Seed is additive and creates fictional accounts; repeated seeds create more tenants, so do not rerun it casually. No reset is supplied. Browser tests own 5174; stop your SmartTownship dev server before running them.

## Source scope

Private invitations and displayed site QR flows, pinned visitor form versions, optional OTP simulation, guard assistance/entry/exit, search and masked export, staff/asset/site/tenant administration, authenticator MFA, privacy review/holds/minimization, parking hierarchy/bays/counters/manual expiry, signed HTTPS IoT ingestion, route timetables, capacity-safe assignment/reassignment, shift-bound GPS, aggregate reporting and a deterministic dispatch experiment now have source. [Current scope](docs/CURRENT_SCOPE.md) distinguishes those paths from unfinished work and external gates.

No real SMS, vehicles, sensor hardware, routing provider or MQTT broker is connected. Simulation must be enabled in the private development database setting and remains labelled. The dispatch experiment reports executed fictional outcomes, not real travel improvements. No deployment, purchase or real personal-data collection occurred.

Architecture: static React/Vite on the planned Pages host, Supabase Auth/PostgreSQL/RPC/RLS/Realtime, optional native Node signed-device bridge. Preserve this repository's architecture rather than converting to the preferred stack in codex.md. See [architecture](docs/ARCHITECTURE.md), [API](docs/API.md), [security](docs/SECURITY.md), [privacy](docs/PRIVACY.md), [operations](docs/OPERATIONS.md), [demo](docs/DEMO_SCRIPT.md), [plan](docs/IMPLEMENTATION_PLAN.md) and [release checklist](docs/PRODUCTION_CHECKLIST.md).
