# Sprint 2: copied capture lookup provenance

## Scope

This is a human-assisted implementation for #1145/#732 and the shared Hook ownership conditions in #1154. It preserves the existing capture facade and the source-language phase boundary; no public API, IR schema or generated runtime implementation changes.

The integration baseline already failed five `capture-facade.test.ts` cases with `PUI1007: Callable provenance is not closed at this invocation`. The same five failures were independently reproduced on the earlier `d0eb81d3c61c3d3e93e46c4151e78031273d6116` main tree. The source copied `getState`, `getMethod`, child lookups and methods through a real hook projection. The checked types retained those fields, but callable analysis recognized only the capture's renderer and therefore lost the actual installation behind a copied getter.

## Repair

The analysis now transports an internal lookup fact bound to the actual capture. Reading or copying the public facade preserves methods, child lookups and nested method records. Calling a lookup resolves the method or child belonging to that installation, including the absent alternative for an unknown key. Only an actual checked installation can create the fact. An ordinary property name or forged callable signature cannot manufacture it.

Invoking a returned method still analyzes its real body in the caller's phase. Two new negative cases copy and rename a getter, then attempt a setup-only operation from an exposed callback; both retain `PUI1007`. The existing serialized lookup and event-key forgeries remain rejected.

## Validation and limitations

The focused validation uses:

```sh
NODE_OPTIONS=--max-old-space-size=3072 corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/capture-facade.test.ts \
  packages/compiler/test/capture-facade-runtime.test.ts \
  --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

Final result: **2 files, 35 passed, 0 failed, 0 skipped** (24 source/IR cases and 11 runtime cases). The earlier five source failures are all resolved.

A bounded TypeScript program rooted at `callable-effects.ts` and the two test files, with the repository's compiler options and complete imported dependency graph, reported **0 diagnostics**. This is separate from the workspace-wide type gate.

The ordinary generated React, Vue 3, Vue 2 and Web Component consumers exercise copied facade identities, nested raw/projected child identities, renamed getters, isolated owner counters and retained callbacks after disposal. They execute in Happy DOM and do not establish physical-browser, paint, AT or native-platform acceptance. Source-free IR validation and the existing GPUI source-emission case remain separate from native execution.

The first new owner-counter fixture incorrectly installed two methods named `next` in the same component owner. Three targets rejected that fixture, consistent with `C-EXPOSE-0004`; it was replaced by two separate owners with independent starting values. Vue 2 unexpectedly accepted the invalid duplicate-key fixture. That observation and its original log were handed to the owning emitter integration task as a separate Expose defect, rather than counted as a passing capture result.

This bounded repair does not close the original issues or replace their full source/library/profile, cleanup, independent differential and integration acceptance requirements.
