# Compiler Button SSR: declared theme and archive closure repair

Date: 2026-10-08. Baseline: `63a8d4240d8dfc2a36f8cbab367e8a9c43f41fd7` (tree `2feebcf1159b9bf4c8dfc4edf64ef7ce587cc93b`).

## Observed official failure, without extending its meaning

[Compiler evidence run 37801216661](https://github.com/Proto-UI/Proto-UI/actions/runs/37801216661) executed all 36 source controls and all 18 native cases: source 36/36 passed, native 14 passed and four failed. All four failures stopped at the same `borderRadius > 0` assertion. The actual no-script frame was a visible 146.0625 × 39 Button with white background, black text and a 1px border; `borderRadius` was `0px`. The emitted `rounded-md` rule correctly referenced `--pui-radius-md`, but no delivered stylesheet declared that variable or the `--pui-foreground` dependency. This was not a blank frame or proof that the unreached later AX, disabled or adoption assertions failed.

The build inventory recorded nine generated files, but the default artifact upload omitted five logical `.proto-ui/...` helper files because their directory was hidden. Four remaining file hashes and the source hashes matched. The archive did not establish the claimed complete generated closure.

## Ownership decision and implementation

`C-PROTOTYPE-STYLE-CLOSURE-0001-D` and `D-WEB-SURFACE-NORMALIZATION-0001` retain consumer ownership of theme activation and variable values. Therefore the Compiler does not choose a theme or replace `rounded-md` with an arbitrary literal to satisfy the test.

The bounded fixture now explicitly selects the existing `SHADCN_THEME_CSS`, transformed by the existing `renderPrefixedThemeCss`, in the lower-priority `theme` layer. The consumer explicitly activates `data-theme="light"`. Its source/prototype remains the complete actual Base Button/asButton plus the same presentation-only fixture. No Runtime snapshot or Adapter owner is introduced.

The internal SSR emitter accepts the named consumer stylesheet as an explicit input and emits `Component.environment.css`. It records the name, artifact SHA and required custom-property closure in generated provenance; the fixture also records both theme/renderer source-file SHAs. The compatibility binding covers the selected environment name and bytes. Generated client adoption checks that the exact environment artifact was delivered, separately from token CSS. Missing/cyclic property dependencies are rejected during source lowering; missing, wrong-version and modified theme bytes are rejected before client ownership while preserving the server frame. This syntactic dependency check is not an arbitrary CSS cascade/selector proof, nor a claim that every consumer theme is supported. External CSS imports and URLs remain outside the slice.

The positive native rounding assertion remains unchanged. Three new real-HTTP negative cases check missing, altered and wrong-version theme delivery using the actual generated dependency and the pre-adoption frame. They require a new native run; local source checks cannot turn the original run green.

## Safe complete generated evidence

`button-ssr-evidence.ts` accepts only a finite path/kind allowlist for this exact Button closure and validates every byte against its generated SHA inventory before writing any export. The five hidden logical helpers map to non-hidden `generated/helpers/...`. `generated-artifacts.json` and `build.json` retain each original logical path, export path and SHA, so the original source layout can be reconstructed. There is no source-directory copying, arbitrary hidden-file upload, or widened `include-hidden-files` setting.

Tests read all ten exported artifacts, verify their hashes, reconstruct the logical generated modules and render the generated server. Traversal, unrelated files, duplicate paths and foreign bytes are rejected before any evidence write.

## Verification and next step

Local Node 24.19.0 / pnpm 10.32.1 evidence:

- 47 source/server/synthetic-DOM cases pass, including generated TypeScript strict checking, actual source graph, consumer dependency/refusal checks, carrier mismatch preservation and the archive reconstruction/negative cases.
- The existing 37 WC/Context/style/target/output cases are rerun against the same candidate, for 84 passing tests in seven files.
- Workspace TypeScript passes after the documented style generator; an earlier check was blocked only by missing generated Shadow-style declarations.
- The 21-case browser suite is collected, not executed locally. No local Chrome or alternate socket route was used. All embedded workflow shell blocks and YAML parse checks pass, and hidden-file expansion remains disabled.

The read-only exact-head workflow now requires all 47 source and 21 native cases with no skips and retains failure evidence. Fresh independent review and the next official native run remain pending. All four public SSR profile gates stay false; the website retains its current Runtime snapshot path. No public SSR admission, product scope expansion, remote write or deployment is included.
