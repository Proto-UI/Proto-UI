# Public build prerequisite for general consumers — 2026-11-23

The cancelled `d0392fb3` general job reported four missing-public-export failures in `tabs-profile-switch-code.test.ts`. That test deliberately executes the displayed WC, React, Vue and Vue 2 source with `createRequire` against actual package `dist` exports. The separate package-budget job does not transfer its build outputs into the general worker; installing the workspace alone does not produce those exports.

The general plan now runs the existing canonical **`build:packages`** producer before the unchanged root test chain. All original root gates, runtime controls and complete runtime inventory remain selected. A failed build is retained as a blocking failed step while later evidence is still collected. No source alias, test skip, exported stub, retry or case/job timeout extension is introduced. The original 45-minute general job limit is unchanged.

The complete production graph built **47/47 public packages** successfully in 122.09 seconds, with identical before/after source snapshots. The original four-runtime Tabs file then passed **4/4**, with no changes to that test, its displayed code, input sequence, instance/child identity, profile assertions or 20-second case limits. The plan's ten existing controls also pass, including preservation of every root gate and rejection of a failed or missing execution. Full command logs, exact receipts and the four original failures are in `evidence/2026-11-23-general-public-build/`.

This is local build/ordinary consumer evidence. The next integrated general CI must still complete its entire inventory within its existing budget; the earlier cancelled run is not reclassified as passing.
