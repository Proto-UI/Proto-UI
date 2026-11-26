# Finf rule-state compiler reconciliation

Status: source-stage compiler regression repair; not native or full prototype admission.

The full source run first rejected the Shadcn Button size callback's setup-time ternary as an unmodeled condition. Rewriting only that size choice into two existing DSL rule shapes preserves all eight size/wrap combinations and fixed icon density. The scanner and its fail-closed operator/helper controls are unchanged. The original Button behavior controls pass before and after this rewrite.

After that first blind spot was removed, the same gate exposed missing real mappings for `asCollapsibleTrigger`, `asAccordionTrigger`, `asFieldTextControl` and `asFieldLabel`. Their mappings now follow the actual Base `expose.state` identities. Accordion's `collapseBlocked` remains distinct from disabled. Field's `required` alias retains the declared `fieldRequired` semantic and therefore uses `data-field-required`; it must not silently become `data-required`.

Verification: 88 tests across the complete 77-case lowering suite, three Button tests (including all eight size/wrap combinations), and eight four-adapter Shadcn Dialog tests pass. New end-to-end fixtures invoke the real token extractor, verify the required alias does not emit the wrong selector, and retain unknown-hook/state rejection. Existing raw negative logs preserve both the initial ternary failure and the subsequently revealed mapping failures. Canonical style token generators produce the newly reachable variants; no gate, grammar or threshold was weakened.

These checks establish bounded source/token behavior. Exact-head browser paint, native GPUI capability and full Finf acceptance remain separate gates. The next integrated package budget must be measured again.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
