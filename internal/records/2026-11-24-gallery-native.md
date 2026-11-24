# Native mobile gallery preconditions: 20 current-source journeys

The mobile Homepage intentionally defaults to an inert, scaled five-column overview. The audited Button, Rhea layout and loading-mask cases attempted to measure or edit that overview as though the user had opened its interactive gallery. This record compares the original current-source tests on clean `fca048905ca8c8a97bb0cedb6311816670d3d318` with the bounded test correction on clean `cfb5724a3bdeb37b414fe4642b915b14e521f775`.

The candidate uses native Enter on the existing public layout toggle, confirms the expanded stage is no longer inert, and verifies the actual input value immediately after the original fill. Its 39 inserted lines do not modify product source, expected geometry, text scaling, viewport coverage, ownership, feedback, deadlines, or post-cancellation assertions. Independent source review found no blocker before the native candidate run.

| Original selected journeys | Baseline pass / fail | Candidate pass / fail | Preserved coverage |
| --- | --: | --: | --- |
| Button selection, public height and editing | 4 / 4 | 8 / 0 | Shadcn and Brutalist across WC, React, Vue and Vue 2; original narrow 200% text and height assertions. |
| Rhea child padding and reopen flow | 4 / 4 | 8 / 0 | Four official Web hosts, each at 1180 px / 100% and 390 px / 200%; original one-pixel tolerance. |
| Runtime loading-mask cancellation | 2 / 2 | 4 / 0 | Both families at desktop/light and narrow/dark/200%; original mask, retained node, focus and value assertions. |

The original baseline reproduces all ten targeted failures on current fca: Shadcn's narrow measured height is 8.03125 instead of 64 px in all four hosts; Rhea's four narrow geometry deltas are 28.5625 instead of at most one pixel; both narrow cancellation cases read an empty value. The baseline's other ten selected cases pass. The candidate passes the same twenty named journeys. Both runs deliberately leave the same 22 other cases unselected; this is not a claim that all 42 cases or all families pass.

The fca baseline completed at 13:11:16.105Z with exit 1. The candidate completed at 13:18:18.983Z with exit 0. Neither had an outer timeout. Both used Node 24.22.3, pnpm 10.32.1, Playwright 1.58.2 and sandboxed Chrome 156.0.8078.79, without a CPU profiler. The baseline freshly built the CLI and generated the canonical website assets. The candidate reused those assets only after confirming that its full source delta consists of the three test files, all recorded producer scopes and dependency fields are unchanged, the lockfile is unchanged, and all four generated asset hashes match. Its source receipt states `generationRerun: false` and identifies fca as the producer.

[The receipt](evidence/2026-11-24-gallery-native/receipt.json) binds the exact sources, unchanged selected names, commands, timings, generated assets and independent source review. The adjacent complete archive contains all 403 test-output files, including all 326 original PNG files, and both exact runner sources. The per-file manifest preserves each original byte count and SHA256. No images were transformed or re-encoded to reduce the archive.

Baseline process cleanup ends with no remaining owned process. The candidate's last Astro sample retains its exited leader as `Zs` with RSS 0 and no live descendants. This is preserved rather than reported as an empty final list; TERM was used and KILL was not required. No later reap is claimed.

These results accept the corrected public interaction preconditions and their twenty real journeys. The original Homepage runtime/preference latency, the unreached wheel diagnosis on later sources, and Matrix initialization remain open. The record is not a complete release rehearsal, whole browser matrix, or assistive-technology acceptance.
