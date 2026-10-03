# Liquid Glass projection foundation (draft)

This private, unreleased source package currently implements only the deterministic **opaque, non-moving accessibility fallback** for a functional Button. It is not the requested full Liquid Glass effect, Apple's native material engine, an Apple-endorsed library or a completed [#792](https://github.com/Proto-UI/Proto-UI/issues/792).

`liquid-glass-button` genuinely inherits `asButton()` and owns only `variant: regular | prominent` visual styling plus inherited `disabled`. It provides capsule geometry, paired readable surfaces, restrained elevation and focus-visible treatment. Theme values are independently authored. No Apple fonts, icons, assets, proprietary shader or implementation code are redistributed. Consumers own font resources and activation of the light/dark palette.

The appearance is defined by Prototype feedback tokens and Rule state contributions, with family `renderThemeCss()` and the existing token translator. Website/global CSS is not needed to repair its default appearance. The standalone `/en/test/new-projection-families/` route compares this fallback with Bootstrap 2.3.2 through four real Web adapters.

The actual translucent enhancement is separately gated by [#793](https://github.com/Proto-UI/Proto-UI/issues/793): reactive reduced-transparency/contrast preferences and an honest host-support boundary. Unknown support must not silently become permission to display translucent text backgrounds. Refraction, adaptive luminosity, morphing and moving highlights remain explicit follow-up work. Apple [Materials HIG](https://developer.apple.com/design/human-interface-guidelines/materials) guides functional/navigation layering; a whole gallery/content background should not become glass.

No new native or Prototype Compiler support is claimed. GPUI has a bounded Rust implementation whose omitted effects remain diagnostics; Flutter/Qt need real backends. See #792 for the staged full outcome.
