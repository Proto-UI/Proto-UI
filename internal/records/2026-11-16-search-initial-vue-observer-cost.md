# Initial Vue Search diagnosis and unchanged attribute notifications

Date: 2026-11-16. This records a bounded performance repair and its evidence. It does not establish that the production Search deadline passes.

## Exact failing source and diagnostic boundary

The parent-run official production suite at `e90249ab6d49ef959750936cc57ec3b5ab1de45d` produced three passes and one failure. Shadcn failed its initial WC-to-Vue transition during the held Pagefind retry, at the original 1000 ms `expect.poll` assertion. This is earlier than the React-to-Vue2 failure observed on the previous combined candidate; those failures remain separate receipts.

The subsequent diagnostic copied the freshly built e902 production output into an independent worktree. All 4,067 output files, totaling 137,560,390 bytes, were hashed before copying and compared after the run. The frozen manifest SHA-256 is `68d1c1300d4d32c065e274b68a37a0f3ea523b75636f14edec0e82d1453b769e`. All 13,201 tracked source files in the original clean checkout matched the preceding official source manifest. Original source, original output, frozen output and instrumented source stayed unchanged during the diagnostic.

The isolated fixture wrapped only the original initial Vue request and its original assertion in the existing CPU/long-task/Node-event-loop profiler. It selected the complete Shadcn recovery case, retaining its HEAD503, retry, runtime actions, getter and 1000 ms deadline. The other three cases were explicitly filtered. The driver reused the frozen output instead of rebuilding it. This was an instrumented diagnosis, not a production acceptance gate. Its one selected case failed at the same initial Vue assertion. A preparatory exact-text guard failed before launch and was corrected; it did not execute another browser scenario.

The production output contains neither external `.map` files nor inline `sourceMappingURL` comments. Source attribution below uses exact generated URL/line/column, hashed served text and manually inspected source equivalents. It is not a source-map result or a claim that a different build generated identical mappings.

The diagnostic ended at 03:13:24 UTC. Cleanup at 03:13:25 UTC confirmed that port 4397 was closed and no private Chrome profile remained. The shared native slot was then handed to the compiler acceptance owner. The original checkout remained clean.

## Observed costs

The initial Vue request reached the observed ready attribute after 1,128.1 ms. Polling started 560 ms after dispatch began. The three getter calls returned `wc`, `wc`, and finally `vue`; the matching return arrived 1,035 ms after poll start, after the original deadline. The observer's earlier ready timestamp is not a passing assertion.

Node event-loop p99 was 12.39 ms and maximum delay was 27.93 ms. The CPU profile instead identified substantial page-side style work:

| Profile window and exact path | Sampled cost |
| --- | --: |
| Request to ready: native `getPropertyValue`, all callers | 394.385 ms self |
| Request to ready: SiteCopy hidden-first-activation `display` reads | 217.828 ms native leaf |
| Original poll: projection-theme token reads from generic preview setup | 103.674 ms native leaf |
| Original poll: projection-theme token reads from queued watcher delivery | 69.571 ms native leaf |
| Original poll: portal direction `sync` | 94.475 ms self |

The SiteCopy asset is `SiteCopyBootstrap.astro_astro_type_script_index_0_lang.D5SfqqZA.js`, SHA-256 `46521cd40be4d335281458b69e6cb869601ff03fe05bd5e53a8d25bb3917d556`; its `se` at zero-based line 0, column 767 reads ancestor display. The theme asset is `projection-theme.CNGHi1mS.js`, SHA-256 `c01384b22584a61ceed6ff704d26dd0db480e4bc2f0a910c570863574c59f6a5`; the token callback is at line 0, column 2490. Portal `m` is at line 12, column 35129 of `site-shadcn-controls.DvBAjdSx.js`, SHA-256 `e2a54fe307578dfe8dc1454c3729d912579907c8ffa341f277566020add4641d`.

These are statistical attribution totals, not exact invocation counts. Ancestor totals overlap. The profile identifies hot paths but does not prove that every sampled style read came from an unchanged attribute notification, or predict the saving of this patch.

## Bounded repair and preserved behavior

The existing hidden-activation and theme watchers scheduled style reads for observable attribute writes even when the attribute retained exactly the same value. Both now request `attributeOldValue` and compare it with the live attribute value before scheduling work. The hidden gate considers only roots affected by an actual changed record; the theme watcher still resolves its complete map when any record genuinely changed.

No computed value survives an observer delivery. Real mutations mixed with unchanged writes still activate revealed content and update the theme. Existing hidden/display semantics, parent traversal, reentrant activation, resize handling, initial theme publication, system-color notifications and cleanup remain in their owners. No timeout, Search assertion, request dispatch, readiness marker, portal implementation, renderer or compiler changed.

`C-PROTOTYPE-STYLE-CLOSURE-0001` and `D-HOST-PROTOTYPE-PROJECTION-SCOPE-0001` remain draft and preserve consumer theme ownership and the existing generation boundary. The implementation-level hidden-activation policy is retained by its existing tests and the earlier `2026-11-16-hidden-activation-portal-invalidation.md` record. No catalog criterion or lifecycle was amended. Portal residual work and repeated generic-preview theme acquisition require separate evidence and are not included in this patch.

## Executed local evidence

Two new cases use actual HappyDOM MutationObserver deliveries, and a separate audit observer confirms that notifications occurred. They count style-read entries, then verify that a real reveal or token change in a mixed batch still produces the expected consumer effect. They do not claim native browser cascade or elapsed-time evidence.

The final identical fixture bytes on the original e902 production source produced **17 passed / 2 failed**, zero skipped. The hidden gate performed three unnecessary style reads, and the theme watcher performed one unnecessary complete bank read. With the repair, the focused cases passed **19/19**. An initial red run before formatting is retained separately.

The affected run passed **210/210 in 14 files**, zero skipped, in 33.32 s. It includes hidden activation and its reentry controls, Copy bootstrap/command/controller, CodeSurface discovery and consumers, the theme watcher, projection materialization/loading masks, preview ready publication, actual four-framework post-render failure cleanup and 52 runtime-preview portal-theme cases. Exact paths, collected cases and source hashes are in the evidence report.

Strict TypeScript checking of the four modified source/test roots and their dependencies passed, exit 0, with a 1024 MiB heap limit. This was not a whole-workspace check. Formatting and whitespace checks cover the changed files.

Local evidence directory: `/workspace/scratch/46c8fad17f2b/search-e902-evidence`. It includes the original CPU profile, frozen manifests and run receipts under `native-diagnostic`. The independently hashed archive is `diagnostic-handoff.tar.gz`, SHA-256 `e30903fcc67cf2d5a2756f9ffc77e860c6cf106ff7d66a81b4cc4a9a6e082591`. The raw CPU profile SHA-256 is `56a2a069f5b61c5236cdc073575ce42a50c01b9bb46e363d04c1c8d64c9fa533`.

Remote original official receipts: `/workspace/release03-browser-acceptance-20261116/production4-e90249a`. Remote diagnostic receipts: `/workspace/release03-browser-acceptance-20261116/initial-vue-profile-e90249a`.

## Remaining acceptance

The local redundant-read conditions are repaired. Independent review and an unchanged, unprofiled production Search run on the integrated candidate remain necessary. The original deadline failures are retained; this focused result does not close the production performance or broader Search acceptance criterion. The parent owns the next native slot and external integration/tracking work. No push or external comment was made by this child.
