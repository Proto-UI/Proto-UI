# Reproduce the final independent controls

The final candidate is `27b5429b46fdc31ae94d1f6a1bd37fb1c6a8323c`; the review base is `4009346439913420769db1fa777354c6479f4846`. Use an isolated, clean checkout of the candidate and a copy of this evidence directory. The scripts write their result files beside themselves. The implementer's checkout is read only.

Executed dependencies: Node 24.22.3, TypeScript 5.9.3, esbuild 0.25.12, Happy DOM 15.11.7 and tsx 4.21.0. They were resolved from the candidate checkout. The scripts accept `PUI_REVIEW_REPO`; without it their original absolute workspace path is used.

Set `PUI_REVIEW_REPO` to the candidate checkout and `PUI_REVIEW_COMMIT` to the exact candidate SHA. Run from that checkout so `node --import tsx` resolves its installed loader. `review-binding.mjs` refuses a different HEAD or a dirty tree when `PUI_REVIEW_COMMIT` is set. The controller and scope probes also verify that their included scene snapshot equals the checked-out file.

```sh
export PUI_REVIEW_REPO=/path/to/Proto-UI
export PUI_REVIEW_COMMIT=27b5429b46fdc31ae94d1f6a1bd37fb1c6a8323c
cd "$PUI_REVIEW_REPO"
node /path/to/review/controller-probe.mjs
node /path/to/review/scope-recovery-probe.mjs
node --import tsx /path/to/review/factory-lifetime-probe.mts
node /path/to/review/publication-guard-probe.mjs
node --import tsx /path/to/review/mixed-source-factory-probe.mts
node --import tsx /path/to/review/source-switch-probe.mts
node --import tsx /path/to/review/factory-names-probe.mts
```

Expected results are 11, 2, 9, 8, 2, 4 and 12 passing controls respectively. The 12 Compiler controls consist of four valid compiled outputs and eight expected compiler refusals. The syntax validator uses TSX only for React output and TS for the other profiles.

## What was controlled

The controller and factory probes replace physical publication with a recorded capability. The publication probe keeps actual scene and physical presenter logic but replaces only `createWebShaderResources` with a counted GPU device; image decode returns a held callback. Each stale-publication case invokes that callback before any MutationObserver delivery. These tests are local Happy DOM/JavaScript controls; they are not real browser or GPU results.

The direct Compiler controls call the actual `compilePrototype` entry and parse its actual emitted code. They do not mount framework consumers.

`stable-review-result.json` records the final result-file hashes and source bindings. `stable-source-snapshot.json` records the before/after-checked selected source identities. Earlier failed reports, selected exact older source copies and pre-final successful reports are preserved separately. They are historical records, not a claim that a complete historical checkout/toolchain archive was captured.
