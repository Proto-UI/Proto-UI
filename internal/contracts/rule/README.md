# Rule Contract Index

> Status: Draft - v0
>
> Rule is Proto UI's declarative condition-to-intent syntax. It is not an information channel. It observes values exposed by other modules and records intent in analyzable RuleIR so runtime, adapters, and future compilers can choose an equivalent execution strategy.

---

## Catalog authority

The bounded Props/State-to-style realization is cataloged by [M-RULE-0001](../../../spec/modules/M-RULE-0001.yaml) and [T-RULE-0002](../../../spec/tests/T-RULE-0002.yaml), with four Adapter profile relations. These are draft. The documents below remain explanatory projections; applicable spec entities own semantics. Existing planned matrix files are not passing evidence; the catalog separately maps executable supported cells.

## Core Contracts

- `rule.v0.md`
  - `C-RULE-0001`: rule is not an information channel
  - `C-RULE-0002`: rule is optional but recommended when expressive enough
  - `C-RULE-0003`: RuleIR must be serializable
  - `C-RULE-0004`: `def.rule` is setup-only
  - `C-RULE-0005`: setup-time removal must not become runtime removal

- `define.setup-only.v0.md`
  - setup-time declaration API
  - RuleSpec and RuleIR boundaries
  - declaration order and setup-only RuleHandle cancellation

- `when.expr.v0.md`
  - pure condition expression grammar
  - `eq`, `not`, `all`, `any`, `t`, `f`
  - dependency recording shape

- `intent.compose.v0.md`
  - intent builder as declarative op recorder
  - op ordering and channel independence
  - no arbitrary callbacks or host-specific side effects

- `runtime.apply.v0.md`
  - rule evaluation flow
  - default Plan output
  - executor and extension boundary

---

## Stable v0 Inputs and Intents

Stable first-pass when inputs:

- `when.deps.props.v0.md`
- `when.deps.state.v0.md`
- `when.deps.state.wiring.v0.md`

Stable first-pass intent:

- `intent.feedback.style.v0.md`

These are the preferred baseline for executable tests in the first cataloging pass.

---

## Deferred or Extension Scope

- `intent.state.v0.md`
  - planned rule state intent semantics
  - not fully implemented in the current runtime
  - tracked by `_debt/rule.deferred-semantics.md`

- `when.deps.context.v0.md`
- `when.deps.context.wiring.v0.md`
  - context dependency exists in current implementation as `w.ctx(key)`
  - static path access remains deferred
  - tracked by `_debt/rule.deferred-semantics.md`

- rule meta / host environment inputs
  - currently implemented by `module-rule-meta`
  - treated as rule secondary scope, not rule core
  - already used for official light/dark theme behavior; API naming and abstraction may evolve

- Web exposed-state selector optimization
  - belongs to `module-rule-expose-state-web` and Web adapter/profile contracts
  - validates rule's optimization potential but does not define rule core semantics

---

## Test Matrix Guidance

The current matrix files intentionally separate dimensions:

- `packages/runtime/test/contract/rule.matrix.when.v0.contract.test.ts`
- `packages/runtime/test/contract/rule.matrix.intent.v0.contract.test.ts`
- `packages/runtime/test/contract/rule.matrix.combine.v0.contract.test.ts`

First executable coverage should focus on:

- `when.props x intent.feedback.style`
- `when.state x intent.feedback.style`
- declaration order and semantic token merge
- activation and deactivation cleanup
- setup-only phase errors
- RuleIR dependency recording and serialization boundaries

Only after those are stable should deferred channels such as `intent.state` and context path access be promoted into executable conformance tests.
