# R7 owner commit typing — WIP, not acceptance

This incremental record preserves the actual R7 strict-consumer graph and all
**124 remaining diagnostics** without repeating the immutable R6 graph. The
lawful retained-template-helper regression and old SSR walker remain unresolved.
The original r2 167-error record and R6 134-error record are unchanged.

## Exact execution boundary

- Executed base: `783ac833a77102365489d4050f7279c758114ec4`.
- Control: `b47fdd8b086821563f4bec617cd2f07b8c8d6133`.
- Candidate: `256cc4daba517d93498c7fd59bb3a682e0b13ce3`.
- Ten isolated phases: both collect 45; both source-strict exit 0; both core
  **43 passed / 2 failed / 0 skipped**; both independent regressions **41/41**.
- Full generated strict: **134 → 124**, comprising **124 common, 10 old-only,
  0 new** diagnostics. The common diagnostics retain identical source lines,
  columns and spans. These are diagnostic occurrences, not ten independent fixes.
- Both new lifecycle controls passed on both variants. The original 12 cases /
  43 assertion sites remain; three other cases are unsupported-input rejection
  controls, not implemented native capabilities.
- All 1,198 captured artifacts (21,443,135 bytes) were individually hash-checked.
  All phase source, dependency and capture guards passed. Source-strict success
  does not mean generated-consumer strict success.

The product delta is six JSDoc declarations: real pending/rendered commit records,
an optional disposer and Vue 2's actual `CreateElement`. Runtime statements did
not change. The tests cover queued commits before painting and retirement of an
old pending queue during close/reopen. The public files are separately formatted copies, not a new behavioral run.
`executed-source.patch` applies to immutable public c81 to recover both exact
unformatted executed files; their hashes are recorded in `executedSourceFiles`.
No separate execution of the formatted source, complete public ancestry or
current main is claimed. Formatter evidence is in `manifest.json`.

Official Prettier 3.8.1 export and read-only recheck passed. The first raw check
failed, as did strict all-field AST equality: 30 layout `multiLine` fields and
two parser `AwaitContext` flags changed after adding parameter parentheses to
one non-async `error` arrow inside an async test. All generated-template raw and
cooked literals, comments, expression parentheses and other AST payloads were
unchanged. Source-bound exact-difference accounting passed, with six original
negative controls plus four async/await/binding/initializer controls. No global
flag mask was used. The failed equality and initial ES2022 grammar-oracle check
remain retained evidence, not silently converted to passes.

## Reconstruct the captured graph (no project execution)

Use the adjacent `r6-owned-state-cell` directory from immutable public commit
[`c81d6a64`](https://github.com/Proto-UI/Proto-UI/commit/c81d6a64ce638c1f69e477f25245dad1c1b7cf83).
The helper uses only Python's standard library to verify and reconstruct bytes:

```sh
python3 reconstruct.py --base-record ../r6-owned-state-cell --output /tmp/vue2-r7-evidence
```

The output directory must not exist. All seven base-file hashes and all eight
output hashes must match. The readable `Component.js.patch` contains the same
six comment insertions; the manifest binds byte offsets for deterministic
reconstruction. The full `GeneratedModule` is reconstructed by replacing its
single exact JSON-quoted Component code value; every other byte is unchanged.
The 215-entry strict program changes only that Component's hash. Authored input,
actual consumer, Context support and strict request are byte-identical to R6.
The actual emitted and consumed Component bytes were also identical.

`diagnostics.portable.json` retains every diagnostic and field in order. Only
the four temporary path-prefix substitutions documented in R6 are applied to
diagnostics/program/request metadata; authored input and generated source are
not normalized. The original raw hashes are recorded, and inverse conversion
was byte-verified before publication. This is a captured compiler result, not
a mock emitter or a replacement strict check. It does not ship the private
execution environment or all other local captures.

## Still open

- All 124 generated diagnostics: State 35, props 36, owner 14, Context 12,
  Expose 12, lifecycle 5, root VNode 5 and authored-entry 5.
- General lawful template-formal/helper projection without capability downgrade.
- Native SSR/hydration; ordinary mixed production consumers and browser behavior.
- Reachable-only capability cost; complete backend/operation acceptance.

No ready-to-merge, independent approval, full compiler acceptance or UI
screenshot claim is made by this logic-only record. Work continues in #1055 /
Draft #1209; #1120 remains the sole shared canonical shape analyzer.
