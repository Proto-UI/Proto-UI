# Experimental source-generated Button SSR fixture

This fixture is internal Compiler evidence. It does not admit a public SSR profile. All four SSR entries in `packages/compiler/src/targets.ts` remain `implemented: false`; `compilePrototype`, `compileFile` and the CLI still reject requests for those profiles. There is no new target, website route, Runtime snapshot, Adapter mount, or readiness flag here.

## Actual source and artifact chain

`button.proto.ts` imports the official `asButton` from `packages/prototypes/base/src/button/button.proto.ts`. Both that hook and the unchanged default Base Button use the complete `setupButton` function. The fixture adds only authored static style and a disabled style Rule. It does not replace the interaction code, omit a rejected capability, or implement a second activation path. A separate positive test compiles the unchanged default entry.

`button-ssr-fixture.ts` reads the source closure with the existing restricted TypeScript frontend, then exercises the already existing internal `emitWebComponentSource(ir, {ssr: true})` experiment. This deliberately separate harness is not an alternate public compile command. Authored input is never imported or run. Tests execute the generated `Component.ts`, `Component.client.ts` and declared helper files. Generated client code has no Proto UI Core, Runtime, hooks or Adapter imports. The existing declared `@floating-ui/dom` host helper dependency remains explicit.

The emitter produces `Component.css` using the same `packages/cli/src/services/proto-style-css.ts` renderer used by the website style pipeline. It collects the finite reached authored token set, including inactive Rules, and rejects missing CSS recipes. The server projects style tokens from generated statements. There is no call to `snapshot-prototype-style.ts`.

## Handoff contract under test

The HTTP harness first embeds the exact declared `Component.environment.css`, then the exact `Component.css` bytes in `style[data-pui-ssr-css="<css-sha256>"]` before the rendered Button HTML. Loading the generated client does not register it automatically. At the requested registration boundary the generated owner adopts the original host and slot nodes. It does not create an additional Runtime owner.

The compatibility binding covers the source graph, IR version, profile, generated owner/client statements, all supporting helper bytes, token CSS bytes, and the selected consumer stylesheet environment identity/bytes. Separate source/helper/CSS versions make mismatches diagnosable. These hashes are compatibility receipts, not signatures or proof of trustworthy HTML. Every render allocates a random UUID instance identity and a default HTML ID. Explicit caller-supplied IDs remain the caller's responsibility. Duplicate live instance identities are refused.

Carrier/source/profile/helper/CSS/initial-props/DOM mismatches report `PUI_WC_HYDRATION_MISMATCH` and preserve the existing first frame. Even a failure after matching the carrier cannot silently clear the server tree. A missing or non-object carrier on an SSR-marked host is a mismatch, never permission to reconstruct a client-only Button. Initial client props must match the raw serialized server snapshot; ordinary updates use `setProps` after successful adoption. Client callbacks, DOM objects, accessors, cyclic values and other capabilities cannot enter the props carrier. Slot HTML is trusted consumer-authored HTML, not an automatic sanitizer.

## Evidence boundaries

The bounded positive subject is the real Base Button plus this presentation shell in light DOM with portable disabled props and caller-provided label content. It exercises focus, selection, trigger activation, disabled behavior, style projection, repeated initialization and disposal. It does not establish general SSR for arbitrary prototypes, context/provider trees, physical native controls, portals, Shadow DOM, optical material, other frameworks, or native hosts. The broader internal emitter's existing branches are not admitted by this fixture.

Run source, synthetic-DOM and generated-output checks:

```sh
corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/button-ssr.test.ts \
  packages/compiler/test/button-ssr-server.test.ts \
  packages/compiler/src/web-component-ssr-style.test.ts \
  --maxWorkers=1 --minWorkers=1
```

Run the real HTTP/Chrome journeys in a browser-capable environment:

```sh
COMPILER_EVIDENCE_DIR=/tmp/compiler-button-evidence \
  corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/browser-button-ssr.test.ts \
  --maxWorkers=1 --minWorkers=1
```

