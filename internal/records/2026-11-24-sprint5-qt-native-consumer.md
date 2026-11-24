# Sprint 5: actual Qt Root, Scroll and request-outcome consumer

This record covers the bounded Qt portion of #1144. It records actual Qt 6.4.2 execution of generated QML and C++, separately from JavaScript guest controls, the optional Vitest wrapper, formal hosted execution, and public profile admission. `qt-source-v1` remains unavailable through the canonical compiler.

## Definition and actual product failures

`C-TEMPLATE-0001` criteria A/B/C require a host-owned Root containing authored template children in source order. A template node, anonymous slot, empty output or array of siblings does not replace that Root. `C-CORE-SYNTAX-0004` retains the default anonymous slot when setup returns no render function.

The actual native C++ build succeeded, then the first generated Qt Quick component failed with `Anonymous slot cannot replace the single Root`. The old owner promoted the first template node to Root and rejected otherwise legal default-slot and sibling output. The repair creates and retains the host Item Root and flattens authored output beneath it. Root feedback remains separate from child style; updates reuse the Root, while detach retires the physical view and returns parked native slot children to their host.

Independent static review of this Root delta is retained as `independent-root-review.json`. It reads the applicable shared definition and actual owner/emitter/view sources. It is source review, not an independently executed SDK result or a GitHub approval.

Actual consumer work then exposed a second existing gap: Qt Scroll requests delivered to the native Flickable but returned `undefined` instead of the shared `ScrollSurfaceRequestOutcome`. A request could also reach a retiring root, use an inactive axis, or publish end-follow success before host application.

The request repair implements the existing `C-SCROLL-0001` request/current-view boundary and the draft end-follow policy:

- Mounted requests return `dispatched` only after delivery to the same current physical engine. Detached views return `not-mounted`; inactive axes and the unimplemented optional reveal route return `unavailable` without movement.
- Absolute and control-drag positions are clamped. Axis position facts still come from the native view; the guest does not fabricate successful geometry.
- End requests publish `pending` before native delivery and `applied` after it returns. Request generations prevent an older call from moving or overwriting a newer request after synchronous observer reentry, pause, detach or replacement.
- A host failure retires the pending end request and preserves the original thrown value, including a falsy value, if a cleanup observer also throws.

These are bounded implementation decisions under the existing definitions. The Scroll and end-follow lifecycle statuses remain draft. Optional native reveal, composed Qt chrome, complete input integration and platform accessibility are not accepted by these tests.

## Real SDK preparation and preserved failures

The auxiliary environment was Debian 12 with g++ 12.2, Qt 6.4.2, aqtinstall 3.3.0, CMake and Ninja. SDK acquisition ran from 22:11:28 to 22:12:36 UTC on 2026-11-23. The exact Qt archives were `qtbase`, `qtdeclarative`, `qtsvg` and `icu`; installer reports, version logs, commands and all original exits remain in the evidence archive.

Two first CMake attempts stopped on missing OpenGL development libraries and then the GLX link target. The required Debian packages were unpacked into a task-local sysroot with `dpkg-deb`; no host package database or system library was overwritten. Package versions, checksums and the separate dependency completion record are retained. These were preparation failures, not native component passes.

The third attempt reached the real generated Qt Quick application and exposed the original Root refusal. The next Root-only repair passed four original native cases. A subsequent expanded fixture passed all eight named cases for default slot, sibling order, empty render, native Scroll geometry, Root identity, axis policy, same-owner replacement, and terminal old-callable refusal.

The eight-case run executed from 22:32:47 to 22:33:38 UTC with 27 generated input files checked before and after. Configure, build and consumer commands all returned zero; no generated file drift was observed. That successful result continues to belong to its original v4 input archive.

## Expanded actual native request acceptance

The request-outcome fixture retains all eight earlier cases and adds four journeys. Its actual native run started at 22:57:33 and ended at 22:58:05 UTC on 2026-11-23: **12 passed, 0 failed**, launcher exit zero, and **zero drift across all 27 generated files**.

| Native consumer case | Direct observation |
| --- | --- |
| Default setup / original slot child | The original native Rectangle remains under the anonymous slot of the host Root |
| Sibling order / independent Root styles | Two template children remain distinct and ordered; child widths 32/48 and Root width 160 remain separate |
| Empty output | A present host Root remains with zero authored children |
| Flickable viewport / initial facts | Actual 240×200 native viewport, overflowing content and system/vertical facts |
| Position request outcomes / movement | Absolute, relative, page and control-drag requests return `dispatched` and update actual observed native position |
| Explicit update | Children change while the native Root identity remains |
| Axis-only update / setup policy | Owner and view identity remain; projection and end-follow policy are unchanged |
| Inactive-axis refusal | A vertical request in the horizontal-only view returns `unavailable` and preserves native position |
| Detached refusal | A detached request returns `not-mounted` without reaching the retired native root |
| Same-owner replacement | A fresh physical root and increased epoch adopt retained both-axis intent; native slot content still overflows |
| Replacement end request | The current engine reaches its end, then exposes `following` / `applied` |
| Terminal old callable | Disposal clears the logical owner and the retained old callable throws |

