# In-place Select selected-row contour repair

Date: 2026-11-09. Related issue: #1159. Base: `0607c6c5c386b8a932ab850e92a8873b2121dc45`.

## Requested result and scope

The owner reported that the expanded selected Item still did not occupy the Trigger's position. Two supplied image crops showed a roughly 132 × 44px Header Trigger and a wider, shorter selected Shadcn row. The requested result is the selected row's rectangle replacing the Trigger rectangle, not merely matching popup width or aligning text centers. Private input images are not republished.

The current issue discussion was reread, including the released Header writer window and #1330, #1343 and #1344 outcomes. No open Select PR was found. This repair does not take over the separate Compiler/IR, Bootstrap appearance, Header CSS or Dialog workstreams. All related catalog entities remain draft; no release or full #1159 acceptance is claimed.

## Diagnosis and decision

The previous implementation bound Surface to the anchor width but retained a profile minimum of 144px and intrinsic Item height. Its oracle accepted up to 8px row inset. This could pass while the reported 132 × 44px Trigger still had a 144 × 32px row. The historical popup-only decision and evidence remain in `2026-11-07-select-popup-anchor-width.md`; the current explicit requirement supersedes that goal for item-aligned mode only.

- Base Content selects the current semantic alignment row and requests its existing neutral `sizeMatch` lease against the Trigger. Only this aligned row is sized; other options retain intrinsic height, including multiline content.
- The neutral host measures that row's logical border-box inset inside Surface, subtracts it from the reference inset, and includes outer Group/Viewport/border chrome in the containing frame width. No component name, CSS selector, selection value or DOM fact enters portable state.
- Shadcn item-aligned Surface fills the measured frame with no family minimum. Explicit popper retains its previous anchor-width/min-width recipe. The two modes use exclusive sizing tokens, avoiding cascade-order dependence.
- Actual reference movement/resize recomputes block allocation instead of retaining a stale, larger frame height. Same-reference metadata refresh retains scroll; intentional viewport scrolling retains the existing expansion behavior. Lease cleanup and named geometry/content-conflict boundaries remain in force.
- Draft definitions and their detailed numerical projection were reconciled with this explicit selected-row policy. This is a Proto UI in-place extension, not an assertion of exact upstream popup geometry.

## Evidence and failures retained

Environment: Node 24.22.1, pnpm 10.32.1, locked dependencies. No newly downloaded third-party implementation was executed.

1. Before the source repair, new LTR/RTL inset and consumer binding assertions failed for the intended reason: **3 failed, 36 passed**.
2. Initial focused candidate: **72/72** passed.
3. Wider run: **634 passed, 33 failed**. Existing owner fixtures reported constant layout boxes and omitted size-lease geometry facts; the old motion oracle still explicitly accepted the unwanted 8px inset. These failures were not counted as success.
4. Fixture correction first exposed Happy DOM's absent `offsetParent` getter (**43 failures**). The explicit, cleaned-up mock layout now responds to owned width/height writes; this is deterministic host simulation, not native CSS evidence. A remaining same-metadata scroll regression was repaired without deleting its assertion.
5. Final main focused matrix: **42 files, 668/668 tests passed**, covering Positioning and Base/Shadcn Select, lifecycle/focus/reopen, animation observation and negative boundaries. Additional 132 × 44px sizing and popper↔item-aligned withdrawal assertions passed **37/37**. The final host cleanup delta was rechecked separately.
6. `check:styles:preset` passed, including Shadcn, Brutalist and draft-family token closures and **13/13** motion-palette tests. Lifecycle authoring passed against the exact base. Formatting and whitespace checks passed.
7. A full workspace type check was killed with SIGKILL and produced no type result. The integrating task owns the bounded-memory rerun and remaining aggregate checks.

## Native acceptance remains open

The scheduled bilingual × four-runtime browser carrier now requires the selected row's left/right/top/bottom errors to be ≤ 0.5 CSS px on first entry, selected reopen and 390px reopen. Its motion oracle rejects the former 8px inset. Each case also visits the actual homepage, selects its real runtime, opens the Header family Select, verifies its ≥44px Trigger and exact selected-row rectangle, checks Escape focus restoration/reopen, and requests new screenshots. The existing eight test identities/count are retained. This carrier remains planned evidence until actually run.

The local carrier initially stopped before browser input because Astro telemetry could not create its config directory. A separate minimal installed Chromium check, with Chromium's sandbox enabled and reviewed execution escalation, still terminated at startup with `socket() failed: Operation not permitted`. There were **zero rendered page results and zero new screenshots**. No sandbox setting was disabled. Source tests are not substituted for native raster, true scrolling, viewport collision or font-scale/RTL/AT evidence.

Next: run the current committed candidate through the native carrier on a supported authorized environment, inspect all eight JSON reports including `headerObservations` and their newly captured screenshots, then perform exact-head independent review/CI and update only earned #1159 children. Preserve long-label size conflicts as named failures; do not clip text or weaken the rectangle oracle to obtain a pass.
