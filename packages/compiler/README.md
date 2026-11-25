# Proto language compiler foundation

The previous private compiler is retired. The replacement compiler has not been implemented. This package currently exposes availability and an explicit failure boundary; it produces no React, GPUI, Vue 2, Vue 3 or Web Components artifacts.

| Target         | Replacement implementation |
| -------------- | -------------------------- |
| React          | Not implemented            |
| GPUI           | Not implemented            |
| Vue 2          | Not implemented            |
| Vue 3          | Not implemented            |
| Web Components | Not implemented            |

## Direction

The replacement is a Proto language based on TypeScript syntax and compiler infrastructure. Its explicit `schema`, `init`, `derive`, `action` and `lifecycle` declarations lower through a typed semantic IR into target ASTs. React and GPUI are the first implementation targets; Vue 2, Vue 3 and Web Components remain required targets. LLVM is outside the initial implementation.

The [compiler design entry](../../internal/compiler/README.md) and [foundation contract](../../spec/contracts/C-COMPILER-FOUNDATION-0001.yaml) define the replacement. Old compiler APIs, generated snapshots and tests do not define the new language. Source parsing, semantic analysis, target lowering and consumer integration are future implementation work.

## What was retired

The old parser and hand-maintained type/effect machinery, duplicated IR validation, source emitters, embedded runtime templates, Rust dynamic-value machinery, QuickJS browser engine, artifact linker and migration helpers have been removed. Their compiler-specific tests and generated fixtures have also been removed. Git history retains the old implementation.

The existing `packages/runtime`, `packages/modules` and `packages/adapters` product implementations remain separate from this compiler retirement. Useful product tests belong to those packages; future compiler cases must be derived from the new language specification.

## Availability boundary

The package root and `@proto.ui/compiler/browser` export `COMPILER_STATUS`, `CompilerUnavailableError` and `requireCompilerImplementation`. The latter always throws `PUI_COMPILER_NOT_IMPLEMENTED` before reading, executing or generating source. There is no legacy `parsePrototype`, `compilePrototype`, target profile registry or runtime-wrapper fallback. These status exports are temporary integration boundaries, not the replacement compiler API.

With Node.js 24, inspect the status from the repository root:

```sh
node packages/compiler/src/cli-entry.mjs --status
```

Any other invocation exits with status 1 and the explicit unavailable diagnostic. The command does not inspect input files or write outputs. The browser export has no Worker, network or WASM dependency.

Run the focused retirement checks:

```sh
node --test packages/compiler/test/retirement.node-test.mjs
```

These checks establish the availability boundary and absence of compilation side effects. They are not tests of the replacement language or evidence of target support.
