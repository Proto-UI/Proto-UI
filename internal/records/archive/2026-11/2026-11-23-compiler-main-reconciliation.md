# Compiler and mainline semantic reconciliation

## Candidate and purpose

This record accompanies the normal merge of main `b715b8a6d08c2c79417272c8d4ca9254984feadb` into the public seven-sprint integration candidate `502693304fc8d7509402fdfb586b283681915231` for [PR #1733](https://github.com/Proto-UI/Proto-UI/pull/1733). The mainline includes the merged native-control work from #1730. The compiler consumer checks below concern the combined authoring source, not either parent in isolation.

The first independent local merge began from unpublished `f342328a2417b9cf0a8e1c4337ae2f090ecd5e9f`. When that execution environment became unavailable, its worktree was left intact. The replacement worktree was created from the exact public #1733 head and normally merged main. It did not reset, force-push or overwrite the other session's worktree. The unpublished objects were not available from the checked remote object stores or GitHub at recovery time; this record does not claim their history was published or all of their changes were restored.

The final candidate was reconstructed in an isolated worktree, with saved conflicted originals and exact per-file guards. Before adding this record, its staged tree was `125a76628d12c446af4ed020a0ac91abb4f7f9c9`. Of 383 staged paths, 360 have blobs identical to the merged mainline. The remaining 23 paths combine the integration branch's existing work with mainline changes or the repairs described below. The inventory preserves every path and both parent blob identities. Historical mainline records and their original bytes are inherited without cleanup or rewriting.

## Reconciled behavior

The merge retains the integration branch's ordinary callable bridge, lossless UTF-16 string values, ControlLabel requests and native action leases. It also retains mainline renderer adapters, distinct definition/render owner identities, conditional accessibility state, native notification, hover recovery, explicit text reset and existing external scroll-engine bindings. Callable equality follows the captured callable identity; owner facets remain distinct. Root setup and authored-hook setup both convert their checked renderer boundary, while existing typed scalar return handling remains present.

Native accessibility callbacks continue to carry their actual action data through the current declaration, mount and window lease. Numeric SetValue handling and generic action routing remain available. ControlLabel activation retains its authored press route and stale-callback guards. A hover exit cancels ControlLabel participation only after the current native hover observation has passed its lease checks.

The DOM TextControl merge keeps the integration branch's full Scroll detach cleanup. Text callbacks gain the mainline reset lease: reset, detach and replacement retire physical event listeners and pending selection observations. Each callback in a listener batch rechecks the current generation, including after reentrant reset. The text-reset tests retain their exact complete snapshot assertions and derive the selection fields from the physical input. The correction does not replace the original expectations with partial matches.

Scalar target admission retains bounded GPUI conversion and the mainline numeric, rounding and UTF-16 length rules. Structured or opaque native coercion remains rejected, and the original direct Qt/Flutter negative cases remain. The separate object-spread and readonly JSON-publication helpers both survive the merge. Frontend and serialized-IR flow histories remain aligned for terminating branches.

The native workflow retains all existing ordinary, ControlLabel, style, activation and scroll consumer lanes and mainline's actual emitted SDK unit lane. The SDK lane runs through the numeric consumer workspace with `-p proto-ui-gpui-native --features test-support,gpui/test-support --lib`; it is not replaced with source-text assertions.

## Repairs found by actual execution

The initial emitted SDK build failed with Rust E0063: mainline's captured-renderer unit fixture constructed a `NativeCallable` without the integration branch's `ordinary` field. The authoring source fixture now supplies `ordinary: None`. The assertion about original callable identity is unchanged. The subsequent fresh SDK generation compiled and passed the complete 27-test unit set.

A new native consumer composes an actual external viewport with its real ScrollHandle. Its original clamped-overscroll case failed in the separate Sprint 7 repair: the parent canvas observed a raw wheel offset before the external child completed prepaint clamping, and following resumed without committed vertical displacement. The repaired owner observes an internal engine during its existing prepaint phase and an external engine at the beginning of canvas paint, after the complete prepaint traversal. Short-lived RefCell reads end before the observer runs. This preserves explicit pause for stationary, clamped and horizontal input and allows real followed-axis arrival to resume following.

The same minimal phase repair and unchanged external consumer were incorporated here. This candidate's complete six-target native consumer command passes 65 tests, including the new external viewport case. Its result is separate from the earlier 64-test diagnostic run, which did not include that case.

## Observed validation

All results are execution results from the isolated recovered candidate. Exact commands, raw output hashes, input hashes and retained failed attempts are in [the evidence directory](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-compiler-main-reconciliation/manifest.json). The ordinary and numeric packages were generated by their checked-in producers. Generated Rust was not edited.

| Check | Observed result | Scope |
| --- | --- | --- |
| Offline frozen pnpm install | Exit 0 | Candidate's own dependencies; no clean-install claim based on another checkout |
| General compiler/Input regressions | 18 files, 253/253; zero skipped | Before the subsequent owner phase-only repair; required emitted Rust numeric data cases executed |
| Compiler source strict TypeScript | Exit 0 | The compiler source program, not a whole-workspace type-check claim |
| Scroll source regressions after the phase repair | 9 files, 135/135 | Complete original files, unchanged assertions |
| Ordinary and numeric producers | Exit 0 each | Fresh output directories from the final authoring source |
| Cargo graph controls | 19/19; zero skipped | Complete original graph fixture suite, including negative cases |
| Ordinary and numeric dependency admission | Exit 0 each | Full locked graph, pinned GPUI source/revision and shared SDK identity |
| Emitted native SDK unit tests | 27/27 | Real pinned GPUI SDK with test support |
| Ordinary native consumers | 65/65 | 39 ordinary, 14 ControlLabel, 4 activation, 3 pause, 4 reader, 1 style |
| Numeric accessibility consumer | 9/9 | Original emitted numeric-action bridge cases |
| Default native library check | Exit 0 | Default-feature library check in addition to the test-support runs |
| Source formatting and Rust fixture syntax | Exit 0 | TS/YAML formatting and Rust parser; actual Rust compilation is reported separately above |

The native commands used Rust 1.98.1, GPUI `62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`, `--locked` and `--offline`. The numeric producer's existing receipt explicitly requires one metadata resolution to add its exact generated package; that preparation was performed offline, followed by the unchanged locked graph and native checks. The ordinary consumer used its checked-in lockfile without an unlocked update.

The general source run's authoring-file hashes match before and after that run. The native continuation checks the final authoring-file hashes against the producer run and verifies that all generated Rust file hashes remain identical before and after compilation and execution.

## Retained failed attempts and interpretation

- The first SDK invocation selected a manifest outside the intended workspace and failed before compilation. A subsequent numeric invocation required the producer's documented metadata preparation. Those command/setup failures remain in the historical diagnostic bundle.
- The initial actual SDK compilation then failed with the missing `ordinary` field described above. Its original failure output is retained.
- The first recovery formatting command incorrectly passed the Rust fixture to Prettier. All TS/YAML paths were unchanged; Prettier rejected the unsupported Rust parser. The corrected run uses Prettier for TS/YAML and rustfmt parsing for Rust.
- The first phase patch driver rejected an exact context mismatch before changing the source. The integration template used a one-line canvas prepaint expression. The replacement driver matched that actual expression and retained the same semantic repair.
- The first graph-control invocation inherited `CARGO_NET_OFFLINE=true` from the native harness. Cargo refused to check out the suite's freshly created `file://` Git fixtures. The unchanged full fixture command was rerun with offline mode disabled only for that command. Its dependencies are local test repositories. Actual generated graph admission and all native commands remained locked and offline; no assertion or negative case was removed.
- The old `sdk-v2-status.json` diagnostic runner accidentally labels its archive with the ordinary archive digest. The original record is preserved. The additive manifest names the correct numeric archive digest `05213dde6e96f11c68e0b0d6db34aff2778854afe8cc01205da2d945ee9ad09b`; the ordinary archive digest is `b2f0a8b0fcfc5c3352669b05a0deef44cf5624df05d9a5df33f2ed7c8c68fa73`. Neither old diagnostic run is relabeled as validation of the recovered source commit.

## Publication recovery and frozen evidence

The supported publisher created normal merge commit `13fca7298f80c8a8acd8acdb3e4a35c279875576`, with the intended two parents, but then correctly returned `PublicationUnknown`: the committed tree `ff4c2d3b6562690e06433812360e359589e085a8` differed from the explicitly reviewed tree `2643ec88c87b8d994ee5add76f2c208f2ccda9d7`. The normal pre-commit hook had run lint-staged/Prettier over mainline additions and rewritten twelve inherited files. That attempt was not pushed or treated as a successful publisher receipt.

Ten affected files are frozen Sprint 7 source/review records. They are restored byte for byte from main `b715b8a6d08c2c79417272c8d4ca9254984feadb`. The existing .prettierignore policy already protects exact legal, generated, upstream, Issue-snapshot and reviewed-resolver bytes. The repair adds only the ten explicit affected record paths to that same policy. Hooks, the publisher's exact-tree verification and other formatting checks remain enabled.

The two remaining files are ordinary scripts, `scripts/analysis/invisible-consumption/produce-button.mjs` and `scripts/governance/history-audit.mjs`. Their formatter output is retained after full diff inspection and TypeScript syntax-tree comparison. The history-audit tree is identical directly. The producer differs only by parentheses around a complete return expression; removing only that unambiguous outer return wrapper yields the same expression/operator/literal tree. The first strict comparison's mismatch is retained alongside that narrower explanation and comparison. No producer condition, data string, numerical value or effect is changed.

The recovery receipt preserves the actual merge commit, both tree identities, all twelve changed paths, the failed publisher log, the complete formatting diff and before/after source hashes. A following normal commit records the restoration and exact-path formatting rule; the original attempt is retained in history. All fourteen compiler reconciliation inputs still match the successful generated-native run. No native result is relabeled as a new execution after this metadata/formatting correction.

## Review and limits

The complete staged path inventory was compared with both parents. The combined scalar/flow/publication paths and all manual conflict resolutions were read as source, including the separate helpers, action data, callable identity and lifecycle guards. The final DOM application was also read against the public #1733 preimage by the Sprint 2 contributor: only ten TextControl change locations were present, and integrated Scroll cleanup was preserved. That contributor participated in the original TextControl repair, so this is an independent check of its application here, not a second independent approval of that original logic and not a GitHub review approval.

The Sprint 7 phase correction was independently checked against the pinned GPUI prepaint/paint ordering and then executed again in this candidate's complete native consumer command. Headless GPUI TestAppContext execution is real SDK evidence; it does not certify physical OS IME, screen-reader delivery or native application acceptance outside these consumers.

These results resolve the combined source and SDK blockers represented here. They do not close every browser, budget, production or portfolio gate in #1733, and do not by themselves make the umbrella PR Ready. S4 and S5 retain their own original branches, normal mainline merges and candidate-specific acceptance results. No contract/profile promotion, benchmark threshold change, negative-control relaxation or blanket completion status is made by this record.
