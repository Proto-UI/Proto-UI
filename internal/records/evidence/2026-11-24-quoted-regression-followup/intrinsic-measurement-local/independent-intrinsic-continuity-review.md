# Independent review: intrinsic measurement and scroll continuity

## Review binding

This local technical review follows the repository's human-assisted/current-user review route. It is not a GitHub approval, merge verdict, release statement or native acceptance result. The reviewer inspected the author's delta over `b110ec92f5b1c5d256c79b831c0b86b9caaec3e3` and made no product-source edits. No new commit is bound at this cutoff; these seven file hashes bind the frozen candidate.

**No unresolved substantive source finding remains in the inspected delta.** Three source findings are resolved below. Final process receipts and native verification are distinct outstanding evidence.

| File | SHA256 |
| --- | --- |
| `packages/modules/positioning/src/web/floating-ui-host.ts` | `35b27b569d761dba6a251e96d8c0a34f08cbc386792678b803054f368ce4956d` |
| `packages/modules/positioning/test/floating-ui-host.test.ts` | `3806258d0f683b2f2ef6e7b4a0f9145411025a697d7136dadc6cde7558a820ca` |
| `packages/modules/positioning/test/floating-ui-host-intrinsic-invalidation.test.ts` | `14094c1d8ff052a599189c37f8fce24c40d3db81708fc427be44cfab2b663d7f` |
| `packages/modules/positioning/test/available-projection-ownership.test.ts` | `8fbbbbea38985258512047983dd92b5d5795c12e1dbce8c89ef3491210eac280` |
| `packages/modules/positioning/test/lease-generation.test.ts` | `7f1339292fbb41459fd09084f664475696fd1e473260f8a87beb54f4f39fcacf` |
| `.github/workflows/browser-suite-repair-evidence.yml` | `4ccb1376274404ef2dc5d7474fd943b898b195278e7258c683950b5d8edc5818` |
| `apps/www/src/content/docs/zh-cn/homepage-dogfood.browser.test.ts` | `9b6f17dd10ab67bcc4c934cf06c6e3c5b0f0a69c1bf89094dd29a5ccad82826e` |

The main test changed from d0ecddf2… to 3806258d… during final Prettier formatting. The exact earlier file and diff are retained and independently checked: only the async-function invocation's line wrapping changed. The final-byte selection was rerun; this report does not relabel the older run as the same bytes.

## Finding disposition

### F-WHEEL-004 — P2 — settled displacement

b110 directly observed the same Content at 500 then 0 about 60.5 ms later. The old movement poll could see a transient positive offset while its later read omitted the offset check. The new two assertions require the existing final checkpoint to retain nonzero displacement in the input direction. The original 1000 ms deadline, native input and two animation-frame waits remain unchanged. Existing receipt construction and primary-error-preserving cleanup remain intact. This source fix was added after b110 and is not yet native-verified.

### F-INTRINSIC-001 — P2 — side-dependent intrinsic layout

An intermediate candidate treated data-side/data-align writes as owned outputs while potentially certifying natural dimensions measured before their CSS changed layout. Final cache commit checks intrinsic style and scroll extents across the solve. A real stylesheet in the added model changes top-side padding by 200 px and requires the next refresh to measure natural 1200 instead of retaining 1000. Pure output mutation records can still preserve the separate MO-then-RO continuity control. This is source-level resolution and a passing repaired control; no intermediate-source red execution or native reproduction is claimed.

### F-INTRINSIC-002 — P2 — external input changes across await

The intermediate ddbe candidate could pair a measurement with an end-of-solve reference/viewport/ancestor/offset-parent basis that had changed during the await. Final source records a separate context after strategy pinning and immediately before the first real platform measurement. Commit requires the same context and offset parent, plus revision, authored-style and extent checks. The new controlled await test uses the real DOM platform, changes reference width 50→80 after its measurement, and requires the next geometry notification to read natural height 1000 rather than capped 644. The author explicitly confirms that this new control was not run red on old ddbe; the report does not invent that baseline execution.

## Why the final implementation preserves the reviewed boundaries

The custom platform delegates real DOM work and substitutes natural dimensions only in its first rectangle result. Reference geometry and offset-parent coordinates remain fresh. Size middleware uses real capped dimensions, and later rectangle resets also return the real box. Natural dimensions are not permanently forced through getDimensions, avoiding a hidden size reset or repeated natural-size reset loop.

Reuse requires a live owned projection, a non-sizeMatch connection, a mutation observer, no ongoing font loading, positive overflow and equal bounded facts. Foreign root style/class/text/child changes, load/font invalidation, extent changes and external geometry differences reject reuse. A separate pre-measurement context certifies external input while allowing the used box to change legitimately when the new projection is applied.

Per-compute platform state and measured dimensions remain local. Existing generation and style-owner checks gate publication after await; cache commit also requires the same active intrinsic observer. Restart/dispose retire the new observations and pending ownership. The existing delayed-generation, foreign override, equal-value successor and reentrant retirement assertions remain unchanged. Their two mock files add only platform:{} for the new import. These mocks certify ownership behavior, not the real platform measurement implementation by themselves.

