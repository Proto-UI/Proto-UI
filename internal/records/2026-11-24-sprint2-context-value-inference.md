# Sprint 2: infer fresh Context values from their resolved key

Scope: the contextual type of a fresh `context.provide` / `context.update` / `context.tryUpdate` value and an inline Context updater return. Related work: #732 and #1145. The starting source is `d0eb81d3c61c3d3e93e46c4151e78031273d6116`.

## Authority and owning layer

Draft `C-CONTEXT-0008-A/B` accepts an explicit next value or updater for the specified key. Draft `C-CONTEXT-0009-C/D/E` permits finite JSON fields and rejects invalid values without sanitizing them. The private compiler's closed-source contract and thin-compiler standard require a checked source-to-IR path, without altering authored prototypes or dispatching on a component name.

The source parser already resolves a ContextKey's value type and checks an updater's parameters and result against it. It did not pass that expected type into the expression reader or the updater body. Consequently a fresh field such as `{ mode: 'open' }` widened to `string` before validation against `{ mode: 'open' | 'closed' }`. A caller had to add redundant assertions even though the resolved key supplies the required contextual type.

The parser now carries the existing key type into fresh Context values and updater returns. The ordinary expression/type rules still validate every field. There is no new runtime helper, emitted operation, profile or component-specific case. A widened reference, incompatible/missing field, fallthrough return or hidden callable still receives a diagnostic. Portable IR validation continues to check the resulting callback rather than trusting the source parser's claim.

## Actual validation

On Node 24.22.3 / pnpm 10.32.1, the new `packages/compiler/test/context-value-inference.test.ts` first recorded **11 failed / 7 passed**. Failures included the direct fresh provide value, the updater result and the actual generated consumers. After the parser change, the same file recorded **18 passed / 0 failed / 0 skipped**:

```sh
corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/context-value-inference.test.ts \
  --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

The cases cover update and tryUpdate; concise and block updater returns; nested literal-union fields; invalid value, missing field, null, callable erasure and widened-reference controls; and rejection of a mutated serialized IR. Eight ordinary generated-consumer cases run the two operations on React, Vue 3, Vue 2 and Web Components under Happy DOM and check both consecutive transitions and their next/previous ordering. These are source/IR and framework-consumer results, not browser paint, physical input, assistive-technology, whole-library or native backend acceptance. Existing Vite warnings about the configured ES2024 target were visible and did not prevent these executions.

This repair can complete a development child for fresh Context value/updater inference after integration and tracking readback. The original #732 full library/profile denominator, independent differential experiments and #1145 all-capability/target acceptance remain separate. No external Issue state or checkbox was changed by this local implementation.
