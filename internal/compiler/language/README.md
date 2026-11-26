# Compiler source-language specifications

Topic-scoped admission rules for the private compiler's closed source language. Start with [../source-language.md](../source-language.md) for the top-level contract and target matrix.

| Spec | Topics covered |
| --- | --- |
| [bindings-and-types.md](bindings-and-types.md) | Binding identity, inert module cycles, external source roots, erased type graph, width subtyping, readonly views, evaluation boundary |
| [intrinsics-and-data.md](intrinsics-and-data.md) | Finite string membership, `String()`/`Number()`/`Math` scalars, `Object.assign`, style tables & Rule environment facts, static loops, collections, destructuring, Context aggregates |
| [functions-and-hooks.md](functions-and-hooks.md) | Closures, callable effect analysis, helper specialization, object getters, `defineAsHook`/`defineHook`, `stateHandles`, Anatomy selectors, recursion envelope, mixed value unions |
| [targets-and-presentation.md](targets-and-presentation.md) | Target-profile support matrix, Flutter capture boundary, `feedback.style.presence`, `feedback.material.shader` & owned-scene host capability |
