# Preview authored-prop withdrawal for native hover evidence

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

## Contract and failure

At a62ba0ba9a04498c7050cbe6707c9b13525c9851, six partial native hover captures named Accordion reenabled-item retained disabled=true and reported no-active-material-candidate. Their preferences were normal. The fixture called setProps with disabled=undefined and described that as removing the prop.

Active C-PROPS-0009 distinguishes missing raw keys from provided-empty values. The former restores defaults; the latter may preserve prevValid. Each preview renderer retained the authored key, so the original Props behavior was correct. The same incorrect fixture path would also fail to restore auto after an opaque material override. Neither a false patch nor a longer wait performs removal.

## Bounded additive API

DemoRuntimeApi gains optional removeProps(ref, names), implemented by all four built-in preview renderers. It deletes only named authored keys, then delivers the remaining host snapshot. The optional declaration preserves compatibility for external/custom APIs; the hover consumer explicitly rejects a missing capability. setProps remains a patch and keeps its defined-undefined semantics. No portable API, Core, Runtime, Compiler, IR or material guard changes.

Referenced React/Vue/Vue2 nodes now render the initialized authored props map without reapplying the original node.props. Otherwise an initially provided key would resurrect after withdrawal. WC retires callback listener projections as well as their authored keys. Unrelated props, raw callbacks, surface styling and stale-lease isolation retain their existing owners.

The hover fixture calls the real deletion capability. Its raw-removal, disabled re-enable and material-default assertions remain; they are not replaced with hard-coded false/auto values. Future native evidence must still pass the whole interaction and fallback journeys and retain the original Toggle scenarios.

## Local evidence and boundaries

Four runtime × Base/Liquid Accordion × initial missing/false/true cases produce 24 failing tests before the new capability and 24 passes after it. A separate PropsKernel test preserves the provided-empty versus missing distinction. Additional tests cover initial opaque material withdrawal, callbacks removed and re-added, unrelated props, idempotency, unknown refs and retired leases. The focused five-file regression totals 115 passes. Consumer capability tests require explicit failure for a custom API without removeProps.

These are first-party deterministic host-unit tests with installed framework modules. No browser or GPU was run locally. Earlier a62 timeouts and the partial cancelled run remain failed evidence. The docs-wide typecheck has existing unresolved diagnostics, so source-local cleanliness is not full docs acceptance. Independent review and exact-head native receipts remain required; remote writes remain paused while the owner's latest confirmation is pending.
