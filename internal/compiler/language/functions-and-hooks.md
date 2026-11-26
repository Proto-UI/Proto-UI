# Functions, hooks, callable analysis, and recursion

This document specifies closure semantics, callable-effect provenance, helper specialization, object getters, hook installation (`defineAsHook`/`defineHook`), recursion bounds, and mixed semantic value unions.

## Scope & Limits

- Governs compile-time source admission and portable IR validation in `packages/compiler/**`.
- Callable analysis limits (128 active invocations, 16,777,216 store/fingerprint visits) are private compiler analysis bounds, not restrictions on legal Proto UI authored behavior.
- Source admission alone never establishes full phase-safety across every native backend or proves termination of recursive user code.

## Closures, initialization order, and dead-declaration deferral

- **Lexical closures**: Creating, returning, aliasing, or passing a function never runs its body or starts a lifecycle phase. Parameter bindings exist before left-to-right defaults run. Captures bind to declarations (including later `const`), while direct reads before lexical initialization fail admission.
- **Conservative deferral**: Source admission may defer a local function's body/defaults only when a binding-use proof shows every reference stays inside an unused declaration closure (synchronous shape and explicit types are still checked; source bytes/hashes stay unchanged; no dummy IR is emitted).
- **Forward result inference**: Fixed operation signatures (e.g., Context unsubscribe `() => void`) participate in forward binding inference without running initializers.
- **Flow predicates**: Closed single-expression predicates over stable operands (`===`, Boolean ops, `typeof`, `Number.isFinite`) may inline flow facts; bare type predicates (`value is number`) prove nothing. Mutable writes, host writes, and exception paths invalidate affected observations.
- **Computed member reads**: Non-optional computed reads with a proven immutable scalar key evaluate receiver and index once in order (preserving captures/init checks); optional access skips index evaluation on nullish receivers.

## Callable provenance and effect analysis

Source admission and portable IR share one static traversal over lexical bindings, arguments, defaults, aliases, returned closures, and record members:

- **Execution context**: Registered callback signatures establish callback context; returning or storing a function does not. Setup writes apply in order, while registered callbacks and setup-returned render functions stabilize against one shared mutable store (handling repeated arbitrary invocation orders).
- **Event payload optimization**: When every actual emit of a declared event omits its payload or passes `undefined` directly, callable and phase analysis still runs without JSON aggregate tracking. Any other expression (even declared `void`) keeps full data-provenance checking.
- **Untracked vs. tracked values**: Untracked pure-data values carry data facts; stored closures, records, cells, and captures are always traversed regardless of type annotations so alias writes cannot hide effectful callables. Union alternatives keep independent facts.
- **Props validators & spreads**: Checked Props validators retain their real closures (running after schema/range checks on JS hosts; rejected on targets without lowering). Optional, defaulted, and final rest parameters preserve JS evaluation order; dynamic spreads are admitted after fixed parameters, into a rest tail, or at a nominal public-method boundary.

## Helper specialization

| Specialization form | Admitted rule | Boundaries |
| --- | --- | --- |
| Structural record subset | Closed ordinary helper specializes a parameter to the caller's full checked record shape, preserving hidden callable/capability fields and `readonly` views. | Never applies to casts, assignments, aliases, or `unknown` parameters. |
| Nominal handle subset | Closed helper interface may list a subset of declared capability members/simple methods from the shared operation table; IR retains the real nominal handle. | Callback-bearing or arg-dependent methods without proof reject; structural records cannot forge nominal authority. |
| Immutable local helper | Known immutable local helper with required ordinary params rechecks the closed graph with a retained nominal argument (no cloning per call). | Mixed nominal payloads, mutable helpers, optional/default/rest params, unresolved recursion, and open callers reject. |
| Authored-hook options | Closed options expression retains concrete types of generic `unknown` slots (including callback inputs/outputs) before checking the hook body. | Lexical only; preserves hook name and once-per-owner identity. Contextual `void` cannot hide a callable/capability return. |
| `unknown` module-helper param | Keeps its own guard obligation; finite data containers may retain full checked shape + nullish alternatives for helper identity. | Never turns `unknown` into checked data without a guard. |

