# Intrinsics, scalar conversions, style tables, and collections

This document specifies admitted JavaScript intrinsics, compile-time data folding, Rule environment inputs, loops, and checked collection operations in the closed source language.

## Scope & Limits

- Applies to source admission and portable IR validation for the private compiler.
- Target-specific support varies by profile (see [targets-and-presentation.md](targets-and-presentation.md)); source admission does not certify unimplemented backends or component acceptance.
- All admitted builtins require an unshadowed global binding; local or imported bindings with the same name remain ordinary declarations.

## Finite string membership (`Array.prototype.includes`)

- **Static folding**: A direct literal array of finite scalars calling `.includes(scalarLiteral)` folds at compile time using SameValueZero without coercion (empty array → `false`). Holes, spreads, getters, proxies, identifier operands, optional calls, type arguments, and `fromIndex` are excluded.
- **Dynamic membership**: `array.includes(search)` accepts exactly one operand (including `unknown`) and returns `boolean`; receiver and search evaluate once in order (preserving optional short-circuiting).
- **Const string arrays & narrowing**: A nonempty string-literal array asserted `as const` retains exact literal element types in IR. At this boundary, one erased assertion to a finite string-literal union may strip from `search`. A true direct guard refines an immutable searched binding; mutable cells and saved booleans do not.

## Scalar conversions and ECMAScript value table

Draft contract [`C-COMPILER-SCALAR-0001`](../../../spec/contracts/C-COMPILER-SCALAR-0001.yaml) (mapped in [`T-COMPILER-SCALAR-0001`](../../../spec/tests/T-COMPILER-SCALAR-0001.yaml)) governs scalar coercion and math intrinsics:

