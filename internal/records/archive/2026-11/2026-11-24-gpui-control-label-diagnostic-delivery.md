# ControlLabel diagnostic delivery after a queue drain

The focused repair verification passed. The original failed runs remain failed and are preserved below.

## Exact source and repair

The base commit is `e470d1b0c21fc40e99e71cd7c49a76470444c6e7`, tree `1b273ac7d664a807a399e3f45d677f14aae8d43a`. The repair changes only `packages/compiler/src/gpui-native-control-label.ts`: the diagnostic-buffer helper and assertions in one existing SDK case. Its original SHA-256 is `ee07845235af39b8a1fd723ba9f50ab0004093ea36b485873bc18d1be5bbe77a`; the controls-only counterfactual is `e121c08e190660001b8faa0c0a379a216df8a1b11e76096ff6dd9a411c0cc819`; the complete candidate is `f7290b713dfe98b38feafce0c894f3c16c4711e7018fc0f134d16e040291278d`.

The prepared source is tested as a working-tree change on that base. This record does not invent a later commit SHA. All 294 recorded source and fixture paths are checked against the original manifest: this is the only changed path, and all 294 final hashes remain stable through the focused continuation and archive preparation. The ordinary signed-off commit and its hook/tree verification are separate subsequent operations.

The official consumer drains the Label's diagnostics and creates a fresh current refused action. The immutable lease factory can already have recorded that same refusal during paint. The old helper used `last_diagnostic` to gate both queue insertion and stderr output; draining the queue left the stderr sentinel in place, so a fresh identical refusal was not delivered.

The repair buffers a refusal when the queue is empty or the message changes. It retains the original stderr transition throttle. Repeated identical refusals before the next drain remain coalesced; A-to-B-to-A and valid-reset transitions retain their prior behavior. It does not change pair resolution, physical-view receipts, App/Window or epoch checks, immutable request capture, or invocation authority. An earlier inactive bridge remains permanently inactive and silent after a valid pair becomes available.

The existing `inactive_action_bridge_never_acquires_a_later_valid_pair` case keeps its original assertions and adds checks through the actual factory, take, and request APIs for missing, ambiguous, and foreign-window pairings. It checks initial refusal, a fresh same refusal after draining, coalescing before the next drain, and silence and inactivity of both retained empty snapshots after repair. The SDK still contains 62 cases. The official nine-case consumer and its diagnostic assertion are unchanged.

## Preserved first failures

