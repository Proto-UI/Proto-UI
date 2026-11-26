# React optional-runtime startup cleanup

Date: 2026-10-06 UTC. This bounded repair continues #832 from `601f9d0a55f8deaa79f5beed463edb7a198c0ace`. It changes no Focus policy, public API, package ceiling, browser assertion or skip policy. The earlier entry-gap review 4190649102 remains a separate design disagreement; its existing empty-policy behavior is unchanged.

## Reproduction and supported scope

[Review 4190948739](https://github.com/Proto-UI/Proto-UI/pull/775#discussion_r4190948739) reports first React readiness publication escaping before terminal cleanup is registered. The reviewed #775 head `db7a1f43775c025b075cfd04bd4193b9db8a19f8` and #832 source601 contain the identical React `adapt.ts` blob `3ecaab043665b044797bbf8a4e09d918971e45ef`.

The reported order does not apply to the default complete React runtime: Context support makes the initial view absent, so the cleanup effect mounts before the next commit attaches and publishes the view. Actual React18.3.1 and19.2.6 controls throw an author `focused.watch` callback at that publication and confirm ErrorBoundary automatically disposes the failed child, before explicit test unmount.

The public optional no-Context runtime fallback does expose the window. `ReactRuntime` exports both Context methods as optional; existing framework-input and lifecycle-event tests consume this fallback. With actual React renderers but those optional methods omitted, initial attachment precedes registration of the lifetime cleanup effect. ErrorBoundary removes the child DOM, but source601 leaves its logical root, readiness source, FocusCenter entry, nine root listeners and eight global listeners. The original author error is captured; gated old click delivery alone does not establish resource release. Normal controls remain alive as expected. This is a bounded fallback compatibility defect, not evidence of a default React profile failure.

The earlier `framework-initial-readiness` control did not close this window: its React throwing branch reached marker publication, and final assertions followed explicit app unmount. A later `framework-second-publication` control did reach readiness publication successfully under full Context, but also did not exercise the optional no-Context fallback. The earlier terminal repair ensured `release()` ran when an already-registered cleanup callback threw; it could not invoke a cleanup effect that had never mounted.

## Ownership change and resource boundaries

Only `packages/adapters/react/src/adapt.ts` changes in production. Effect registration order and full-Context initialization remain unchanged. The fallback creates a HostSession in the existing manual first-mount mode, lets its owner adopt the returned session, then immediately mounts it in the same effect. A render/mount exception therefore has an acquired terminal disposer.

| Acquired resource | Reachable release at the callback boundary |
| --- | --- |
| Root marker | Existing exact-root marker rollback, then the captured view disposer |
| Event gate, router and logical event target | Captured view disposer disables ingress, unbinds the exact target and releases native listeners |
| Readiness source and descendant observer | Deferred lease and observer release are held before publication; view cleanup releases them after old bindings |
| View disposer before session construction | `attachView` adopts it before invoking the session factory; captured initial-owner cleanup can release it even if that factory fails |
| Partial Runtime cap wiring | The factory catch revokes attached caps before host invalidation can call abandoned subscriptions and register a stale Center entry |
| Returned HostSession | The owner retains it before initial mount; render and publication failures dispose that session and its Center/expose resources |
| Existing full-Context or retained owner | Its previous React lifecycle cleanup continues to own disposal; an attach failure does not unconditionally terminate it |

The initial-failure catch disposes only the captured owner. Existing view cleanup guards its captured root and gate references. Cleanup errors and rejected cleanup Promises cannot replace the original author exception; a secondary author `onBeforeDispose` failure is exercised. A factory which has not returned a RuntimeSession is credited only with acquired Adapter-resource/cap cleanup, not an invented terminal callback.

## Evidence and limits

The new permanent suite `packages/adapters/react/test/focus-startup-cleanup.integration.test.ts` has 20 cases using both installed React versions. Each pairs normal/error behavior for complete-runtime publication, fallback partial allocation, fallback publication, fallback render and publication followed by a second cleanup error. All failure assertions occur after actual ErrorBoundary teardown and before test cleanup; no manual owner disposal makes them pass. The fixture observes real add/remove operations and the returned readiness lease, controls physical focus rejection, and never changes gates or fabricates semantic facts.

The final suite against exact 601 source supplied only through a temporary Vite load fails 8 cases while 12 controls pass. The repaired candidate passes 20/20. All 69 explicitly selected React non-browser files pass 257 tests, including existing retained/terminal, input compatibility, lifecycle and bounded-retry cases. Narrow React source/new-test TypeScript and staged diff checks pass. The repository's StrictMode replay control remains identified as a controlled harness, not a new native lifecycle result.

React18 DEV requires DOM error-event reporting. Vitest disables that Happy DOM transport by default; the new test temporarily restores Happy DOM's standard capture and restores the previous setting afterward. The initial transport failure, earlier mis-targeted probes and a corrected partial-wiring catch are retained in the investigation evidence. None is represented as a product pass. No native browser was run, and native listener-method failure transactions remain outside this repair.

The exact source/test hashes, resource table, red/green logs and commands are retained under `/tmp/focus832-601-react-startup/`. Source hash is `e35becf4143241be535921477b357eaa984c6ca2a29b6f57e1c6732cfae064de`; permanent-test hash is `901d6130ac2abc5e4b0f50eace6846c2f8bf260029f4ffb196dcd45d9a20ddfb`. T-FOCUS adds only this implementation to the existing source-lifetime-exceptions case under `HC-FOCUS-TARGET-0001-C`.

At this record's initial freeze, independent review and whole-general/build/CI validation remain pending. Prior 601 native passes are historical evidence for that head, not this candidate. Source publication and the downstream #775 combination remain coordinated by the owning task.

## Recovered candidate and complete local verification

The original shared workspace became unavailable during whole-tree validation. That earlier pipeline has no verified terminal result and is not credited as a pass. The production/test snapshots were recovered with their exact hashes above, and the four originally staged files reproduced tree `2e638b7ebe9a780db93bc1f1bebc0549b7863fa7`. Only the acknowledged historical-record correction changed the recovered tree to `2a2a2a72fa02c317d9e1b49c08d7b323a78b7b65`; an independent review rebound that exact source and test. No remote branch was changed during recovery.

In the recovered environment, the twenty permanent cases passed again. All 44 public packages built, canonical workspace/docs types passed (446 documentation files, zero errors/warnings and four existing hints), and general ran after build/docs completion. General passed 641 files and 4,385 tests, with three existing skipped files and 34 TODO tests. Independent evidence also includes twelve exact publication controls, four partial-registry controls, ten normal lifecycle traces identical to 601 and 85 focused regressions; those overlapping counts are not summed.

Original package budgets remain unchanged and fail: Runtime 68,073/67,100, React 89,616/87,500 and Vue 89,365/87,200 gzip bytes. React is +71 gzip bytes compared with 601; WC remains 93,260/104,500. All eleven entry measurements and hashes are retained for the separate budget integration to measure its real combination. New exact-head CI/native evidence remains required; local simulated-DOM tests and prior 601 native runs do not supply that result.
