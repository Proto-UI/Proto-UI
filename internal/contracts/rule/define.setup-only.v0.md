# rule.define - Setup-only Declaration Contract (v0)

> Status: Draft - v0
>
> This contract defines `def.rule` as the setup-time declaration API for rule. A rule declaration records static condition-to-intent structure and compiles it into RuleIR. It must not become a runtime rule creation or runtime removal API.

---

## 0. Scope and Non-goals

### 0.1 Scope (v0)

- `def.rule(spec)` phase boundary
- RuleSpec minimum shape
- RuleIR declaration invariants
- declaration-order stability
- setup-time removal boundary

### 0.2 Non-goals (v0)

- individual `when` semantics
- individual `intent` semantics
- runtime scheduling
- host-specific optimization
- runtime rule declaration or mutation

---

## 1. API Shape

```ts
def.rule(spec: RuleSpec<Props>): RuleHandle | void
```

`def.rule` is setup-only.

Calling `def.rule` outside setup must throw or fail through the exec-phase guard.

---

## 2. RuleSpec Shape

```ts
type RuleSpec<Props> = {
  label?: string;
  note?: string;
  when: (w: WhenBuilder<Props>) => WhenExpr<Props>;
  intent: (i: IntentBuilder) => void;
};
```

Rules:

- `when` must use `WhenBuilder` to construct a declarative expression.
- `intent` must use `IntentBuilder` to record declarative operations.
- RuleSpec must be fully resolved during setup.
- Runtime closures must not escape into RuleIR.

---

## 3. RuleIR Invariants

RuleIR must be the serialized form of the rule declaration.

It must include:

- stable rule identity
- optional `label` and `note`
- dependency records
- a declarative `when` expression
- declarative intent operations

RuleIR must not contain:

- functions
- host references
- runtime closures
- live state handles
- adapter-specific objects

If an implementation currently needs a live handle for execution, that handle must be treated as implementation state outside RuleIR. The RuleIR-facing identity must remain serializable.

---

## 4. Declaration Order

When multiple rules are active, their intent operations are collected in declaration order.

Declaration order is the only core ordering rule in v0. Conflict resolution belongs to the relevant intent channel.

---

## 5. Setup-time Removal Boundary

If `def.rule` returns a handle with a removal method, that removal method is part of setup-time composition unless a separate runtime rule API is explicitly specified.

Rules:

- setup-time rule removal may be allowed to support conditional composition during setup
- runtime rule removal is not part of rule core v0
- a removal function returned by a setup-only API must not be used as a lifecycle disposer

`RuleHandle.dispose()` follows [C-CORE-SYNTAX-0007](../../../spec/contracts/C-CORE-SYNTAX-0007.yaml), as confirmed by [D-RULE-HANDLE-DISPOSE-0001](../../../spec/decisions/D-RULE-HANDLE-DISPOSE-0001.yaml): it is allowed only during setup execution. Calls in `onCreated` or any later scope fail before changing declarations or style output. Direct handles and asHook-captured disposers share this boundary. Internal Module teardown remains separate.

---

## 6. Error Model

The following must fail synchronously:

- calling `def.rule` outside setup
- returning a non-declarative `when` expression
- using unsupported intent operations
- using setup-only removal outside setup

---

## 7. Related Contracts

- `rule.v0.md`
- `when.expr.v0.md`
- `intent.compose.v0.md`
- `runtime.apply.v0.md`
- `_debt/rule.deferred-semantics.md`
