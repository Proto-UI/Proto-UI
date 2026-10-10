# Finf P2 integration on published 4b85 baseline

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Source boundary

This local candidate starts at published head `4b85c33f7b53ed5fee70b7e27351082769b6fea8`. Source A is `0aa09069313a692947561c0a1994caae4d81617d`, with root tree `f874f642fba17e408f41214604b91df48745b183`. It changes eight source/test/documentation paths. Neither historical local alias `33593f8ff0c4c5246286bddb302fa9a8bc72e373` nor `dd0ce9c641f57d4b7fe6171187a7abb803a37cbd` is an ancestor. The previously published DAG is preserved.

Four previously reviewed patches were replayed without changing their bytes, authors, author dates, messages or DCO statements; normal hooks ran on every new commit:

| Repair | Original local source | Replay |
| --- | --- | --- |
| Field own report admission | `63e7fde4679fa4891b410dca8712e2ce32226a2d` | `4e7c7c4faeab84ff9948658560a1f3a23821ea29` |
| Portal viewport direction refresh | `24049b45fc4c46c92c0a6d0c7115c19c9c84516a` | `0377cc521b50883e575dd05328077a16d7c64d8b` |
| Generated SSR physical control snapshots | `e3b0e5c58f4eb8fb5f1ed429f7ad388fdb33a264` | `a0db9e97db91953cff84d01c0001d2de9ec56e07` |
| Generated SSR accepted-mode reconnect | `5f6f666031041f6fcc5fc6fdb21fb5846ff0e56c` | `6810016737d666dcdbd6978d72e87db4b9e58965` |

The additional A commit changes only the browser test cleanup from `element.remove()` to `element.parentNode?.removeChild(element)`. Playwright inferred `Node`, making the former expression fail TS2339. No cast, assertion, viewport, timeout or product behavior was changed. The old type failure is retained in the evidence packet.

## Bounded behavior

- Field requires the report payload's own `value` and reads optional values only when owned. Existing shape rules and single-read accessor semantics remain; this does not impose a new plain-object-only, array, symbol or hidden-key protocol.
- Portal refreshes inherited direction through its owner Window resize lifecycle and removes the listener on release. Explicit author direction retains ownership. This is not a claim to observe every CSSOM or media-feature change.
- Generated Web Component SSR validates physical control attributes and serialized property baselines, snapshots the carrier before cleanup can mutate it, and retains failed-adoption restoration. Textarea value is not incorrectly treated as an ordinary serialized property baseline.
- Generated SSR reconnect remembers only a successfully accepted mode at the guarded success boundary. It does not infer framework ownership from arbitrary open or closed shadow roots, override the existing carrier priority, or revive a terminal owner.

This generated SSR helper is a different path from the real `AdaptToWebComponent` reconnect path discussed in [#883](https://github.com/Proto-UI/Proto-UI/issues/883). Same-root-cause equivalence has not been established. The candidate does not cover Focus, Anatomy or Runtime and does not alter the C-group Runtime/Delay work owned by HyacinthHaru in [#884](https://github.com/Proto-UI/Proto-UI/pull/884). No group claim or delivery commitment is made here.

## Source proof and acceptance limits

Canonical proof now names A and verifies 4,206 bound paths with 121 Git tree objects. Only the two Field bindings changed; the six other changed paths are outside that inventory. The [separate eight-path manifest](./evidence/2026-10-10-finf-p2-source-manifest.json) includes 21 self-verifying Git tree objects, commit bytes, blob IDs and SHA256 values to close that source-path proof offline. Source identity is not implementation or native acceptance.

All other canonical top-level fields remain unchanged: 258 draft catalog identities; 55 core plus 13 prior-work items, 68 total, with checkedCoreTodos still zero; all four SSR profiles unimplemented; Liquid Card private and default-off; all 280 GPUI rows required-unassessed. Historical records retain their original identities.

## Verification and retained gaps

- Final A: focused 312 tests pass, including a separate fresh independent-agent run. Source replay, dependency origins, the one-line type correction and proof integrity were independently reviewed by agents; this is not independent human acceptance.
- Final A: all workspace and documentation types pass (641 documentation files, zero errors, ten hints); type contracts pass. The old TS2339 result remains available.
- Final A: full non-native Web Component closure passes, 128 files / 940 tests. Preset closure and all four GPUI fixture checks pass.
- Final A: documentation build produces 349 pages; production bundle/source-owner checks pass. The bundle graph has no foreign-worktree product source IDs. Shared, fixed third-party package-store IDs are separately identified.
- The complete 74-test CLI Shadow closure passed on the immediately preceding source `68100167…`. Its final-A rerun lost its execution session after an authorization-review rejection while polling; the permitted same-call retry returned an unknown process ID. Partial logs are retained and no final-A Shadow pass is claimed. The only intervening source difference is the browser-test Node API correction.
- At source `68100167…`, GPUI script controls retain 17 passes and 14 failures caused by the existing tsx CLI's local IPC `listen EPERM`; an elevated retry did not fix that limitation. Exact committed native source files omitted by sparse checkout were materialized for static checks only. No native program was executed. A final-A script-suite pass is not established.
- Strict package budgets fail: React +486 B, Vue +315 B and Web Component +99 B gzip over the unchanged ceilings. The scoped Finf advisory command exits zero while preserving those failed comparisons; strict success is not claimed.
- The first proof-suite run began before proof refresh finished and read the old source binding: 3,725 pass, five fail and one skip. That orchestration failure is retained separately. After refresh completed, the full suite passes 3,730 tests with zero failures and one existing skip. The source-wall check also passes on final A.

Native Portal CSS/media behavior, native positive and negative controls, and screenshots remain verification debt. Generated SSR tests are not an end-to-end native browser or real-adapter acceptance claim. Source A and its proof/record companion are local candidates, not a claim that these repairs have been pushed, merged or accepted.