Semantically equal configuration objects still trigger a position solve; a new public-lease control requires anchor movement x100→140 and preserved modeled scroll 80, preventing a no-op from passing. A valid certificate may be reused for that geometry solve. Explicit requestUpdate, changed configuration, root-space changes and sizeMatch keep fresh measurement. The earlier composed-ancestor and ShadowRoot scroll dependency handling remains intact. There is no scroll-offset writeback, removal of Brutalist decoration, widened internal-scroll repositioning or anchor-translation semantic change.

The workflow delta adds only three precise test paths to its source recorder, from 14 to 17. Selection, execution, timeouts, artifact upload and failure gates are unchanged. The browser matrix delta is exactly the two stronger settled-displacement assertions.

## Observed checks and execution limits

The reviewer read and hashed retained logs rather than rerunning tests.

- Focused control log: 4 files / 47 tests passed; author reports exit 0. This run precedes the formatting-only test change.
- Final-byte positioning plus four-adapter log: 26 files / 337 tests passed, duration 24.76 s. Its terminal summary is present; the original process exit receipt has not yet been delivered at this exact cutoff.
- Final-byte workspace typecheck log is currently empty. No completion or success is inferred from an empty file; author process receipt is pending.
- Final formatting log says all matched files use Prettier code style; its process receipt is pending.
- Baseline-labelled core log: 2 failing cap-continuity controls, 1 passing viewport control, 23 intentionally filtered tests. Failures observed empty caps instead of 644 px and 596 px. Author validation will bind that run's source/execution metadata separately.
- Independent public-lease baseline receipt: unchanged b110 host, originally executed three-case source, 1 failed / 2 passed; modeled scroll 80→0 after owned mutation delivery and a controlled resize echo. The final four-case source also adds an active-RO receiver guard and equivalent-configuration case. Those later bytes and that fourth case were not run as the original baseline.

The companion JSON records full evidence paths and observations. The earlier final-test.json needsCandidateExecution field is a historical edit-state receipt, not an assertion about the now-observed candidate suite.

| Retained evidence | Bytes | SHA256 |
| --- | ---: | --- |
| `contents-intrinsic-context-guard.log` | 39738 | `0187991beb776ba8a7d042c86b33bb5f1133378bd9b36e5963bd83980f0de724` |
| `contents-intrinsic-positioning-adapters-frozen.log` | 297836 | `9e5fbf478765bfa00f34fd43fd7830296a1fbceca9fa75190f23a16978ffacb0` |
| `contents-intrinsic-workspace-tsc-frozen.log` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `contents-intrinsic-prettier-frozen.log` | 66 | `17aa973d3f004560237d9a95171210b0671deff23d61628eecf7322ff5938f20` |
| `contents-intrinsic-b110-core-red.log` | 31940 | `19de578ebfabfb87c5503b2512642dacbbd9eeeb59a10e544250955d753399fa` |
| `vitest.log` | 31222 | `f3c7276360a8d183c31f125c79e2129fd4a536b1d89013c574ce7e91564a1a68` |
| `result.json` | 727 | `8025f2f6aaed6ab890479719faf9d24b69e60e27fb366529aac4f795cffc62b9` |
| `final-test.json` | 556 | `9850f2a9eb1fe829277a80c0387e125a97b84b19cc593982f0134b250517141d` |
| `final-test-delta.diff` | 2961 | `d900f06dceea6b1bb33a2c1ea6d1770a1422dace8e233d287e8cf245b09dcc2d` |
| `contents-intrinsic-host-test-before-final-format.ts` | 33085 | `d0ecddf2a95af1df49fd13c4c6af5e6c7fc668a5f86868c2abf9f2c5561c9b20` |
| `contents-intrinsic-final-format.diff` | 1569 | `12b25158c22a93625b2ba304f65ac6a5db9a83c3c512bd5723645a6763d3bb31` |

## Native debt and scope limits

The last actual native source remains b110: 12 Shadcn combinations completed, then Brutalist/WC/click failed after observed 500→0; 23 combinations did not run. No new native pass is claimed. Exact attribution of that reset to a particular observer callback remains an inference from source and four-pixel motion, not a captured JavaScript stack.

Happy DOM geometry and scroll models, actual mutation delivery and controlled resize callbacks prove the listed source controls. They do not establish native layout, real font loading, trusted wheel behavior, every runtime/family combination or an unbounded future retention interval. This is a bounded cache certificate review, not proof for every possible author stylesheet or shadow-tree mutation. The selected suite is not the full repository; workspace-only typechecking would not certify full check:types or docs/Astro checks.

Later process receipts and native evidence should be appended with exact source/hash binding. Preserve this frozen review's cutoff instead of rewriting pending evidence as though it had already arrived.
