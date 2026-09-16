# feedback.style.use — Setup-only Contract (v0)

## 1. Purpose

This contract defines the **author-facing API boundary** for recording style intent via feedback.

This setup API records **static style intent tokens**. Runtime patching is separately governed by [C-FEEDBACK-STYLE-0005](../../../spec/contracts/C-FEEDBACK-STYLE-0005.yaml). It does not express conditions, selectors, priorities, or realization strategy.

The intent recorded here is later composed with rule, expose, and adapter, but this contract intentionally limits what authors can express.

---

## 2. API Shape

### Author-facing API (setup phase)

```ts
def.feedback.style.use(...handles: ProtoStyleHandle[]): unUse
```

- `ProtoStyleHandle` is a notation for expressing style intent.
- The returned function `unUse` removes the contribution of this `use` call from the merge inputs.
- This API is only available during the **setup phase** (`def`).

---

## 3. Setup-only Constraint

### 3.1 Allowed Timing

`def.feedback.style.use` **MUST** be called during prototype setup.

Calling `use` outside of setup **MUST throw**.

This includes (but is not limited to):

- event handlers
- runtime callbacks
- effects
- rule evaluation
- any post-mount execution

Silent no-ops or warnings are explicitly disallowed.

---

### 3.2 unUse Semantics (setup-only)

The `unUse` function exists to support **setup-time removal** of unwanted style intent.

Typical use cases include:

- removing default styles introduced by third-party composition
- selectively opting out of inherited style intent during setup

Rules:

- Calling `unUse` outside of setup **MUST throw**.
- Calling `unUse` MUST remove exactly the handles introduced by the associated `use` call.
- After `unUse`, the merged style intent MUST be re-evaluated as if the corresponding `use` call never occurred.

`unUse` is **not** a runtime update mechanism and **not** a lifecycle disposer.

Repeatable view unmount suspends host effects while preserving logical contributions. Terminal instance disposal clears Feedback state; neither operation uses author `unUse`. See [M-FEEDBACK-0001](../../../spec/modules/M-FEEDBACK-0001.yaml) and [C-LIFECYCLE-0006](../../../spec/contracts/C-LIFECYCLE-0006.yaml).

---

## 4. Accepted Style Handles (v0)

### 4.1 Supported Handle Kind

In v0, feedback.style supports a **single notation**:

#### Tailwind-style Token Handle (`tw`)

```ts
{
  kind: 'tw'
  tokens: string[]
}
```

- `tw.tokens` are **Tailwind-flavored style intent tokens**.
- Tokens describe _what kind of visual intent exists_, not how it is realized.
- Tokens do not imply class-based or CSS-based rendering.
- How tokens are translated into host output is the adapter’s responsibility.

---

### 4.2 Explicitly Unsupported Handle Kinds

The following are **out of scope** for v0 and MUST NOT be accepted:

- Conditional or dynamic handles (`when`, predicates, expressions)
- Selector-based syntax
- Pseudo-class or pseudo-element syntax
- Host-specific variants or cascade controls
- Inline style declarations

Support for these features, if any, must be introduced by higher-level modules (e.g. rule) or adapter compilation strategies.

---

## 5. Token Syntax Rules (`tw.tokens`)

Feedback records **intent**, not **compiled output**.

### 5.1 Forbidden Syntax

A `tw` token MUST NOT contain:

- `:` (variant / pseudo / selector syntax)
- `&`, `>`, `#`, `.` (selector operators)

Tokens containing any of the above **MUST throw**.

---

### 5.2 Allowed Arbitrary Values

To preserve expressive power, **controlled arbitrary values** are allowed.

A `tw` token MAY contain bracket values (`[...]`) if all of the following hold:

- The bracket appears as part of a known token pattern (e.g. `w-[2px]`, `h-[var(--x)]`, `translate-x-[10%]`)
- The bracket content MUST NOT contain:
  - `:`
  - whitespace

- The bracket content is treated as an opaque value

This allows custom values while preventing selector or variant injection.

---

## 6. Recording Semantics

### 6.1 Accumulation

Each call to `def.feedback.style.use` contributes tokens to the feedback manager’s merge inputs.

- Calls are accumulated in order.
- Token order across calls is preserved.
- Later tokens may override earlier ones according to merge rules.

---

### 6.2 Determinism

Given the same sequence of `use` / `unUse` calls with identical tokens, the resulting merged intent MUST be identical.

The result MUST NOT depend on:

- host timing
- scheduling strategy
- runtime state
- adapter behavior

---

## 7. Error Handling

The following conditions MUST result in a thrown error:

- Calling `def.feedback.style.use` outside of setup
- Calling `unUse` outside of setup
- Passing forbidden token syntax
- Passing unsupported handle kinds

Errors MUST be synchronous and deterministic.

---

## 8. Extension Points (Non-goals in v0)

In v0, core feedback supports **only `tw` tokens**.

Additional style notations may exist as extensions if they can be normalized into the same semantic style IR.

Such extensions are explicitly out of scope for this contract.

---

## 9. Related Contracts

This contract builds upon:

- `feedback/style.merge.semantic.v0`

And is consumed by:

- `feedback/style.export.v0`
- `adapter-web-component/feedback.style.apply-to-host.v0`
