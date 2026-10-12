# @proto.ui/module-feedback

Proto UI module that provides feedback capability for adapters.

## Purpose

Provides feedback capability to adapters running Proto UI prototypes.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

```bash
npm install @proto.ui/module-feedback@0.3.0-alpha.1
```

## Internal Structure

- `src/caps.ts`
- `src/create.ts`
- `src/index.ts`
- `src/material/`
- `src/types.ts`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-base`

## License

MIT

## Draft resident style motion

`def.feedback.style.transition({ properties: ['translate'], durationMs: 150, easing: [0.4, 0, 0.2, 1] })` declares persistent-view interpolation. Targets remain ordinary setup/Rule style contributions followed by the existing runtime patch layer. It does not change `checked`, presence, focus, or input ownership.

The bounded first channels are translate and background-color. Translate accepts supported affine px/rem/reference-box targets; color uses semantic palette roles and an explicitly supplied typed palette. The shared sampler handles current-value retargeting, shortened reversal, reduced/unknown preference, hidden views and terminal disposal. Unsupported units, transform composition or missing palette roles retain ordinary target styles with diagnostics, not guessed animation.

Web adapters accept `residentMotion.palette`, a revisioned source with `current()` returning `{ revision, colors }` and `subscribe(invalidate)` returning cleanup. Colors are sRGB `[r, g, b, alpha]` components in `[0, 1]`. Theme CSS and this source must be projections of the same theme facts. No default Shadcn colors are copied into an adapter and no computed background CSS becomes prototype intent.

See `C-FEEDBACK-RESIDENT-MOTION-0001` and `HC-FEEDBACK-RESIDENT-MOTION-0001`. This remains draft: unit/CSSOM evidence is not browser-pixel, actual frame-timing, Compiler, native or full Switch completion. Optical material plus resident motion needs one combined atomic projection owner; a separate concurrent writer is rejected by the current implementation.
