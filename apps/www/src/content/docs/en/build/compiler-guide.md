---
title: 'Compiler Guide'
desp: 'The 0.2 release boundary and the separately verified private compiler experiment'
description: 'The 0.2 release boundary and the separately verified private compiler experiment'
---

Proto UI 0.2 does **not** ship a Compiler implementation or a Compiler authoring workflow. There is no `@proto.ui/compiler` package, compiler entity type, official compiler profile, CLI compile command, or supported compiler input/output artifact in the 0.2 release.

Release support and repository experiments are separate. The private experiment described below does not change the 0.2 package, catalog, CLI, or official-support boundary.

## Prerequisites

Read [Chapter 5: Translation Layer](/en/whitepaper/5-translation-layer/) for the conceptual distinction, [Core](/en/specifications/core/) for portable syntax, and [Runtime Architecture](/en/build/runtime-architecture/) for the current execution path.

## What 0.2 actually ships

| Layer | Current responsibility |
| --- | --- |
| `@proto.ui/core` | Prototype definition, setup/render syntax, template structures, module declarations, Rule authoring types |
| `@proto.ui/runtime` | Materialize a Prototype, run Modules, own lifecycle/update flow, hand commits to a host |
| Official Adapters | Translate Runtime output and semantic host capabilities for Web Component, React, and Vue profiles |
| `@proto.ui/cli` | Initialize projects and generate themes, tokens, styles, and component preset material; it is not a Prototype compiler |

The current production route is therefore:

```text
Prototype TypeScript → Runtime execution → official Adapter → Web host
```

A Compiler route was not shipped in 0.2:

```text
portable analyzable input → [future Compiler] → host artifacts
```

Nothing in 0.2 promises the second route's accepted source language, optimization model, generated files, runtime footprint, or compatibility policy.

## Constraints that already apply

Even without a Compiler package, cataloged protocol boundaries constrain any future official translation:

- `K-PROTOTYPE-COMPOSITION-0001`: templates describe one Root Node; they do not embed another Prototype definition.
- `C-TEMPLATE-0005`: the v0 slot is anonymous, singular, and parameterless.
- `C-TEMPLATE-0006`: an official Adapter or Compiler encountering `PrototypeRef` as a template node must reject it rather than inventing private composition.
- `C-RULE-0003`: Rule declarations produce serializable `RuleIR` without functions, host references, closures, or live handles.
- `C-MODULE-DECLARATION-0001`: static typed Module declarations are available before Module construction and potential host selection.

These are protocol constraints, not a Compiler SPI. They do not specify a parser, AST format, incremental build graph, code generator, or deployment artifact.

## Static intent versus arbitrary functions

Some authoring forms preserve more analyzable intent than callbacks. Rule is the clearest current example: it separates condition from semantic intent and compiles internally to `RuleIR` for Runtime evaluation. That does **not** mean the repository has a general Prototype compiler, nor that arbitrary callback bodies can be translated losslessly.

Use declarative forms when they accurately express behavior, but do not rewrite working 0.2 semantics around an imagined compiler. `internal/contracts/integration/portability-and-integration.md` discusses this longer-term direction as explanatory, non-normative material.

## No supported Compiler inputs or outputs in 0.2

| Question | 0.2 answer |
| --- | --- |
| Can a `.proto.ts` file be compiled without Runtime? | No supported workflow |
| Is `TemplateChildren` a stable compiler IR? | No; it is current Core/Runtime template data |
| Is `RuleIR` a complete Prototype IR? | No; it covers Rule only |
| Can CLI emit React/Vue/Custom Element components from a Prototype? | No |
| Is zero-runtime delivery supported? | No; it remains future direction |
| Is there a Compiler conformance matrix? | No Compiler entity/profile exists |

If a future proposal needs one of these answers to change, it requires explicit catalog and API work rather than documentation inference.

## Private repository compiler experiment

`packages/compiler` is an implemented **private experiment**, not an official Compiler distribution. Its manifest retains `private: true` and `protoUi.release.scan: false`. The private compiler CLI is separate from the published `proto-ui` CLI; publication, catalog admission and maintained compatibility require their own approval.

### Implemented profiles and compatibility

