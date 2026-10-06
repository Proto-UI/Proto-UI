# Web Component startup cleanup at supported callback boundaries

Date: 2026-10-06 UTC; investigation began on 2026-10-05. This repair continues #832 from `b1d7439fe0c53ac0c50b5f910c03f49e6fb066c0`. It changes no public API, normative lifecycle rule, native-event contract, package ceiling, browser assertion or skip policy.

## Reproduced supported-path failures

[Review 4189880395](https://github.com/Proto-UI/Proto-UI/pull/832#discussion_r4189880395) identifies an initial-connection window that the previous terminal matrix did not cover. An outer pending focus request can replay during the child's first readiness publication. If the child's author-controlled focus callback throws, `connectedCallback` exits before installing its terminal disposer. Later removal leaves the old session, native callbacks and readiness resources alive; reconnect can create a second owner.

The baseline was reproduced independently with a passing normal control. After the throwing initial connection and removal, the old disposal count remained zero, a click still reached the old callback, and a readiness listener plus host display/applier remained. The original error remained observable. A second supported boundary reproduces the same failure at final `bindController`: a readiness callback queues raw props, then the author's props watcher throws while the controller is published. Early Adapter `getProps` and mounted diagnostic callbacks also expose Adapter-owned cleanup gaps. The early factory case verifies Adapter-owned resources only; it does not claim complete disposal of an internal Runtime session that was never returned.

The published b1d source separately passed canonical general 4,347, native Focus 50, React 9, Vue 9, Homepage settings/caret checks, all eight browser shards and the test aggregate. Those passes are valid bounded evidence for that source, but do not resolve these newly exercised initialization failures. Its three original package-budget failures remain. #775's a5b dependency publication happened before this upstream review was re-read; future downstream publication preflights also re-read upstream review-thread deltas, not only heads and permissions.

## Bounded ownership transaction

Only `packages/adapters/web-component/src/adapt.ts` changes in production:

- Claim the initializing logical owner before marker publication, so a synchronous DOM move does not create a competing owner.
- Install the owner's terminal disposer before initialization, setup, first view attachment, readiness publication and final public controller binding can invoke supported callbacks.
- Make an idempotent view-release list reachable before view resources are acquired. Each successfully returned event gate, router, style applier, focus bridge and readiness lease is recorded before subsequent publication.
- Track the Adapter's raw-props MutationObservers so a failed session factory cannot strand an observer that has already been returned to its caller.
- Use captured-token terminal retirement for initial failure, attempt all reachable owned releases, and retain the original callback error rather than replace it with a secondary cleanup error. Observe the cleanup Promise to avoid an unrelated unhandled rejection.
- A failed element that simply remains connected does not automatically retry startup. Only an actual `connectedCallback` reentry during guarded retirement requests a fresh connection. A late old cleanup Promise cannot unlock or erase a newer owner.

Retained owners keep their established ownership model. Failed view construction releases that view without discarding the logical owner; a later readiness-publication error on an already fully owned retained view remains available to its existing lifecycle cleanup. Normal terminal teardown and ordinary reconnect retain their prior timing. The old Tooltip and lifecycle assertions are unchanged.

## Evidence boundary and separate robustness observation

Other Web adapters' earliest marker and first readiness publication controls pass 12/12; no corresponding React/Vue/Vue2 product change is justified by these probes. The WC candidate passes 14 independent supported-path controls. The final independent related run passes 18 files / 205 tests, including the new 18 permanent initialization controls and the existing terminal, retained, Tooltip and four-runtime retry cases. These overlapping runs are not summed into a single count.

A separate deliberate override of native `addEventListener` exposed 13/14 retained registrations when the router factory throws before returning its disposer. This is retained as a robustness observation, not silently treated as fixed. Draft `C-EVENT-0007-F` and its 0.2 revision explicitly leave transactional guarantees for listener attachment or cleanup exceptions undefined, and no ordinary valid registration path that naturally throws was established. The base router remains byte-identical to b1d; native-method fault injection is not a blocking conformance case for this repair. This record does not promise arbitrary-host-error transactional safety.

The test mapping adds only the WC initialization implementation to existing `T-FOCUS-0001-CASE-SOURCE-LIFETIME-EXCEPTIONS`, retaining its `HC-FOCUS-TARGET-0001-C` coverage and explicit native-exception limits. Full aggregate validation, final package measurements and new exact-head native execution are reported with the development commit. No local browser is launched and no older screenshot or run is relabeled.

## Final local candidate results

The final staged candidate passes 640 files / 4,365 tests in the canonical non-browser general run, with three existing skipped files and 34 TODO tests. All 44 public packages build. Workspace and documentation types pass; docs cover 446 files with zero errors/warnings and four existing hints. Documentation/CLI generation completed before general started. Source and permanent-test hashes remained frozen throughout.

The separate focused implementation run passes 14 files / 174 tests; the independent supported-path and broader runs remain 26 and 205 respectively. The precise catalog guard passes 9/9. These overlapping results are not added together.

All eleven package measurements are retained. Runtime 68,073/67,100, React 89,545/87,500 and Vue 89,365/87,200 keep their existing failures and unchanged source bytes. Web Component becomes 93,260/104,500 gzip bytes, 287 bytes above b1d and still below its existing ceiling. The combined #824/#826 vector still needs its own measurement; no threshold is changed here. New exact-head native Focus50, the other browser journeys and dependent rendered audit remain unexecuted at local freeze.
