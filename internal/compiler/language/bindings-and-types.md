# Bindings, module cycles, and erased types

This document specifies how the closed source-language frontend resolves declarations, module graphs, external source identities, and compile-time type queries.

## Scope & Limits

- Applies to the private compiler frontend and portable IR validator; it is not a complete TypeScript checker or a public API guarantee.
- Source admission never imports or executes authored modules. Source bytes are provenance, not a runtime fallback for unsupported syntax.
- Current-source admission does not accept historical private IR candidates (such as IR10).

## Binding identity and normalization

Semantic authority belongs to a resolved declaration, never a spelling alone:

- **Core imports**: An imported `@proto.ui/core` type or factory (including `FocusRequestOptions`) keeps its identity through local aliases and named re-exports. A same-spelled local declaration remains ordinary.
- **Setup functions**: A setup function may be a method, declaration, arrow, function expression, or static alias. Importing or re-exporting preserves its lexical owner and free-binding resolution.
- **Module aliases**: Admitted for static functions, admitted package symbols, and checked finite static data. Scalar aliases (`const saved = mutable`) have snapshot semantics and require a supported initializer.
- **Erased assertion chains**: A contiguous assertion chain may pass through `unknown` only when every intermediate assertion passes admission and the final nominal capability type equals the original checked type. The compiler emits the original expression once, preserving `readonly` and without recovering authority from `unknown`.
- **Callback parameter constraints**: Unannotated callback parameters inherit constraints from a resolved operation's receiver capability and argument schema; conflicting constraints are rejected.
- **Dormant bodies**: Unreached bodies acquire no emission obligation, though direct calls to explicitly typed callable parameters with all-literal arguments still undergo closed argument-contradiction checks.

```ts
// Resolved binding keeps Core identity; same-spelled local property does not.
import { type FocusRequestOptions as FocusOpts } from '@proto.ui/core';
```

### Inert module cycles and static callable selection

| Construct | Admitted | Rejected |
| --- | --- | --- |
| Runtime import cycles | Complete declaration tables containing only inert functions, immutable literals, or static callable selections | Mutable module storage, static Core factories, accessor objects, wildcard export cycles, arbitrary initializer calls, back-edge to partial table |
| Immediate initializer order | Checked in ESM dependency DFS postorder and statement order; function declarations link-hoist | Direct cross-module reads before initialization (`PUI1008`), including `export default fn` snapshots of hoisted functions |
| Static callable selection | `const fn = cond ? modFnA : undefined` (or two module functions) where `cond` is a boolean literal, immutable literal boolean ref, or literal scalar membership | Mutable snapshots, arbitrary calls, callable containers, owner-created closures |

Portable IR independently rechecks that immutable callable chains root at checked module functions or `undefined`. Native module partitioning keeps aliases beside helpers that require the current owner, and unselected helpers never publish exposures.

## Explicit external source identities

File and project compilation may accept a bijection mapping canonical external source-tree root directories to unique logical identifiers:

- Roots must be existing directories disjoint from the project root and from each other.
- Logical source identity combines the root identifier with the relative package/file path; manifests and unresolved lookups use the same key.
- Logical-location collisions reject. Installed copies are never coalesced by package name, version, or content hash.
- Physical dependency inventories, package `proto` export rules, and local-edge boundaries remain unchanged.

## Erased type graph

The type resolver loads syntactically required local type edges (including barrel named/star value re-exports for value queries) without admitting type-only files as executable code. Unused type-only imports require no source bytes. Every file used in semantic resolution enters provenance.

| Erased query / utility | Admitted domain | Explicit exclusions |
| --- | --- | --- |
| `(typeof CONST_TUPLE)[number]` | Module `const` array literal asserted `as const` (no widening annotation) of string/number/boolean/null literals; collapses duplicates; empty tuple → `never` | Runtime arrays, mutable/widened declarations, element refs, spreads, holes, nested containers |
| Value queries & `ReturnType` | Checked lexical values, finite static data in admitted modules, ordinary callables, registered Core operations, nongeneric module function signatures | Loading erased-only modules as runtime code; recovering capabilities from `unknown` |
| `keyof`, mapped fields, `Pick`, `Omit` | Ordinary finite records (preserving field permissions); `Pick` on nominal Core handles when every key is a declared public member | Treating `Pick` on a handle as a runtime authority restriction |
| `NonNullable<T>` | Removes `null`/`undefined` from checked domains; keeps `false`, `0`, `''`, `readonly`, nested nullability, nominal handles (authored aliases win over builtin) | Opaque `unknown`/`any` inputs |
| `Extract` / `Exclude` | Selects complete members of a finite checked union via structural constraints | Stripping extra fields, callbacks, owner handles, or `readonly` permissions |

## Width subtyping, readonly views, and evaluation boundary

- **Authority preservation**: Structural width subtyping may omit extra pure-data fields, never callable or owner-capability fields. Annotations, assertions, or assignments that hide authority-bearing fields reject in both frontend and portable IR.
- **Readonly permissions**: `readonly` field and collection views survive aliases, defaults, calls, and assertions. Object spread creates a fresh mutable top-level record; writes through a mutable alias invalidate flow observations on the same field.
- **Coarse `record` marker**: Raw Props snapshots (`run.props.getRaw()`, renderer raw reads, raw watcher snapshots) and opaque watcher metadata expose static member reads as `unknown`, without proving key presence, materializing defaults, or allowing writes.
- **Top-level runtime calls**: Limited to statically admitted declarations (even through factory aliases). Normalization tests verify identical semantic IR (ignoring spans/provenance) across renaming, aliases, re-exports, and local shadowing while preserving full source provenance.
