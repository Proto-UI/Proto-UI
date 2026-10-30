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

## Current Base draft projections

The workspace also contains direct passive-region, Image, Table and Transition projections, complete Select structural/alignment parts, an optional passive Tabs Indicator and a separate indexed Slider Values family. Existing controls, forms, overlays, search/navigation and collection/layout families retain their real Base owners. Drawer accepted-side/scroll are helper boundaries rather than additional rendered parts. Indexed Values Track remains structural; pointer-origin/session, grouped Field and native/Compiler admission are not manufactured by family paint.

The retained source comparison for the eight modern profiles (vega, nova, maia, lyra, mira, luma, sera, rhea) and the independently retained New York recipes is `shadcn-ui/ui@3d98900e9b73c45f035f8109e9d41ba6a51685e7`. Existing component-specific API and adopted content pins remain distinct. Scope/default/profile support is declared per component: a profile name is not a cross-component compatibility guarantee, and unsupported consumers fail rather than silently borrow another profile. Native layout, drag/motion, four-Web consumers, accessibility, Compiler and exact-head source-derived style closure require their own evidence; source/catalog availability does not promote a draft.

Style selection is private Rule state, not a Web data-attribute API. Profile-qualified focus, checked and theme rules therefore apply bare tokens only while their full runtime condition holds; profile-independent exposed-state rules can still lower to conditional Web tokens. Static CSS collection must retain every profile's runtime tokens, including the shared menu recipes and Luma/Sera separator negative spacing, even when those tokens are absent from an idle host.

Scroll Area retains its component-specific `f31ed81983653919dd4fe77aee4b4859f610f1dc` New York comparison alongside the later retained source. Viewport inherits its authored parent radius; vertical/horizontal tracks use only their inward left/top transparent border with one-pixel padding. Thumb has no authored border: New York and the nonsquare profiles use round ends, while Lyra/Sera are square. Native forced-color visibility and geometry still require separate evidence. Drawer Header/Footer layout and inherited Title paint follow the retained New York recipe; accepted-side rules select directional borders/corners rather than a fixed all-edge shell, without replacing the Root owner or caller nodes. Runtime CSS declarations alone do not establish native layout or paint acceptance.

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

The same entry exports `fieldTextarea`, `fieldSelectTrigger` and `fieldSwitch`, each consuming its matching optional-Field Base hook once and sharing standalone family paint. The canonical Field binding alone supplies invalid/pending, policy and relationships; these are not parallel editors or additional selection owners.

This is not Fieldset/Form or form submission. Native TextControl transport, OS accessibility, browser screenshots and optical/GPUI evidence remain separate gates. Package source and synthetic-DOM tests do not imply stable release admission.

## Card (draft)

`./card` exports ShadcnCardRoot/Header/Content/Footer and their `shadcnCard*` aliases. These direct styled-only parts have no Base Card dependency, role, focus or action protocol. The source comparison is `f31ed81983653919dd4fe77aee4b4859f610f1dc`, `apps/v4/registry/new-york-v4/ui/card.tsx`, covered by the MIT third-party notice above. Root uses card-specific fill/foreground, rounded-xl, border plus explicit border-border ink (the upstream global reset made self-contained), shadow-sm and vertical spacing; the other parts own local spacing. Surface outline retains its neutral meaning.

Titles and descriptions remain ordinary content. Use native headings/paragraphs where appropriate, Shadcn Text `tone: 'inherit'` for nested title/body and explicit muted tone for captions. Upstream CardTitle/Description/Action, action-dependent header columns, header container-query markers, border-presence selectors and `asChild` are outside this bounded subset. Source/CLI/preview availability is not stable admission or a completed Finf goal; current native visual and first-frame evidence remains pending.

### Textarea style scope (draft)

`shadcnTextareaRoot` accepts `inherit`, New York (`new-york-v4`, alias `new-york`) and all eight modern `styleProfile` values: vega, nova, maia, lyra, mira, luma, sera and rhea. The public shared `styleScope` selects nearest inherited paint; an explicit leaf choice wins, then the existing New York baseline is the fallback. Unknown profiles fail rather than silently borrowing another recipe. Base still owns the single editor, value, selection, composition, labels, focus, disabled/readOnly and native props.

Use `fieldTextarea` from the existing `field` entry (also root-exported) when the multiline editor belongs to a Field. This is the semantic optional-Field composition from Base, not a second editor or Rhea-specific product. It shares exactly the same paint setup with ordinary Textarea. Field owns invalid/pending and label/description/error relationships; nonempty external `labelledBy`/`describedBy` are rejected. Ordinary Textarea retains explicit label relationships and does not automatically absorb a nearby Field.

The mapped profiles use native CSS `field-sizing: content`; no JS measures content or sets height. This explicitly revises the former Shadcn slice's blanket auto-resize exclusion, while preserving the prohibition on a new JS/editor sizing protocol. Rhea uses `resize: none`; New York retains the existing `resize: vertical` compatibility choice, and other profiles retain their own pinned paint. Browser support for intrinsic sizing and its effect on `rows` is native CSS behavior, not a replacement editor API.

The md font-size threshold is prototype Rule data (`viewport.width >= 768` CSS pixels), not adapter code. SSR/missing paired source uses the safe base font size. Fixed upstream source is `shadcn-ui/ui@3d98900e9b73c45f035f8109e9d41ba6a51685e7`; full native intrinsic/resizing/raster acceptance and positive compiler lowering remain separate evidence boundaries.

### Command and single-control input shell (draft)

Command accepts shared `styleProfile` selection for New York and all eight modern styles, each with its retained source recipe. The New York default retains standalone compatibility. The explicitly composed Rhea example remains Command Root → CommandInputWrapper → InputShell → CommandInput, alongside CommandContent; its passive shell is not an editor or selection owner. The public `./input-shell` entry also supplies `inputShellControl`, an ordinary Base Input editor, so the shell is reusable rather than Command-specific. Do not add a second rounded border to the inner input.

Bind actual control focus/disabled exposes with `bindInputShellControl` and an explicit view owner; merge its facts with shell props, retire it on disposal, and use its replacement method when changing the control instance. Command uses `focusIndicator: 'none'` to match its upstream slot selector; ordinary input uses the default ring. This is not full InputGroup, invalid aggregation or an addon API. See [the bounded composition contract](../../../internal/contracts/command/shadcn-input-shell.presentation.v0.md) for exact lifecycle, omissions and source attribution. Native visual acceptance is separate from source/unit coverage.

If a control unsubscribe throws during disposal or replacement, the binding still attempts every unsubscribe and releases its reservations, then surfaces the first thrown value unchanged, including `undefined`, `null`, `false`, `0` or an empty string. The owner cleanup returned by `onDispose` is attempted in the same pass and never replaces that first failure; it surfaces only when no control unsubscribe failed first. A failed replacement never attaches the new control; cleanup failure is not successful disposal or replacement.
