# Proto language compiler foundation

The package compiles a bounded 0.4 authoring surface through a shared TypeScript Program and checked component and behavior IR. The versioned Badge, controlled Toggle and owned async Tabs run in ordinary React and GPUI applications. The package also provides partial Proto lint and an editor analysis API.

| Target         | Replacement implementation |
| -------------- | -------------------------- |
| React          | Authored Badge, Toggle and Tabs with typed public state, requests and a loopback loader in Chromium |
| GPUI           | The same authored inputs and IR with native paint, pointer input and a file-backed Tabs loader |
| Vue 2          | Not implemented            |
| Vue 3          | Not implemented            |
| Web Components | Not implemented            |

## Direction

The replacement is a Proto language based on TypeScript syntax and compiler infrastructure. Its explicit `schema`, `init`, `derive`, `action` and `lifecycle` declarations lower through a typed semantic IR into target ASTs. React and GPUI are the first implementation targets; Vue 2, Vue 3 and Web Components remain required targets. LLVM is outside the initial implementation.

The [compiler design entry](../../internal/compiler/README.md), [foundation contract](../../spec/contracts/C-COMPILER-FOUNDATION-0001.yaml) and [lint contract](../../spec/contracts/C-COMPILER-LINT-0001.yaml) define the replacement. Complete phase, effect, capture and ownership coverage remains in development.

## Compiling an author source

With Node.js 24 and workspace dependencies installed, emit the checked-in Badge from its original source and helper. The GPUI command also requires Cargo. The CLI prints generated source by default and accepts `--out path` for atomic file output.

```sh
node packages/compiler/src/cli-entry.mjs compile internal/compiler/examples/readonly-badge.proto.ts.txt --target react --name AuthoringBadge
node packages/compiler/src/cli-entry.mjs compile internal/compiler/examples/readonly-badge.proto.ts.txt --target gpui --name AuthoringBadge
node packages/compiler/src/cli-entry.mjs compile internal/compiler/examples/controlled-toggle.proto.ts.txt --target react --name ControlledToggle
node packages/compiler/src/cli-entry.mjs compile internal/compiler/examples/controlled-toggle.proto.ts.txt --target gpui --name ControlledToggle
```

`produceComponentIR(program, { fileName, exportName, publicName })` is available through `@proto.ui/compiler/producer`. It uses the Program from `@proto.ui/compiler/frontend` and returns the target-neutral source closure with either checked IR or located diagnostics. Source spans use UTF-16 offsets. `exportName` defaults to `default`. `publicName` chooses the target binding independently of the prototype's debug name.

Compilation, lint and editor analysis prepare their inputs through `createProtoProgram({ rootNames, currentDirectory, project })`. The factory supplies the controlled `@proto.ui/core/authoring` declaration when no project mapping matches. An exact or wildcard mapping keeps TypeScript’s resolution precedence, including the base directory of an inherited `paths` setting. An unresolved project mapping stays visible in the closure. The producer exports `AUTHORING_DECLARATIONS` for callers that need the declaration path and checks the identity of resolved symbols and reachable helper bodies. The public Core/Adapter authoring runtime and application-source migrations have separate coverage requirements.

The Toggle's optional boolean input selects its mode at creation. A controlled click delivers a typed, immutable `{ active: boolean }` request. The committed public value follows the owner's accepted input. An uncontrolled instance initializes from `defaultActive` once and commits local changes. Both hosts reject a mode change on the same instance and retain its last accepted inputs.

The source producer also links nominal Context keys, pure provider values, required reads and stable text-keyed children in one compilation unit. The authored `LevelOwner` and `LevelReader` fixture exercises live provider updates, same-label key identity, replacement by an equal-valued provider and retained child initialization. Chromium observes a portal and GPUI observes physical detachment and reattachment.

The [keyed task owner](test/fixtures/authoring-keyed-tasks/owner.proto.ts.txt) declares two siblings whose text keys come from the parent's `first` and `second` props. Each child records its initial Context and starts one load for its own ID. Its rendered result includes the Context captured before suspension and the current Context read after the load completes. These values distinguish a retained child from a new child created with a previously used key.

`PairReader` issues two loads in one task. Its public `stage` records the Context at entry, after the first response and after the second response. React task continuations keep original function parameters that a reachable block reads, including parameters first used beyond another suspension. [Author source](test/fixtures/authoring-pair/owner.proto.ts.txt)

The versioned Tabs owner and `AsyncTabPanel` both reach the declared extern `authoring.load-tab`. Pass `--bindings host-bindings.json` to `compile` when emitting either export. The path is relative to the working directory. In this example the React entry names an ESM export and the GPUI entry names a Rust function in the consuming crate.

```json
{
  "react": { "authoring.load-tab": { "module": "./tabs-loader", "export": "loadTab" } },
  "gpui": { "authoring.load-tab": { "path": "crate::tabs_loader::load_panel_tab" } }
}
```

```sh
node packages/compiler/src/cli-entry.mjs compile internal/compiler/examples/context-owned-async-tabs.proto.ts.txt --export AsyncTabPanel --target react --bindings host-bindings.json
```

The React function takes the selected `string` and an `AbortSignal` and returns `LoadTabResult` or a `PromiseLike<LoadTabResult>`. The Rust function takes the selected `String` and `&mut gpui::AsyncApp` and returns `TaskOperation<LoadTabResult>` using the selected generated module's result type. Missing registration on the selected target reports `extern-unbound` at the actual await and includes the reached binding chain. The output file is replaced only after successful emission.

