# `@proto.ui/compiler`

The compiler is being rebuilt under [#1809](https://github.com/Proto-UI/Proto-UI/issues/1809) in `0.4 scope`. It compiles Proto definitions and authored behavior through a semantic intermediate representation into target-native programs. Unsupported behavior must produce diagnostics; generated components must not delegate it to the original prototype, an adapter, or the Proto runtime.

**Current official Base admission emits 2 of 212 prototypes for React and 2 of 212 for GPUI: `base-text-root` and `base-surface-root`.** Each target analyzes all 184 input files and identifies 212 prototype declarations plus 214 authored Hooks. The remaining 210 prototypes are unsupported; the file outcomes are 2 emitted, 177 unsupported and 5 Hook-only analyses, with zero source errors. Inventory execution counts remain zero; separate React and GPUI behavior tests exercise the admitted Base sources. See the [current inventory summary](evidence/legacy-cleanup-20261125/base-inventory-summary.json).

The earlier `59c18246` baseline emitted 0/212 for both targets. Its [original inventory](evidence/ast-pipeline-20261125/base-inventory-summary.json) remains unchanged. The current increase reflects generic semantic lowering, with no prototype-name exceptions or authored source changes. Full Base coverage and real application migrations remain required work.

- Compilation design: [`internal/compiler/v2-compilation-spec.md`](../../internal/compiler/v2-compilation-spec.md)
- Draft architecture: [`D-COMPILER-ARCH-0001`](../../spec/decisions/D-COMPILER-ARCH-0001.yaml)
- Draft contract: [`C-COMPILER-PIPELINE-0001`](../../spec/contracts/C-COMPILER-PIPELINE-0001.yaml)
- Evidence and outstanding acceptance: [`T-COMPILER-PIPELINE-0001`](../../spec/tests/T-COMPILER-PIPELINE-0001.yaml)
- Maintained commands: [`scripts/compiler/README.md`](../../scripts/compiler/README.md)
- Removed paths, migrated assertions and remaining obligations: [`internal/compiler/legacy-cleanup.md`](../../internal/compiler/legacy-cleanup.md)

## Compilation model

1. A cached TypeScript `Program` and `TypeChecker` provide binding, module, alias, and type facts from the workspace configuration.
2. Proto semantic HIR represents authored expressions, control flow, props, state, events, lifecycle, and capability ownership. TypeScript type information does not replace Proto effect and phase analysis.
3. Each target admits only behavior it can completely lower. Unknown statements or capabilities cannot silently disappear or become a runtime fallback.
4. React lowering constructs nodes with `ts.factory` and prints them with `ts.Printer`. It does not concatenate source text, copy authored source fragments, or parse constructed source strings as a substitute for AST generation.
5. GPUI lowering constructs Rust component, expression, statement, and implementation nodes through `syn` 2 and prints them with `prettyplease`; it targets the real pinned GPUI APIs without Rust source templates or prototype-runtime execution.
6. Applicable pure calculations and explicit state transitions lower to typed kernels. A native C++ driver constructs LLVM modules using `LLVMContext`, `Module`, and `IRBuilder`, verifies them, and uses LLVM's standard printers and tools to produce LLVM/native/WASM artifacts.

A successful native component must preserve the selected definition's behavior. A small generated file, a metadata function, or an executable arithmetic kernel does not establish full component coverage.

## Output and dependency rules

Generated React components use target-native React state, handlers, effects, and ordinary compiled component imports as needed. They must not import the original `.proto.ts`, `@proto.ui/runtime`, `@proto.ui/adapter-*`, or another prototype execution bridge.

Explicit host primitives may be shared through ordinary target libraries. Their use and lifetime must be lowered from the semantic representation; they must not recreate a generic Proto owner or IR interpreter.

There is no `protocol` wrapper fallback. When a target lacks lowering for an event, Hook, context, exposed API, lifecycle, or other behavior, compilation reports the unsupported capability and source location. This is an incomplete coverage item, not a completed implementation.

## Source map

| Location | Responsibility |
| --- | --- |
| `src/frontend/` | TypeScript session, binding, Proto analysis, and structured diagnostics |
| `src/ir/` | Semantic and typed kernel representations, builders, verification, optimization, and inspection |
| `src/targets/react.ts` | Target admission and native React AST construction |
| `src/targets/gpui.ts` | GPUI admission and structured native component lowering |
| `native/rust-builder/` | Rust AST construction with `syn` 2 and the `prettyplease` printer |
| `src/llvm/` | Structured LLVM driver requests, diagnostics, and toolchain integration |
| `native/llvm-builder.cpp` | LLVM C++ API construction, verification, and standard module printing |
| `src/kernel-host.ts` | Bounded WASM memory/ABI host support; no prototype or adapter execution |
| `src/targets/kinds.ts` | Single registry for current component and compilation targets |
| `src/browser/` | Browser frontend/Worker integration; current source-bound browser execution remains a separate acceptance boundary |
| `src/cli.ts` | `info`, `check`, `ir`, `llvm`, `compile`, and `inventory` orchestration |

## GPUI work in this iteration

GPUI is being implemented in parallel with the React and LLVM paths. Its pipeline lowers the same semantic HIR into typed native props/state, a GPUI `Render` implementation, a native element tree, events, rules, and supported lifecycle operations. `syn` nodes and `prettyplease` provide structured Rust generation; Rust source concatenation and whole-item `quote!`/`parse_quote!` templates are prohibited.

Each admitted operation must preserve the definition under the actual pinned GPUI API. Context, exposed APIs, slots, dynamic render, lifecycle, and other capabilities require their own admitted lowering; an unimplemented operation produces target diagnostics. A native shell requiring manual consumer reimplementation does not count as a compiled component.

GPUI evidence has separate boundaries: Rust AST generation, real GPUI Cargo build and behavior, and actual Verdant GPUI consumer integration. Shenko is a React/Web consumer in the inspected workspace and has no GPUI dependency there; it requires React consumer validation, not a fabricated GPUI path. Pins, dependencies, inputs, props/state, focus, lifecycle, and accessibility must be checked in each real consumer. A working LLVM kernel does not satisfy these UI or consumer requirements.

The inspected Verdant snapshot (`44aeee6383`) uses workspace GPUI from `cyjin-yl/z3rm@e5f2f9db75e97613232b5c1946333e61fa3828ab`, while its compiler pin records upstream GPUI `62e5991`. These are separate dependency/baseline identities and must be validated independently rather than treated as one version.

The `59c18246` native test workspace at `native/rust-builder/test-support/` exercised generated components against that actual Verdant fork. That baseline slice includes native clicks, typed state and control flow, props resolution and updates, instance isolation, numeric edge cases, handler order, and actual GPUI Render/text layout. Text-layout observations do not establish pixel or accessibility output. Later capabilities need their own source-bound build and behavior receipts. The test entity keeps fork-native execution, the default upstream pin, and real application migration as separate evidence.

The [native validation guide](native/rust-builder/test-support/README.md) provides reproducible Cargo commands and the typed host API. Separate [fork](native/rust-builder/test-support/evidence/verdant-fork.txt), [upstream](native/rust-builder/test-support/evidence/upstream-pinned.txt), and [driver cache](native/rust-builder/test-support/evidence/cache-rebuild.txt) logs record the actual runs.

The [continuation receipt](native/rust-builder/test-support/evidence/continuation-20261125-summary.md) records 10 current GPUI AST tests, 13 real native tests against the Verdant fork, a locked fork workspace/all-targets check, and a separate locked upstream check of the expanded generated component. The native tests include the unchanged Base Text/Surface sources, props and fallback history, independent Root ownership, mixed text/`AnyView` slots and child Entity lifetime, explicit template updates, immediate rule paint, created/watch order and error behavior, numeric policies, and helper return scopes. A blue painted quad with unchanged template text is native scene evidence; it is not a pixel or accessibility result. Mounted/updated/unmounted/disposal, context/expose and other absent operations remain unsupported. The upstream check is compilation evidence, and neither pin's component harness establishes the whole Verdant application migration.

## LLVM prerequisites and limits

Explicit LLVM/native/WASM compilation requires a compatible LLVM SDK and tools, including `llvm-config`, a C++ compiler, and the selected `opt`/`llvm-as`/`llc`/`wasm-ld` stages. Driver compilation is cached using its source and toolchain/build inputs. Missing tools and failed construction or verification are diagnostics, not successful validation.

React-only compilation must not require an unused LLVM artifact. An explicitly requested LLVM stage must actually run.

The WASM boundary uses a versioned scalar slot ABI with declared capacities and the instance's actual exported memory. Host support must respect the module heap boundary, grow memory as required, validate access bounds, and isolate state between instances. LLVM verification checks LLVM invariants; source equivalence and host behavior require separate execution tests.

This bounded host is exposed as `@proto.ui/compiler/kernel-host` from `src/kernel-host.ts`. The old `@proto.ui/compiler/runtime` entry is removed. The retained host performs no Proto or adapter execution; the existing memory/ABI tests follow its explicit new name without losing their assertions.

## Behavior and cleanup boundaries

A state write changes the live state value; it does not itself request a template update. An authored `run.update()` controls publication. The current terminal-only update admission does not implement general scheduling, reentrant or multiple requests, or queued work after disposal. Those semantics remain required and must be diagnosed when their lowering is absent.

The component host Root and authored template elements have distinct ownership. Root styles and native host events belong to the host; an `r.el(...)` node retains its own template identity and children. A small Text/Surface or slot example cannot establish complete component-family coverage.

Exposed state requires its full `get`, `subscribe`, `spec`, stable identity, payload and disposal contract. A generated getter alone is insufficient to mark Base Separator or complete expose support as compiled. Context, full lifecycle, authored Hook effects, other target backends, production browser behavior, and real consumer migrations retain their original acceptance obligations.

Retired source-template generators and harnesses for the removed private compiler API are removed. Their useful assertions move to current API/native consumers, while unimplemented acceptance stays in the [cleanup ledger](../../internal/compiler/legacy-cleanup.md). Historical records and failed receipts remain intact. The three retained foundation tools verify provenance or recover source material into a new directory; maintained builds never use them to install or invoke an old compiler.

## Coverage and validation

Report these outcomes separately:

| Outcome | Meaning |
| --- | --- |
| Analyzed | Semantic analysis produced a result; unsupported items may remain |
| Compiled native | All required behavior for the selected target was lowered without prototype-runtime fallback |
| Unsupported | Valid behavior lacks a complete target implementation and has a diagnostic |
| Invalid | Source or IR violates the applicable definition |
| Kernel emitted | A kernel with a stated semantic scope was generated |
| Consumer exercised | A real consumer executed the relevant behavior of the generated artifact |

The orchestration API selects `target: 'react' | 'gpui' | 'kernel' | 'ir'`. `inventoryProject` reports `emitted`, `unsupported`, `source-error`, and `hook-analysis` separately. Emission is not build or execution proof; `executionVerifiedPrototypes` remains `0` when execution has not been performed. The acceptance categories above require their corresponding evidence rather than relabeling emitted artifacts.

Tests must exercise props/default/empty updates, state and event order, control flow, numerical edge cases, supported rules and lifecycle, ABI bounds, and unsupported diagnostics. Count final transitive dependencies and distinguish cold, warm, and incremental compilation costs. The draft test entity records current executable evidence and outstanding obligations; corpus acceptance and line counts are not substitutes for those tests.

The baseline isolated-worktree integration run on 2026-11-25 passed 12 Vitest files and 61 tests with zero failures or skips. Strict TypeScript checking passed for compiler source/tests and the pinned-package build/CLI entry scripts; the repository's separate `check:types:workspace` command also passed on both that worktree and the clean `73ff2847` baseline after preparing the isolated workspace dependencies and generated files. Separate baseline GPUI evidence includes 6 native Rust tests against the Verdant fork and independent Cargo checks of that fork and the default upstream pin. The Base test validates coverage accounting, including unsupported results and zero execution claims; it does not establish full native Base coverage. The native-asset relocation and temporary pinned-package smoke validate the packaging mechanism. Each later candidate pin, capability extension and real application migration requires its own evidence.

Run the reproducible compiler checks from the repository root:

```sh
corepack pnpm@10.32.1 --filter @proto.ui/compiler check:types
corepack pnpm@10.32.1 -w check:types:workspace
corepack pnpm@10.32.1 exec vitest run packages/compiler/test
```

The [integration receipt](evidence/ast-pipeline-20261125/receipt.json) and [Vitest log](evidence/ast-pipeline-20261125/vitest.log) record the actual run. The [temporary pinned-package evidence](evidence/pinned-package-snapshot-01a33b38/README.md) records the separate relocation and cold-cache mechanism check.

The [cleanup continuation evidence](evidence/legacy-cleanup-20261125/README.md) separately records 26 passing admission/source controls, actual CLI safety/concurrency executions, and an independently type-checked and mounted React artifact. It preserves the original failed `run.update()` lowering attempt and the first CLI harness's incorrect expected refusal code. Corrected runs retain the same behavior and safety requirements.

GPUI is a current implementation track. Full Base/family coverage, each target, browser compilation, existing CLI/library workflows, and the Shenko/Verdant consumers retain their own acceptance obligations. Adding an unsupported diagnostic does not cancel an existing implementation commitment.

## Historical baseline

The `73ff2847` rebuild report recorded approximately 175,348 removed lines, 184/184 accepted Base files, 212 prototypes, 214 authored hooks, and 14 passing compiler examples. Those figures described that snapshot. Complex components still used a `protocol` wrapper importing the original prototype and adapter/runtime, and separately emitted WASM kernels were not called by React output.

The old numbers therefore establish neither full native compilation coverage nor acceptance of this replacement. The previous small wrapper measurements excluded transitive runtime cost. Removed or stale regression evidence remains debt until replaced and exercised.

## API example

Given an admitted Proto source in `src/hello.proto.ts`, compile it and inspect diagnostics before consuming its output:

```ts
import { createCompiler } from '@proto.ui/compiler';

const compiler = createCompiler({ rootDir: process.cwd() });
const result = compiler.compileFile('src/hello.proto.ts', { target: 'react' });

if (!result.ok) {
  console.error(result.diagnostics);
} else {
  console.log(result.value.primary?.react.code);
}
```

Explicit LLVM artifacts can be requested through the compiler's LLVM options or CLI. Targets and behaviors without implemented lowering return diagnostics.
