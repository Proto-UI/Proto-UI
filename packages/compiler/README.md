# Proto language compiler foundation

The previous private compiler is retired. This package now provides the first shared TypeScript frontend and partial Proto semantic lint, alongside the availability boundary. It produces no React, GPUI, Vue 2, Vue 3 or Web Components artifacts.

| Target         | Replacement implementation |
| -------------- | -------------------------- |
| React          | Not implemented            |
| GPUI           | Not implemented            |
| Vue 2          | Not implemented            |
| Vue 3          | Not implemented            |
| Web Components | Not implemented            |

## Direction

The replacement is a Proto language based on TypeScript syntax and compiler infrastructure. Its explicit `schema`, `init`, `derive`, `action` and `lifecycle` declarations lower through a typed semantic IR into target ASTs. React and GPUI are the first implementation targets; Vue 2, Vue 3 and Web Components remain required targets. LLVM is outside the initial implementation.

The [compiler design entry](../../internal/compiler/README.md), [foundation contract](../../spec/contracts/C-COMPILER-FOUNDATION-0001.yaml) and [lint contract](../../spec/contracts/C-COMPILER-LINT-0001.yaml) define the replacement. Old compiler APIs, generated snapshots and tests do not define the new language. Complete phase, effect, capture and ownership analysis, typed IR, target lowering and generated-consumer integration remain implementation work.

## Shared frontend and partial lint

With Node.js 24, analyze one or more entries without executing author modules or writing generated files:

```sh
node packages/compiler/src/cli-entry.mjs lint path/to/component.proto.ts --target react --json
```

The command resolves actual imports and TypeScript bindings, including aliases, reexports and project `paths`. `--project path/to/tsconfig.json` selects a project explicitly; otherwise it finds the current directory's config. The frontend fixes its own prelude, ambient-type policy and strict checks, so project flags cannot silently substitute JavaScript or host semantics.

Implemented checks cover boolean conditions, proven implicit numeric/text conversions, explicitly undeclared JavaScript code-unit operations and well-formed Unicode literals. Operations requiring unimplemented union correlation, phase/effect or capability analysis remain `compiler-missing`; they do not become new language bans. There is no automatic source rewrite.

The JSON report identifies language, rule-set and compiler versions, resolved source/dependency byte digests, configuration and all five targets. Its three status fields remain distinct:

| Field | Meaning in this increment |
| --- | --- |
| `sourceValid` | `false` when a defined violation is established; otherwise `null`, because full analysis is incomplete. |
| `analysisComplete` | Always `false`; missing analysis obligations are reported explicitly. |
| `targets[target].compilable` | Always `false`; none of the source backends is implemented. |

Exit status `1` means invalid source, `2` means analysis or the requested target is incomplete, and `64` means an invalid command invocation. Status `0` is reserved for a future complete requested analysis. A missing dependency is recorded in the closure and cannot produce a complete-input claim. An informational missing-capability diagnostic is not a compile success.

### Editor integration

`@proto.ui/compiler/frontend` exports `createProtoProgram`, `analyzeProtoProgram` and `analyzeProtoFiles`. `@proto.ui/compiler/editor` exports `analyzeProtoDocument` for a Node-based editor or language-server host. The editor entry accepts unsaved source/dependency snapshots and uses the exact same Program and analysis as the CLI. It returns source locations in zero-based UTF-16 editor coordinates; those transport coordinates do not change Proto's Unicode-scalar text semantics.

The editor adapter is an API for integration, not an installed VS Code extension or a completed TypeScript language-service plugin. Both analysis entries are private development surfaces. The package's browser export remains the dependency-free availability module and does not import the Node-based analyzer.

### Consumer source inventories

`@proto.ui/compiler/source-manifest` exports `createSourceManifest`, `verifySourceManifest`, `parseSourceManifest` and a read-only directory snapshot reader. An intake fixes repository revisions, explicit exported entrypoints, original file bytes and configuration. Verification reuses the shared frontend's actual dependency closure and invalidates prior input evidence when those inputs change. It performs no checkout, source migration or author-module execution.

File totals, prototype declarations and registered entries remain separate counts. Missing files and unresolved inventory stay visible. Even a `matched` input report leaves `sourceValid: null`, `compilationVerified: false` and `conformanceVerified: false`: matching an input is not execution evidence. The [Shenko intake](../../internal/compiler/consumers/README.md) records a real partial snapshot and the outstanding upstream and Adapter declarations.

## What was retired

The old parser and hand-maintained type/effect machinery, duplicated IR validation, source emitters, embedded runtime templates, Rust dynamic-value machinery, QuickJS browser engine, artifact linker and migration helpers have been removed. Their compiler-specific tests and generated fixtures have also been removed. Git history retains the old implementation.

The existing `packages/runtime`, `packages/modules` and `packages/adapters` product implementations remain separate from this compiler retirement. Useful product tests belong to those packages; future compiler cases must be derived from the new language specification.

## Availability boundary

The package root and `@proto.ui/compiler/browser` export `COMPILER_STATUS`, `CompilerUnavailableError` and `requireCompilerImplementation`. The latter always throws `PUI_COMPILER_NOT_IMPLEMENTED` before reading, executing or generating source. There is no legacy `parsePrototype`, `compilePrototype`, target profile registry or runtime-wrapper fallback. These status exports are temporary integration boundaries, not the replacement compiler API.

With Node.js 24, inspect the status from the repository root:

```sh
node packages/compiler/src/cli-entry.mjs --status
```

Compilation invocations exit with status 1 and the explicit unavailable diagnostic before inspecting input files or writing outputs. The separate `lint` command reads source for analysis only. The browser export has no Worker, network or WASM dependency.

Run the frontend, editor, CLI and retirement checks:

```sh
corepack pnpm@10.32.1 --filter @proto.ui/compiler test
```

These checks cover the implemented analysis rules, shared diagnostics, source binding and absence of compilation side effects. They do not establish complete language conformance or any target support.
