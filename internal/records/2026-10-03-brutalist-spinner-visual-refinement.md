# Brutalist Spinner visual refinement

## Request and observed problem

Agent's sanitized paraphrase: improve the Brutalist Spinner's appearance after comparing real Neo-Brutalist implementations, and submit a separate PR.

The existing draft uses a 2px three-sided square. At diagonal phases its open side and two corners can read as a tilted bracket or check-like shape. Its painted bounding envelope also changes during rotation. Those are the specific visual problems being addressed, not a loading-state or accessibility defect.

## Primary reference and scope

On 2026-10-03 the [Neobrutalism components Spinner page](https://www.neobrutalism.dev/docs/spinner) was inspected in a real browser, including its animated size and Button examples and displayed Manual source. It uses a circular Loader2 icon, 16px default size, `currentColor`, and one-second linear rotation. The page identifies its license as MIT. This is visual-behavior observation only: no source, path data, icons, assets, or tokens were copied. Proto UI remains its own design-language family.

The actual upstream source was also checked at commit `3306a802724874a85f93079702b2795370a279d4`: [Spinner implementation](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/components/ui/spinner.tsx) and [MIT LICENSE](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/LICENSE), copyright Samuel Breznjak. The implementation matches the page's displayed Manual example. This is an implementation reference, not Proto UI's semantic upstream or a compatibility commitment: Proto UI's own draft contracts continue to govern anatomy, API and accessibility ownership. Any later source adaptation must independently preserve the applicable license and attribution.

The proposed minimal change is a circular 2px open ring using the existing `rounded-full` style token. The circular outline avoids diagonal corner overshoot during rotation; the familiar open arc is intended to read more clearly at small sizes. This is a readability and motion-stability tradeoff, not a claim that circles are inherently more Neo-Brutalist. Actual baseline/candidate captures remain required to assess optical weight beside text.

The reference's `role=status` and label are deliberately not adopted. The existing single contentless Root, size-only API (16/24/32), inherited `currentColor`, 1000ms linear timeline, reduced-motion static fallback, and parent-owned loading, busy, accessible text, placement and focus remain unchanged. No new dependency, Base Spinner, semantic surface or lifecycle promotion is introduced.

## Authority and evidence

The visual prescription is revised coherently in the draft `D-BRUTALIST-STYLED-ONLY-ADMISSION-0001`, `P-BRUTALIST-SPINNER` and `T-BRUTALIST-SPINNER-0001`, preserving their history and all ownership boundaries. EN/ZH docs describe the same candidate. The source remains `packages/prototypes/brutalist/src/spinner/root.proto.ts`; the demo still consumes the real public package through Web Components, React, Vue and Vue 2.

Verification covers token projection, all three sizes, both parent compositions, light/dark currentColor contrast, actual animation progress and static reduced motion. Generated files are regenerated, not hand-edited. The dedicated browser evidence job captures the base and candidate without rewriting component styles; metadata names exact source SHAs and measured styles. PNGs and a WebM preserve both resting and naturally animated output. Evidence is incomplete until that run succeeds and its artifacts have been inspected; artifacts have 30-day retention and may require GitHub sign-in to download.

AI assistance: implementation, source tracing, tests and this record were prepared with OpenAI Dots. Co-author by OpenAI Dots.

## First capture-run correction

The first exact-head run (`58f8c4f3b16d648b758ac222523a2ea72cff77e0`, Actions `37105413077`) passed all four candidate browser-contract tests, including the four-runtime/theme and reduced-motion loops. Both base and candidate capture drivers stopped with `ReferenceError: __name is not defined`: tsx's function-name preservation helper was referenced by local color-math functions serialized into the browser. This is capture-driver failure, not a reproduced Spinner failure.

The correction moves color parsing/contrast calculation into Node while the page callback only reads computed styles. A serialization regression compiles the actual callbacks with `keepNames: true`, evaluates them in a fresh realm, and exercises the style reader without an injected helper. The original failed run and artifacts remain available; new captures must bind to the corrected head before visual claims are made.
