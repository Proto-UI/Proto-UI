# Keep keyboard image Close readable from its first painted frame

## Preserve the actual native and visual baseline

The frameless repair at `a888e059264852d5fd51d150f2196a8e2f405eff` passed the existing 34-case native suite in [run 45433771285](https://github.com/Proto-UI/Proto-UI/actions/runs/45433771285). Its 70 Content outline samples were `none / 0px`, while the actual focus facts remained intact. Rendered review accepted the repaired repeated-pointer image entry, but found two keyboard-only problems: the dark Shadcn Close label was unreadable over a light image, and the forced-colors vector capture cut off the top of the Close label. That native success is retained alongside the rejected keyboard appearance.

The coordinating agent's four-image review is `/tmp/proto-ui-image-evidence-b91f/a888/root-visual-review-a888.json`, SHA-256 `569b57a360f0dd3eff81bca7e3258479bafcaa7733d94fd859b97c1f7848a9e2`. The independent nine-image review is `independent-visual-review-relay-status.json` in the same directory, SHA-256 `0648fcde80cfdb7bac4e4ea8c6c6f518a66f9e23b27e61333b7baa14639d879b`. Neither review inferred a settled Button state from Content's `entered` phase.

The subsequent test-only commit `6da1739bf31b3049406e0689f488c00968331d71` kept all production bytes from a888. It added observations around the original trusted Tab input: the pre-input state, actual input boundary, real animation frames over 400ms, immediate screenshots and terminal screenshots. It did not change input, native focus, public visibility facts, clocks or global test timeouts. All 240 preceding assertions and the 220ms motion oracle remained intact; two new assertions checked only capture completeness.

[Run 45437869238](https://github.com/Proto-UI/Proto-UI/actions/runs/45437869238), job `138600530257`, genuinely passed **34/34**, with no failures or skips. This diagnostic success does not mean the keyboard defects were fixed. Artifact `14942337349` is 10,122,582 bytes, SHA-256 `a49e70187eaba2af491173aaccf27c6f25f77c682159534fbace498242190be7`, matching GitHub. Its 342 entries passed ZIP CRC and safe extraction checks. Original logs, PNGs, JSON and the archive remain under `/tmp/proto-ui-image-evidence-b91f/6da/`.

## Measured cause and owning layer

All **14 Close reveal sequences** showed the same geometry defect, including both families, all three ordinary widths, both schemes, and the forced-colors vector/whitepaper controls. The first three frames of every sequence placed the text Range outside Dialog Content's real overflow clip: **42 clipped frames among 349 sampled frames**. All terminal samples had recovered their text geometry. No page-scroll movement was recorded during those sequences.

The Button itself reported real `CSSTransition` objects for `height` and `top`. Shadcn expanded from 2px to its 28px small size; Brutalist expanded from 4px to its 36px small size. The nominal hidden CSS height was 1px, with each family's borders accounting for the initial measured minimum. The page had imposed this hiding height on a public Button that retained `transition-all`.

For the forced-colors vector's first frame, the focused Button began at `y=332.5`, height `2`; its text Range began at `y=325.5`, height `16`. Content's scrollport began at `y=332.5`, cutting off 7px of the label. The stable Button later measured 28px at `y=340.5`, with no text clipping. Thus Content's `entered` phase and the Button's `clip-path: none` were insufficient evidence of legibility.

The independent paint problem remained after geometry settled. The 390px dark Shadcn Close reported foreground sRGB `[250,250,250,255]` with a transparent background throughout its 25 frames, including the terminal state. Its ghost recipe could not supply a reliable foreground/background pair over arbitrary image pixels. The existing Brutalist surface pair stayed opaque. The raw analysis is `close-reveal-audit.json`, SHA-256 `8b4833fd51f66ca8c274090e46bb8d36a83ff173508f47d47832b7535ca10d4c`; it preserves both observations and its geometry-analysis limits.

The repair belongs to the website composition. The public Shadcn DialogClose contract defines its wrapper as an unstyled semantic boundary with consumer-owned layout bounds. The nested public Button continues to own actual focus, interaction and family feedback. No Base, Focus, Adapter or public family implementation changes are needed.

## Bounded candidate

The existing DialogClose element receives the `docs-image-close` class and owns the 1px hidden box, overflow clip and keyboard-visible position. Its CSS uses `:has([data-focus-visible])` to read the inner Button's existing public projection. There is no new event handler, private getter, focus-state mirror or navigation member.

The inner Button keeps its natural family dimensions and original feedback transitions. Its original hidden oracle is preserved: without the public focus-visible attribute, its own `clip-path` remains `inset(50%)`; keyboard focus restores `none`. Keeping the hiding box inside the image canvas preserves the bounded scroll geometry. The wrapper has no family transition, so changing its layout does not animate the Button's height through the label.

Shadcn Close selects the already-supported `secondary` variant with paired `bg-secondary / text-secondary-foreground`; Brutalist keeps its supported `surface` pair. The page does not write theme colors, override forced-color adjustment or remove the public focus feedback. Pointer entry retains the same hidden Close and no persistent toolbar. Content focus, Tab/Shift+Tab, Enter/Escape, restoration and the source-to-contain animation retain their existing owners and assertions.

## Discriminating executable evidence

Before the production change, the new pure native-fact oracle was executed against the unmodified 6da recordings:

```sh
node --test .tmp/image-zoom/close-readability-recorded-native.test.mjs
```

It produced **42 checks: 20 passed, 22 failed, no skips**. The 14 first-paint geometry checks failed on the actual clipped text. Eight Shadcn image-independent pair checks failed because the background was transparent. The 14 terminal geometry controls and six Brutalist opaque-pair controls passed. Production source and CSS still matched 6da when that replay ran.

The raw `close-readability-recorded-native-red.log` and receipt under `.tmp/image-zoom/` preserve this outcome. The receipt has SHA-256 `e25a1fd01c052117067fbe7d41880c53eff91ba923103d4dbda6df06826e14d3`. This is an executable replay of recorded Chromium facts, **not a new native run** and not a passing result for the repaired candidate.

The browser now applies that oracle to every sampled frame whose Close actually has native focus, plus the terminal sample. It does not discard frames with missing public visibility or an unexpected clip. The oracle requires actual keyboard/public visibility, painted nonempty text, an opaque pair, text inside its Button and viewport, and text inside applicable ancestor overflow bounds. It checks page scroll across the complete recorded sequence. A 0.5 CSS px allowance addresses integer client-metric rounding; it does not allow a clipped text line. The helper explicitly rejects unaccounted transforms or masks instead of assuming their bounds are safe.

The page-local small-label color check uses the [W3C contrast-minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) 4.5:1 threshold on browser-resolved sRGB colors. This bounded check is not a new family-wide palette guarantee, full accessibility certification or screen-reader acceptance. Actual first/terminal PNG review remains necessary.

## Validation boundary

Five focused image files passed **93/93**, with no failed or skipped cases, covering the existing DOM integration, source safety, asynchronous ownership, geometry and trigger readiness. The raw result is `.tmp/image-zoom/close-readability-focused.log`, SHA-256 `2112e43dbaa2f660b1e5df61c375c0b501c7c52e3e7c6e9c54d9b36af7dd7c4d`. These DOM checks do not prove the new CSS paint or native geometry.

The final scoped TypeScript check used the strict root compiler options and the Website's real path mappings: **805 source files, zero diagnostics**. It is not a full Astro application check. Its raw `.tmp/image-zoom/close-readability-types-final.log` has SHA-256 `6ef31d32550f2ff0c80b9221155449c4ea369ba41f8f2b223dd40023de225125`. Syntax, formatting and the scoped diff check passed. All **242 preceding full assertion statements remain in order**, now among 245 calls. All three motion helpers remain byte-identical, including `expectLinearImageMotion` at SHA-256 `47d1b4125834f315f7783addf8b440b621553fadde0b3888d13bdba21f3a8c96`.

The candidate retains the preceding browser assertions and the original 220ms motion oracle. Its own hosted native run, rendered keyboard/forced-colors review, and final-head whitepaper captures remain pending. Earlier a888 or 6da native success cannot substitute for those results. The previous Content-focus and outline records remain unchanged, including their genuine failures and evidence limits.
