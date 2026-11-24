# Sprint 4: explicit application scene shader binding

Recorded 2026-11-23 UTC / 2026-11-24 Beijing. Base: `4009346439913420769db1fa777354c6479f4846`.

This draft slice connects an explicit application-owned canvas scene to the existing finite shader pipeline. The same portable `owned-scene` slot is accepted by Core, real Runtime execution and the four native Web compiler profiles. Application source authority enters through a shared host capability, outside portable Props and IR. This addresses the backing-source gap recorded in [the preceding static-data slice](2026-11-24-sprint4-static-shader-data.md); it does not establish every original Presentation input family, another shader kernel, non-Web GPU support or complete acceptance of #1143 and #1089.

The updated C/HC/T entities remain **draft**. The current user authorized making this bounded implementation and its host protocol reviewable. No stable lifecycle, source provenance, independent acceptance, release or hardware evidence is inferred from that authorization.

## Source and host boundary

The portable declaration contains `{ kind: 'owned-scene', slot: 'mainScene' }`. Its finite slot is ordinary own data, with no getter, provider function, DOM element or arbitrary URL. Core freezes the snapshot; static compiler analysis and cold IR validation preserve it. Only a reached scene source emits `createComponent` and `createShaderHost`. Existing ordinary and owned-pixels output keeps its previous exports and legal component names. Configured native factories close over the host capability without passing it through component Props, attributes or serialization.

The shared `createWebShaderHost({ ownedScenes })` constructor accepts the borrowed `current` and `subscribe` interface of the existing application `CanvasBackdropLease`. React, Vue, Vue2 and Web Component Runtime adapters receive that capability through their `shader` option. Native consumers receive the structurally identical capability through `createComponent(createShaderHost(...))`; the shared Runtime constructor can also configure a native factory. An unchanged default export remains usable with an opaque fallback and no source capability.

This source is a complete application-owned scene sampled over normalized UV coordinates. It is not an implicit viewport backdrop crop. The existing `in-app-backdrop` meaning is unchanged. The canvas must remain a direct child of its declared scope, connected in the same Document as the current target, and within the target's current composed scope. A scene cannot recursively capture the target. The host observes the actual Documents and ShadowRoots on the current composed ancestry, including slot changes; it does not scan a global registry or capture other documents.

The existing canvas lease supplies opaque sRGB bytes. The scene host independently converts them to the shader's premultiplied linear RGBA8 representation; it does not pass an sRGB frame through a misleading type assertion. Alpha must be 255. Each dimension is at most 1,024, the input has at most 262,144 texels, and the reached source plus pass resources obey the existing 16 MiB bound. Whole-scene extent is checked when a frame is acquired because it is not a constant in portable IR.

Source revisions are monotonic for a borrowed source. Reusing a revision with a different immutable frame, changing canvas extent without a corresponding frame, leaving the scope, changing Document, losing the source or invalidating the source during decode retires the old work. Same-scope restoration can reacquire the same still-current immutable frame. No source draw, revoke or dispose method is delegated to the shader consumer; the application retains that authority.

## Lifecycle and independent findings

Source callbacks and host capabilities can synchronously reenter ownership operations. The implementation detaches old state before external cleanup, retains each returned unsubscribe once, rejects late callbacks and bounds a nonconvergent synchronous invalidation drain to eight turns. Current, subscribe and cleanup failures retain fallback and diagnostics. The physical presenter rechecks source identity, revision, scope, target and Document immediately before actual decoded publication, so a delayed MutationObserver is not the publication guard.

The Runtime sink advances its common view/revision boundary only after declaration and frame validation succeed. Stale input retains the original `shader-stale-frame` diagnostic. A capability factory returning after release or a newer request, including an owned-pixels request, cannot commit and is disposed. A valid source-kind change at the low-level sink first detaches and retires the previous physical or scene publisher; cleanup reentry cannot reclaim its replacement. Ordinary Feedback declarations remain frozen after setup. These low-level controls do not claim that a mounted Prototype dynamically edits its declared source kind.

Independent review identified and preserved the following initial failures:

- Document-only observation missed source-scope movement entirely inside ShadowRoots. The host now observes the actual composed root chain.
- Returning to the original scope with the same immutable frame did not resume execution. The current source-availability state now permits that recovery.
- Newly emitted factory names could collide with a requested component/class name. Only scene-reached output now rejects those reserved names, while old output retains the previous naming surface.
- An early Runtime ordinal optimization let invalid frame/declaration input poison later valid owned-pixels recovery and lost stale diagnostics. The acceptance boundary now follows validation and preserves those diagnostics.
- Moving that guard into only the scene branch let a reentrant newer owned-pixels request be overwritten by an older returning factory. The boundary is shared across sources. Established source-kind changes also retire the previous publisher, including cleanup reentry and cleanup failure.

The original failing reports are preserved alongside their bounded follow-ups. The reviewer-owned reports distinguish real source execution with controlled host or GPU boundaries from browser execution. Final independent binding to the resulting commit is performed during parent integration; an intermediate green report is not relabeled as a later commit's acceptance.

## Native output and default capability cost