| Private profile | Exercised target | Output dependency boundary |
| --- | --- | --- |
| `react-runtime-v1` | React / React DOM 19.2.6 | Retains Proto UI Core, Hooks and React Adapter; not Runtime-independent |
| `react-dom-source-v1` | React / React DOM 19.2.6 | Target framework plus emitted native helpers; no Proto UI Runtime/Adapter |
| `vue-source-v1` | Vue 3.5.31 | Target framework plus emitted native helpers; no Proto UI Runtime/Adapter |
| `vue2-source-v1` | Vue 2.6.14 | Target framework plus emitted native helpers; no Proto UI Runtime/Adapter |
| `web-component-source-v1` | Custom Elements v1 | Emitted native helpers; no framework or Proto UI Runtime/Adapter dependency |

The registry also identifies GPUI, Qt and Flutter source profiles and four Web SSR profiles. GPUI artifact generation does not establish complete native Adapter parity or browser preview support; Qt, Flutter and the four SSR profiles currently reject as unimplemented. A profile's concrete tested target version is not a compatibility promise for other versions. Restricted source admission, semantic IR version **5**, target profile identity and emitted helper ABI **1** are separate private compatibility dimensions; neither IR nor helper files are a public plugin SPI.

The frontend reads a closed, root-contained TypeScript source graph without importing or evaluating the author program. It admits checked data, primitive/control-flow callbacks, static helpers and authored hooks, explicit updates, named State and typed exposes, Props and Context reads/watchers, one-Root templates, serializable Rule conditions and style intent, and the declared native event/focus/accessibility slice. Unsupported syntax, phase/capture authority, operations, target versions and missing host capabilities are diagnostics, not silent bridges.

Static Module requirements can use checked declaration arrays, checked array spreads, or a statically resolved `modules` snapshot from an admitted `definePrototype`/`defineAsHook` descriptor, including local import/re-export aliases and literal `['modules']` access. Only admitted declaration factories are decoded; no factory, getter or computed lookup from author input is executed. Cycles, reads before initialization and duplicate declaration IDs reject. The selected caller Prototype's explicit declarations determine pre-render Root selection; invoking an authored hook during setup does not implicitly promote its requirements into that caller. This bounded admission and physical-Root repair does not establish all canonical sources, every Module projection or complete target/Adapter parity.

Native templates keep child style separate from Root feedback and support the singular anonymous slot. Arbitrary attributes, `PrototypeRef`, multiple/named slots, native interaction groups/portals and operations outside the admitted interaction vocabulary remain unsupported. Raw host events are opaque; raw Props snapshots are available, but arbitrary raw-member access is not treated as typed portable data. The setup style `unUse` and Rule declaration disposer stay setup-only; runtime changes use Rules and `run.feedback.style.patch/suppress/clearPatch`.

State writes and feedback projection do not themselves request a template render. Explicit authored update intent remains separate from host policy: React/Vue 3 consumers exercise authored updates; the default Vue 2 props policy and Custom Element `setProps` can explicitly request semantic updates. View detach retains instance state, exposed handles, Context and pending intent; terminal disposal closes them. Framework wrappers compose components through their native ownership mechanisms, not Prototype nodes inside templates.

The four Web source profiles lower ExposedState Host projection into a standalone supporting helper. Names use the State semantic, falling back to the exposure key, and share the existing Module's official aliases and normalization. Boolean `true` adds an empty attribute and `false` removes it; string/enum values write attributes, discrete numbers write attributes and CSS variables, and continuous numbers write only CSS variables by default. The JavaScript compile APIs accept the existing `exposeStateWebMode` flags `allowStringVar` and `allowContinuousAttr`. This is a Web extension, not a DOM projection promise for GPUI, Qt or Flutter.

Projection subscriptions belong to the eligible view epoch and replay on host/commit changes, including distinct presentation mirrors. Detach and terminal disposal invalidate queued writes without disposing retained upstream State during detach. Readonly Focus and Scroll States preserve their semantic names and numeric kinds. Erasing or restoring old DOM artifacts and collision ownership remain unresolved in the governing contract; this helper does not invent those policies.

### Local commands and consumer ownership

Run from the repository root with its development dependencies installed. Choose a fresh output directory:

