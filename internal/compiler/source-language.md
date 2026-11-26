# Closed source language

The private compiler parses and resolves authored Proto UI TypeScript inside a closed source graph—never importing or executing input modules—and independently revalidates the resulting portable IR before target emission.

## Scope & Limits

- This contract governs the private compiler under `packages/compiler/**`; it is not a published TypeScript compatibility guarantee, a public API promise, or proof of downstream component/consumer acceptance.
- Source admission, portable IR validation, and per-target native emission are distinct gates. Admitting syntax in the frontend does not imply support on GPUI, Qt, Flutter, or SSR.
- Historical private IR candidates (such as IR10) remain outside current-source admission.

## Specification modules

| Area | Detailed spec | Core guarantee |
| --- | --- | --- |
| Bindings, module cycles & erased types | [language/bindings-and-types.md](language/bindings-and-types.md) | Resolved declarations own authority. Covers inert cycles, static callable selection, external roots, erased type queries, width subtyping, and `record` raw-Props reads. |
| Intrinsics, scalars, style tables & collections | [language/intrinsics-and-data.md](language/intrinsics-and-data.md) | Unshadowed `includes`, `String`/`Number`/`Math` (`C-COMPILER-SCALAR-0001`), fresh `Object.assign`, style tables & `tw()`, Rule leases, loops, destructuring, and `Array`/`Set`/`Map`. |
| Functions, hooks, analysis & recursion | [language/functions-and-hooks.md](language/functions-and-hooks.md) | Closures, callable-effect traversal, helper specialization, object getters (IR8), `defineAsHook`/`defineHook`, definite `stateHandles`, Anatomy selectors, recursion bounds, and `value-union`. |
| Target profiles, presentation & shaders | [language/targets-and-presentation.md](language/targets-and-presentation.md) | Target matrix (React/Vue3/Vue2/WC/GPUI vs. Qt/Flutter/SSR), Flutter capture boundary, `feedback.style.presence`, and `feedback.material.shader` (`owned-scene`). |

## Core invariants shared across every section

1. **No author code execution**: Compile-time folding (`as const` tuples, literal `includes`, style tables, static `for...of`, shader graphs) inspects AST/IR statically without evaluating authored JavaScript.
2. **Source-free portable IR revalidation**: Portable IR independently checks binding identity, initialization order, readonly/authority permissions, getter tags, `stateHandles`, callable effects, and intrinsic domains without trusting serialized source claims.
3. **Zero component-name dispatch**: Shared Core syntax, authored packages (`proto` exports / `sourceImports`), and hooks lower generically through IR; no component-specific protocol or runtime interpreter is emitted (see [atomic-lowering-completion.md](atomic-lowering-completion.md)).
4. **Full source provenance**: Every executable and erased-type file consulted during semantic resolution stays in provenance; normalization tests verify identical semantic IR across renaming, aliases, re-exports, and local shadowing.

## Related references

- Thin-compiler delivery standard: [atomic-lowering-completion.md](atomic-lowering-completion.md)
- Scalar contract & test mapping: [`C-COMPILER-SCALAR-0001`](../../spec/contracts/C-COMPILER-SCALAR-0001.yaml), [`T-COMPILER-SCALAR-0001`](../../spec/tests/T-COMPILER-SCALAR-0001.yaml)
- Directory overview & generated inventories: [README.md](README.md)
