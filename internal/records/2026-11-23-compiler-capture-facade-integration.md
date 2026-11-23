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

## Integration gates

The incoming native text/notification branch is preserved through f624e0f99db0a43c5d676c4e8322630ae05c8108. It retains the original native notification, owner identity and renderer-adapter regressions while adding AccessKit text selection, raw-props convergence and the full source CI lane.

The native key boundary respects a descendant's prior default-action cancellation before root key-down intent synthesis. Raw host observation and all key-up terminal cleanup remain available. It does not introduce an Overlay-specific policy or change Enter/Space commit timing.

- [x] Execute the bounded source and four-Web-target regressions above.
- [x] Add tracked native capture fixtures and explicit CI execution.
- [ ] Execute the final integrated source, native SDK and ordinary consumer matrix.
- [ ] Verify the final pinned Verdant artifacts and complete application/OS matrix.

These are verification steps, not a substitute for original-author contribution rights, DCO or independent review. Native TestAppContext results do not claim physical OS input or assistive-technology acceptance.
