# Liquid Glass projection (draft)

This private, unreleased source package projects Base Button into a functional-control visual language informed by Apple's [Materials HIG](https://developer.apple.com/design/human-interface-guidelines/materials). It is independently implemented, not Apple's native material engine or an Apple-endorsed library. No Apple font, icon, private asset or shader is redistributed.

`liquid-glass-button` genuinely invokes `asButton()` once. Base owns activation, keyboard, focus and disabled behavior. Visual props:

- `variant: regular | prominent`, default `regular`
- `material: auto | opaque`, default `auto`
- inherited `disabled`, default `false`

## Bounded material

A regular functional surface uses `bg-secondary/80` and `backdrop-blur-xs` only when all four live `preference.*` values explicitly permit enhancement and both paired `styleSupport.alphaFill` and `styleSupport.backdropBlur4px` facts are true. These are fixed draft contracts from #793, not arbitrary browser reads inside a Prototype. The Web provider's syntax filter is necessary but insufficient: actual paint must be verified in the consumer fixture.

Any unknown/lost/mismatched source, reduced transparency or motion, non-default contrast, forced colors, unsupported effect, or explicit `material: opaque` uses the readable opaque surface. Removing an enhancement contribution also removes its blur. Prominent actions retain a solid accent for text clarity. There are no animated highlights, transitions, morphing, refraction or background-adaptive luminosity claims. Content panels and the page remain neutral; the whole gallery is not glass.

The 80% fill bounds background influence. Text uses source-owned contrasting light/dark tokens; the consumer owns font resources and theme activation. Prototype tokens, not website component CSS, own the surface. A colorful demonstration backdrop is consumer content, not a fake material bitmap.

## Entry points and evidence

- `src/button` and package root are genuine source exports
- `src/theme` owns light/dark values and the theme renderer
- `/en/ui-libraries/liquid-glass/` and `/zh-cn/ui-libraries/liquid-glass/` register the currently implemented Button, with operable four-runtime documentation demos
- `/en/test/liquid-glass-material/` is the exact-source real-Web material fixture; its negative control removes only blur from the same actual control and compares decoded screenshot pixels
- `/en/test/new-projection-families/` deliberately sets `material: opaque` to retain explicit fallback evidence

The full family remains incomplete (#792). A Button-only manifest rejects missing kinds instead of aliasing another family. Homepage-wide selection awaits the real parts/compositions its gallery needs. General Compiler admission remains #732/#733. GPUI requires the real root Feedback transaction path in #719 plus native paint/input/focus/a11y evidence; #798's token data alone is insufficient. Flutter/Qt need actual backends. Native effects remain explicit gaps, not silently dropped success.

Current new material browser evidence is planned until the combined exact-head Actions fixture has run and its actual captures have been inspected. Existing Button fallback evidence is retained separately.
