# @proto.ui/prototypes-shadcn

shadcn-style Proto UI prototype library for adapter-driven components.

## Purpose

Provides a shadcn-style Proto UI prototype library that works with Proto UI adapters.

## Source Attribution And Status

- Component APIs and visual definitions are derived from [shadcn/ui](https://github.com/shadcn-ui/ui).
- This package is maintained by Proto UI and is not an official shadcn/ui package.
- Each cataloged component pins an upstream comparison revision and declares its current compatible subset; uncataloged or unimplemented upstream API must not be implied as supported.
- The first pinned catalog baseline is the v4 new-york Button at shadcn-ui/ui revision `f31ed81983653919dd4fe77aee4b4859f610f1dc`.
- Shadcn prototypes inherit their Base protocols by default. A setup-time negative patch is allowed only when the derived P entity explicitly declares the abandoned or replaced Base capability.
- Proto UI intentionally does not expose upstream `asChild`: trigger event routes remain component-author-owned and are merged automatically through `asTrigger`; transparent slots are not claimed as Radix Slot equivalents.

## Package Role

Prototype library package intended to be consumed together with Proto UI adapters.

## Install

```bash
npm install @proto.ui/prototypes-shadcn@0.3.0-alpha.1
```

## Family Imports

Prefer anatomy-family subpaths so only the selected Shadcn family and its corresponding Base family enter the prototype module graph:

```ts
import { shadcnButton } from '@proto.ui/prototypes-shadcn/button';
import { shadcnSelectRoot, shadcnSelectTrigger } from '@proto.ui/prototypes-shadcn/select';
import {
  shadcnScrollAreaRoot,
  shadcnScrollAreaViewport,
  shadcnScrollAreaScrollbar,
  shadcnScrollAreaThumb,
} from '@proto.ui/prototypes-shadcn/scroll-area';
import {
  shadcnTooltipGroup,
  shadcnTooltipRoot,
  shadcnTooltipTrigger,
  shadcnTooltipContent,
} from '@proto.ui/prototypes-shadcn/tooltip';
import {
  shadcnRadioGroupRoot,
  shadcnRadioGroupItem,
  shadcnRadioGroupIndicator,
} from '@proto.ui/prototypes-shadcn/radio-group';
```

The root package export remains available for compatibility. Shadcn families do not depend on sibling Shadcn families.

Radio Group composes its three parts explicitly. Base owns the selected value, Collection, roving focus, selection requests, and accessibility; Shadcn adds the circular control and passive selected dot. The family has no native form, `asChild`, public orientation/loop, or visual-variant API. Its catalog entries remain draft.

## Internal Structure

- `src/button/`
- `src/component-presets.ts`
- `src/component-presets.types.ts`
- `src/dialog/`
- `src/dropdown/`
- `src/hover-card/`
- `src/index.ts`
- `src/radio-group/`
- `src/select/`
- `src/scroll-area/`
- `src/switch/`
- `src/tabs/`
- `src/toggle/`
- `src/tooltip/`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/hooks`
- `@proto.ui/prototypes-base`

## License

The Proto UI integration code is MIT-licensed. The pinned shadcn/ui attribution and upstream MIT license are distributed in [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md); the Proto UI package license does not replace that upstream notice.

### Wrapping action labels

`ShadcnButtonProps.wrap` is an optional Proto UI presentation extension. It keeps the default single-line recipe when omitted or false. With `wrap: true`, text sizes use their original height as a minimum and allow the label to wrap within the containing inline width. `size: 'icon'` remains fixed-size. Activation, focus, disabled state and accessible names still come from Base Button.

Dialog Footer uses intrinsic reverse wrapping, rather than reproducing the upstream `sm` media-query breakpoint. Footer does not restyle arbitrary child components. Use wrapping-capable actions when labels can exceed available space; the public Dialog example explicitly opts into Button wrapping. Custom wrappers must also supply a bounded inline size. This is not a guarantee that arbitrary unbounded or fixed-width descendants will fit every viewport.

## Field (draft workspace source)

The `./field` subpath exports `fieldRoot`, `fieldLabel`, `fieldControl`, `fieldDescription`, `fieldError` and `fieldValidity`. Root owns validation and consumer-owned async request leases; the default Control owns one host text editor. All six atoms share the same Base protocol, including controlled validity, required/length checks, disabled/readOnly, exact label/help/error relationships and stale-result rejection.

This is not Fieldset/Form or form submission. Native TextControl transport, OS accessibility, browser screenshots and optical/GPUI evidence remain separate gates. Package source and synthetic-DOM tests do not imply stable release admission.

## Card (draft)

`./card` exports ShadcnCardRoot/Header/Content/Footer and their `shadcnCard*` aliases. These direct styled-only parts have no Base Card dependency, role, focus or action protocol. The source comparison is `f31ed81983653919dd4fe77aee4b4859f610f1dc`, `apps/v4/registry/new-york-v4/ui/card.tsx`, covered by the MIT third-party notice above. Root uses card-specific fill/foreground, rounded-xl, border plus explicit border-border ink (the upstream global reset made self-contained), shadow-sm and vertical spacing; the other parts own local spacing. Surface outline retains its neutral meaning.

Titles and descriptions remain ordinary content. Use native headings/paragraphs where appropriate, Shadcn Text `tone: 'inherit'` for nested title/body and explicit muted tone for captions. Upstream CardTitle/Description/Action, action-dependent header columns, header container-query markers, border-presence selectors and `asChild` are outside this bounded subset. Source/CLI/preview availability is not stable admission or a completed Finf goal; current native visual and first-frame evidence remains pending.
