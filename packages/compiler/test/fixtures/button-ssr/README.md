# Experimental source-generated Button SSR fixture

This fixture is internal Compiler evidence. It does not admit a public SSR profile. All four SSR entries in `packages/compiler/src/targets.ts` remain `implemented: false`; `compilePrototype`, `compileFile` and the CLI still reject requests for those profiles. There is no new target, website route, Runtime snapshot, Adapter mount, or readiness flag here.

## Actual source and artifact chain

`button.proto.ts` imports the official `asButton` from `packages/prototypes/base/src/button/button.proto.ts`. Both that hook and the unchanged default Base Button use the complete `setupButton` function. The fixture adds only authored static style and a disabled style Rule. It does not replace the interaction code, omit a rejected capability, or implement a second activation path. A separate positive test compiles the unchanged default entry.

`button-ssr-fixture.ts` reads the source closure with the existing restricted TypeScript frontend, then exercises the already existing internal `emitWebComponentSource(ir, {ssr: true})` experiment. This deliberately separate harness is not an alternate public compile command. Authored input is never imported or run. Tests execute the generated `Component.ts`, `Component.client.ts` and declared helper files. Generated client code has no Proto UI Core, Runtime, hooks or Adapter imports. The existing declared `@floating-ui/dom` host helper dependency remains explicit.

The emitter produces `Component.css` using the same `packages/cli/src/services/proto-style-css.ts` renderer used by the website style pipeline. It collects the finite reached authored token set, including inactive Rules, and rejects missing CSS recipes. The server projects style tokens from generated statements. There is no call to `snapshot-prototype-style.ts`.

## Handoff contract under test

The HTTP harness embeds the exact `Component.css` bytes in `style[data-pui-ssr-css="<css-sha256>"]` before the rendered Button HTML. Loading the generated client does not register it automatically. At the requested registration boundary the generated owner adopts the original host and slot nodes. It does not create an additional Runtime owner.

The compatibility binding covers the source graph, IR version, profile, generated owner/client statements, all supporting helper bytes, and CSS bytes. Separate source/helper/CSS versions make mismatches diagnosable. These hashes are compatibility receipts, not signatures or proof of trustworthy HTML. Every render allocates a random UUID instance identity and a default HTML ID. Explicit caller-supplied IDs remain the caller's responsibility. Duplicate live instance identities are refused.

Carrier/source/profile/helper/CSS/initial-props/DOM mismatches report `PUI_WC_HYDRATION_MISMATCH` and preserve the existing first frame. Even a failure after matching the carrier cannot silently clear the server tree. Initial client props must match the raw serialized server snapshot; ordinary updates use `setProps` after successful adoption. Client callbacks, DOM objects, accessors, cyclic values and other capabilities cannot enter the props carrier. Slot HTML is trusted consumer-authored HTML, not an automatic sanitizer.

## Evidence boundaries

The bounded positive subject is the real Base Button plus this presentation shell in light DOM with portable disabled props and caller-provided label content. It exercises focus, selection, trigger activation, disabled behavior, style projection, repeated initialization and disposal. It does not establish general SSR for arbitrary prototypes, context/provider trees, physical native controls, portals, Shadow DOM, optical material, other frameworks, or native hosts. The broader internal emitter's existing branches are not admitted by this fixture.

Run source, synthetic-DOM and generated-output checks:

```sh
corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/button-ssr.test.ts \
  packages/compiler/test/button-ssr-server.test.ts \
  --maxWorkers=1 --minWorkers=1
```

Run the real HTTP/Chrome journeys in a browser-capable environment:

```sh
COMPILER_EVIDENCE_DIR=/tmp/compiler-button-evidence \
  corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/browser-button-ssr.test.ts \
  --maxWorkers=1 --minWorkers=1
```

The dedicated `compiler-button-ssr-evidence.yml` workflow runs both groups at the exact PR head, requires all 21 source and 15 browser tests with no skips, and retains generated files, source/lockfile identity, HTTP responses, CSS, carrier mismatch cases, native accessibility observations, frame samples, screenshots and traces. A collected or authored browser suite is not a browser pass. Local synthetic tests and output typechecking do not establish native pixels or AX. Public SSR gates stay closed pending wider capability evidence and independent admission, even if this bounded browser fixture passes.
