# Demo script — fictional services only

Prerequisite: complete SETUP_HOSTED.md and all hosted tests. Local UI contract fixtures are not an acceptable live demo backend. Every name, account, journey and sensor below is fictional. No actual township/operator affiliation is claimed.

1. Admin publishes a controlled visitor form. Resident creates a private invitation; guest opens QR, acknowledges the demo notice, optionally requests/verifies a labelled simulator code and submits. Refresh shows a minimal private confirmation; resubmission fails. Guard checks in/out. For weak signal or no smartphone, guard uses assisted registration with reason and policy acknowledgement; entry remains separate.
2. Admin issues a displayed site QR. Two visitors start distinct private flows. Revoke the site QR; new flow creation must fail. Existing private flows retain their documented short expiry. Unrelated tenant users cannot query the visits.
3. Driver starts a shift. Residents request configured stop-to-stop rides; dispatcher checks capacity-only recommendations (ETA unavailable), assigns and, before boarding, can reassign with a reason. Driver sends labelled simulated GPS, boards/completes, then ends shift. Stale GPS becomes unavailable.
4. Parking staff sends a simulated counter observation or configures a facility/level/bay and suspended device, activates it, then sends a bay event. Display only supported granularity and SIMULATED labels. Wait over 120 seconds: stale free data becomes Unknown. A manual verified count has a reason and expiry; it does not identify an individual bay.
5. Manager reviews actual bounded aggregate reports, masked visitor records and audit metadata. Privacy requests require independent approval; an active hold blocks erasure. Name/answer minimization preserves operational references and is not a legal-compliance claim.
6. Stop the optional device bridge and repeat core Supabase workflows. Demonstrate a visible network failure and recovery. Do not claim this passed until tested on the configured project.

## Executed dispatch experiment

Run npm run simulate:dispatch. The ignored .local/dispatch-experiment.json contains identical fictional demand/fleet/matrix, both event logs and derived metrics. Seed 20261020; input SHA-256 497b4195500b78d77f091e3f62127cdf9c18b9e60ca0a5bc21e234c56b2812fb.

| Metric | Fixed timetable | Adaptive simulation |
|---|---:|---:|
| Requests served / total | 28 / 30 | 30 / 30 |
| Average wait, minutes | 10.79 | 7.83 |
| p95 wait, minutes | 19 | 17 |
| Unserved | 2 | 0 |
| Operating vehicle-minutes | 112 | 136 |
| Seat utilization during operating legs | 58.93% | 51.47% |
| Mean detour, minutes | 0 | 0 |

These are executed synthetic results, not observed passenger outcomes. Adaptive service used more driving and lower utilization in this scenario. Zero detour follows direct same-origin/destination batching in a two-stop matrix; it does not prove general route optimality. The operational application still uses capacity-only recommendations. Manual-vs-QR time studies, ground-truth sensor accuracy, real route performance and provider cost quotations remain pending.
