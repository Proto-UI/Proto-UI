## CONTRACT_DEBT(v0): rule.deferred-semantics

### Problem

Rule has a stable core direction, but several old draft semantics are ahead of the current implementation or still under naming/design discussion.

These items must not be treated as current rule-core conformance until they are implemented, tested, and promoted into active contracts.

---

### D-RULE-STATE-INTENT-0001: `intent.state` layer semantics are not implemented

Old drafts describe `i.state(handle).be(value)` with:

- writable view constraints
- per-state layer stacks
- rule deactivation rollback
- fallback to latest non-rule baseline
- at-most-once set per evaluation
- rule-shaped write reasons

Current implementation records `state.set` ops but does not apply the full semantics.

Acceptance criteria:

1. Runtime implements layer merge and rollback.
2. Runtime tracks non-rule baseline values.
3. Runtime writes each target state at most once per evaluation.
4. Rule-driven writes carry distinguishable reasons.
5. Contract tests cover owned, borrowed, and observed target constraints.

---

### D-RULE-CONTEXT-PATH-0001: context static path access is not implemented

Old drafts describe context path access:

```ts
w.ctx(key).path('a', 'b');
```

Current implementation supports only whole-value context dependency through `w.ctx(key)`.

Acceptance criteria:

1. Builder API for static path access exists.
2. RuleIR records path as serializable string array.
3. Evaluation traverses only plain JSON objects.
4. Missing path segments resolve to `null` without throwing.
5. Tests cover missing provider, invalid path, and valid path cases.

---

### D-RULE-META-NAMING-0001: host-environment input naming is unstable

`module-rule-meta` currently provides `w.meta(key)` through host-provided metadata.

This is an implemented extension already used for light/dark theme conditions by official Shadcn prototypes. The use case is accepted, but it is insufficient on its own to freeze a general environment abstraction. API shape may evolve or be replaced as broader requirements emerge; preserve existing theme behavior while naming and ownership are governed.

Acceptance criteria:

1. Decide whether host-environment inputs belong to rule core or a secondary rule module.
2. Decide the stable naming.
3. Define capability/provider ownership.
4. Add tests that distinguish host environment inputs from props/state/context.

---

### D-RULE-HANDLE-DISPOSE-0001: `RuleHandle.dispose()` conflicts with setup-only removal boundary

Resolved direction in the 2026-09-08 maintainer discussion: `RuleHandle.dispose()` is setup-time cancellation, not a runtime API. See [D-RULE-HANDLE-DISPOSE-0001](../../../spec/decisions/D-RULE-HANDLE-DISPOSE-0001.yaml) and [C-CORE-SYNTAX-0007](../../../spec/contracts/C-CORE-SYNTAX-0007.yaml); lifecycle remains draft.

The historical implementation allowed direct handles after setup while asHook-captured disposers already rejected them. Direct Module handles now enforce the same boundary, including before the first mount in `onCreated`. Rejected calls preserve the declaration and output. Instance teardown uses internal Module cleanup rather than author cancellation.

Executable evidence is mapped by `T-RULE-0001`; this resolves the removal-phase gap without claiming the other planned RuleIR or matrix evidence.

---

### D-RULE-IR-SERIALIZABLE-0001: RuleIR must not retain live handles

RuleIR must be fully serializable in principle.

Current implementation can retain live handles in some intent operations, especially deferred state intent paths.

Acceptance criteria:

1. RuleIR contains only serializable identities and values.
2. Live handles are retained only in runtime implementation side tables, not in RuleIR.
3. Exported IR can be string-serialized without losing normative meaning.
4. Tests reject or detect non-serializable IR contents.