```sh
node --import tsx packages/compiler/src/cli-entry.ts check packages/prototypes/base/src/button/button.proto.ts --root . --profile react-dom-source-v1
node --import tsx packages/compiler/src/cli-entry.ts compile packages/prototypes/base/src/button/button.proto.ts --root . --profile react-dom-source-v1 --output .cache/compiler-guide-button
node --import tsx packages/compiler/src/cli-entry.ts diff packages/prototypes/base/src/button/button.proto.ts --root . --profile react-dom-source-v1 --output .cache/compiler-guide-button --json
node --import tsx packages/compiler/src/cli-entry.ts watch packages/prototypes/base/src/button/button.proto.ts --root . --profile react-dom-source-v1 --output .cache/compiler-guide-watch --json
```

`inspect` prints checked IR; `explain` reports the profile, requirements and dependencies. `--config` explicitly selects JSON with `entry`, `root`, `export`, `output`, `profile` and `json`; configuration paths are relative to that file, command-line paths to the working directory. Command-line values override configuration, and unknown/repeated flags or fields fail.

Compilation plans source, supporting helpers, standard source maps and hash/provenance manifests before create-only publication. Existing consumer files are never overwritten. `diff` is read-only and identifies consumer modifications against recorded hashes. `watch` publishes immutable `<output>/<session UUID>/revision-<N>` generations, retaining the last successful generation on rejected input; it does not maintain a mutable latest pointer. Consumer edits require a normal target rebuild. The original compiler map remains historical and can be stale after an edit; a rebuild supplies the current executable-to-edited-source map.

### Executed evidence and measured costs

The private verification runs compile and mount three-component/Context assemblies in physically isolated consumers for all four native profiles, type-check generated TypeScript and helpers, rebuild and execute a consumer-owned template edit, reject an introduced syntax error, and verify the physical dependency tree and artifact hashes. Vue 2 JavaScript component bodies are not `checkJs`-validated. A separate offline private-package rehearsal executes the bundled compiler JavaScript API in plain Node and records tarball integrity, bundled compile-time inputs, dependencies, BOM and licenses; this is not an official package or public declaration-file release.

Real Chromium evidence independently checks the original React Adapter, runtime-backed output and native React output for explicit update/detach/reattach contracts and a finite Rule/style/AX/input program. Missing-update and duplicate-activation mutants fail those observations. Separate real failing generated callback stacks resolve through standard executable-to-generated and generated-to-author maps; automatic map composition is not claimed.

Replay the isolated native consumer measurement with:

```sh
node --import tsx scripts/compiler/native-consumer-smoke.mjs
```

Each run retains `summary.json`, `timing.json`, `costs.json`, runtime traces, diagnostics and dependency integrity in its printed evidence directory. Measurements cover cold/hot/changed compilation, whole-process peak RSS and coarse memory snapshots, emitted/supporting source and dependency payload bytes, real framework initialization/update/teardown, retained handle identity and observed instance/view-epoch/Root counts. They do **not** measure exact allocation counts, garbage collection, native-browser layout latency or Adapter-relative speed. Happy DOM consumers are one-sided evidence; the finite Chromium program is not general equivalence, SSR/hydration support or a claim that compiled output is universally faster or smaller.

### Browser WebAssembly execution

The private `@proto.ui/compiler/browser` API runs the **same canonical compiler inside QuickJS WebAssembly**, with a caller-owned module Worker. This is WASM-hosted JavaScript compiler execution, not an ahead-of-time TypeScript-to-WASM rewrite. The caller must independently trust the supplied compiler bundle; authored source remains AST input, never evaluated. The host binds UTF-8 SHA-256, while virtual source paths retain the normal POSIX semantics. It does not supply a browser filesystem or download imported author modules.

Build the trusted bundle and its TypeScript-version/digest manifest from the repository root:

```sh
node scripts/compiler/build-browser.mjs
```

In a Vite consumer, load the generated `compiler.js` as text and `build.json` as data, then call `createBrowserCompilerClient(bundle, build)`. Submit `{ format: 1, revision, source, options: { fileName, profile, files?, exportName?, componentName?, exposeStateWebMode? } }`; `files` is a closed map of virtual paths to source text. A target profile is required and is never silently replaced. The optional Web projection mode accepts only the two boolean flags above; malformed modes reject at the Host boundary. A successful response includes the canonical generated source, supporting files, dependency versions, provenance and source map, together with its source identity, compiler-bundle identity and request revision. It **does not mount or execute generated target code**.

