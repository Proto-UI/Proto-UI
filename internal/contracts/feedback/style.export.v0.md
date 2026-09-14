# feedback.style.export — Export Contract (v0)

> Legacy explanation. Current authority: [M-FEEDBACK-0001](../../../spec/modules/M-FEEDBACK-0001.yaml), [C-FEEDBACK-STYLE-0003](../../../spec/contracts/C-FEEDBACK-STYLE-0003.yaml), [C-FEEDBACK-STYLE-0004](../../../spec/contracts/C-FEEDBACK-STYLE-0004.yaml), and [C-FEEDBACK-STYLE-0005](../../../spec/contracts/C-FEEDBACK-STYLE-0005.yaml). These entities remain draft.

## 1. Purpose

This contract defines how merged style intent recorded by feedback is **exported for consumption** by adapters and internal modules.

The export represents a **stable semantic snapshot** of style intent. It does not encode rendering strategy, scheduling, or host-specific behavior.

---

## 2. Exported Shape

### 2.1 Export API

The feedback module MUST provide a way to export the current merged style intent.

Conceptually, the export is equivalent to:

```ts
type FeedbackStyleExport = {
  tokens: string[];
};
```

- `tokens` is the result of semantic merge as defined in `feedback/style.merge.semantic.v0`.

The exact API surface (method name, access pattern) is implementation-defined, but the exported shape and semantics MUST follow this contract.

---

## 3. Snapshot Semantics

### 3.1 Snapshot Nature

The exported result represents a **snapshot** of merged style intent.

- It reflects the remaining setup contributions, current internal base contributions (including Rule), and the current runtime patch layer.
- Export does not independently evaluate conditions, read host state, or schedule updates.

Exporting does not mutate feedback state.

---

### 3.2 Determinism

Given identical current contributions and runtime patch state, exporting style intent produces an identical result.

The exported result MUST be independent of:

- host rendering behavior
- adapter implementation details
- update timing or batching
- lifecycle phase for the same retained logical state; terminal disposal clears that state

---

## 4. Semantics of the Exported Tokens

The exported `tokens` list describes **what visual intents exist**, not how they are realized.

The export:

- Does NOT imply class-based rendering
- Does NOT imply CSS-based rendering
- Does NOT encode priority or cascade rules
- Author semantic input does not encode selectors or conditions; internal translation artifacts may contain selector syntax under `C-FEEDBACK-STYLE-0004`

How these tokens are translated into host output is the responsibility of adapters or higher-level compilation steps.

---

## 5. Consumption Model

### 5.1 Adapter Consumption

Adapters consume the exported tokens to produce host-specific output.

Possible adapter strategies include (non-exhaustive):

- compiling tokens into static CSS rules
- mapping tokens to class names
- generating attributes or parts
- applying imperative updates at runtime

All such strategies MUST preserve the semantic meaning of the exported tokens.

---

### 5.2 Rule and Optimization Consumption

Higher-level modules (e.g. rule engines or optimizers) MAY:

- read exported tokens
- compare snapshots across evaluations
- replace or recompute exports based on conditions

Such modules MUST treat the export as **semantic input**, not as a rendering instruction.

---

## 6. Invariants

All consumers of `feedback.style.export` MUST respect the following:

1. **Semantic Equivalence** Different realization strategies MUST preserve the same visual intent.

2. **Order Preservation** The relative order implied by semantic merge MUST NOT be violated.

3. **No Implicit Priorities** Consumers MUST NOT infer priority or dominance beyond what is expressed by semantic merge.

---

## 7. Non-goals

This contract explicitly does NOT define:

- When exported tokens are applied
- How often export is called
- How changes are scheduled or flushed
- How conflicts are resolved at the host level
- How dynamic conditions affect activation

These concerns are addressed by adapter-level and rule-level contracts.

---

## 8. Related Contracts

This contract depends on:

- `feedback/style.use.setup-only.v0`
- `feedback/style.merge.semantic.v0`

This contract is consumed by:

- `adapter-web-component/feedback.style.apply-to-host.v0`
- `C-RULE-INTENT-FEEDBACK-STYLE-0001` and `C-FEEDBACK-STYLE-0005`
