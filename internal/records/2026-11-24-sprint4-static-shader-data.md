# Sprint 4: proved static shader construction

Recorded 2026-11-23 UTC / 2026-11-24 Beijing. Base: `d0eb81d3c61c3d3e93e46c4151e78031273d6116`.

The four native Web compiler profiles now specialize proved immutable graph aliases and pure finite-data factories. The exact new authored fixture also executes through the real Runtime without Web globals. This completes a compiler coverage gap within the existing draft owned-pixels contract; it does not close either original compound Issue.

The original #1143 conditions remain **贯通 Presentation 准入中间表示与目标生成** and **贯通 shader Runtime 与 Compiler 实现契约**. Its live comments still name other Presentation input families, application backing-source leases, additional kernels and non-Web GPU realization. The live Issue does not enumerate a complete original input-family denominator. The rows below describe inspected definitions, not a replacement denominator.

## Implementation and independent correction

`shader-static-data.ts` interprets only a bounded, checked IR data subset at compile time. It resolves lexical binding identities, immutable references, own-data records/arrays, ordinary member reads, supported unary/conditional structure, pure helper calls, left-to-right argument/default evaluation and finite local returns. It never imports or executes author JavaScript. Existing source admission still applies; `ShaderPresentationDeclaration` annotations preserve graph discriminants where ordinary inferred values would widen them.

The proof follows mutation and escape through aliases and through factory results. It retains explicit `PUI4009` rejection for unproved data, mutable cells, effectful construction, recursion, scalar conversion intrinsics and arithmetic outside this bounded evaluator. A pure helper's captured container is admitted only while its uses retain the data proof. Independent review found an initial false refusal for a factory capturing an immutable pixel array. The correction distinguishes a pure return from an external escape and propagates an actual result escape back through the factory's captured dependencies. Captured module data and a same-named setup-local array now pass; exposing the factory or either direct/aliased result still rejects.

Target analysis retains the validated snapshot and derives the actual reached kernel set. Native emission uses that snapshot for direct upload/copy/tint calls. No graph evaluator, component-name dispatch, source-path dispatch or Runtime/Adapter dependency is added to generated output. Cold serialized IR independently reconstructs the same plan. A guaranteed abrupt factory remains abrupt; its following unreachable shader site neither attempts static construction nor acquires a shader host.

The Core shader API, physical host implementation, kernel source bytes, public package budgets and draft lifecycle remain unchanged. The new test fixture constructs the same graph through a pure factory capturing module data. Browser fixture generation passes the exact selected authored input to the real Runtime adapters and independently imports all four generated native artifacts.

## Executed evidence

The [machine receipt](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint4-static-shader/receipt.json) binds actual source hashes, original log hashes, toolchain and outcomes. Logs and independent reports are retained as lossless gzip files. These local runs occurred on an uncommitted candidate over the recorded base; they are not relabeled as runs on a later commit or as hosted CI.

| Evidence | Actual result and boundary |
| --- | --- |
| New static-construction cases | 21 passed: four-target inline/alias/factory/captured-data plan equivalence, cold IR, rename/re-export, eight refusal controls, dormant local escape and abrupt-factory elision. |
| Existing native shader admission | 18 passed, retaining snapshot/resource bounds, unsupported target and reached kernel closure controls. |
| Existing project closure | 4 passed, retaining independent entry closure and modified/missing support rejection. |
| Runtime without Web globals | 4 passed: both exact authored fixtures execute real setup, mount, detach, remount and disposal; created-time absence acquires no physical view. |
| General target analysis | 7 passed. The final focused run totals 54 passed, zero failed and zero skipped. |
| Independent review probes | 48 general and 24 captured-data probes passed. Every counted negative traversed source admission and reached the new `PUI4009` proof boundary. The capture-pair report records unchanged source fingerprints during its run. |
| Strict generated consumers | All four profiles passed with copy-only, tint-only, combined and static-factory artifacts. Vue2 retains `checkJs`; the other strict checks are unchanged. Each selected invocation intentionally omits the other three profiles; the four completed invocations cover the full profile denominator. |
| Compiler source types | The changed compiler source closure passed a strict TypeScript program. Initial inner-function narrowing errors were fixed by retaining the admitted `shaderPlans` in the emitter's outer scope. |
| Draft entity authoring | The two changed catalog inputs passed against the recorded base. The normal `tsx` CLI was blocked by its IPC socket; `node --import tsx` ran the same authoring implementation without that optional CLI server. |
| Actual browser | The sandboxed Chromium launch failed at `socket() ... Operation not permitted` before opening a page. All 28 cases were skipped; there is no new pixel, visual, physical GPU or browser-lifetime acceptance. Final source builds successfully produced both exact fixtures and eight target artifacts, with full build manifests retained. |

