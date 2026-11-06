# Select motion evidence: retain the original trace handle

Date: 2026-11-05 UTC. Scope: an internal browser-test evidence repair for #1159, following merged #1229. This is not a Select product fix, native acceptance, formal approval or a lifecycle change.

## Source and decision

Baseline: `ec9ea70b8e1f1e2ff356091daf99221a605ad8c8`, tree `a71a60aaa6841114e5213a643047f4562432231d`. The three executable candidate files are bound below and in the [complete result record](2026-11-05-select-motion-retained-handle.results.json). Record files were prepared after the 11:07 UTC execution, so they are not relabeled as executed source.

The existing installer wrote a handle to the pre-action Trigger. The browser test later resolved the Trigger locator again to read that expando. A replacement node can match the locator without carrying the original handle. The new installer returns the same object it stores; the browser test retains a Playwright `JSHandle` before each action, awaits that object's `done`, and disposes it. Exceptional cleanup uses the same retained object and independently records disposal failures.

The sampler still rejects detached/replaced owners. A replacement does not become the original trace and an invalid-owner or interrupted trace is not converted to success. No product code, CSS, workflow, dependency, geometric tolerance, animation duration or keyboard command changes.

Authority: `internal/agent-operations/testing-method.md` requires discriminating controls and source-bound observations. Draft `P-SHADCN-SELECT-CONTENT`, especially `P-SHADCN-SELECT-CONTENT-TRANSITION` and `P-SHADCN-SELECT-CONTENT-CURRENT-VISUAL-SURFACE`, retains the 150/0ms policy and separate Content/Surface/Viewport responsibilities. This evidence change neither promotes that draft nor amends its unresolved parity questions. The existing eight native cases remain their own acceptance boundary.

## Actual results

The fixed three-file candidate ran in a cleared, credential-free environment with inherited syscall-level network denial and the existing 105 hash-bound packages. Node 24.22.1; dependency versions, commands, case identities, every failure and per-phase raw-file hashes are retained in the linked result record. No dependency was installed. One bounded execution slot was used; each phase had a 120-second limit and none timed out.

| Subject                                     | Collected |  Actual unit result | Exit |
| ------------------------------------------- | --------: | ------------------: | ---: |
| Exact baseline                              |        27 | 27 passed, 0 failed |    0 |
| Exact candidate                             |        30 | 30 passed, 0 failed |    0 |
| Candidate with only `return handle` removed |        30 | 26 passed, 4 failed |    1 |

All three have zero skipped/pending/todo cases. Baseline and candidate scoped strict TypeScript checks both exited 0. The program uses ES2024, ES2022/Bundler, strict/noEmit and skipLibCheck; it includes the three files and their imports, not the whole workspace. Browser harness/server-readiness are type inputs only. Baseline and candidate three-file read-only Prettier checks both exited 0. All ten phase source-before/source-after comparisons and 105-package checks passed; frozen inputs remained unchanged after completion.

The negative control is deliberately red, not a failed candidate hidden from the totals. Removing only the installer return causes:

1. The strengthened serialized-function check to receive `undefined` instead of the installed handle.
2. The new exact-return check to receive `undefined` instead of the installed handle.
3. The replacement-owner check to fail reading `done` from the missing return.
4. The old-handle cleanup check to fail reading `done` from the missing return.

The other 26 original cases pass in that negative control. Original baseline case names remain present. All failures and their source locations are retained, with only sandbox path prefixes normalized.

## Measured internal walkthrough

These are executed Happy DOM controls, not a browser simulation presented as native evidence:

- Same-node reinstall: the previous `done.status` is `stopped`; the returned object is strictly equal to the current Trigger expando. After open and settle, the new result passes the existing trajectory checker.
- Replacement Trigger: the new node copies attributes but its expando is `undefined`. The retained original handle resolves `invalid-owner`, preserves one early sample, reports both cleanup acknowledgments true, and leaves zero scheduled fixture frames/timers. The existing checker still rejects the result.
- Old-handle cleanup: install a new same-node trace, observe the old result as `stopped`, then call the old handle's `stop` again. The Trigger still references the new object; that new trace settles without issues and leaves zero fixture frames/timers.
- Serialized installer: execute the transpiled function without its module closure, assert its returned identity, then read `done` through that return. This proves closure-free return behavior in the fixture, not Playwright transport.

Independent byte comparison retained the complete `facts`, `assertGeometry` and `ready` sections and the keyboard press list. The 1,200ms/96-frame limits and two-terminal-frame requirement remain unchanged. No geometric polling or fixed delay was added.

## Historical native failures and remaining work

