# Close remaining unpublished review repairs

Date: 2026-10-06. Baseline: published `973c3d7d8bcd97fe0b220696653eab996e6b1cb7` in PR #563.

## Verified gap

A live inventory contained 18 unresolved inline threads. Ten older findings had current implementation and passing focused coverage, and three newest markup findings were repaired by the baseline commit. Five older findings were still absent from that published source: window.open executable URLs (#4182138198), Animation/Layout Worklets (#4182138211), imperative native-element navigation URLs (#4186678817), completed Node-loader traversal cost (#4186678835), and native JSX stylesheet links (#4186678847). An unpublished historical candidate is not evidence that a branch contains its fixes.

New paired Website/Harness source probes on the published baseline produced 20 failures and 18 passing controls. The repaired four source-entry branches then passed 78 positive/negative assertions, including native aliases, shadowed business receivers, case-sensitive IDL versus content attributes, inert JSX text/components, static versus dynamic stylesheet attributes, and ordinary navigation URLs. These probes parse source strings; they do not execute their payloads, navigate, or register workers.

The Node-loader regression independently extracts the actual production lexical inventory and resolver. It adds a test-only lexical-lookup counter and VM deadline to isolate this resolver's cost from other scanner branches. The published baseline exceeded 20,000 lookups for each 32-assignment native/business probe. Completed-result caching reduces each to 562 while preserving opaque/native versus business results. Cache entries retain consulted binding/context dependencies and relative alias depth; cycle/depth-truncated results are not cached. Six dedicated controls and 69 existing loader fixtures pass. This is not a global scanner-work budget or a claim that every cyclic source graph has constant cost.

## Boundaries

The existing native ownership classifiers and lexical inventory remain authoritative for this bounded scan. Window open uses the existing browser-value alias/shadow model. Added Worklet names use the existing native CSS receiver classifier, including direct/member aliases; destructured Worklet receivers remain an inherited unmodeled form. DOM navigation checks apply to proven HTML/XHTML receivers, with separate case rules for IDL formAction and content-attribute formaction. JSX stylesheet checks inspect actual native AST elements and attributes rather than strings containing markup; leading-capital Link components remain outside native classification. Opaque resource values cannot certify promotion evidence.

Independent review found that reusing the markup xlink:href vocabulary falsely classified inert HTML anchor properties/attributes. The imperative a/area branch was narrowed to href, with eight Website/Harness xlink and foreign-namespace controls.

The prior commit's emitted graph policy, matrix lifecycle states and exact source bindings are unchanged. No directory or package allowance, runtime execution, credential, repository protection or human-review override is introduced.

## Governance reconciliation

The new #420-linked rows reuse two existing accountable Website roles, but the per-Issue snapshot did not yet associate those tokens with #420. Its exact-match drift workflow correctly rejected that omission. Read-only public GitHub data for all 27 dependency Issues and the one referenced PR was fetched and reconciled through the existing normalization/reconciliation functions. All live metadata matched; the only resulting snapshot changes are the two explicit #420 owner tokens. This changes recorded row accountability, not GitHub assignees, access, repository rules or actual ownership permissions.

## Validation status

Full coverage tests and the current-source gate run separately against the final tree before publication. Remote checks, thread closure, and independent review remain exact-head work; this record does not assert them completed. Checker and metadata changes use source-bound executable evidence rather than unrelated UI screenshots.