| Operation | Admitted operands | Semantics & limits |
| --- | --- | --- |
| `String()` / `String(v)` | 0 or 1 checked data or `unknown` (Web); scalar-only on GPUI/Rust | Native JS coercion on Web; invalidates mutable flow observations because coercion can run user code. Rejects spreads, optional calls, constructors, callables/capabilities. |
| `Number()` / `Number(v)` | 0 or 1 checked scalar (`''` → `0`, omitted → `+0`, `undefined` → `NaN`) | ECMAScript conversion including signed zero, whitespace, radix prefixes. Rejects objects, `unknown`, callables, capabilities. |
| `Math.round(n)` / `Math.floor(n)` | 1 checked `number` | Preserves JS negative ties toward `+∞`, `-0`, non-finite values, and precision-limit integers (never Rust's tie rule). |
| `str.length` | Checked `string` | UTF-16 code-unit count (astral chars count as 2). |
| `Intl.NumberFormat`, `RegExp` literals/`.test`, string formatters, `Math`/`Number` constants | Checked finite scalar/option domains | Unshadowed globals; exact finite constants. `unknown` is never treated as checked data. |
| `AggregateError`, `TypeError` | Checked iterable/error or optional string message | Returns opaque exception; cannot smuggle owner values inside unknown fields. |
| `console.warn(...args)` | Checked scalar arguments only | Effectful, returns `void`, preserves source order; rejects objects, callables, and handles. |

Browser source profiles also admit keyed `props.watchRaw` and all-key raw/resolved watchers (verified against `C-PROPS-0011`/`C-PROPS-0012`); raw snapshots remain host-specific escape hatches, not portable resolved Props.

## Fresh-target `Object.assign`

- **Admitted shape**: Unshadowed `Object.assign(target, ...sources)` where `target` is a direct fresh record literal or `new Error(message)` and each source is a direct finite record literal (pure-data entries or static zero-parameter pure-data getters).
- **Exclusions**: Aliased, asserted, frozen, or `readonly` targets; spreads, getter targets, setters, dynamic keys, `__proto__`, callables/capabilities, arrays, scalars, nullish sources, and optional calls.
- **Semantics**: Evaluates target and sources once left-to-right, copies in order (invoking source getters), returns the original target identity, and invalidates mutable flow observations. An `Error` result stays an opaque exception. Lowered natively on Web targets; rejected on GPUI, Qt, and Flutter.

## Finite style tables, `Object.freeze`, and Rule environment facts

### Static data folding and `tw()`

- **Module data**: Shared by generated artifact instances. `const` preserves binding identity without implying deep `readonly`; explicit `Readonly` and `Object.freeze` keep readonly views. Shared `let` requires a scalar initializer and finite declared storage; containers cannot retain owner callables or capabilities.
- **Local style tables**: A flat local `const` table supports compile-time token lookup (`TABLE[key]`), template-literal folding, static `<string[]>.join(sep)`, and unshadowed `Object.keys(table)` only when the block proves the container never escapes or mutates (`__proto__` rejected).
- **`Object.freeze(arr)`**: Emits native JS freeze (preserving identity and readonly outer view; non-recursive). Frozen primitive module arrays may drive spreads, enum options, and static loop keys.
- **Trusted `tw()`**: Single-argument `tw(cond ? a : b)` lowers to a conditional over two checked static style handles (condition evaluates once). Module `tw` declarations may reference immutable module string constants; Rule builder arguments may spread literal lists after conditional lifting.

### Rule environment facts and style handles

- **Environment inputs**: Rules admit `colorScheme` and `preference.*` from draft `C-RULE-COLOR-SCHEME-0001` / `C-RULE-PREFERENCES-0001`, plus `eq` (strict equality) and `gte` (finite numeric literal threshold vs. finite numeric input). Targets emit direct predicates, never a Rule interpreter.
- **Web leases**: Browser source profiles acquire only reached native document sources while mounted (shared per document/key, `unknown` on missing/ambiguous facts), lease before style reconciliation, and release on detach/dispose.
- **Lifting & handles**: Pure captured ternaries inside `when` or style `intent` callbacks lift to setup conditionals (every branch is validated). Rule operands may reference checked `StyleHandle` parameters/fields evaluated once at declaration installation.

### Captured Set membership in Rule declarations

A declaration-time conditional inside a Rule callback can use the existing native `Set.has` intrinsic for captured membership tests.

- The receiver has a checked, non-nullable Set type. Receiver and search are pure captured expressions; neither operand comes from callback parameters or local declarations.
- Lowering retains the actual membership call and checks both branches through ordinary Rule declaration admission.
- Same-named ordinary methods, collection writes, optional calls, spreads and effectful operand calls remain outside this lifting boundary.

This combines Set semantics with captured choices. General helper-purity analysis and new Rule observers remain separate work; authored source stays unexecuted.

## Loops, destructuring, collections, and Context aggregates

| Construct | Admitted behavior | Rejected / bounded |
| --- | --- | --- |
| Static `for (const x of list)` & `list.forEach(x => ...)` | Unrolled at compile time over scalar literal arrays, module bindings to them, or `Object.keys(moduleObj)`. Unlabelled `continue` lowers via a synchronous iteration closure; tuple/`Object.entries` loops evaluate initializers once. | Async arrows, default/rest params, abrupt outer `return`/`break`/labelled jumps combined with `continue` normalization |
| Runtime loops | `for (const v of iterable)` over Array/Set/string; `while`; counting `for` with one `let` index lowered to `while` | Capturing/redeclaring counting index or `break`/`continue` in normalized counting `for` |
| Destructuring | Flat `const`/`let` object/array patterns (static keys/indices); required nonempty flat object parameter patterns (no defaults/rest) | Defaults, rest, nested patterns, computed keys, empty/array param patterns, module-scope patterns |
| Collections (`Array`, `Set`, `Map`) | Native JS lowering for checked iteration, `Array.at`/`from`, `reduce` (finite data + accumulator), `sort` (writable finite-data array + numeric comparator), `filter` (retains predicate refinement), `Set`, and `Map` (empty ctor, explicit finite-data K/V) | Storing callables/owner handles in `Map`; unlowered collection ops on native profiles |
| Context input aggregates | Checks evaluation order across provided values, direct updates, and inline updater returns so a retained shared container cannot rely on its shape past a later effectful operand | Helper-purity proofs or general alias/`finally` flow analysis; scalars and flat scalar spreads drop container identity |