Use a Vite `?raw` import or an untransformed public asset for the trusted bundle. Fetching Vite-transformed JavaScript can add a source map and change the bytes; the build-identity check correctly rejects that response. Do not replace the manifest digest to accept transformed delivery.

The digest comparison checks **bundle/manifest consistency, not authenticity**. The caller supplies both values; changing both permits the changed program to execute. Fetching `compiler.js` and `build.json` from the same mutable location does not establish a separate trust anchor. Authenticate or pin the compiler delivery through the application's trusted deployment configuration or verified supply chain before calling this API. It supplies no independent signature verifier or trust root, and its resource limits do not make arbitrary compiler programs safe to accept. Controlled tests deliberately change the compiler program and recompute its manifest for trusted-entry fault injection; those tests demonstrate this consistency-only boundary.

Source rejection returns `phase: 'compile'` with the normal diagnostic code/category/file/span. Host rejection returns `phase: 'host'`, distinct from source diagnostics. Admission validates the serialized request inside the trusted entry before compilation can supply defaults; target fields lost through inheritance, nonenumerability or `toJSON` are rejected. Worker construction, initialization and transport errors reject the client promise. Overlapping edits retain one running request and only the newest queued request; superseded requests reject with `AbortError`. Each call binds the submitted revision and source graph, including queued nested `files`, independently of later caller mutations. Call `dispose()` on navigation or terminal owner teardown; it terminates the Worker and rejects pending work.

The configured limits are 256 KiB of UTF-8 serialized input, 128 MiB of WASM heap, 2 MiB of VM stack, 8,388,608 output characters, a 30-second initialization deadline, a five-second VM compilation deadline and a ten-second Worker response deadline. These are resource/failure boundaries, not an admitted instantaneous-preview performance budget or a measurement of whole-browser memory.

Actual Chromium module-Worker evidence compiles the repository's canonical Base Button through WASM. The captured artifact matches ordinary Node compilation and direct WASM execution; separate comparisons cover all four Web source emitters, Unicode source/graph identity, source-located rejection and graph insertion order. In one local observation, initialization took 2.83 seconds and compilation 116 milliseconds; the trusted compiler JavaScript was 5,035,825 uncompressed UTF-8 bytes and the QuickJS WASM asset 503,134 bytes. These single samples do not establish cold/warm distributions, mobile support or a startup budget. The permanent WASM regression also injects a nonterminating **trusted entry** to verify interruption, subsequent canonical compilation and terminal disposal; it never evaluates authored input.

The review repair compares actual Chromium Worker results with Node for all twelve registered profile identities, plus Unicode GPUI fields and embedded-NUL source. GPUI Rust artifacts, including Cargo package identity, now match without a Node `Buffer` global; the SHA-256 bridge preserves NUL separators. Qt, Flutter and the four SSR profiles still return their canonical unsupported-target diagnostics. These are compiler-artifact comparisons, not native-widget execution, generated-preview sandboxing or new target admission. The source-bound repair receipt is in `internal/compiler/browser-wasm-evidence.json`; the earlier timing sample above remains historical.

The ExposedState repair separately mounts all four original Web Adapters alongside generated native consumers: 18 scalar/mirror surfaces exercise writes without structural rendering, real detach and retained-State remount; eight readonly surfaces exercise actual focus/blur and continuous Scroll projection. Actual WASM Worker comparison covers 23 successful complete outputs, the Web-only GPUI mode rejection, six unimplemented-profile rejections and four malformed mode requests. Earlier failed observations and corrected driver mistakes remain recorded. The Root and Scroll marker gaps observed in that revision are addressed by the follow-up below; these bounded observations are not complete Adapter parity or RuntimeBox migration.

Static Module declarations select the physical Root before rendering, but only an invoked hook activates its image or text properties. Inactive declarations must not overwrite consumer-owned alternative text, image fit or editing values. Generated Custom Elements mark the connected canonical host with `data-pui-root`, not a template child or physical image/input part; their constructors do not add host attributes. Activated Scroll surfaces expose the negotiated `data-pui-scroll-projection` marker, measured position/visible-ratio facts and view-scoped readiness. Detach returns the projection to `unresolved`; remount renegotiates the live Root. TextControl owns the client editing value, without a competing Vue 2 or Vue 3 VNode writer. Explicit updates preserve a composing value and composition end restores the controlled value; server serialization retains its separate value path.

