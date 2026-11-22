# Sprint 6: independent frame-budget failure triage

## Bound evidence and conclusion

This read-only triage concerns GitHub Actions run **45013193295**, candidate **9b6448e339a474bca6a8fbaae4ad8c24c522a84c**, tree **e03d3e6ddbd4141a90adc06a84768a67bdd18a18**. The theme and release receipts report the same clean source identity at start and end. The actual browser is Chromium 157.0.8103.78. The corrected workflow registered all five required material cases: **one passed, four failed**. The sixth, separate live-canvas diagnostic was not selected by the frame-budget pattern and remains skipped; it is not a sixth passing result.

All four original failures remain failures. This triage distinguishes primary defects, unexecuted consequences, and a likely invalid fixture recovery precondition. It does not accept a candidate fix or substitute a unit result for another exact-source browser run.

| Required case | Actual failure | Attribution supported by this evidence |
| --- | --- | --- |
| Light dynamic optical journey | 20,000 ms quality wait after CDP deviceScaleFactor=2; original source line 422 | DPR/source resynchronization requires separate investigation. This receipt alone does not establish whether it is persistent product behavior, task scheduling, or a fixture race. |
| Dark dynamic optical journey | Expected self-optical after removal of a sibling blocker; received opaque-fallback at original line 359 | Original overlap rejection succeeded. Recovery failed. The neighboring material footprint condition described below is relevant, but this run does not retain the exact overlapping sibling in the failed predicate. |
| Authored theme through WC portal | Mounted authored foreground #aabbcc was replaced with #1d1d1f | High-confidence Website projection ownership bug: a nested authored theme-key object is treated as renderer-owned by a key-name heuristic. |
| Bounded release lifecycle | full-footprint-negative-guards fails ownedRest after removing a 2 px blocker, deadline 2,000 ms | Ten earlier natural/pending-decode cases reached their original assertions. The failure is blocker-removal recovery, not a demonstrated stuck natural release tail. Neighboring dynamic material footprints make the fixture's recovery precondition suspect. |

## Authored theme: primary fault and secondary observation

The real fixture clones the canonical Liquid Dropdown, adds an authored nested `surfaceStyle` entry `{'--pui-foreground':'#aabbcc', color:'var(--pui-foreground)'}`, and mounts the public WC rendering route. The nested Content has no `pui-projection-renderer-theme` class, remains inside its owning Root, and the initial theme watcher has emitted once. Its actual inline foreground, background and border are nevertheless the complete light palette. The original author declaration and canonical source tree remain unchanged, demonstrating that checking only those objects misses the rendered-surface overwrite.

`projection-composition.ts` originally implements `pushNestedOwnedThemeSurfaces` by taking the last style object, recognizing any overlapping theme key, and issuing `api.setSurfaceStyle` with `{...themeEntry,...theme}`. That makes the author's `--pui-foreground` sufficient to acquire a renderer theme lease. Construction-time `rendererThemeEntries` identity is the appropriate existing provenance; token names or a value coinciding with the palette are not provenance.

The second reported theme error, `expected [] to have a length of 2`, is **not an observer-count failure**. Original suite line 1253 expects two native **click** observations in the final trace. The first mounted-light failure exits before the click/Escape/open sequence, so these interactions did not execute. Keep the failed result and the unexecuted journey; do not diagnose a second observer leak from this assertion.

The retained native disconnect trace separately records successful calls from `projection-theme.ts` during `caller-theme-watcher-stop` and from `projection-composition.ts` during `rendered-destroy`. Its final snapshot has `destroyed=true`, `themeStopped=true`, and `ownedConnectedNodes=0`. These cleanup observations survive the early failure. They do not establish the later portal-open, author-reclaims-stamp, and reopen paths that never ran.

Independent source review of the proposed ownership correction agrees that the old dynamic-child test which expected an authored nested `{'--pui-background':'#fff'}` to become `#222` contradicts this ownership boundary. Preserve that scenario as an authored-value negative control and retain an outer renderer-owned current-theme positive control. Record the oracle correction explicitly; do not infer ownership from keys merely to keep the erroneous old assertion green.

## Release: passed subcases and unresolved recovery precondition

The release receipt preserves five natural cases (light WC/React/Vue/Vue2 and dark WC) and five controlled pending-native-decode cases (up, cancel, blur, source-revoke, dispose) before the final failed case. Their existing geometry, session, source revision, quiet rendering and resource cleanup assertions completed. Controlled promise delivery, synthetic cancellation and synthetic blur remain fault-injected lifecycle evidence, distinct from trusted natural pointer input and physical timing.

In the failed final case, the actual regular host is 143.25 by 38 CSS px, with a 13 px admitted contact paint outset. A real 2 by 2 CSS px sibling is inserted outside the host but within that expanded footprint. The receipt records `source-overlapping-content`, `opaque-fallback`, no committed carrier and no image, so the original outside-host negative guard works. After removing that blocker, the trace remains at that same fallback reason until cleanup; it never records a restored optical frame. The later overflow-hidden negative guard did not execute.

The reviewed fixture wraps three controls in `material-controls` with a **21 px gap**. Both regular and prominent buttons now request bounded contact material. Their individual paint outsets are `ceil(max(width,height)*0.08+1)`, so a valid layout must reserve both controls' expansions, not only one. The saved full-footprint screenshot shows the WC Accent material acquiring visible source detail after the regular control falls back, while the corresponding Accent controls in the other rows remain solid. This is consistent with a sibling acquiring a newly available footprint and subsequently preventing the regular control from recovering. The Accent's precise DOMRect/registered footprint was not retained in this receipt; its approximate screenshot width must not be promoted to an exact measurement.

The next native investigation should capture the conflicting sibling's actual host/pseudo bounds and quality, plus independent closed-layout clearance. If that confirms the inference, repair the fixture's layout precondition while preserving the original blocker rejection, removal recovery, new-frame requirement and 2,000 ms deadline. Do not weaken `inspectCanvasBackdrop` sibling exclusion, widen the deadline, disable the prominent material, or label a valid overlap refusal a product recovery bug without this distinction.

## Evidence inventory

All paths below are relative to `sprint6-evidence/native-45013193295/frame-budget/candidate-release/` in the task workspace.

| Artifact | SHA-256 |
| --- | --- |
| vitest.json | abefcc4c232f2dda8017fee5de1daf833d0a952ce955ea92b032dd5996b94a93 |
| theme-ownership/report.json | 4ff65043546ad869e1fe678511c0d383b2410c15e17bff666a2c10f1e6b88158 |
| release-lifecycle/report.json | 9bf6bb0f8995b4bd28d70e710d3a155803917208ab385b45bf92c9d53e25aa3d |
| release-lifecycle/full-footprint-idle-overlap.png | 6c1f3a357db7bde60e880b25efdc3d4856ae6cdee905ed95d485c55f36c8fcea |

The reviewer read the exact candidate source for failure line mappings and visually inspected the full-footprint screenshot. No source was modified and no browser, heavy validation, hardware measurement or remote write was performed by the reviewer. The independent review remains open for the replacement exact head and its native receipts.