Both hosted first failures use head `2df421b1fc55cc0649be6675c0ee46a69ad9316f` in [run 45259712127](https://github.com/Proto-UI/Proto-UI/actions/runs/45259712127). The complete original [Ubuntu job](https://github.com/Proto-UI/Proto-UI/actions/runs/45259712127/job/137990901268) and [macOS job](https://github.com/Proto-UI/Proto-UI/actions/runs/45259712127/job/137990901202) logs each show successful production and compilation followed by eight passing official consumer cases and one failure. Both fail `one_logical_participant_with_two_physical_views_cannot_name_or_activate` at `tests/control_label.rs:53`, with the assertion “a refused current pairing must retain its diagnostic” and exit code 101.

These logs were first read through the GitHub connector and then downloaded through authenticated `gh`; the complete byte sizes and SHA-256 digests match. They are archived separately from the local repair runs. The failed physical case stopped at its diagnostic assertion; later assertions in that case are not counted as executed in these first failures.

The complete local integrated run `combined-native-union-r1`, on the base above, reproduced the same official-consumer failure. It finished at `2026-11-23T20:37:18.545558+00:00` with unchanged before/after hashes for all 294 inputs.

| Original integrated check      | Actual original result                           |
| ------------------------------ | ------------------------------------------------ |
| sdk-controls                   | 62 passed, 0 failed, 0 ignored, 0 filtered       |
| six-native-consumers           | 74 passed, 0 failed, 0 ignored, 0 filtered       |
| numeric-consumer               | 9 passed, 0 failed, 0 ignored, 0 filtered        |
| official-label-consumer        | 8 passed, 1 failed, 0 ignored, 0 filtered        |
| Eighteen compiler source files | 343 passed, 0 failed, 0 pending, 0 todo          |
| Adapter projection/state/flags | Not executed after the official-consumer failure |

Its official producer, metadata step, ordinary graph check, and default compilation had passed before the failure. The broader SDK, source, ordinary, and numeric passes above belong to that original source and run. They are retained as prior evidence, not relabelled as a complete rerun on the repaired helper.

## Actual SDK counterfactual and correction

The bounded A/B phase `diagnostic-delivery-ab-r1` finished at `2026-11-23T20:57:16.807115+00:00`. It first applied only the new assertions to the old queue helper, used the official numeric producer and metadata step, and ran the complete SDK. The raw failure is exactly the new “fresh same missing refusal after take is buffered once before the next take” assertion. Only after that expected failure did the driver apply the queue-helper change and regenerate the SDK through the same producer.

| SDK source                                | Actual result                              |
| ----------------------------------------- | ------------------------------------------ |
| Old helper with new assertions            | 61 passed, 1 failed, 0 ignored, 0 filtered |
| Corrected helper with the same assertions | 62 passed, 0 failed, 0 ignored, 0 filtered |

The red SDK receipt remains `failed` with Cargo exit 101. The outer SDK wrapper's zero exit status is not treated as a test pass. The A/B driver independently checked the inner receipt, exact raw test summary, failed test identity, assertion text, and source hashes. No generated Rust was edited, no case was removed, and no failure or deadline was converted into a skip.

## Focused follow-up

The continuation `diagnostic-delivery-followup-r1` finished at `2026-11-23T21:01:12.870656+00:00` with state `passed`.

| Selected check | Actual result |
| --- | --- |
| official-label-consumer | 9 passed, 0 failed, 0 ignored, 0 filtered; exit 0 |
| ordinary-control-label | 14 passed, 0 failed, 0 ignored, 0 filtered; exit 0 |
| adapter-projection | 19 passed, 0 failed, 0 ignored, 0 filtered; exit 0 |
| adapter-a11y-state-nodes | 2 passed, 0 failed, 0 ignored, 6 filtered; exit 0 |
| adapter-accessibility-flag-nodes | 1 passed, 0 failed, 0 ignored, 7 filtered; exit 0 |
| Three existing compiler source files | 106 passed, 0 failed, 0 pending, 0 todo across three files |

The three source files are `gpui-control-label.test.ts`, `control-label-lowering.test.ts`, and `gpui-sdk-compatibility.test.ts`. Adapter unit filters select the named two state-node cases and one combined-flags case; the manifest preserves the unrelated filtered counts. This is not a claim that the complete Adapter workspace was rerun.

The official Label producer includes BaseButton, Label, Input, and InputDelegate. The ordinary producer regenerates its full output, but the continuation executes only its 14 ControlLabel consumer cases. It does not repeat the unchanged ordinary resource/Scroll consumers, numeric consumer, or all eighteen source files. Each generated crate uses the pinned GPUI revision, Rust 1.98.1, offline locked Cargo, one build worker, the owned hot target, and a fresh short temporary directory. Node 24 and pnpm 10.32.1 are retained.

The continuation records generated files before and after its actual official and ordinary consumer invocations. The verified identity results are `{"official-label": {"beforeEqualsAfterEqualsArchive": true, "fileCount": 39}, "ordinary": {"beforeEqualsAfterEqualsArchive": true, "fileCount": 258}}`. Inventories of the original run and the two SDK output directories were captured at archive time; those inventories alone are explicitly not a historical before/after equality claim.

## Review, custody, and limits

The archived root review binds the exact source, controls/product patches, and both validation drivers. The independent S5 review covers the queue transition and immutable authority boundaries. Both are technical source reviews made before these results; neither is a GitHub APPROVED review or an execution receipt.

The [manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-gpui-control-label-diagnostic-delivery/manifest.json) records the original and candidate source maps, exact commands and statuses, raw/compressed sizes and SHA-256 digests, actual test counts, generated-file inventories, and all artifact paths. It retains the original local failure, both complete SDK generated outputs and logs, focused continuation outputs, and both complete hosted first-failure logs. Every gzip member is decompressed and verified byte-for-byte. Original phase files are rehashed after archiving and remain untouched.

This record supplies evidence for the bounded diagnostic repair. It does not claim a new macOS repair run, operating-system or assistive-technology delivery, browser retirement, a complete Adapter workspace pass, acceptance of draft host capabilities, or permission to merge. The browser production result and subsequent exact published-head CI remain separate receipts. No browser retirement timeout, native semantic assertion, or required review gate is relaxed here.
