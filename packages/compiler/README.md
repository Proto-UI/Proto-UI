# `@proto.ui/compiler` (v2 — 0.4 scope rebuild)

Private Proto UI compiler rebuilt from a clean slate under [#1809](https://github.com/Proto-UI/Proto-UI/issues/1809) (`0.4 scope`).

- Detailed compilation specification: [`internal/compiler/v2-compilation-spec.md`](../../internal/compiler/v2-compilation-spec.md)
- Governed draft spec entities: [`D-COMPILER-ARCH-0001`](../../spec/decisions/D-COMPILER-ARCH-0001.yaml), [`C-COMPILER-PIPELINE-0001`](../../spec/contracts/C-COMPILER-PIPELINE-0001.yaml), [`T-COMPILER-PIPELINE-0001`](../../spec/tests/T-COMPILER-PIPELINE-0001.yaml)

## Design principles

1. **Real TypeScript toolchain frontend (`src/frontend/`)**: Uses a cached `ts.Program` + `ts.TypeChecker` backed by the workspace `tsconfig.json` for real symbol resolution, alias/re-export traversal, and type inspection — replacing the legacy ~30,000-line hand-rolled parser/typechecker and duplicate 2,800-line IR validator.
2. **Proto SSA IR + LLVM IR pipeline (`src/ir/`, `src/llvm/`)**:
   - Lowers extracted prototypes, declarative `def.rule(...)` predicates, simple state transitions, and pure scalar helpers into a typed SSA IR (`ModuleIR` -> `SsaFunction` -> `SsaBasicBlock`).
   - Runs a concise structural SSA verifier and target-independent passes (constant folding, algebraic simplification, dead basic block pruning, backward liveness DCE, 64-bit capability closure).
   - Emits valid opaque-pointer **LLVM IR (`.ll`)** and integrates with installed LLVM tools (`opt -passes=verify,default<O2>`, `llvm-as`, `llc`, `wasm-ld`) to verify, optimize, emit bitcode/assembly/object code, and compile pure rule/state kernels directly to executable `wasm32` binaries.
3. **Thin shared runtime + thin React output (`src/runtime/`, `src/targets/react.ts`)**:
   - **Zero `String.raw` embedded runtimes.** No DOM modules or kernel state machines are copy-pasted into generated component files.
   - **Tier 0 (`static`)**: Pure static templates lower to ~14-line React functional components with zero Proto UI runtime dependency.
   - **Tier 1 (`reactive`)**: Simple local-state/event templates lower directly to native `React.useState` + native event handlers (~19–30 lines), zero Proto kernel.
   - **Tier 2 (`protocol`)**: Full protocol prototypes (focus, accessibility, overlay, anatomy, context, authored hooks) emit ~23-line strictly-typed React wrappers delegating to the canonical `@proto.ui/compiler/runtime` (`@proto.ui/adapter-react` + `@proto.ui/runtime`).

## Architecture map

| Directory | Responsibility |
| --- | --- |
| `src/frontend/` | Cached `ts.Program` + `ts.TypeChecker` session and prototype/hook/rule/helper extraction |
| `src/ir/` | Typed Proto SSA IR, `SsaBuilder`, structural verifier, SSA optimization passes, `.pir` printer |
| `src/llvm/` | LLVM IR (`.ll`) emitter + `opt`/`llc`/`llvm-as`/`wasm-ld` toolchain integration |
| `src/runtime/` | Thin shared React runtime bridge (`@proto.ui/compiler/runtime`) + WASM kernel host wrapper |
| `src/targets/` | 3-tier thin React TypeScript emitter |
| `src/browser/` | Minimal browser protocol compatibility boundary (QuickJS-in-WASM removed per #1809) |
| `src/cli.ts` | CLI (`info`, `check`, `ir`, `llvm`, `compile`) |

## Measured rebuild baseline (`origin/main` v1 vs v2)

Measured on the local workspace with Node.js 24.22.1 and LLVM 22.1.8 (`opt`, `llc`, `llvm-as`, `wasm-ld`):

| Metric | Legacy v1 (`origin/main`) | Rebuilt v2 (`#1809`) |
| --- | --- | --- |
| `packages/compiler/src` | 214 files / 90,572 LOC | 23 files / 4,667 LOC (-94.8%) |
| `packages/compiler/test` | 447 files / 90,172 LOC | 8 files / 737 LOC (-99.2%) |
| Embedded `String.raw` runtimes in `src/` | Thousands of lines across emitters | 0 occurrences |
| Empty component React output | 1,060 LOC (53.3 KB / 3 files) | 14 LOC (347 B, Tier `static`, 0 runtime) |
| Counter button React output | 2,877 LOC (132.4 KB / 6 files) | 15 LOC (447 B, Tier `reactive`, native `useState`) + 897 B `.wasm` kernel |
| `base/button` React output | 5,459 LOC (251.5 KB / 10 files, ~2,200 ms) | 23 LOC (1,044 B, Tier `protocol`) + 908 B `.wasm` kernel (LLVM verified) |
| Official `packages/prototypes/base/src/**/*.proto.ts` | Complex families (`dialog`/`popover`/`select`/`hover-card`/`tooltip`/`slider`) failed | 184 / 184 files (212 prototypes, 214 authored hooks), avg 19.9 LOC (902 B, max 23 LOC), 6.83 ms/file warm |

## Usage

```ts
import { createCompiler } from '@proto.ui/compiler';

const compiler = createCompiler({ rootDir: process.cwd() });
const result = compiler.compileFile('packages/prototypes/base/src/button/button.proto.ts', {
  llvm: { verify: true, optimize: 'O2', emitWasm: true },
});
if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));

console.log(result.value.primary?.react.code);
console.log(result.value.llvm.optimizedIr);
```

CLI:

```sh
node --import tsx packages/compiler/src/cli-entry.ts info
node --import tsx packages/compiler/src/cli-entry.ts check packages/prototypes/base/src/button/button.proto.ts
node --import tsx packages/compiler/src/cli-entry.ts ir packages/prototypes/base/src/button/button.proto.ts
node --import tsx packages/compiler/src/cli-entry.ts llvm packages/prototypes/base/src/button/button.proto.ts --optimize
node --import tsx packages/compiler/src/cli-entry.ts compile packages/prototypes/base/src/button/button.proto.ts --out .cache/out --wasm
```
