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

## CSS4 background measurement

The second capture run (`651dcfdb`, Actions `37106399893`) passed all seven browser/serialization tests and reached actual captures. Its fail-closed contrast check exposed the documentation preview's real `oklch(... / 0.3)` background over an opaque surface. The RGB-only probe correctly returned unmeasured rather than passing it.

The next evidence-only correction uses Chromium's native CSS Color parser and source-over compositing in a detached, sRGB OffscreenCanvas color probe. It reads the real computed ancestor colors without modifying the page. Contrast arithmetic remains in Node. Images/gradients, group opacity, filters, blend modes, unknown paint and a non-opaque final background remain unmeasured; this is deliberately not a general contrast engine. Browser controls exercise the exact serialized callback on CSS4/translucent and unsupported-paint fixtures. Actual page PNG/WebM review remains separate from that controlled color calculation.

## Centering check

The maintainer additionally requested that the Spinner not drift away from its center. Capture now samples every real Root across at least one full natural 1000ms revolution, verifies all four angular quadrants, and records transform origin and border-box center at each frame. All three sizes and both parent compositions must keep their center within 0.25 CSS pixels and align to the containing row/Button's vertical center. Reduced motion is sampled independently. The open arc's visual mass naturally turns around the pivot; this is distinguished from a drifting geometry/rotation center. A single still image is not evidence of whole-cycle centering. Desktop base/candidate videos and corresponding captures use the same viewport.

Independent review tightened two evidence boundaries before publication: known opacity is proved from supported computed color syntax before 8-bit readback (a near-opaque `.999` can round to 255), and every Root must report `1s linear infinite running` and traverse at least 360 degrees in the sampled window. A half-turn-sized sampling gap is unproven. Near-opaque and backdrop-filter negative controls accompany the native color tests.

## First complete capture matrix

At `c0771459`, Actions `37108467102` successfully captured all 32 baseline and 32 candidate states. Candidate normal-motion samples cover 80 Root windows, each over 395.999 degrees; maximum center drift and parent-center offset are 0.000031 CSS pixels, transform-origin error is zero, and minimum measured contrast is 15.79:1. No captured case reports page exceptions or horizontal overflow. These are measured scope-bound results, not a general accessibility claim.

The same run's new independent browser controls failed because the test passed serialized function text as an expression to Playwright, yielding an uninvoked function and then `undefined`. The actual capture driver passed function objects and completed. The test bridge is corrected to pass the isolated function object; its real-browser controls must still rerun, and the original failure remains preserved.

## Native control calibration

Run `37109118552` at `935e34de` again captured all 64 base/candidate states; the real off-center-pivot and unsupported-paint controls passed. Two control assumptions needed correction. CSS4 conversion placed separate RGB channels on opposite sides of the 127.5 half-byte boundary, so the same existing 127–128 bound now applies independently to all three channels. This does not change the 3:1 contrast or 0.25px centering thresholds.

The legacy `rgba(...,.999)` case reported opaque after the browser's computed-value pipeline; recovering authored precision from that serialized observation is not claimed. [CSSOM's alpha serialization rules](https://www.w3.org/TR/cssom-1/#serialize-an-alphavalue) explicitly cover internal 8-bit alpha representation. The next run retains the raw legacy computed facts as diagnostics. The actual quantization negative control uses `color(srgb ... / .999)` and first requires the computed color to still contain `.999`, before checking that 8-bit readback at 255 cannot prove opacity. The probe models browser-resolved color values only; it does not promise fidelity to original authored transparency or constitute a general contrast engine. No production or capture-probe logic changes in this fixture correction.
