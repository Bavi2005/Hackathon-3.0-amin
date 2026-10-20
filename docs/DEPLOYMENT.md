# Deployment entry point

Use [SETUP_HOSTED.md](SETUP_HOSTED.md) as the canonical setup guide. The user selected hosted Supabase; the default path does not require local Docker. It contains exact normal Windows PowerShell installation commands, the credential/location matrix, secure process prompts, verified-TLS migrations and pgTAP, separate-account/service/browser checks, and Cloudflare Pages/optional Render settings.

No deployment or provider project was created here. Current verification is recorded in [TEST_EVIDENCE.md](TEST_EVIDENCE.md); passing native bridge tests do not establish hosted database or browser operation.

Cloudflare Pages uses the static `apps/web/dist` output and public Supabase URL/publishable key only. Render uses `render.yaml` and server-only secret/device settings, with no dependency of core application flows on the optional service. The generated backend builds without npm runtime packages.

The lockfile is present; clean installation and deployment use npm ci. Target-runtime and live dependency qualification remain pending. Provider quotas/pricing/pausing should be reviewed before a demo: [Supabase](https://supabase.com/pricing), [Supabase pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Render Free](https://render.com/docs/free), [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/). Zero hosting cost is a hackathon configuration goal; free-tier production reliability/security is not claimed.
