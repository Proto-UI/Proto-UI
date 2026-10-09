# Liquid Glass projection (draft)

The draft family declares explicit V2 optical intent. The optional Web provider renders the fixed audited liquidGL kernel over a visible application-owned canvas source. This is not arbitrary DOM capture or Apple-native equivalence; group/morph and the broader material goal remain open under #793.

This private, unreleased source package projects Base Button into a functional-control visual language informed by Apple's [Materials HIG](https://developer.apple.com/design/human-interface-guidelines/materials). It is independently implemented, not Apple's native material engine or an Apple-endorsed library. No Apple font, icon, private asset or shader is redistributed.

`liquid-glass-button` genuinely invokes `asButton()` once. Base owns activation, keyboard, focus and disabled behavior. Visual props:

- `variant: regular | prominent`, default `regular`
- `material: auto | opaque`, default `auto`
- inherited `disabled`, default `false`

## V2 material and source ownership

Regular auto Button requests one complete `liquid-glass` candidate and consumes Base press state. Surface supports static optical candidates independently of Button. Final opaque fill and foreground tokens remain the designated fallback; the host resolves their palette provenance after Rule/runtime patches. Neither Prototype contains browser observers, shader fields or GPU uniforms.

An opt-in consumer imports `@proto.ui/adapter-base/web-material` and passes its `createVisualSink` factory to the chosen Web Adapter. It supplies a revocable visible canvas lease and an explicit current palette. The same provider works through Web Components, React, Vue and Vue 2; asynchronous framework style delivery must be observed before publishing optics. A provider-free Adapter retains ordinary opaque source style.

The website Previewer lazily installs this provider only for Liquid Glass content. Its moving canvas is the real background plane and its pixel source. Source revision, geometry, scroll/resize/DPR, theme, preferences and view retirement are revalidated. Overlapping content, painted ancestors, cross-scope portals, unsupported compositing and unknown provenance reject sampling. This does not promise a screenshot of arbitrary page content.

Reduced/unknown motion selects static optics. Reduced/unknown transparency, unsafe contrast, source loss and GPU failure withdraw enhancement. The explicit opaque and prominent choices retain their safe presentation. Unsupported transparent fallback does not become a fake opaque material: ordinary legal style remains intact.

## Entry points and evidence

- `src/button`, `src/select`, `src/text` and the package root are genuine source exports
- `src/theme` owns light/dark values and the theme renderer
- `/en/ui-libraries/liquid-glass/` and `/zh-cn/ui-libraries/liquid-glass/` register the implemented family parts, including Select and Text, with operable four-runtime documentation demos
- `/en/test/liquid-glass-material/` is the exact-source real-Web material fixture; its negative controls compare decoded optical press/rest pixels and revoke the visible source or insert unrepresented overlapping content
- `/en/test/new-projection-families/` deliberately sets `material: opaque` to retain explicit fallback evidence

The full family remains incomplete (#792). The partial manifest rejects missing kinds instead of aliasing another family. Homepage-wide selection awaits the real parts/compositions its gallery needs. General Compiler admission remains #732/#733. GPUI requires the real root Feedback transaction path in #719 plus native paint/input/focus/a11y evidence; #798's token data alone is insufficient. Flutter/Qt need actual backends. Native effects remain explicit gaps, not silently dropped success.

Current new material browser evidence is planned until the combined exact-head Actions fixture has run and its actual captures have been inspected. Existing Button fallback evidence is retained separately.

Select Root/Trigger/Value/Content/Item and Text now have independent direct Base consumers and private `/select` and `/text` source exports, including source-only four-Web CLI facades. Real Select and Text provide the family toolbar. Select Trigger/Content consume shared explicit liquid-glass material intent and complete opaque fallback; the optional provider realizes supported owned-source optics, while exact-head optical/native paint acceptance remains pending. Text retains all eight Base axes and inherits the owning context’s selection policy.

## Field (draft workspace source)

The `./field` subpath exports `fieldRoot`, `fieldLabel`, `fieldControl`, `fieldDescription`, `fieldError` and `fieldValidity`. Root owns validation and consumer-owned async request leases; the default Control owns one host text editor. All six atoms share the same Base protocol, including controlled validity, required/length checks, disabled/readOnly, exact label/help/error relationships and stale-result rejection.

This is not Fieldset/Form or form submission. Native TextControl transport, OS accessibility, browser screenshots and optical/GPUI evidence remain separate gates. Package source and synthetic-DOM tests do not imply stable release admission.

### Held pointer contact (draft Web slice)

The enabled regular Button requests finite `contact: pointer` visual feedback. The existing Web input router owns the sampled primary-pointer session; the renderer does not capture pointers or emit activation. Contact coordinates use the undeformed down bounds, and visual dragging can continue after pointer leave without changing Base activation semantics. Disabled/opaque/prominent withdraw the request. This source slice does not establish browser GPU smoothness, arbitrary DOM capture, native host support, or Apple-private equivalence. Reduced motion retains static feedback and disables elastic motion.

## Local draft artifacts

`pnpm run build:draft` refreshes the public prerequisite `dist` trees in the workspace through the normal package compiler, then builds and stages the existing draft entries and dependency closure in a fresh temporary directory. `pnpm run pack:draft` additionally produces local tarballs. The JSON receipt identifies every artifact and its draft-only status. Both commands run from this package directory.

These are private, release-excluded development artifacts, not public package admission or a registry publication. The checked-in source exports and public CLI rejection remain unchanged. The temporary manifests use `0.0.0-draft`, retain `private: true`, omit lifecycle scripts and bind workspace dependencies to the same local draft version. Install the complete returned tarball closure together with scripts disabled and offline resolution; no artifact should be uploaded to npm. Build/pack success alone does not establish consumer, host, visual, native, or full Finf G4 acceptance.

Run `pnpm test:draft-packages` from the repository root for the complete offline tarball install, JavaScript ESM and strict NodeNext declaration smoke. Run this build-bearing suite separately from other package builds.

The draft builder admits only the two named prototype families and their current dependency shape. It is not a general private-package build API; adding workspace dependencies that occur only in peer or optional fields requires extending and testing its closure planning first.
