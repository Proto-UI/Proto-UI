# PR #1743: bound Entry projection to relevant form notifications

This repair preserves the existing draft Focus Entry eligibility rule and its native form/CSS dependencies. It changes the Web Component Adapter's projection-event attribution; it does not change the compiler preview's 250 ms cleanup deadline, input stream, acknowledgement semantics or cancellation behavior.

## Observed boundary and repair

The original production preview failure on `48ebbaa7139e5caf7730659ae827049a93e97ea3` remains a failure. A separate, bounded Chrome trace of that same sealed build recorded 331 input callbacks and 6,993 Entry projection callbacks. The sampled Entry path occupied approximately 608.5 ms before a posted task could run. These callback counts do not establish 21 independent owners: one capture callback may be invoked at multiple ancestors. The diagnostic process reached its outer resource bound and is not a passing native acceptance run.

Native form events can flush microtasks between capture listeners, so the existing microtask coalescing is insufficient to exclude repeated, unrelated qualification sampling. The repair only excludes trusted `input` and `change` notifications whose origin is outside the current observed owner and Portal roots, and only when the existing dependency graph establishes no external form-state, radio, image-map, slot or opaque stylesheet dependency. Both the projection-event and window-change channels use the same predicate. Synthetic or unknown-origin notifications retain the original conservative path.

Input-state detection reads CSS selectors and grouping conditions, decodes CSS escapes, and preserves conservative handling of unknown or inaccessible rules. Declaration text is not a selector. No paint-only inference or cross-owner global cache is introduced. Media-query changes, internal inputs, active dependency changes, disable and cleanup retain their existing ownership behavior.

## Independent review and slot correction

Independent review found a P2 in V2: an Entry wrapper inside an open ShadowRoot may contain a slot whose assigned radio is a logical descendant but is not physically contained by the observation roots. The same roots can miss its external same-group radio dependency. Trusted checkedness notifications could therefore leave self fallback stale.

Three fixed controls reproduced that gap without added CSS, visibility or `assignedSlot` injection. They use real `assignedNodes()`, the intrinsic checked setter and actual resolver; explicit `isTrusted` injection remains a Happy DOM branch model. V2 passed the original 14 controls and failed all three new controls. V3 retains the previous conservative input/change behavior when an observed root is itself a slot or contains slots. It does not change slot resolution, physical observation roots, radio ownership or public API.

Independent review verified the same-fixture red/green pair, complete source snapshots and immutable V3 patch. The P2 is closed in this bounded source and host-model scope, with no remaining blocking finding in that narrow review. This remains separate from final-head platform approval and native timing acceptance.

## Fixed-fixture evidence

The implementation and fixtures were prepared against `1af0cda3f5976bb21ea67f6d083053b8ed20d83d`. The incoming main merge did not change `packages/adapters/web-component/src/runtime/modules.ts`. Integration onto `11fd3d61aa8d408027752efcf57482d9dcb76450` preserved the independently reviewed V3 implementation, applied repository formatting, and executed the same complete 95-case selection.

| Actual execution | Result |
| --- | --- |
| Original implementation, final 14 controls | 3 failed / 11 passed; unrelated sampling remained observable |
| Original implementation, 78 related controls | 78 passed |
| First candidate, unchanged 92 controls | 90 passed / 2 failed; existing CSS rule compatibility regressed |
| Second candidate, same 92 controls | 92 passed / 0 failed / 0 skipped / 0 TODO |
| Second candidate and the four actual test files, focused TypeScript graph | Exit 0 |
| V2, fixed 17 controls including the three new slot cases | 14 passed / 3 failed |
| V3, fixed 17 new plus 78 retained controls | 95 passed / 0 failed / 0 skipped / 0 TODO |
| V3 and four actual test files, original focused TypeScript configuration | Exit 0 |
| Formatted V3 integrated on the main merge, same 95 controls | 95 passed / 0 failed / 0 skipped / 0 TODO |
| Integrated prototype catalog and its original bounded-map controls | Exit 0; 7 controls passed |

The failed candidates and all earlier fixture iterations remain archived. The final integrated production source SHA-256 is `ae8b40ded8b8fd7e3b741d89fc21eacefee4a14f4a65880ef032d953d6e20077`; the unchanged final fixture SHA-256 is `15a79e8ad0a63373731389dc4358b3dbc0b6e82b6a078c56b0664ba5c4f539d9`. The integrated 95-case log SHA-256 is `47850eaed5fd88bd993621f4488dc783d9c2f523584dfc87e178c8ec68232805`, and its structured result SHA-256 is `2f4b5dca28722a46f625c50a85c1327798f9baedece1c090d6f3c8c49d401429`.

The fixture explicitly injects `isTrusted` in Happy DOM to exercise the guarded branch. It does not simulate native event scheduling. Its three exclusion cases and fourteen preservation cases are bounded implementation evidence, not a claim that the original production preview now meets 250 ms.

Only an executable implementation mapping is added to existing `T-FOCUS-SCOPE-0001-CASE-ENTRY-ELIGIBILITY-MUTATIONS`. The entity's draft lifecycle and normative criteria remain unchanged.

## Preserved evidence and remaining acceptance

The [original V2 raw archive](evidence/2026-11-23-pr1743-focus-entry-form-origin/raw.tar.gz) is **401,169 bytes**, SHA-256 `483d5b33d7d60562e6e9a9389043381603aebbbe69e77311c3bab61b3ad17565`. Its 75 members retain the source snapshots, all actual red/green logs and result JSON, focused type receipt, immutable patch, authority and reproduction records, and the actual test-to-validation handoff.

The [V3 supplement](evidence/2026-11-23-pr1743-focus-entry-form-origin/v3-supplement.tar.gz) is **187,475 bytes**, SHA-256 `533dc02a81c404b6303b8752660a3e95760a698096f2dd9bdaa783ba0055f7cb`. Its 41 members preserve the slot red/green results, all source snapshots, original focused type configuration and result, owner apply guard, independent V2 finding and actual V3 test handoff. The separate [independent V3 source review](evidence/2026-11-23-pr1743-focus-entry-form-origin/v3-review.tar.gz) is **9,517 bytes**, SHA-256 `b19a9ffcdb2aa31f8c10816a12009d8bd93cf586cfa1ea19614321c8a0e291e3`.

The [integration archive](evidence/2026-11-23-pr1743-focus-entry-form-origin/integration.tar.gz) retains applied source bindings, formatting observations, integrated 92- and 95-case receipts, logs and result JSON. The [integration supplement](evidence/2026-11-23-pr1743-focus-entry-form-origin/integration-supplement.tar.gz) preserves the later catalog result and independent post-format review. The adjacent [manifest](evidence/2026-11-23-pr1743-focus-entry-form-origin/manifest.json) binds all archives. The post-format review confirms the final implementation, test and existing-case mapping, while preserving its observation and correction of an earlier V2-only draft of this record.

Original compiler source regressions, production build and native preview acceptance remain required on the final integrated source. The independent narrow source review and final exact-head review are separate from these executed fixtures. Historical native passes from other source revisions are not relabeled as final-head acceptance.