## Ordinary object getters

- Object literals may declare zero-parameter getters with a static identifier or string key (`accessor: 'get'`, readonly field view). Creation does not call the getter; member reads, spreads, and admitted `Object.assign` sources invoke it (copying into writable data fields).
- Functions that always throw may declare a non-void return type. Setters, `this`, computed keys, and numeric getter syntax remain rejected.
- Getter reads invalidate mutable flow facts and enter callable-effect analysis. Primitive snapshots may cross public boundaries; objects still containing getters cannot. Static module getter objects cannot depend on owner-local operations.
- Portable IR8 adds optional accessor tags (rejected by older readers). Web targets emit native JS getters; GPUI (`PUI4003`), Qt/Flutter (`PUI4001`), and pure Rust data paths reject reached getters.

## Hook installation (`defineAsHook` and `defineHook`)

- **Installation identity**: `defineAsHook` takes no options and installs once per declared hook name per owner (even across multiple lexical declarations). `defineHook` keeps its options type, mode (`once`, `multiple`, `configurable`), `setup(def, options, api)`, and optional `configure(api, options, tools)`.
- **Capture lookup**: `getState`, `getMethod`, `getAsHook`, and `getAsHookHandle` perform read-only lookups usable after setup; calling a returned method checks its execution context. Raw captured methods run synchronously during projection/setup and gain owner callback guards when exposed. Unknown keys include all possible targets plus `undefined`.
- **Definite `stateHandles`**: At setup end, the runtime freezes named state handles (read by both `stateHandles` and `getState(key)`). With one hook declaration, a state is definite (required) only when every normal/return path declares it or exposes it from `asFocusable()`. Other states are optional; zero yields `undefined`.
- **Descriptor & Core reuse**:
  - Descriptors may declare `modules: <hook>.modules` from a static `defineHook`/`defineAsHook` declaration.
  - Authored packages participate via `proto` package exports or `sourceImports` (no hardcoded Transition component logic).
  - Runtime Anatomy selectors (`has`, `partsOf`, `indexOfSelf`, `prevOfSelf`, `nextOfSelf`) accept a literal role or finite nonempty string-literal union.
  - `State<T>` preserves Owned/Borrowed/Observed authority (refinable via native `in`); `state.enum` finite values propagate through immutable aliases and closed helpers; `run.lifecycle` retains nominal identity for `setPresent` on Web targets (never accepted in public method inputs).

## Recursive functions and analysis resource envelope

Ordinary recursive helpers have no blanket `PUI4005` rejection (recursive hook installation stays rejected). Re-entry into an active invocation yields unknown provenance; exceeding bounds emits an explicit unsupported-admission diagnostic without producing approximate output:

| Limit | Bound | Behavior on exhaustion |
| --- | --- | --- |
| Active checked invocations | 128 per pass | Explicit admission diagnostic with source span |
| Counted store/field/fingerprint visits | 16,777,216 per pass | Checked before allocating store copies/joins |
| New-state worklist & capture fingerprints | 8,192 (independent) | Explicit admission diagnostic |
| Demand-only traversal on opaque/cyclic edge | Conservative fallback | `checkTargetOperations` visits all remaining module/setup/hook bodies so support cannot be elided |

Unreachable authored-hook calls proved dead by closed demand analysis still emit checked result types and argument evaluation into an explicit unreachable-call failure (never an empty hook fallback).

## Mixed semantic value unions

`joinValueTypes` keeps distinct non-data alternatives as `value-union`. Assignment requires every actual alternative to satisfy the expected type; member access checks every alternative; calls require matching signatures across non-nullish alternatives (optional calls skip only nullish members). Emission remains target-specific (JS, GPUI, Qt, Dart) and requires per-target verification.
