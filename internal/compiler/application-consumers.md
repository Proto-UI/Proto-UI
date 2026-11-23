# Actual application consumers

This inventory identifies application-owned Proto UI consumers for compiler and host validation. The application, its reviewed upstream pin, and a newly tested compiler candidate are separate source identities. Generated fixtures remain useful conformance evidence; application acceptance also runs the application's producer and its normal consumer path.

The current user identified **Shenko as a real Agent Harness application** and **OpenGreendam/verdant as another application consumer** on 2026-11-22. The existing [Harness planning matrix](../agent-harness/dogfood-coverage-matrix.md) describes the proposed in-repository `apps/agent-harness`; its absent implementation does not mean these external consumers are absent.

## Source inventory

| Consumer | Application revision inspected | Reviewed Proto UI pin in that revision | Actual consumption |
| --- | --- | --- | --- |
| [cyjin-yl/shenko](https://github.com/cyjin-yl/shenko) | [`f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42`](https://github.com/cyjin-yl/shenko/tree/f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42) | `f29738eb6a804ccfc58510cc5a5bd1692690716e` | Two application-owned prototypes compile to React DOM source. Nine upstream Shadcn families use the React Adapter. |
| [OpenGreendam/verdant](https://github.com/OpenGreendam/verdant) | [`91a775546ebd21a87d76d76568195a6513437719`](https://github.com/OpenGreendam/verdant/tree/91a775546ebd21a87d76d76568195a6513437719) | `e56b2d1a3d6b688a1cbc6930dab1d6757304d733` | The pitch gesture prototype compiles to a Rust crate consumed by the GPUI application workspace. Other application controls retain their actual native owners. |

These are source observations, not claims that either application has adopted the Sprint 5 candidate. Candidate runs must record the unchanged application revision, original reviewed pin, explicit candidate pin, compiler revision/tree, dependency lock, generated artifacts and commands. Local uncommitted application work is not a substitute for the inspected public revision.

## Shenko: actual Harness and React consumer

The [reviewed pin](https://github.com/cyjin-yl/shenko/blob/f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42/crates/shenko-ui/web/upstream-pin.json) and [application package manifest](https://github.com/cyjin-yl/shenko/blob/f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42/crates/shenko-ui/web/package.json) bind Node 24, pnpm 10.32.1, the upstream lockfile digest and package versions. [The application producer](https://github.com/cyjin-yl/shenko/blob/f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42/crates/shenko-ui/web/compiler.mjs) bundles the pinned private compiler source only at build time. The shipped browser application imports the generated React source.

| Surface | Authored source and application consumer | Proof to retain |
| --- | --- | --- |
| Transport badge | `crates/shenko-ui/web/prototypes/transport-badge.proto.ts`; `src/ui-kit.tsx` imports its generated component | Original bytes, generated React artifacts and provenance; real label/tone updates through the application |
| Message bubble | `crates/shenko-ui/web/prototypes/message-bubble.proto.ts`; `src/im.tsx` supplies native React children | Original bytes, generated artifacts and provenance; native children, updates, mount and retirement in the conversation |
| Upstream controls | Button, Textarea, Scroll Area, Collapsible, Drawer, Toggle Group, Input, Separator and Toggle through `src/ui-kit.tsx` | Public package build and actual Adapter application behavior, recorded separately from compiled prototypes |
| Transcript and reading state | `src/im.tsx`, `src/timeline-surface.tsx`, `src/reading-state.ts` and the live controller | Append/depart/resume, stable anchor and user priority, session/replay replacement, keyboard/focus, stale work and cleanup |

The last row supplies a concrete application for [#746](https://github.com/Proto-UI/Proto-UI/issues/746). Its existing reading logic does not by itself prove adoption of the generic Scroll end-follow contract or satisfy every original Harness criterion. [#745](https://github.com/Proto-UI/Proto-UI/issues/745), [#522](https://github.com/Proto-UI/Proto-UI/issues/522) and [#523](https://github.com/Proto-UI/Proto-UI/issues/523) retain their editor, Inspector and two-domain obligations; no tree or resizable use is inferred from the application's name.

### Reproduction

Use isolated application and upstream checkouts. Install each repository's locked dependencies, build the upstream public packages required by the reviewed pin, and run the application's existing commands from `crates/shenko-ui/web`:

```sh
PROTO_UI_SOURCE=/absolute/path/to/proto-ui node build.mjs
node --test tests/*.test.mjs
pnpm exec tsc --noEmit
```

`build.mjs` verifies the exact upstream commit, lock digest and package versions before generating the two prototypes, bundling the real app and writing its asset manifest. A candidate experiment uses an explicitly recorded candidate pin in the isolated application checkout; it does not bypass these checks or rewrite generated source. Preserve the original pin and its hash in the receipt.

The application's `scripts/real_browser_witness.py` observes the actual live controller and WebSocket journey. Its real-model journey has a separate owner and dependencies. A run of the explicit `?demo=1` route exercises the real application renderer with fixture data and must be labeled accordingly; it cannot prove live server receipts, model behavior or restart/replay acceptance. Likewise, the four `tests/prototypes.test.mjs` checks prove generated-source/provenance consumption and do not render a browser.

## Verdant: actual compiled Rust consumer

The [compiler pin](https://github.com/OpenGreendam/verdant/blob/91a775546ebd21a87d76d76568195a6513437719/frontend/proto-ui/compiler.pin.json) selects `gpui-source-v1`, `PitchGestureSurface` and `gpuiDependency: workspace`. The application's GPUI workspace revision is `e5f2f9db75e97613232b5c1946333e61fa3828ab`; the pin separately records the compiler's GPUI reference `62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`. A consumer receipt must retain both rather than silently replacing the application's dependency graph.

The original source is `frontend/proto-ui/src/pitch-gesture-surface.proto.ts`. It includes note/control gesture planning and `dragNormalized`, and the generated source is imported as the `verdant-pitch-gesture-surface` Cargo dependency. The [producer](https://github.com/OpenGreendam/verdant/blob/91a775546ebd21a87d76d76568195a6513437719/frontend/proto-ui/tools/build-proto-ui.mjs) checks the exact clean upstream revision, uses the canonical compiler and publishes generated Rust verbatim.

Candidate runs use that producer's explicit `--pin`, `--upstream`, `--out` and `--receipt` options with a retained candidate pin, then run the normal Cargo consumer. Preserve `frontend/crates/verdant-session/tests/generated_gestures.rs`, including move, duplicate, marquee, resize, cancel and stale-revision/contact cases. Do not replace it with a toy Rust crate or silently retype the application source to fit a compiler fast path.

This is evidence for [#1056](https://github.com/Proto-UI/Proto-UI/issues/1056) and the corresponding [#1144](https://github.com/Proto-UI/Proto-UI/issues/1144) source/contract rows. It does not validate the separate GPUI Adapter or GPUI-on-WASM implementation in [#687](https://github.com/Proto-UI/Proto-UI/issues/687), physical input, assistive technology, or all other Verdant controls. Those require their own actual runtime observations.

## Acceptance ownership

| Work | Owner in this Sprint | Evidence boundary |
| --- | --- | --- |
| Shenko compiler generation, app build and UI consumer | Sprint 5 integration / browser consumer lane | Exact application and compiler inputs; actual app producer and renderer; distinguish live and fixture data |
| Verdant compiler generation and Rust consumption | Sprint 5 GPUI compiler lane | Exact original source and workspace GPUI graph; clean generated crate and real application tests |
| Shenko full follow-tail/editor/Inspector journeys | Sprint 7 Harness lane, using this actual application inventory | Original #746/#745/#522/#523 conditions remain until independently accepted |
| GPUI Adapter and GPUI-on-WASM | Sprint 5 Adapter lane / #687's named maintainers | Independent implementation, runtime/input/focus/lifetime/AT and cleanup evidence |
| Qt and Flutter extra backends | Sprint 5 non-Web lane with #793/#792 owners | Separate target admission and platform consumers; canonical rejection remains visible while unsupported |

The application repositories own their upstream adoption decisions. A successful candidate run is a concrete reviewable input to those decisions; this inventory does not publish a pin update on their behalf.