Native lowering emits direct upload/copy/tint calls and a finite source slot request. The scene provider and physical resource owner are first-party atoms generated from the same canonical source used by Runtime. Emitted manifests bind both canonical and specialized source hashes. Native output gains no Proto Core, Runtime, Adapter, source interpreter or graph dispatcher dependency. Project-level support unification admits mixed scene/pixel entries only after checking each original support file's provenance.

The scene provider is explicitly configured. Its implementation retains zero minified bytes in each measured ordinary React, Vue and Web Component root bundle. The common protocol dispatch and retirement checks still have a measurable cost. The diagnostic `createWebShaderDevice` retains its original `read` API; ordinary painting uses the same private resource implementation without retaining the unused diagnostic wrapper. Independent old/new source probes retain the public device methods, read results and cleanup order, including construction failure and reentrant disposal.

The following local measurements use the canonical strict script, Node 24.22.3, esbuild 0.25.12, browser ESM/es2020, minification/tree shaking and gzip level 9. The baseline is a clean worktree at the recorded base. The candidate is an accurately recorded uncommitted source snapshot, stable during measurement. This is a local attribution comparison, not clean hosted acceptance.

| Whole entry | Clean base gzip bytes | Candidate gzip bytes | Difference | Unchanged ceiling | Result |
| --- | --: | --: | --: | --: | --- |
| Core | 12,605 | 12,674 | +69 | 12,800 | Pass |
| Runtime | 104,105 | 104,169 | +64 | 104,300 | Pass |
| React Adapter | 172,338 | 172,749 | +411 | 172,600 | Fail, +149 |
| Vue Adapter | 171,098 | 171,536 | +438 | 171,400 | Fail, +136 |
| Web Component Adapter | 206,862 | 207,303 | +441 | 207,200 | Fail, +103 |

The four remaining canonical entries pass: Lucide X 1,797, Lucide root 635,917, Base Button 4,197 and Shadcn Button 6,741 gzip bytes. The complete comparison therefore remains **6/9**. No ceiling or enforcement mode changed in this slice. Earlier red measurements, including intermediate optimization candidates, remain available. Parent integration will compare clean canonical base and candidate reports before any separately reviewable numeric transaction.

Generated source size, retained bundle bytes and initialization are separate observations. The recorded scene fixture emits a 15,044-byte scene atom, a 3,339-byte scene owner and a 23,697-byte specialized physical host per independent target output. These are source bytes before project sharing, not a compressed application bundle. Default whole-entry source contributions are recorded by the canonical bundle report. Unselected-owner tests observe zero root, source, subscription and capability-factory calls; they do not measure all JavaScript allocations, actual GPU allocation cost or physical input-to-photon latency.

## Executed evidence and remaining acceptance

The [machine receipt](evidence/2026-11-24-sprint4-owned-scene/receipt.json) retains source and log hashes, toolchain, raw failures, three browser build manifests and actual result boundaries. Local executions bind the recorded worktree contents, not a commit that did not yet exist when they ran.

| Evidence | Result and boundary |
| --- | --- |
| Final focused source/owner run | Ten actual files, 132 passed, zero failed and zero skipped. Includes 23 capability lifecycle tests and 25 source-controller tests, existing compiler and project controls, Feedback and Runtime. |
| Exact portable scene Runtime | The two existing real Runtime/no-DOM lifecycle journeys were extended to the same new authored scene fixture, keeping both original fixtures and their assertions. The separate final report covers all six cases. |
| Strict generated interfaces | Four selected profiles each passed all five variants: copy-only, tint-only, combined, immutable factory and configured scene. Both emitted and shared host constructors type-check, including Vue2 `checkJs`. The two initial incorrect selectors selected no tests and are explicitly excluded. |
| Source type closure | The changed compiler and shared host source closure passed strict TypeScript. |
| Draft authoring | All three changed C/HC/T inputs passed against the recorded base. Generated-source and catalog/projection results are in the receipt. |
| Browser build and collection | Exactly 37 cases were collected. Three real authored inputs built for all four native profiles and real Runtime adapters, with source snapshots, generator identity, inputs and output hashes. |
| Browser execution | Local sandboxed Chromium failed at `socket() ... Operation not permitted` before a page opened. Zero passed and 37 pending; no current browser, pixel, visual or GPU acceptance is claimed. The build snapshot predates the final low-level sink retirement fix and remains labeled accordingly. |
| Strict whole-entry budget | 6/9 at unchanged ceilings; actual failed comparisons retained. Clean candidate CI and any governed numeric decision remain parent integration work. |

The browser suite retains all original 28 assertions and adds eight actual application-canvas journeys, one per Runtime/native path across four Web hosts, plus the default-export fallback control. The application supplies the existing canvas lease and actual authored Prototype. The independent oracle covers the sRGB-to-linear conversion and pass output. Journeys include held decode, revoke, source replacement, scope retirement/recovery, unsubscribe and verification that the consumer did not dispose the borrowed source. The suite and launch sandbox are unchanged by the local environment failure.

This slice contributes a concrete source lease and independent composition route to the original #1143 and #1089 conditions. Other Presentation input families, image/video/compositor source authorities, arbitrary shader kernels, non-Web shader realization, complete original source-key acceptance and actual Shenko/Verdant adoption remain separate work. The original Issue did not supply a complete enumerable input-family denominator, and this record does not invent one. No Issue is closed or spec promoted by this local contribution.