An immutable alias such as `const tag = result.kind` can select a tagged result in an `if` or `switch`. The selected payload belongs to that particular `result`, including when a helper receives two results of the same type.

Calling an ordinary synchronous helper from an owned task shares the current transaction segment. The caller can read a state write staged by the helper before publication. An early return resumes execution at the helper's call site.

## Native-source targets

Import `ComponentIR` from `@proto.ui/compiler/targets/ir`. `emitReact(ir)` from `@proto.ui/compiler/targets/react` returns TypeScript. `await emitGpui(ir)` from `@proto.ui/compiler/targets/gpui` returns Rust. The GPUI entry invokes its locked Cargo generator by default and accepts `{ generator: pathToBinary }`. Generated components import reached support from `@proto.ui/compiler/support/react` or the crate in `support/gpui`.

The host suites compile the versioned sources and import the generated components. They exercise Badge's text and nested styles, Toggle's native press and public requests, fixed-mode input rejection and owner updates. Additional direct-IR controls exercise instance captures, rollback, queued reentry and disposal. `PUI_CHROMIUM_EXECUTABLE` selects a system Chromium. `PROTO_UI_REACT_CONSUMER_DIR` and `PROTO_UI_GPUI_CONSUMER_DIR` retain generated modules and their source closure. The native crate also retains its SDK lockfile.

In GPUI, a host may retain a child's `Entity` while its view is hidden or physically detached. Its public actions and Context subscriptions remain active until the logical parent releases it or removes its key. An action on the retired entity returns `ActionOutcome::Disposed`. Creating a new child with the same key gives it its own state and subscriptions.

A scoped GPUI component withdraws or replaces its host bindings during the update. When generated code releases the last reference to an appearance callback or a style resolver, it runs its destructor on a later turn of the live foreground loop. A Rust resource captured by that callback can read a still-live entity through `AsyncApp` in `Drop`. Removing a key revokes the old instance’s actions immediately, including while its host resources await destruction.

For a component whose view or descendants use style tokens, supply a `ContextScope` with a live style resolver. If the scope was obtained from a retired entity, restoring its nominal Context values alone cannot restore that resolver. `mount` and `rebind` report `MissingContext::GPUI_STYLE_RESOLVER` in the error's `key` and identify the authored style expression. A rejected rebind preserves the live component's existing scope.

When updating the GPUI support crate, regenerate older Rust modules that access the former `BoundContext.provider` field. The generator now uses `BoundContext::provider()`, which can represent a withdrawn connection.

```sh
node --test packages/compiler/test/react-target.node-test.mjs
node --test packages/compiler/test/controlled-source-react.node-test.mjs
node --test packages/compiler/test/context-source-react.node-test.mjs
node --test packages/compiler/test/keyed-task-lifetime-react.node-test.mjs
node --test packages/compiler/test/tabs-source-react.node-test.mjs
node --test packages/compiler/test/extern-bindings-cli.node-test.mjs
node --test packages/compiler/test/gpui-target.node-test.mjs
```

## Shared frontend and partial lint

With Node.js 24, analyze one or more entries without executing author modules or writing generated files:

```sh
node packages/compiler/src/cli-entry.mjs lint path/to/component.proto.ts --target react --json
```

The frontend resolves imports, reexports and project `paths` using the nearest `tsconfig.json` above each entry. All entries in one invocation must resolve to the same project, or all use the standalone defaults. Supply `--project path/to/tsconfig.json` to select one configuration for entries from different projects. Explicit project paths and source arguments are relative to the working directory. API callers can set that directory with `currentDirectory`. The frontend enforces its controlled prelude, ambient-type policy and strict TypeScript checks.

`sourceClosure.configurationHash` identifies the effective source configuration. `sourceClosure.digest` also binds the roots, file bytes, module resolutions and positive and negative probes. These values can be compared across compile, lint and editor inputs, including a saved editor buffer with identical bytes. A target-specific analysis additionally has `analysisConfigurationHash`, which includes the selected target. Pair it with the source digest when identifying that analysis.

The closure records the selected configuration in `projectFile` and the original bytes of each configuration TypeScript reads, including inherited files. Project discovery records each candidate it checks. A nearer `tsconfig.json` appearing later invalidates saved evidence even when all previously listed files still match. Include the reached configuration files in the source inventory and provide snapshot coverage for the lookup paths. Regenerate older analyses that lack project evidence before reusing them.

Implemented checks cover boolean conditions, proven implicit numeric/text conversions, explicitly undeclared JavaScript code-unit operations and well-formed Unicode literals. Operations requiring unimplemented union correlation, phase/effect or capability analysis remain `compiler-missing`; they do not become new language bans. There is no automatic source rewrite.

The JSON report identifies language, rule-set and compiler versions, resolved source/dependency byte digests, configuration and all five targets. Its three status fields remain distinct:

| Field | Meaning in this increment |
| --- | --- |
| `sourceValid` | `false` when a defined violation is established; otherwise `null`, because full analysis is incomplete. |
| `analysisComplete` | Always `false`; missing analysis obligations are reported explicitly. |
| `targets[target].compilable` | `false` in this partial lint report. Compilation of a selected export runs its own source and target checks. |

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

The Node `compile` command returns 0 after emission, 1 for invalid source or a compilation error, 2 for unavailable compilation and 64 for an invalid invocation. The `lint` command reads source for analysis only. The browser export has no Worker, network or WASM dependency.

Run the frontend, editor, CLI and retirement checks:

```sh
corepack pnpm@10.32.1 --filter @proto.ui/compiler test
```

The frontend suites cover implemented source rules, shared diagnostics and source binding. The native suites exercise the two checked IR receivers.