The follow-up compiles seven controlled Prototype fixtures through the actual browser WASM Worker to all four Web source profiles: 28 complete outputs match Node, then the unmodified emitted modules mount beside their original Adapters as 56 real surfaces. Evidence covers inactive/active image and input declarations, controlled editing, ordered template children, measured Scroll requests, detach/remount and terminal cleanup. Composition events are synthetic events in Chromium, not OS/IME automation. The shared stylesheet supplies geometry only; it does not inject Module values, Root markers, overflow policy or Scroll facts. Raw attributes, markup and remaining Custom Element presentation differences are retained in `internal/compiler/browser-wasm-evidence.json`. This does not admit native widgets, SSR/hydration profiles, every canonical Demo, RuntimeBox mounting or an editor/security boundary.

An additional Root review repair delivers Scroll's `system` → `unresolved` notification during physical detach, including the authored watcher, without reopening input or terminal-owner guards. Four original/generated Web pairs exercise detach and retained-owner remount; seven complete browser Worker outputs match Node. The Custom Element Root marker is acquired only when the validated port accepts an owner, then restored on disposal unless the consumer has replaced it. Required-Context initialization failure and two shared-port hydration mismatches leave no generated Root marker or owner; an actual provider permits a fresh client owner. Existing marker baselines and later consumer writes survive disposal. These port checks use the unadmitted private serializer only to reproduce the shared client helper; they do not admit SSR/hydration. Raw event reasons, terminal notification differences and the original Web Component Adapter's failed-initialization marker/recovery gap remain recorded. All fourteen reproduction containers are empty after disposal, eight retained getters reject, and the four intentional initialization errors are retained separately from unexpected errors.

Canonical scalar Props now preserve the author contract across source admission, checked-IR validation and the five implemented source targets. String enums retain their options as descriptor metadata, including an empty-string option; a later superset declaration does not invalidate an earlier watcher. Descriptor/default validation and repeated declaration merging are atomic: the established default and stricter empty policy survive, narrowing rejects, and widening diagnostics are emitted only after a successful merge. Missing keys use the latest defaults without reusing previous host values. Provided empty or invalid values follow their declared policy and independent per-key previous-valid fallback; an accepted empty value does not erase that history.

The source-bound Props run compiles three controlled fixtures and the canonical Base Scrollbar/Tabs List graphs through the actual browser WASM Worker to four Web profiles and GPUI: **25 complete outputs match Node**. Four original/generated Web consumers exercise the controlled fixtures and canonical Scrollbar as **32 real surfaces / 68 step observations**, with matching desired values and change payloads before and after explicit public updates. The original Vue 3/Vue 2 repair first reproduces a lost queued commit: completing one commit may synchronously install the next signal, so each Adapter must capture and clear only its own signal before callbacks. The repair preserves host auto-update policy and disabled-auto-update conformance. All 32 containers are empty after disposal, with no captured errors. Earlier stale-Vue observations and incorrect driver assumptions remain in the evidence ledger rather than being rewritten as passes.

The actual GPUI headless-window consumer separately exercises provided-empty, missing and invalid canonical Props through creation, physical commit, `set_props` and terminal disposal. Its generated Rust and SDK source remain byte-identical after the Web repair; no repeated native build or native enum/range-widget breadth is inferred. Canonical Tabs List's graph compiles, but its required real Tabs provider preview is not yet exercised. These observations do not establish full raw-DOM/terminal-event Adapter parity, complete native targets, SSR/hydration admission or a migrated RuntimeBox/editor/security boundary.

The five implemented source targets also admit `props.watchAll`, `props.watchRaw` and `props.watchRawAll`, with checked string-array fields in `WatchInfo`. The emitted helpers preserve the existing contracts: initial application is silent, raw-all callbacks precede keyed raw callbacks, all raw callbacks precede resolved callbacks, and matching resolved callbacks share setup registration order. Comparisons use `Object.is`, including signed zero and host-local object identity. Top-level `undefined` becomes `null` before the frozen raw snapshot, matching Core; nested host-local values are neither copied nor promoted to portable JSON. Arbitrary opaque raw-member access remains rejected.

