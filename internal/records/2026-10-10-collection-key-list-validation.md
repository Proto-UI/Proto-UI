# Tree and DataTable key-list runtime validation

Date: 2026-10-10 UTC. Exact source baseline: `8f937f087f68335b17f7243aaa45549e23945526`. Independent reviewer reproduced the failure from a git archive of that SHA; affected Tree/DataTable files were checked against that source before creating this successor branch. The frozen sixth source is not edited.

## Governed repair

`C-PROPS-0009` is active: invalid provided values enter the per-key fallback chain (`prevValid`, defaults, canonical null). `C-PROPS-0007` permits a first validator declaration. `C-PROPS-0006` keeps validator portability as an explicit open question; this uses the already-supported public declaration API without resolving that question or changing shared Props/Runtime/Compiler semantics.

The public expandedKeys/defaultExpandedKeys and selectedKeys/defaultSelectedKeys domains are readonly string arrays. Their old object-only declarations let `{}` reach a spread and throw. This is a Prototype validation omission for inputs outside that public domain, not a failure of legal arrays or shared Props.

Each owning Root now validates a dense string array. Valid empty arrays and string values are retained; no new nonempty/uniqueness restriction is imposed. The existing Props engine supplies prevValid/default/null fallback. Canonical state is never repaired by catching a spread exception or overwriting host props. A provided invalid controlled key remains controlled; it does not adopt its separate default prop or accept an uncontrolled mutation. Default props still initialize once and never reset a live uncontrolled selection/expansion.

## Evidence

On exact 8f937f08, the new 16-case actual WC fixture failed 13 and passed 3. After the two Root declaration repairs, all 16 passed. It exercises `{}`, wrong-element arrays, mixed null arrays, mount invalid → valid → invalid, valid controlled state retained after invalid updates, empty-array acceptance, invalid controlled values with nonempty defaults, refused controlled requests, and initialization-only default updates.

The combined focused run passed 26/26 across four files: the new fixture, Tree behavior, existing collection compositions and real hook contracts. Node 24.19.0 / fixed offline pnpm 10.32.1 / Vitest 2.1.9, one worker. The scoped TypeScript check and normal formatter/diff checks passed. These are local source/actual-adapter facts, not browser/native/compiled/packed/full acceptance.

```sh
./node_modules/.bin/vitest run packages/prototypes/base/test/collection-key-list-props.test.ts packages/prototypes/base/test/tree.test.ts packages/prototypes/base/test/finf-collection-compositions.test.ts packages/prototypes/base/test/finf-collection-hook-contracts.test.ts --maxWorkers=1 --minWorkers=1
./node_modules/.bin/tsc --noEmit -p packages/prototypes/base/test/tsconfig.collection-key-list-props.json
```

VirtualList generation cleanup is a separate following change, confined to its existing explicit Web materializer. No external publication or TODO/lifecycle change accompanies this key-list repair.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
