# Bounded Liquid Glass consumer and public Button registration

Date: 2026-10-03. Non-normative increment of #792 / #793, based on merged `f7edface`.

## Implemented scope

The actual Liquid Button Prototype adds `material: auto | opaque` (default auto). Auto regular controls require all four `preference.*` values to be their safe no-preference/none values and both finite `styleSupport.*` facts true. It then contributes existing `bg-secondary/80` and `backdrop-blur-xs` tokens. Hover changes elevation, preserving translucency; prominent actions remain solid. No animation/refraction/native Apple engine is represented.

The two already-implemented Button families now have actual same-family prototype loaders, partial manifests, source-owned theme maps, live library cards, library overview entries, explicit sidebar groups and bilingual Button pages/demos. The public routes are `/{en,zh-cn}/ui-libraries/{bootstrap-2-3-2,liquid-glass}/` and their `button/` pages. The recipe uses real Base-inheriting sources and counts actual outward activations. New library cards and their overview previews allow all four runtime IDs, read the current page preference when lazy mounting, and follow the existing page preference event; toolbar-free does not mean WC-only. The browser case selects React before lazy mount and then switches both mounted cards to Vue 2.

A toolbar-free partial preview no longer resolves a nonexistent Select. Requesting a toolbar still fails for the missing same-family Select; no old-family alias is introduced. Missing component kinds fail explicitly. The 11-kind homepage selector remains limited to complete families until its actual parts and composition are available. The companion full Base inventory records 20 public families, 53 public parts and 106 projection targets; this increment is not completion of that work.

## Material installation and evidence boundary

Host style facts declare a finite translation pipeline and apply necessary CSS syntax filtering. They do not prove a consumer installed the generated stylesheet or complete theme variables. The public library imports `DraftProjectionStyle.astro`, which emits the actual source-derived physical token CSS. Each real projection surface receives its own complete family theme map; the standalone material fixture explicitly installs the same CSS plus source theme renderer.

The material browser fixture independently requires a concrete secondary theme variable, computed alpha 0.8, computed backdrop blur 4px, and decoded-pixel differences after removing only blur from the same real control. It additionally disables the generated stylesheet to prove the paint claim ceases to hold even while capability facts remain true, then restores it. Thus missing CSS or a missing variable cannot satisfy the material paint oracle. A colorful stripe scene is ordinary consumer background content, not a material image or component CSS skin.

Planned native-browser cases cover light/dark, four runtime paths, persistent hosts through live reduced transparency/motion, contrast and forced-colors changes and restoration, unknown preference API, hover, pointer/Space activation, bilingual library/documentation interaction, mobile layout and disposal. Source-capability loss/rebind is separately executed on the actual Prototype and Runtime in unit tests; that evidence is not mislabeled as a physical browser capability-unplug test.

## Local verification

- 90 focused tests pass across the real material Prototype, inherited Button behavior, preference/support source and Runtime leases, partial manifest/composition and source-owned themes.
- Browser inventory guard: 4/4 pass; new material suite registered in the sequential phase and its route warmed.
- Source style-token generation/check and Prototype catalog pass.
- Workspace TypeScript passes. Astro check covers 257 files: 0 errors, 0 warnings, one pre-existing whitepaper-script hint.
- The first Astro attempt could not initialize its default telemetry configuration directory. The original failure is retained; rerunning only the documentation check with an explicit writable temporary configuration directory and telemetry disabled passed. No sandbox restriction was bypassed.
- Actual local browser execution is unavailable under the known process restriction and was not retried. Material/browser evidence remains planned until the exact combined source Actions jobs run and their real images are inspected.

## Primitive provenance

The independently reviewed primitive source commits were `c5cf344015cdcb0f527da56a87ee09c0f6961e32`, `f6545129d72e860940776d0723e891f872bcecfd` and compatibility fix `395327f1b8636b7c6eb720d7051578a82ce3707d`. Normal cherry-pick into the consumer candidate produced `180c310c3421c1dcf07e14def878836e0ff9e731`, `fc4907945351fee04d5b1d210ecf96cfd49db410` and `b8a77268f9343a2c4ebe5f44bc25f01d540c9955`, preserving original author and sign-off. They were not published as duplicate standalone PRs.

The old #795 source-9c10090 images remain historical opaque-fallback evidence, not new material screenshots. The legacy fixture now explicitly requests opaque material. New captures will be bound to the combined head.

## Still open

#792 remains open for all Base parts and their real library/documentation/demo/homepage compositions. #793 remains draft; this does not admit a general material engine. General Compiler admission/differentials remain #732/#733. Actual styled GPUI roots still need #719's Feedback transaction channel and its #726 reconciliation before true Prototype-to-Rust-paint evidence. #798 is only a source-data increment. Flutter and Qt still require real backends and evidence.