This is real Qt Quick execution with `QT_QPA_PLATFORM=offscreen` and `QT_QUICK_BACKEND=software`. It proves the stated native lifecycle, geometry and request behavior. It supplies no physical GPU, touch/pen, IME, assistive-technology or complete platform-profile acceptance.

The v5 native input archive is 60,702 bytes, SHA-256 `861489f00f5a88a284e65fd4ad05a1dfb74ece5374ebc623f126ebfee3224be2`. The returned result archive is 6,843 bytes, SHA-256 `4d8488d8d5525845025bd8693de9184f22281259be94e5c4e8bdf2805ea64b71`. All nine manifest entries were checked against the exact returned archive. It contains original native command logs, source receipt, driver, status, final exit and all twelve original case results. The successful direct SDK run is not relabeled as execution of the later Vitest wrapper or hosted CI job.

## Source controls and CI evidence boundary

The original Qt guest failed all twelve new request-outcome cases. The repaired guest and related existing axis/pause controls then passed **24/24**. Adding the first-falsy-host-error/secondary-observer control produced **25/25** in the same three-file selection. These controls execute the actual emitted guest code with bounded host witnesses; they do not simulate a native geometry pass.

The added manual/reusable workflow lane pins Qt 6.4.2, invokes the repository Vitest wrapper, requires the original native application, and preserves artifacts on failure. The explicit source selection also registers the request controls. An unset SDK skips the local opt-in wrapper and is never accepted as native success. The lane retains the existing workflow scheduling boundary.

Independent review found that the first evidence checker could accept empty input/artifact manifests and mutually renamed result/expected-case lists. Those synthetic counterexamples are retained as real checker defects, not native execution results. Their repaired checker and trusted-fixture inventory are reviewed separately before publication; this paragraph does not claim the new hosted job has executed.

## Raw custody

Raw archives and their byte/hash manifest are under `internal/records/evidence/2026-11-24-sprint5-qt-native/`:

- `qt-native-raw-evidence.tar.gz` retains SDK acquisition, both environment failures, the original product refusal, and the four/eight-case successors.
- `qt-native-v1.tar.gz`, `qt-native-v2.tar.gz` and `qt-native-v4.tar.gz` retain the exact historical prepared inputs. The archived v1 bytes are authoritative; a later local regeneration of its scratch directory is not the old input.
- `qt-native-v5-inputs.tar.gz` and `qt-native-v5-results.tar.gz` retain the exact expanded request source and the actual twelve-case native result.
- The independent Root review, original request red/green reports, and checker review/fix materials retain their own source bindings and execution scopes.

Final combined-source hosted execution and independent acceptance remain separate actions. This record does not close all of #1144 or any whole-backend matrix by itself.

## Independent request-order review and final source controls

The independent reviewer retained actual counterexamples for an axis change while a request was pending, an ordinary request superseding a pending end request, and an observer throwing during pending publication. A later review exposed stale second-fact publication when the first observer created a new request. These are genuine software findings; they are not environment failures or missing physical-device evidence.

The final guest binds publication and failure cleanup to a request generation. It snapshots related facts before invoking observers, continues notification after the first observer error only while the generation remains current, preserves the first thrown value including `undefined`, and never rejects a newer or already-applied request while cleaning up an older request. Axis changes update the actual native intent before retiring the old pending request. Ordinary movement supersedes an earlier pending end request.

The final source SHA-256 is `19622fe938caa54cbbb1593ffeb906faa4e94e9770eadb1de1bbb7268e6f9670`. Its 18 request controls plus 12 existing axis/pause controls passed **30/30**. The independent review passed **10/10** controls after preserving the original **2/5** and intermediate **8/9** results and their complete source snapshots. That independent source history is retained with the [Qt evidence-checker record](2026-11-24-sprint5-qt-evidence-checker.md).

`qt-request-source-history.tar.gz` retains the original 12-failure author run, the subsequent 24/25/29/30 source results, exact commands, final source and final test file. It is 71,881 bytes, SHA-256 `0360ed1a290076c1a0a73df5cb49e236b14d12cc16b9f46af0b71cefa0f94f59`. These source controls do not change the actual v5 native 12/12 source binding above; the final native workflow must execute its own current generated consumer.
