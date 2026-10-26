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

The dedicated `compiler-button-ssr-evidence.yml` workflow runs both groups at the exact PR head, requires all 68 source and 21 browser tests with no skips, and retains generated files, source/lockfile identity, HTTP responses, CSS, carrier mismatch cases, native accessibility observations, frame samples, screenshots and traces. A collected or authored browser suite is not a browser pass. Local synthetic tests and output typechecking do not establish native pixels or AX. Public SSR gates stay closed pending wider capability evidence and independent admission, even if this bounded browser fixture passes.

## Input and outward event channels

Under `A-WEB-COMPONENT-0001-M`, `C-EXPOSE-EVENT-0001-D/E` and `HC-EXPOSE-EVENT-SINK-0001-A/B`, a successful activation emits one outward `CustomEvent` named `click`. The original native input event is a distinct channel and is not stopped by this experiment. An unfiltered DOM `click` listener can therefore observe both events. Tests count outward `CustomEvent` signals separately from native clicks; disabled suppresses the outward activation, not native DOM propagation.

## Explicit consumer theme dependency

`C-PROTOTYPE-STYLE-CLOSURE-0001-D` and `D-WEB-SURFACE-NORMALIZATION-0001` retain consumer ownership of theme activation and variable values. `rounded-md` and `text-foreground` intentionally lower to variables; the Compiler must not silently pick their values. The canonical producer in `packages/cli/src/legacy/type.ts` exposes the variable bank and selection theme paint separately while `SHADCN_THEME_CSS` remains their complete ordinary CLI theme. The fixture passes only `SHADCN_THEME_VARIABLES_CSS` through `renderPrefixedThemeCss` into the internal environment. It separately renders `SHADCN_THEME_PAINT_CSS`, using the variable bank as the declaration-name source so both `--pui-selection` references are prefixed without copying or reconstructing the paint rule. The browser consumer delivers that stylesheet in its own `<style data-pui-ssr-consumer-theme-paint>` element after the variable bank; both retain the documented lower-priority `theme` layer ordering. The HTTP consumer activates `data-theme="light"`. This is a declared test-consumer input, not a change from Base Button to the Shadcn Button prototype.

The internal emitter accepts only the closed variable-bank dependency, emits `Component.environment.css`, and includes its name, SHA and required custom-property closure in `provenance.json`. That environment hash authenticates only `Component.environment.css`; it does not claim to authenticate consumer theme paint. The fixture separately records the consumer paint bytes and SHA with the canonical producer/renderer source hashes, and the browser evidence retains `consumer-theme-paint.css` outside the generated-artifact archive. The generated client verifies the exact environment dependency bytes before adopting. Missing or cyclic required variable declarations fail compilation; missing, altered or wrong-version delivered environment bytes fail adoption without replacing the first frame. The dependency scan is a syntactic check of the canonical variable-bank output, not an arbitrary CSS cascade/selector proof. External CSS imports and URLs are outside this bounded experiment.