[Run 41918805824 / job 126924013404](https://github.com/Proto-UI/Proto-UI/actions/runs/41918805824/job/126924013404) executed source `4db5275154fbc80b393c27d6148b8403e7c61361` and recorded 0/8 passed (all eight failed). Its artifact `13371331720` has ZIP SHA-256 `dde96e5876bf4b926b8fa64aa07514efdd0fa8dd49b9ea5dcbf3dba32686c47b`.

- React, both locales: no retained motion result because the handle was not found at readback. Node replacement is a plausible mechanism, not proven by that artifact.
- WC and Vue2, both locales: observed animation later became idle/cancelled, yielding an interrupted trace. This patch does not change animation semantics.
- Vue, both locales: motion settled, then Viewport horizontal overflow was 4px (236 minus 232), exceeding the unchanged 1px limit.

Those cases did not reach selection/reopen/narrow acceptance. Failure screenshots were taken afterward and do not prove the exact failed frame. The later [41977517573 / 127097020721](https://github.com/Proto-UI/Proto-UI/actions/runs/41977517573/job/127097020721) is separately recorded as 0/8 in #1159; this record does not reuse the earlier artifact as that later run's detailed diagnosis.

Pending:

- Run the original eight native cases on an authorized exact candidate; verify actual Playwright handle lifecycle, disposal and exceptional cleanup, retain complete traces and inspect fresh screenshots.
- Diagnose remaining owner changes, WC/Vue2 interruption and Vue overflow without relaxing assertions.
- Reach selection, disabled, reopen and narrow phases; keep first-visible/compositor, RTL/200%/long-text, AT, compiled and other-consumer obligations distinct.
- Complete applicable final-head CI/DCO and formal independent review. No whole-workspace check, new native run, merge or deployment occurred in this validation.
- Header #856 remains outside this change and retains its separate unaccepted cases and source/test contradiction.

## Review, provenance and evidence scope

A separate source/raw-result review inspected the final three-file patch, all ten receipts and all three raw Vitest reports. It found no definite blocking defect for this bounded Draft and confirmed the four negative-control identities and preserved geometry/keyboard logic. It did not rerun the tests and is not a GitHub APPROVE or product acceptance.

Agent's sanitized request paraphrase: advance the maintainer-requested Select repair, publish concrete development progress and preserve unfinished acceptance. Material AI assistance: OpenAI dot generated the bounded patch, tests and record; source and raw results were reviewed separately. No new third-party implementation, private source, credentials or raw private prompt is included. Existing repository source remains under its MIT license. The responsible contributor's own DCO applies to the submitted commit; native DCO is observed separately after publication.

Evidence disposition: complete for the listed isolated controls, partial for browser integration. There is no product UI change or new screenshot to attach. The measured internal state/identity sequence above is the relevant logic evidence. Native captures remain explicit work, not replaced by old images.

The preparation manifest and run plan remain historical pre-execution snapshots locally. The 11:07 UTC actual-result record supersedes their then-pending execution status without rewriting history.

## 2026-11-06 carrier prerequisite correction

Head `8a631b2e7a1f08b81590932f321aa44279bf8286` ran the original eight cases in [42195223357](https://github.com/Proto-UI/Proto-UI/actions/runs/42195223357): two passed and six failed. The separator margin repair cleared both Vue horizontal-overflow failures. The independent main baseline `0ba436431c875b848548504d5d96488158b80902` in [42196224085](https://github.com/Proto-UI/Proto-UI/actions/runs/42196224085) retained all eight failures. These failures remain part of the evidence; counts alone do not identify their causes.

A local real-browser probe attached Playwright to the owned Chromium, used fresh contexts, the actual website and the same `Locator.press` operation. Diagnostic messages were added only to the in-memory sampler's existing rejection branches. React and Vue2 each returned `invalid-owner` before their first sample: the captured Trigger had `data-projection-runtime="wc"` and was disconnected when the requested runtime committed. The earlier inference that four options had not mounted was incorrect. The toolbar's ready scope was insufficient evidence that the demo had committed. The carrier now uses the existing `selectRuntime` helper, which checks the public controller, materialized content and actual framework root.

The same tight keyboard sequence reproduced WC and Vue2 cancellation locally. Their Trigger box-shadow transition starts when the opening key establishes keyboard modality, then reverses as focus moves into the options. Earlier separated browser-tool calls left enough time to hide this sequence; their successful traces did not disprove the failure. A native Tab into the closed Trigger establishes the keyboard focus prerequisite. The carrier requires that focus and its existing animations finish, within 1,200 ms, before installing each open-cycle trace. No geometry is polled during preparation. Native Tab probes then settled on WC (13 samples) and Vue2 (14 samples).

This correction preserves the sampler, its cancellation/owner rejection, 1,200 ms/96-frame bounds, early samples, two terminal frames and all existing geometry, focus, selection, disabled, reopen and narrow assertions. It measures opening from established keyboard focus; it does not claim acceptance of an immediate focus-and-open sequence, first-visible compositor timing, RTL/text scaling, compiled output or assistive technology. The local attached-browser probes do not prove normal-sandbox launch. Final-source execution of the complete eight-case hosted carrier remains required.
