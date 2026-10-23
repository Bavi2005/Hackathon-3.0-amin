# Render frontend deployment (SmartTownship demo)

Last reviewed: 2026-10-20. The Supabase dev project `Hackathon-3.0-amin` is active in Singapore, and all sixteen repository migrations are applied. This is a development/demo environment using fictional data only. Live account, RLS, Realtime, browser and deploy qualification is still pending.

## Static website (not the IoT bridge)

The main React frontend is a Vite-generated static site. Use **`render-static.yaml`** from the repository root when importing a Blueprint into Render. **Do not select `render.yaml`**, which configures only the optional device bridge and requires server-only secrets.

The static Blueprint:

- Builds from `main` with `npm ci && npm run build:web`.
- Publishes `apps/web/dist` on Render's HTTPS CDN.
- Rewrites `/*` to `/index.html` for client routes.
- Mirrors browser security headers defined in `apps/web/public/_headers` (Cloudflare format, not read directly by Render).
- Uses the **public** Supabase project URL and `sb_publishable_...` key. Those are safe in the Vite/browser build; **never** add `SUPABASE_SERVICE_ROLE_KEY`, `sb_secret_`, database passwords/URIs or `DEMO_PASSWORD` to static Render configuration.
- Does not deploy, require, or modify the optional IoT service.

## Complete the hosted demo

1. In Render, create a Blueprint from `https://github.com/Bavi2005/Hackathon-3.0-amin`, specifying Blueprint file path `render-static.yaml`, or create an equivalent Static Site. Verify the build succeeded and record its `https://...onrender.com` URL.
2. In Supabase Authentication > URL Configuration, change the Site URL to that final HTTPS URL and allow its exact callback/redirect origin, while retaining the local `http://127.0.0.1:5174/**` redirect if needed. Keep password sign-in enabled; disable open public signup for the fictional-demo seed.
3. Run the repository's `docs/SETUP_HOSTED.md` hosted verification/seed commands from a trusted local environment. The database has **already** been migrated; `db:migrate` should report every file as previously applied because `private.schema_migrations` has their exact source-content hashes. Run one successful integration test first, then `db:seed:demo` **once**; do not re-seed on repeated deploys. Demo users cannot sign in until provisioned via trusted Auth Admin API.
4. Verify the landing page, password login, role isolation, visitor QR flows, parking simulations, transport, HTTPS headers, frontend deep links and live Realtime. No success is claimed until these checks actually pass.

## Current gates

- Database health RPC reports 20 public tables, zero unprotected/client-mutable tables, proper site foreign keys, and a scheduled retention job. Simulation mode is explicitly enabled for this development database.
- Supabase security advisor reports intentional anonymous privileged visitor endpoints plus private/unexposed tables with no RLS policies. Review public token abuse protection and API authorization before real users.
- SQL pgTAP assertions, Auth demo seeding, real service/hosted browser tests, Render build, live link and final Auth site URL are **not yet confirmed**.
- This is a hackathon prototype, not a production/privacy/security sign-off.

Existing `render.yaml` remains dedicated to optional Render IoT ingestion, not the main frontend.
