# Draft number.list State reconstruction

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and provenance

This is a new reconstruction on `764d02f6554bc7b9974b6941fd87fdc657604ad3` (tree `42bfed3039b3c28a135695a0a1fbd9ae6837cb30`). Previous unpublished source and test artifacts were unavailable after the workspace reset. No historical tree or review result is represented as recovered or as evidence for this candidate.

The generic draft extension is governed by `C-STATE-NUMBER-LIST-0001` and changes the admitted kinds, equality and facade projections in `C-STATE-0006`, `C-STATE-0011` and `M-STATE-0001`. It adds no component policy or Compiler change. Compiler support remains unimplemented by this slice. Slider sorting, spacing, quantization and endpoint policy belong to its independently defined model; number.list normalizes -0 to +0 and does not preserve that sign bit.

## Checkpoint 1 evidence (2026-10-11 UTC)

Node 24.19.0, pnpm 10.32.1, frozen lockfile. The first dependency attempt failed because the default pnpm home could not be created; installation in an explicit workspace-local store then succeeded with lifecycle scripts disabled.

- New kernel tests on unchanged baseline: 6 failed, 1 legacy-scalar control passed.
- Candidate module regression: 9 files, 55 tests passed.
- Candidate State runtime contracts: 5 files, 20 tests passed.
- Public readonly/type-negative contracts: `test:types` passed.
- First runtime test draft wrongly assumed terminal disconnect receives a run; corrected the test to assert current-run only for value changes, preserving the existing lifecycle policy. First type draft omitted a required generic argument; corrected the test. Both failed logs remain evidence rather than being erased.
- Source descriptor is copied/frozen. Existing Adapter public descriptor clones are not newly promised deep readonly; source integrity is the bounded guarantee.

Pending for the full reconstruction: new four-Adapter list tests, explicit Web projection negative control, port-view additions, packed 37-package consumer, exact-baseline nine-entry budgets, full affected/spec checks, public documentation, workspace type check, independent review and normal publication hooks. This checkpoint is useful public-API/runtime evidence, not full host or release admission. No browser paint, native host or Compiler pass is claimed. Size ceilings and measurement policy remain unchanged.

## Independent checkpoint correction

The initial reconstruction tree `c8aeee3e315d3d079ac6a69ec690cecd01040097` failed independent review: looking up an index in the ordinary descriptor table through its prototype could admit a hole plus an extra own property when `Object.prototype[0]` was polluted with a descriptor-shaped value. The input itself still lacked an own index. A new exact regression failed before repair (1 failed, 7 passed) and passed after changing the lookup to an own-property descriptor (8 passed). A null-prototype Array positive control also passes. The failed tree and review are retained, not published as accepted work.

A second independent counterexample inherited `Object.prototype.value` into an accessor descriptor. The `value` field must itself be own, not merely present on the prototype chain. Its new regression failed before repair (1 failed, 8 passed) and the nine-case kernel suite passed with both own-property checks. No input getter was invoked. Prototype pollution in these tests is restored in `finally`.

Checkpoint 2 also adds direct port metadata/capability tests, explicit custom and permissive Web mapping refusal, and fresh React, Vue 3, Vue 2 and Web Component external get/subscribe/no-auto-render tests. The bridge test first used a numeric map key where the existing public map is string-keyed; only the test was fixed. The complete affected command is re-run on the repaired candidate. These are happy-dom/test-runtime observations, not browser paint or native-host evidence.

Checkpoint 2 repaired affected run: 23 files / 112 tests passed, including the four new Adapter tests and both independent-review regressions. Type contracts passed again. The initial catalog-kind schema error was repaired from the invalid `type-test` enum to `workspace-check`; the repaired first checkpoint passed all 24 spec files / 161 tests, and the additional host mappings are checked separately.
