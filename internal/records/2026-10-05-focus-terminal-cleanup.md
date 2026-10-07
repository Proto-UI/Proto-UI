# Focus terminal cleanup and failed view construction

Date: 2026-10-05. This follow-up continues PR #832 from `40e10ff8fb99ddcf75d6f4c22f5158892ca48a16`. It records a newly distinguished lifecycle ordering, not a new public guarantee.

## Reproduction and the earlier control's limit

[Review 4189027378](https://github.com/Proto-UI/Proto-UI/pull/832#discussion_r4189027378) reports interrupted React/Vue view cleanup when a readiness observer synchronously retries focus and the host call throws.

The previous cross-Adapter control used retained `setPresent(false)`. In React and Vue, that path removed the old DOM before the later cleanup, and the real replay used the still-connected outer Trigger fallback. The test's throwing override was on the departed inner element, so it was never called. That passing control did not establish terminal-child-removal exception safety.

The new actual-framework control keeps the outer adapted instance alive and removes only its child. React layout cleanup and Vue `onBeforeUnmount` run while the old child root is still connected. An already pending programmatic request therefore reaches the deliberately throwing old host target during source release. On `40e`, both adapters subsequently remove the DOM but retain the old logical-root binding. The captured `viewDisposed` flag prevents later cleanup from retrying. Exact-source controls preserve both terminal failures and both retained-hide successes.

A separate remount control identified an earlier construction boundary: `markProtoInstance` publishes Trigger-surface changes before the new readiness lease and view disposer exist. A throwing pending request can leave the replacement root marked without a usable owner. Failure followed by normal cleanup leaves a detached root still registered in React, Vue and Vue2. React's error-boundary unmount is allowed; the assertion concerns the leaked binding, not a requirement to suppress the error or preserve the UI.

## Bounded repair

The repair is governed by draft `HC-FOCUS-TARGET-0001-C/D` releasable readiness bindings and `C-LIFECYCLE-0006-C/D` view-epoch ownership. Public Focus request semantics and retry bounds are unchanged.

- Complete every old-view release even if a readiness callback throws. Preserve the original error, clear only the captured old root and owned references, and publish source invalidation after old bindings have been released.
- Keep readiness registration's release lease before any publication can call user code. Publish only after the new view has acquired its disposer and current owner state.
- Roll back the exact root if marker publication fails before a view owner exists. Preserve the originating error if rollback notification also fails, and reset an initialization sentinel only if it still belongs to that failed root.
- Ensure React schedules terminal owner disposal in a `finally` block even if old-view detachment throws. Preserving the original error must not leave the logical instance alive indefinitely.
- Preserve framework error handling. A Vue disposal Promise must remain visible to Vue's error handler rather than being discarded; normally returned rejection semantics in the shared owner are not changed or silently swallowed.

The exceptions are deliberately injected host-method failures in real framework lifecycle transitions. They are controlled evidence for resource ownership and error propagation, not a claim that ordinary browser focus spontaneously throws. Existing native focus suites remain necessary for the normal successful paths.

## Evidence and remaining work

Independent review of the final five production files passes 14 attack probes and 66 permanent/adjacent cases. The permanent focused matrix is React 8, Vue 8 and Vue2 20 (36 total). Narrow types pass. The earlier full React/Vue non-browser run passed 130 files / 428 tests before the final React terminal-disposal `finally` change; final-tree whole-general validation remains a separate result.

A validation command initially selected the React/Vue test directories without excluding browser files, unintentionally attempting two local browser suites. Startup failed in the known environment and the 18 native cases supplied no passing evidence. The failure is preserved; subsequent local commands use explicit browser exclusions, with no assertions or skip policy changed. No native execution success is inferred from source smoke or simulated DOM.

Final local whole-general validation passes 637 files / 4,280 tests, with 34 existing todo tests and three skipped files. New paths were staged before catalog collection. All 44 public packages build and workspace types pass against the frozen five-file source. Documentation types pass for 446 files with zero errors, zero warnings and four existing hints.

The unchanged gzip gates still fail for Runtime 68,073/67,100, React 89,511/87,500 and Vue 89,328/87,200; Web Component remains 92,704/104,500. Compared with `40e`, the measured React and Vue increments are 178 and 171 bytes. All eleven entries retain environment and minified-hash provenance; the separate combination must be measured directly rather than adding these deltas arithmetically.

The exact final source hashes, documentation-type results and CI are reported with the resulting development commit. The `40e` evidence and failed cases remain historical; its prior independent bounded review is not credited with this newly tested ordering. #775 and the final budget transaction are paused until the corrected source is frozen. No threshold, assertion, public API or normative spec rule is weakened to close these failures.