Native run [37801216661](https://github.com/Proto-UI/Proto-UI/actions/runs/37801216661) at `63a8d424` exposed the missing consumer dependency: all four failures stopped at `borderRadius > 0`, while the Button was otherwise a visible 146 × 39 white/bordered first frame. The later AX/adoption/disabled assertions in those cases had not executed. The positive radius assertion is retained unchanged. The new candidate requires another native run; local source tests do not turn that failed run green.

## Archive-safe generated closure

`button-ssr-evidence.ts` accepts only the finite generated Button artifact paths and verifies every byte against the compiler fixture's SHA inventory before writing. Hidden logical `.proto-ui/...` helpers are exported as non-hidden `generated/helpers/...`; `generated-artifacts.json` and `build.json` retain the original logical path, exported relative path and SHA. Tests read all ten generated artifacts, verify each hash and reconstruct the generated server under its logical paths. The separately retained consumer theme-paint stylesheet is not a generated artifact and does not change that ten-file allowlist. Traversal, unrelated files, duplicate paths and foreign bytes are rejected before any write. The workflow retains its normal hidden-file exclusion and never uploads another hidden directory.

The dependency checker preserves CSS `var()` fallback behavior: a valid primary does not require an unused fallback, and a complete fallback can close an absent/invalid primary. It tokenizes nested functions and commas rather than treating every referenced name as mandatory. The declaration cycle graph includes fallback references; a fallback inside a cyclic declaration does not resolve that cycle. A consuming declaration can still supply a fallback for a guaranteed-invalid variable. These rules follow [CSS Custom Properties](https://www.w3.org/TR/css-variables-1/#cycles).

Closed consumer environments are deliberately limited to unescaped ASCII CSS identifiers, custom-property declarations, `@layer`/`@media`, and the admitted pure math/color/`var()` and canonical selector functions. CSS escapes, external-resource functions (including `image-set`), ordinary property declarations and other at-rules/functions are unsupported and rejected. Quoted font names and comma-separated fallback lists remain supported. This is a finite canonical theme grammar, not a universal CSS sanitizer or selector/cascade proof.

## Held-client first-paint capture

The delayed journey keeps the parser-discovered deferred `/client.js` request held through its first screenshot. CSS Font Loading considers an unfinished document pending on the environment; Playwright's ordinary screenshot helper awaits `document.fonts.ready` and therefore cannot finish before that same deferred request is released. This is a harness dependency cycle, not evidence of a missing downloadable font.

Both delayed endpoint images now use the same native CDP viewport PNG capture, with no document-load wait. The finite consumer explicitly uses system Arial/sans-serif: capture requires zero declared FontFace entries, available computed label fonts, and nonempty actual system glyphs from `CSS.getPlatformFontsForNode`. Both endpoint font observations must match exactly, and computed font joins the unchanged eight-frame assertions. Unexpected web fonts or missing CDP evidence fail closed. No environment-wide screenshot/font-wait switch is used; all other screenshots keep Playwright's usual behavior. Original visibility, radius, identity, geometry, pixel-hash and AX assertions remain. Native confirmation of this revision is still required.

## Shared-parent repair carry diagnostic (2026-10-25)

The [shared-parent decision](https://github.com/Proto-UI/Proto-UI/pull/955#issuecomment-6397665849) selects the accepted private SSR repair from [#997](https://github.com/Proto-UI/Proto-UI/pull/997) for integration at #955, rather than independent copies in each descendant. This section records the prepared source candidate, not a published commit, a passing CI run, or acceptance of public SSR.

Source commit `4ee133175cad6b32a6f6dc13fc0db59b94f6805b` was authored by cyjin-yl and merged as `4d0751dc0499dcd574be8ada56a314a533c2d85a`. Its preimage is `7181a93a5ec5cad43936a72e31d5477d5488733a`. The inspected integration parent is #955 commit `b01cd33661850db5d8cba37122d732384c472083`, tree `ce3a36e016b6fe2b52b36d72eba28c19793b2023`; commit and tree identities are distinct. Existing source provenance and the [finite #732 writer scope](https://github.com/Proto-UI/Proto-UI/issues/732#issuecomment-6392431236) remain intact. This carry does not take ownership of the Compiler/IR/Core ABI.

### Reproducible diagnosis and integration workflow

1. Pin the source commit, its parent and the actual shared-parent ref. Compare all thirteen changed paths against both trees before applying any hunk. Twelve preimage blobs match. The only divergent file is `packages/cli/src/services/proto-style-css.ts`: carry only the `renderPrefixedThemeCss` optional `variableDeclarations` hunk, preserving the parent's token map. In particular, do not introduce the source-base-only `leading-[1.1]` and `tracking-tighter` token additions through a whole-file replacement.
2. The inherited failure is `PUI3301`: the SSR environment accepts a custom-property variable bank, but the previous fixture supplied the complete ordinary consumer theme, including selection paint. Keep the validator strict. Split the canonical producer's variable bank and consumer paint, deliver paint separately, and retain independent artifact hashes. This is not a reason to permit arbitrary stylesheet environments or change public target admission.
3. Carry the source tests, canonical palette generator and its already-generated output together. The generated palette is copied from the accepted source, not manually recalculated. Run its generator in check mode on the integrated tree before claiming current generated output. Preserve the original failed runs; source-byte equivalence is not execution evidence.
4. Review current overlapping stack hunks rather than treating whole paths as unowned. In particular, #925's separate `cli.test.ts` assertion removals are not imported into this #955 carry. Keep existing parent code intact, and synchronize descendants through the agreed native `gh stack` route only after the shared-parent source is verified and published. Content-merge independent F0/S1/S2/S3 composition records rather than choosing one side. Refresh actual head/base/tree and checks after synchronization.
5. Execute the unchanged `.github/workflows/compiler-button-ssr-evidence.yml` source/server controls and native browser journeys through the sole parent heavy runner. It requires 91 source/server tests and 21 browser journeys, with zero pending or failed tests. Also run the applicable CLI renderer tests, palette tests/generator check and full `corepack pnpm@10.32.1 check:types`. Do not lower coverage counts, soften assertions, disable native checks or widen permissions to manufacture a pass.

### Prepared-candidate evidence and remaining gates

Static checks verified all thirteen fetched parent and accepted blobs, twelve matching preimages, exact minimal replacement in the divergent renderer, and preservation of every other parent leaf. The renderer change is reversible to the exact preimage and does not alter its token map. The fixture README additionally records this diagnosis; it is intentionally not byte-identical to the accepted source README. No Compiler production implementation, public target declaration, workflow, package dependency or lockfile is changed. The public `PUI4001` negative test remains in `button-ssr.test.ts`; `publicSSR: false` remains a boundary, not a newly enabled capability.

Guarded Node 24 validation of the candidate producer, renderer and palette generator completed with zero targeted and zero transitive TypeScript diagnostics. An initial runtime-input audit detected two inherited generated token files from a different revision; that first result was retained but not used as exact-parent evidence. Both were replaced with authenticated #955 inputs and every check was rerun under the same restrictions. The final six-file TypeScript source closure, test/output/package inputs and formatter configuration were checked against the candidate and parent blobs; this is not a full workspace type check. The existing palette generator `--check` exited zero without writing generated output. The existing palette test suite actually executed thirteen tests: twelve passed; the final temporary-file test failed at `mkdtemp` with `ERR_ACCESS_DENIED` / `FileSystemWrite` before testing changed-output rejection. Its failure is retained, not skipped or treated as a pass. The combined CLI renderer/CLI/SSR source/server Vitest invocation failed before collection with Rollup `ERR_DLOPEN_DISABLED`. No addon or filesystem-write permission was added. These executions used the existing synchronous TypeScript loader and pinned installed dependencies; they are not native or browser acceptance. Full workspace types, successful complete source/server coverage and all native browser journeys remain unrun for this candidate. Historical #997 or #955 results are not reused as candidate passes. Heavy verification remains with the designated parent runner. Independent source review has been requested; source publication, exact-head CI and descendant synchronization remain pending. Keep #998 and #1000 open; this bounded repair does not establish whole #732/#935/#974 acceptance.
