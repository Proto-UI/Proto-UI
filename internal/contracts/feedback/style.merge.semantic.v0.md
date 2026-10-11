# feedback.style.merge.semantic — Semantic Merge Contract (v0)

## 1. Purpose

This contract defines how multiple style intent tokens recorded via `def.feedback.style.use` are **merged into a single semantic result**.

The merge process defines the _meaning_ of style intent in Proto-UI and MUST be consistent across all adapters and optimization paths.

---

## 2. Merge Inputs

### 2.1 Input Sequence

Semantic merge operates on an **ordered sequence of `tw` tokens**.

The input order is defined by:

1. The order of `def.feedback.style.use` calls
2. The order of tokens within each call

This order MUST be preserved.

---

## 3. Semantic Model

Semantic merge is performed by grouping tokens into **semantic groups**.

A semantic group represents a dimension of visual intent where multiple tokens are considered mutually exclusive.

Examples include (non-exhaustive):

- background color
- text color
- spacing
- sizing
- layout role

Tokens in the same group conflict by intent. Tokens in different groups are independent.

---

## 4. Semantic Groups (v0)

### 4.1 Group Identification

In v0, semantic groups are identified by **prefix matching**.

The following prefixes define semantic groups:

#### Color

- `bg-`
- `text-` color values, excluding the independent size and alignment utilities

Text size (`text-sm`, `text-lg`, etc.) and text alignment (`text-left`,
`text-right`, `text-center`, `text-justify`, `text-start`, `text-end`) are
separate semantic groups. Setting alignment must not remove a theme foreground
or font size. The same distinction holds inside the allowlisted static
`selection:` scope and during runtime patch/suppress operations.

#### Spacing

- `p-`, `px-`, `py-`, `pt-`, `pr-`, `pb-`, `pl-`
- `m-`, `mx-`, `my-`, `mt-`, `mr-`, `mb-`, `ml-`

#### Sizing

- `w-`, `h-`
- `min-w-`, `min-h-`
- `max-w-`, `max-h-`

#### Layout / Flex

- `flex`
- `justify-`
- `items-`
- `content-`

#### Effects

- `opacity-`
- `shadow-`
- `rounded`

The bounded [C-CONTENT-SELECTION-AFFORDANCE-0001](../../../spec/contracts/C-CONTENT-SELECTION-AFFORDANCE-0001.yaml) revision adds one exact group containing `select-auto`, `select-text`, and `select-none`. It deliberately replaces fallback grouping for those three tokens only; `selection:*` paint stays independent. This versioned exception does not broaden prefix matching for other `select-*` tokens.

This list is intentionally conservative.

Expanding or redefining semantic groups is a **breaking change** and requires a new contract version.

---

### 4.2 Fallback Grouping

If a token does not match any supported prefix:

- The token itself defines a unique semantic group.
- Such tokens conflict only with identical tokens.

This prevents accidental over-grouping and preserves forward compatibility.

---

## 5. Merge Rules

### 5.1 Conflict Resolution (Last-wins)

Within a semantic group:

- Tokens are resolved using **last-wins** semantics.
- The token appearing last in the input sequence MUST be selected.
- Earlier tokens in the same group are discarded.

---

### 5.2 Output Ordering

The merged token list MUST be ordered deterministically.

Ordering rule:

1. Semantic groups are ordered by the **first occurrence** of any token belonging to that group in the input sequence.
2. For each group, only the final selected token is emitted.

This guarantees stable output ordering.

---

## 6. Merge Result

The result of semantic merge is:

```ts
{
  tokens: string[]
}
```

- Each token represents a resolved semantic intent.
- No priorities or cascade rules are encoded in the result.

The result describes **what visual intents exist**, not how they are realized.

---

## 7. Determinism and Purity

Semantic merge MUST be:

- pure (no side effects)
- deterministic
- independent of host behavior
- independent of scheduling or timing

Given identical input tokens in the same order, the merged result MUST be identical.

---

## 8. Non-goals

This contract does NOT define:

- How tokens are rendered or applied
- Whether tokens become classes, attributes, or CSS rules
- How conflicts are resolved at the host level
- How dynamic conditions affect activation

These concerns belong to adapter and rule contracts.

---

## 9. Related Contracts

This contract is used by:

- `feedback/style.use.setup-only.v0`
- `feedback/style.export.v0`
- `adapter-web-component/feedback.style.apply-to-host.v0`