Two strict-test attempts ended with `Worker exited unexpectedly`; they produced no complete consumer result. The log does not establish an OOM diagnosis. The final Vue2 and WC processes passed the same assertions with `NODE_OPTIONS=--max-old-space-size=1536`, while React and Vue3 passed in individually selected processes without that heap setting. The failed attempts remain in the receipt.

The browser command to resume on an executor supporting sandboxed Chromium is:

```sh
PROTO_UI_RUNTIME_EVIDENCE_DIR=/absolute/evidence-directory \
  corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/shader-presentation.browser.test.ts \
  --maxWorkers=1 --minWorkers=1
```

The existing launch remains `headless: true`, `chromiumSandbox: true` and the repository's `chromeExecutable()`. The expanded suite retains the original twenty cases and adds eight real Runtime/native journeys for the static factory across WC, React, Vue3 and Vue2. It does not substitute handwritten HTML or weaken the independent pixel oracle.

## Inspected Presentation and shader boundary

| Inspected input or source family | Definition and current implementation | Remaining original condition |
| --- | --- | --- |
| Phase/attempt owner, completion receipt and deadline | `C-FEEDBACK-PRESENCE-PRESENTATION-0001`; authored Transition and ordinary IR operations already exist. | Original complete source-key acceptance and independent consumer combinations remain separate from this shader change. |
| Presence affine translation and opacity | Core admits finite px/rootText/ownBox endpoints and readable State selection. The first Web physical profile requires a neutral entered baseline and explicitly settles other valid endpoints as unsupported. | Actual full applicable source/host/Document/Shadow/native evidence; no arbitrary scale, cycle or layout-motion support is inferred. |
| Static owned RGBA8 shader source | `C-FEEDBACK-SHADER-PRESENTATION-0001`; copy/tint with explicit color, alpha, resource bounds and physical retirement. | This change fills proved alias/factory construction. Final browser and integration acceptance remain required; other kernels and backends are untouched. |
| Application-owned scene | Existing `MaterialSourceRequest` has an `owned-scene` slot. The Web material provider has a real canvas lease with scope, Document, revision, invalidation and disposal. | The shader declaration still accepts only `owned-pixels`. A shader source lease needs explicit binding of this existing source identity, extent, color conversion, revision, fallback and stale decode retirement through Runtime and native output. A canvas lease alone is not that implementation. |
| Image/texture, video, compositor backdrop, captured scene and reconstructed scene | The typed-effect-graph ADR distinguishes these source classes and their freshness/coordinate contracts. Existing material `in-app-backdrop` and `behind-window` requests do not manufacture a shader capability. | Each actual provider/target needs its own admitted source mapping and consumer evidence. The classes cannot be silently interchanged or counted from filenames. |
| Non-Web GPU realization | Shader source targets remain unsupported; native GPUI/Qt/Flutter implementation elsewhere does not imply shader execution. | Audited kernel ABI, actual native resource and source ownership, execution and consumer evidence remain original work. |

## Relation to #1089's original eight conditions

This change retains pure authored source and source provenance, explicit admission and host boundaries, real no-DOM execution, host-neutral compiler analysis, direct lowering without copied Prototype logic, and a snapshot shared with the Runtime contract. Cold IR and renamed/re-exported inputs test source identity independently of naming. Mutation and escape controls test disagreements the implementation must reject. The independent CPU/GPU oracle and actual browser suite remain available; the new browser invocation did not execute.

Those facts contribute bounded evidence to the original eight conditions. They do not certify all changed shared definitions, all independent implementations or the complete Shenko/Verdant application combinations. Existing application results retain their original revisions and their temporary-consumption limits. The current baseline already supports explicit `sourceLicense` for Rust data artifacts and omits a default generated crate license; the older hardcoded-MIT finding is not a new implementation task. Actual Verdant regeneration with that option, provenance and adoption remain separate consumer acceptance.

No Issue was closed, no spec was promoted and no application pin was changed by this local contribution.
