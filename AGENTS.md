# Agent instructions — SmartTownship

Read `codex.md` at the repository root **in full** before planning or changing code. It is the canonical product, architecture, security, access-control, feature and acceptance-test specification for this repository.

Start by inspecting the repository and protecting existing functionality. Then execute the ordered implementation phases in `codex.md` in functional vertical slices. Maintain `docs/IMPLEMENTATION_PLAN.md`, `docs/PROGRESS.md`, and `docs/TEST_EVIDENCE.md` with truthful evidence, and apply its release gates.

Do not skip server-side tenant/site authorization, use invented real-world transport/parking availability, accept unauthenticated IoT state changes, use fake success UI, commit credentials, destroy existing data, or call a prototype production-ready. Treat external SMS/IoT and actual vehicle connections as provider integrations needing proper credentials/approval; use clearly labelled simulators locally.

Report at each checkpoint: what works, files changed, tests actually run, blockers and next steps. Execute ordinary coding decisions autonomously; request approval for destructive operations, deployment, purchases and real personal-data collection.
