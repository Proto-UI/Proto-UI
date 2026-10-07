# Bootstrap evidence repair on current main

Date: 2026-10-04. Non-normative continuation of PR #808, within #799 / #792.

## Merge and diagnostic baseline

The PR head `48073a78da9e37539f8060350595d4b3653ba369` was merged with main `d4bdb66b54d68625fb3da1109a76e0829c1e77d7`, preserving both histories. The sole textual conflict was the generated GPUI style-token count. Running `node --import tsx scripts/gpui/generate-style-fixture.mts` regenerated the combined inventory: 286 tokens, 280 compiled, six without declarations. An automatic merge also duplicated the Input union/required-parts entries; those duplicate declarations were removed while retaining both the Bootstrap and Shadcn Input registrations.

The existing four editor failures remain intentionally unrepaired at this checkpoint. The exact-head Actions fixture retains its `count === 1` assertions and the native-input attribution added in `48073a78`. A fresh run after this conflict repair can distinguish multiple native edits from duplicate outward delivery. The governing draft `C-TEXT-CONTROL-0001-C` requires normalized events in native order; `P-BASE-TEXTAREA` owns the editor and event protocol, and `P-BOOTSTRAP-2-3-2-TEXTAREA` only projects its appearance.

## Verification and limits

- Six browser-scaffold boundary checks pass.
- The initial five-file focused run passes 58 tests; a duplicate `input` warning from the automatic merge was then corrected and the affected registry plus actual Bootstrap recipe test file rerun: 27 tests pass. An initially supplied docs test filter matched no file; only the actual collected files are counted.
- Full workspace TypeScript (`check:types:workspace`) passes.
- Prototype catalog, generated GPUI fixture check and all source-derived style preset checks pass.
- Locked dependencies were installed offline from the existing package store.
- A pure-native Chromium attribution probe could not open a page: the execution sandbox rejected Chromium's process-singleton socket. No runtime assertion was reached and no local browser result is claimed. The Actions-only fixture guard remains intact; no fake Actions environment or stale external URL is used as evidence.

Real exact-head Actions results and new screenshots remain pending. Prior-head screenshots remain historical evidence and must not be presented as the new source. This eight-part increment does not complete the Bootstrap Base family; remaining parts and Compiler/native coverage remain open.

## Measured event attribution and fixture repair

The exact-head `60e491d9` Actions run `37184204831` reproduced the same 11/15 browser result. Artifact `11296775285` binds to that SHA and Chromium `154.0.8037.57`. In WC, React, Vue and Vue 2, the initial Input fill produced one trusted native input and one matching outward request. The multiline Textarea fill produced three trusted native inputs, with `data` equal to `Changed`, `null`, and `Second line`; each reported the complete `Changed\nSecond line` value, `inputType: insertText`, and `composing: false`. The three outward requests matched those facts exactly and in order.

The first wrong expectation was the browser fixture's assumption that one Playwright `fill` operation must mean one native event. No duplicated or dropped outward delivery was observed. The governing native-order contract does not authorize coalescing this stream in Base or the Bootstrap projection.

The repaired fixture retains a strict one-request single-line fill for both physical editor kinds, zero additional requests during disabled/read-only transitions, the exact one-additional-request restoration delta, controlled request/owner acceptance, and physical editor identity. Before the disabled/read-only transitions, it fills the Textarea with the original multiline value and checks the literal DOM and protocol value plus exact native-to-outward payload sequence equality. It never dispatches a synthetic event or writes the editor value directly. Native event count is measured, not hardcoded to one browser release's fragmentation.

The same assertion helper is tested against the recorded sequence and rejects duplicate, dropped, reordered, coalesced, altered-value, altered-input-type, altered-composition, missing, and synthetic event evidence. The bounded workflow runs these adversarial tests beside the real four-runtime fixture and tracks both helper paths. New browser acceptance remains pending until the repaired exact head runs; this diagnosis does not relabel the failed baseline as passing.

## Controlled-editor boundary coverage

Repair head `0443dbdd614d5f24ede83f375847e16a25687bca` passes the exact-head Bootstrap workflow `37184812341`. The following increment applies the same trusted-event/full-payload oracle to the actual controlled Input and Textarea as well. The read-only native listener runs in capture phase at the physical editor, before the runtime restores a rejected proposal. Controlled disabled/readOnly edits must emit neither a native input nor an outward request; owner acceptance through `setProps(value)` must emit no additional request. The strict controlled single-edit request remains exactly one, with all four normalized payload fields checked. The listener still neither dispatches events nor writes value, and per-case fixture disposal/page closure bounds its lifetime.

## Negative focus evidence and sibling isolation

Head `c77d52c6631fea30ecc3b7096db169b3d51407c5` passed all 15 browser cases in run `37185048495`, artifact `11296817009`. Inspecting its actual recovery screenshots revealed an important fixture side effect: the uncontrolled fields showed `RestoredX`. `Locator.press` could not focus the disabled controlled target and therefore sent the attempted `X` to the still-focused preceding uncontrolled editor. The controlled target correctly emitted no input/request; this is not evidence of a component duplication defect.

The refinement performs a real click on the non-editable fixture heading before attempting a blocked controlled edit. It verifies the preceding editor is no longer focused, and requires its recovered value, entire native-input history and entire outward-request history to stay unchanged after each blocked attempt. Existing controlled no-event assertions and the full trusted sequence oracle remain. The old run and images are preserved as negative attribution evidence; no production semantics, value mutation, synthetic event, timeout or screenshot edits are introduced.

## Opt-in browser dependency trigger closure

Review comment `4179292684` on current-main merge `f38d52a4` identifies a genuine scheduling gap: the focused browser suite requires its opt-in environment, but adapter, text-control and Previewer runtime changes did not match the workflow's path filter. The shared runtime phase deliberately collects the same suite with that opt-in disabled, so its existence there did not supply the missing browser coverage.

The bounded PR-head workflow now follows the four Web adapters and shared adapter base, core/hooks/runtime/modules, Base exports, Previewer renderer/loaders, the style token collector and build/dependency manifests. Those are actual fixture execution or generated-paint inputs. Unrelated native/Compiler implementations and site-only styles are not broadened into the fixture's claims. Permissions, exact-head guard, Actions-only admission, native event oracle, timeout, non-persistent checkout credentials and lack of dispatch/deploy actions are unchanged.

The new dependency-closure test fails against the old filter, then all twelve evidence/runtime-plan tests pass with the repaired filter. This is CI trigger repair only; runtime and fixture behavior are unchanged. The preceding f38 four-runtime browser run remains its own historical success; the new exact-head run and screenshots are still required.
