# Packed consumer presentation checks

These fixtures project the existing prototype definitions into packed consumers. They do not define a separate component recipe or claim full upstream parity.

## Shadcn Button

`P-SHADCN-BUTTON-NEW-YORK-PAINT` governs the accepted shared paint. Its visual source is [New York Button at shadcn-ui/ui 02cad61166c4c20edbc8a3f71bd720eed4c1f49b](https://github.com/shadcn-ui/ui/blob/02cad61166c4c20edbc8a3f71bd720eed4c1f49b/apps/v4/registry/new-york-v4/ui/button.tsx#L7), independently of the entity's older historical compatibility baseline and recorded extensions.

- Default size uses `h-9 gap-2 px-4 py-2 rounded-md`: 2.25rem height, 0.5rem gap, 1rem inline padding and 0.5rem block padding. At a 16px root the native border-box height is 36px; `sm` remains 32px. Preserve exact dimensions rather than accepting any nonzero size.
- Icon size uses `size-9 gap-2 rounded-md`, so website copy commands that select this public size inherit a 36px square at a 16px root. Their 18px glyph, clipboard behavior, focus feedback, repeated activation, failure recovery and user classes remain separate assertions. Brutalist copy commands retain their own 40px geometry.
- Default/outline radius follows the installed theme's `--pui-radius-md` (8px at the default 16px root). Do not substitute the former large radius. Enlarged-root theme parity remains outside this consumer correction.
- `group/button` is not a guaranteed paint token. Styled smoke entries verify the explicit default recipe in `data-pui-style`, reject prototype tokens leaking into `class`, and verify installed structural CSS. Missing CSS, stale height and stale padding must fail even if the data attribute is correct.
- React/Vite and CLI React, Vue and Web Component smoke cases load the actual generated CSS through the bounded HappyDOM loader. The CLI Vue 2 JavaScript `--no-styles` case verifies authored tokens and behavior only; loading styles there would erase its separate no-styles boundary.

`consumer-smoke-css.test.mjs` tests the oracle against generated CLI CSS, including missing/stale CSS and obsolete-token negatives. `packages/prototypes/shadcn/test/button-consumer-style.test.ts` exercises it against the real source Web Component host. Neither replaces the packed artifact run. HappyDOM preserves logical padding declarations but does not reliably resolve their physical longhands; this helper checks the logical values with exact rem/px equivalence. Browser tests retain exact physical geometry, complete stylesheet loading, navigation, overflow, palette, focus and clipboard assertions. Source/HappyDOM checks are not evidence of browser layout, paint, native hit testing, animation or full family parity.
