# Checked capture facades and native consumer integration

Date: 2026-11-23

The user-directed Verdant Compiler migration exposed a public asInputRoot delegate that the compiler rejected at its checked capture spread. The official InputRoot source remains unchanged. This record binds the repair to the existing draft C-AS-HOOK-0005, C-AS-HOOK-0006, C-AS-HOOK-0007 and C-AS-HOOK-0009 definitions; it does not promote their lifecycle or declare a complete stable compiler profile.

The parser admits finite public capture projections, and standalone IR validation re-derives their shape from checked contributions. Opaque effect receipts cannot become JSON or arbitrary records. Externally supplied callback parameters cannot invent keyed getter-return metadata. Actual derived getters, methods and borrowed state references retain their identity. Child raw results and projected handles remain distinct and child states are not automatically flattened.

Web and GPUI capture managers record only setup operations that succeeded and preserve real unsubscribe tokens and setup-only disposer boundaries. Vue 2 and GPUI resolve projected render callables at compile time. The output contains target-native callbacks, not a runtime IR interpreter or component-name protocol. The new ordinary native fixture physically mounts the shared facade and projected null, text and number renderers.

## Source evidence before incoming-branch integration

Baseline: a7e88435f943b9e8fe993e324d455a97dc5b3bb2, with source changes recorded separately.

- Final facade/runtime group: 53 assertions passed in five files, including seven actual consumer cases across all four Web source targets.
- Affected provenance group: 144 assertions passed in six files. An earlier attempt completed 138 assertions but could not collect the last file because the temporary filesystem was full. The unchanged file passed all six assertions with a private temporary directory; the failure is retained.
- Focused TypeScript compiler/import closure: exit 0.
- Fresh facade and projected scalar output: generated successfully; Rustfmt 1.98.1 parsed all 15 Rust files. This is syntax evidence, not native typechecking or execution.
- The earlier 286-assertion run predates the final renderer and incoming-lookup changes and is not the final-candidate full suite.

## Integrated compiler and native corrections

The incoming native text/notification branch is preserved through f624e0f99db0a43c5d676c4e8322630ae05c8108. It retains the original native notification, owner identity and renderer-adapter regressions while adding AccessKit text selection, raw-props convergence and the full source CI lane.

The native key boundary respects a descendant's prior default-action cancellation before root key-down intent synthesis. Raw host observation and all key-up terminal cleanup remain available. It does not introduce an Overlay-specific policy or change Enter/Space commit timing. A focus-subtree exit retires a held native press; movement between native children in the same subtree does not cancel it. Direct root blur and subtree exit consume the lease once.

Standalone IR checking now requires the complete checked lookup map, including its exact cardinality. It cannot accept a forged narrower map and thereby grant a projected getter a different authority. Copied and forwarded child renderers retain the provenance of the checked raw capture. Known-nullish optional access contributes undefined; unknown receivers remain unknown. No recursive-helper or spread-overwrite admission was added on the basis of an unconfirmed hypothesis.

Web Component source emission now gives a zero-argument renderer its existing native frame. String, number and null renderer results keep their normal renderer meaning; ordinary zero-argument helpers and exposed methods keep their scalar return values. The document guard and native-child ownership checks remain intact.

## Bounded execution checkpoint before exact-source CI

These local results identify their own inputs and do not substitute for the complete workflow on the commit containing this record:

- A source-derived negative probe at 0d6c0f6badc1a543670cc073a308400e173365a6 admitted all six forged narrower lookup cases. The repaired lookup and notification group passed all 10 tests without skips.
- The six zero-argument scalar Web Component cases failed in four string/number cases before the repair; both null controls passed. After repair, all 35 browser cases and all 15 renderer-alias cases passed without skips. The alias cases cover the actual source/IR emitters and four executing Web runtimes.
- Fresh generated GPUI capture consumers passed all seven cases, including the three direct/copied/forwarded child renderer paths. All five mounted delivery regressions passed.
- The subtree-exit case produced a real pressed-state assertion failure on fresh 0d6c0f6 output and passed on fresh repaired output. Both use the same corrected test dispatcher. The earlier window reentrancy panic was a fixture error and is not causal negative evidence.
- The first complete ordinary-consumer rerun passed 45 of 46 cases. The remaining resource assertion still expected three subscriptions; the added subtree listener makes the real count four. Only that expected count changed. The plain/ordinary no-unrelated-resource controls remain.
- The first canonical default-SDK run passed 49 of 53 tests. Three new native-key fixtures used a window helper that held the root while dispatch synchronously rendered it; they now dispatch through AppContext, retaining every input and behavior assertion. The remaining fixture incorrectly compared callback wrappers belonging to two different public receivers. It now preserves the raw captured getter identity check, each receiver's stable public getter, identical returned live methods, and disposal rejection on both paths. Public projection remains receiver-aware, matching the existing Web callback binding; production caching was not changed.

The ordinary producer emits 37 actual source units. The workflow executes its ordinary, delivery and capture-facade consumers, the numeric and sequential-focus consumers, the complete emitted SDK tests, official Button/Label consumers, the full compiler source directory, public Input browser journeys, types, documentation and catalog checks. Exact final commit identities, commands, outcomes and any existing skipped host conditions are retained by `.github/workflows/compiler-gpui-source-consumers.yml` and reported with the integration PR. Verdant pins a clean immutable compiler commit and separately verifies fresh artifacts, full application/SDK configurations and packaged OS input.

This checkpoint does not promote the draft asHook contracts or the experimental compiler profile. Execution evidence is not original-author contribution-rights certification, DCO or formal independent acceptance. Native TestAppContext results do not claim physical OS input or assistive-technology acceptance.
