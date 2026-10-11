# React host-box first-frame attribute parity

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Observed failure and scope

The official quick-start run [37724537059](https://github.com/Proto-UI/Proto-UI/actions/runs/37724537059) checked out clean head `d0a09844744469637e2c63dc8a26a886fe403f05`. Its [artifact 11527785793](https://github.com/Proto-UI/Proto-UI/actions/runs/37724537059/artifacts/11527785793), ZIP SHA-256 `3d61f0dff7aad44743bd99fafede247c2cf2010584ef8a70dcdada99f5094d5d`, retained original PNGs and frame JSON. Nine of ten cases passed. React 390px dark cold hydration failed on an intermediate frame with document overflow 10px; its refresh journey was not reached. The earlier top-fragment displacement did not recur, but this does not establish complete flash-free acceptance.

The failing frame shows staging Copy glyph rows measuring 72px and reaching x=400 in a 390px viewport. Their four icons were simultaneously present. Final hydrated frames have no overflow, so final-state screenshots alone conceal the transient failure.

`DemoBoxAttrs` is a native string-attribute contract. WC applies it with `setAttribute`; React had spread the same strings into boolean DOM props. The authored `hidden=""` on Copy's three inactive glyphs therefore disappeared before setup. The later Copy effect fixed visibility, after React's initial commit had already crossed animation-frame boundaries. Real-renderer negative controls reproduced all four visible glyphs, dropped empty hidden, and loss of the enumerated `hidden="until-found"` value. The installed React also dropped empty `inert`.

## Repair and boundaries

Only React host-box global presence attributes `hidden`, `inert` and `itemscope` are initialized with their exact native strings in a commit ref. The stable per-node ref runs on mount, before setup and frame waits; subsequent prototype-props updates do not reset application-owned hidden/inert state. This matches WC's initial attribute assignment without passing native strings through React boolean coercion. No Prototype/Adapter guarantee changes. Other attributes, including ARIA, data and enumerated strings, retain their existing path. Boolean values remain invalid under the string-only DemoBoxAttrs contract; the string `"false"` remains a present native attribute.

The source change does not clip the page, hide active content, change Copy's interaction state, delay rendering, or relax the browser oracle. It changes no lifecycle or consumer acceptance state. The existing reviewed Website source-scan fingerprint is refreshed separately for the modified renderer; no prototype source-binding JSON regeneration is needed.

## Validation and remaining evidence

Before repair, the actual framework/renderer suite run against both the website React 18.3.1 and Adapter React 19.2.6 had 10 failures and 22 passes, including the four-glyph negative controls. After repair, the expanded 13-file focused suite passes 159 tests, including initial raw attributes, absent attributes, boolean rejection, preserved dynamic glyph state after a React props refresh, renderer cleanup, materializer, Copy, and quick-start geometry/header contracts. These are host-unit/source controls, not native layout proof.

A fresh exact-head official ten-case run must still verify both cold and refresh at both viewport/theme pairs across WC, React, Vue and Vue2, plus no-JavaScript cases. Preserve the earlier red artifact and inspect the new original PNG/JSON, actual source SHA, per-frame fonts/paint/geometry/scroll/overflow and any failures. Full type/coverage checks and independent review are separate gates.