The source-bound watcher run compares **ten complete actual WASM Worker outputs with Node**, then mounts two fixtures across all four original/generated Web pairs as **16 real surfaces / 120 pair observations**. Resolved payloads, signed-zero observations and authored traces match throughout, including explicit updates. Generated Vue 3 reads the normalized component props/attrs source rather than reviving a VNode-only `+0` → `-0` change. A separate real Vue pair verifies that repeated raw reads share the current snapshot and raw callbacks receive that snapshot; equal new objects notify, but the same retained object does not. All 18 containers are empty after disposal, eight retained State getters reject, and no errors are captured. Vue 2 raw changed-key arrays retain their different props/attrs ordering; the original observations are not sorted or rewritten, and universal raw parity is not claimed.

The original Runtime repair restores the incoming execution phase after synchronous rendering, including when rendering throws. An authored watcher may call `run.update()` without stripping the callback authority required by later watchers; mutation guards remain intact. Actual GPUI headless-window evidence exercises the watcher-family fixture's groups, key metadata, unchanged/invalid/missing inputs, signed zero and terminal ownership. Its generated Rust and SDK bytes still match the tested generation; both captured GPUI artifacts are unchanged. The window proof is reused without claiming another native build or a separate identity-fixture window run. The earlier source-admission, ordering, Runtime-phase and Vue failures remain in `internal/compiler/browser-wasm-evidence.json`. This increment does not complete native targets, SSR/hydration, all canonical Demo admissions, or RuntimeBox/editor/security migration.

### Website-wide migration inventory

Regenerate the source-bound inventory with:

```sh
node --import tsx scripts/compiler/website-demo-inventory.mjs
```

`internal/compiler/website-demo-migrations.json` records every demo-bearing MDX documentation page, homepage/library/Matrix expansion, demo declaration, registration binding and canonical prototype definition. It follows imported Astro wrappers, including both `UiLibraryGallery` mounts, and retains the underlying preview's file/line address. Literal equality choices resolve finite template-generated demo IDs without executing author scripts; unresolved dynamic mount attributes remain explicit row obligations. It reuses the Website's manifest-exported source resolver and records actual canonical Node admission diagnostics rather than substituting an Adapter. The current inventory has **122 pages, 65 demo declarations and 145 prototype definitions**; five definitions pass the selected Web Component source profile and 140 are rejected by current source admission. Canonical Base Scrollbar and Tabs List join the earlier three admitted definitions; this is not page migration. All registration/source addresses are resolved. No page is excluded merely because compilation fails.

Every migration row remains **not migrated**. This inventory and the browser compiler API do not close [#817](https://github.com/Proto-UI/Proto-UI/issues/817): canonical-source admission gaps, supported-target RuntimeBox mounting, optional editing, revision-consistent diagnostics/preview, failure rollback, lifecycle/security boundaries and per-page browser evidence remain explicit obligations. Existing RuntimeBox frame ownership stays with [#786](https://github.com/Proto-UI/Proto-UI/issues/786) / [#777](https://github.com/Proto-UI/Proto-UI/pull/777). A WASM compiler does not sandbox generated preview code.

## Contribution boundary

A Compiler proposal begins as Agent-led governed research. Research, candidate entities, implementation probes, and executable evidence may proceed immediately; only product choices not decided by current authority become an attended decision. The proposal must identify at least:

1. the portable source subset and how unsupported constructs fail;
2. the output host and ownership of generated artifacts;
3. semantic parity with existing Contract criteria;
4. lifecycle, capability, and component-composition treatment;
5. a versioned identity and executable conformance model; and
6. migration and coexistence with the Runtime/Adapter path.

Do not open an implementation PR by treating `packages/modules/rule/src/compile.ts`, CLI style generation, or a bundler transform as the missing Compiler architecture. Those are bounded implementations with different owners.

## Verification of the current boundary

The following checks exercise the portable template and analyzable Rule constraints that exist today:

```sh
corepack pnpm@10.32.1 vitest run packages/core/test/contract/template.normalize.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/adapters/web-component/test/contract/template.no-prototype-composition.v0.contract.test.ts
corepack pnpm@10.32.1 vitest run packages/runtime/test/contract/rule.props-style.smoke.v0.contract.test.ts
corepack pnpm@10.32.1 check:types
```

For work that can ship now, continue to [Runtime Architecture](/en/build/runtime-architecture/), [Module & Extension Architecture](/en/build/module-extension-architecture/), or the bounded [Adapter Guide](/en/build/adapter-guide/). For future sequencing, see [Roadmap](/en/project/roadmap/).