The dedicated `compiler-button-ssr-evidence.yml` workflow runs both groups at the exact PR head, requires all 67 source and 21 browser tests with no skips, and retains generated files, source/lockfile identity, HTTP responses, CSS, carrier mismatch cases, native accessibility observations, frame samples, screenshots and traces. A collected or authored browser suite is not a browser pass. Local synthetic tests and output typechecking do not establish native pixels or AX. Public SSR gates stay closed pending wider capability evidence and independent admission, even if this bounded browser fixture passes.

## Input and outward event channels

Under `A-WEB-COMPONENT-0001-M`, `C-EXPOSE-EVENT-0001-D/E` and `HC-EXPOSE-EVENT-SINK-0001-A/B`, a successful activation emits one outward `CustomEvent` named `click`. The original native input event is a distinct channel and is not stopped by this experiment. An unfiltered DOM `click` listener can therefore observe both events. Tests count outward `CustomEvent` signals separately from native clicks; disabled suppresses the outward activation, not native DOM propagation.

## Explicit consumer theme dependency

`C-PROTOTYPE-STYLE-CLOSURE-0001-D` and `D-WEB-SURFACE-NORMALIZATION-0001` retain consumer ownership of theme activation and variable values. `rounded-md` and `text-foreground` intentionally lower to variables; the Compiler must not silently pick their values. This fixture explicitly selects `SHADCN_THEME_CSS` from `packages/cli/src/legacy/type.ts`, transforms it with the existing `renderPrefixedThemeCss`, and wraps the result in the documented lower-priority `theme` layer. The HTTP consumer activates `data-theme="light"`. This is a declared test-consumer input, not a change from Base Button to the Shadcn Button prototype.

The internal emitter accepts this closed stylesheet dependency explicitly, emits `Component.environment.css`, and includes its name, SHA and required custom-property closure in `provenance.json`. The fixture additionally records SHA-256 of both canonical theme/renderer source files. The generated client verifies the exact dependency bytes before adopting. Missing or cyclic required variable declarations fail compilation; missing, altered or wrong-version delivered theme bytes fail adoption without replacing the first frame. The dependency scan is a syntactic check of the canonical CSS output, not an arbitrary CSS cascade/selector proof. External CSS imports and URLs are outside this bounded experiment.

Native run [37801216661](https://github.com/Proto-UI/Proto-UI/actions/runs/37801216661) at `63a8d424` exposed the missing consumer dependency: all four failures stopped at `borderRadius > 0`, while the Button was otherwise a visible 146 × 39 white/bordered first frame. The later AX/adoption/disabled assertions in those cases had not executed. The positive radius assertion is retained unchanged. The new candidate requires another native run; local source tests do not turn that failed run green.

## Archive-safe generated closure

`button-ssr-evidence.ts` accepts only the finite generated Button artifact paths and verifies every byte against the compiler fixture's SHA inventory before writing. Hidden logical `.proto-ui/...` helpers are exported as non-hidden `generated/helpers/...`; `generated-artifacts.json` and `build.json` retain the original logical path, exported relative path and SHA. Tests read all ten exported artifacts, verify each hash and reconstruct the generated server under its logical paths. Traversal, unrelated files, duplicate paths and foreign bytes are rejected before any write. The workflow retains its normal hidden-file exclusion and never uploads another hidden directory.

The dependency checker preserves CSS `var()` fallback behavior: a valid primary does not require an unused fallback, and a complete fallback can close an absent/invalid primary. It tokenizes nested functions and commas rather than treating every referenced name as mandatory. The declaration cycle graph includes fallback references; a fallback inside a cyclic declaration does not resolve that cycle. A consuming declaration can still supply a fallback for a guaranteed-invalid variable. These rules follow [CSS Custom Properties](https://www.w3.org/TR/css-variables-1/#cycles).

Closed consumer environments are deliberately limited to unescaped ASCII CSS identifiers, custom-property declarations, `@layer`/`@media`, and the admitted pure math/color/`var()` and canonical selector functions. CSS escapes, external-resource functions (including `image-set`), ordinary property declarations and other at-rules/functions are unsupported and rejected. Quoted font names and comma-separated fallback lists remain supported. This is a finite canonical theme grammar, not a universal CSS sanitizer or selector/cascade proof.
