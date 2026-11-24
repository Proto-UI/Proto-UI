# Sprint 5: exact public finite value type bindings

This record concerns the Compiler admission portion of #1056 and #1144. It is not native Image execution, complete Table acceptance, a public Compiler profile promotion, or completion of either Issue.

## Governed scope and implementation

`C-IMAGE-VIEW-0001` remains draft. Its B/C/F criteria define the existing fit, accessibility mode, and loading-status alternatives. Draft `C-TABLE-STRUCTURE-0001-HEADER-KEYS` defines `column | row`. Their public shared TypeScript declarations are unchanged. The Compiler now resolves these ordinary finite data types by exact package and exported symbol:

| Public export                                      | Admitted alternatives                |
| -------------------------------------------------- | ------------------------------------ |
| `@proto.ui/core:ImageViewA11yMode`                 | `informative`, `decorative`          |
| `@proto.ui/core:ImageViewFit`                      | `contain`, `cover`, `fill`           |
| `@proto.ui/core:ImageViewStatus`                   | `idle`, `loading`, `loaded`, `error` |
| `@proto.ui/module-table-structure:TableHeaderKind` | `column`, `row`                      |

`packages/compiler/src/public-value-types.ts` contains exhaustive records checked against the shared public types. It imports those types only; it adds no runtime Module, component protocol, source-path dispatch, or authority-bearing intrinsic. The existing source resolver retains renamed import, namespace, transparent alias, and local barrel identity. A local homonym uses its actual declaration. An unrelated package, unknown export, or generic application of these nongeneric aliases is rejected. `@proto.ui/types` does not acquire the new Core exports.

The test independently reads the actual shared declaration AST and verifies the public barrel exports. Missing `fill` and invented `stretch` alternatives are separate strict TypeScript mutation controls. The finite union survives cold JSON IR validation, and assigning `diagonal` to `TableHeaderKind` fails at the authored initializer.

## Source-bound evidence

The source candidate is based on Git HEAD `1afa22e88c087db244f0e28a835b2926fb8bce8e` plus the already frozen Sprint 5 product inputs. Base index tree `b598bab4ea3821dbad035a055fab233e678d1ce0` becomes `af5626eff762adf4e2cd0318f1bcdd970044f08a`. These are tree identities, not fabricated commits. The three-file source patch has SHA-256 `0a5ae976720e91199ce37ccd4c96cc78f2493abf16b3d7ca55f0c2712b5d795b`.

| Observation | Actual result and boundary |
| --- | --- |
| Unchanged original input, parent Compiler | Image Root and Table HeaderCell both reject with located `PUI1020` missing public type bindings. |
| Same 34 alias controls, parent source | 15 pass, 19 fail; the original source bytes are restored after the run. |
| Candidate alias controls | 34/34 pass. Together with existing source-value and source-normalization suites: 3 files, 98/98, zero skipped. |
| Final run source binding | 266 input files hashed before and after; zero drift. Node 24.22.3 and frozen pnpm 10.32.1 workspace. |
| Strict source closure | 312 files, strict and `skipLibCheck: false`, zero diagnostics. |
| Missing shared alternative mutation | Exactly TS2345 at the finite binding record. |
| Extra nonpublic alternative mutation | Exactly TS2353 at the finite binding record. |
| Original Base Image Root, final candidate | Complete unchanged source compiles through `gpui-source-v1`, cold IR accepts, and create-only publication writes 20 generated artifacts. No native Rust execution is claimed here. |
| Original Table HeaderCell, final candidate | Alias resolution succeeds, followed by the independent `PUI1006` array-prop admission refusal. It is not counted as an admitted full consumer. |

The actual original source hashes are `da5c148a7969c15d9350d0a3330493fa6cbe36865ed498f27a8a97c3828aad21` for Image Root and `1aad0553e6a2a2a87822a05af105a90adb128124043cb4813533be0962659a72` for HeaderCell. Neither prototype was edited.

## Retained failed attempts and limits

The first runner invocation selected `--maxWorkers=1` without matching `--minWorkers=1` and executed no tests; its exit code was 1 and it is not acceptance. The first implemented 98-case run passed 97 cases. Its newly authored whole-output ban on `serde_json::Value` was broader than the alias question: the existing GPUI ordinary-value carrier still imports JSON support and emits the local finite value through `Value::string`. The assertion was corrected to inspect the exact checked finite union and reject an out-of-set assignment. This change does not establish fully typed Rust lowering for all ordinary values under #1056.

The first strict harness omitted Node ambient types and reported four unresolved Node builtins. Supplying the repository's actual Node declarations produced the complete 312-file zero-diagnostic result; the original errors are preserved. No source diagnostics were filtered.

## Independent software gap exposed by Table

Active `C-PROPS-0003-B` admits arrays whose elements are JSON values. Active `C-PROPS-0006-B` admits the `object` descriptor. Both original Table Cell and HeaderCell declare `headers?: readonly string[]` with `{ type: 'object', empty: 'fallback' }` and a default empty array. The source frontend currently admits only primitive/enum descriptors and rejects `object` before target selection. The shared target tables already include `props.define`; this is a source-language coverage gap for an existing defined value, not an inferred human semantic gate. Array source admission, independent IR checks, exact element validation, missing/null/undefined/default behavior, and native/Web consumer execution require a separate patch and receipt.

## Evidence carrier

[Raw attempts, input bindings, unchanged source receipts, generated files and strict controls](evidence/2026-11-24-sprint5-public-value-types/public-value-types-evidence.tar.gz) are accompanied by an [archive manifest](evidence/2026-11-24-sprint5-public-value-types/manifest.json). The archive retains the earlier product baseline patch and untracked source snapshots, so the tree can be reconstructed without interpreting a passing log as missing source.

Native Image execution, integration CI, independent source review, actual merge and the earned Issue tracking write remain separate transitions. This record claims none of those actions already occurred.
