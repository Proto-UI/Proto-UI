# Brutalist visual system: source-aligned revision

Date: 2026-10-03. Implementation carrier: [#794](https://github.com/Proto-UI/Proto-UI/issues/794).

This replaces the visual direction of the [July design](2026-07-24-brutalist-design-system-design.md). It is a source/evidence design document, not a second normative catalog. Current `P-BRUTALIST-*` draft criteria own the implementation prescription; inherited Base contracts continue to own interaction semantics, anatomy, accessibility, state, focus, placement and lifecycle. No lifecycle promotion or upstream component API compatibility is claimed.

## Reference and provenance

Primary reference: [neobrutalism.dev](https://www.neobrutalism.dev/) and [ekmas/neobrutalism-components at 3306a802724874a85f93079702b2795370a279d4](https://github.com/ekmas/neobrutalism-components/tree/3306a802724874a85f93079702b2795370a279d4). The inspected commit is the 2026-09-14 Base UI migration. The live Button page was inspected on 2026-10-03 in the cloud Chromium browser. Its measured default button was DM Sans, 14px/20px, weight 500, normal casing, 5px radius, 2px black border, blue `rgb(82,148,255)` fill and 4px 4px zero-blur black shadow. A page customized through local storage is not evidence of the default: the source baseline is pinned independently.

Use these exact upstream paths at that commit:

- `src/app/layout.tsx`: `DM_Sans` and `display: swap`
- `src/styling/globals.css`: 5px base radius, 4px shadow axes, 500 base/700 heading, default blue palette
- `src/data/fonts.ts`, `src/components/app/set-styling-pref.tsx`: DM Sans default and optional font/weight/radius/shadow customization
- `src/components/ui/{button,card,dialog,badge,toggle,tabs,textarea,select,dropdown-menu,hover-card,tooltip,switch,checkbox,scroll-area,skeleton,spinner}.tsx`: individual part geometry and states
- `public/r/styling/blue.json`: current distributable style defaults, including the absence of a dark palette
- `LICENSE`: MIT, Copyright (c) 2023 Samuel Breznjak; the complete notice is retained in `packages/prototypes/brutalist/THIRD_PARTY_NOTICES.md`

Visual recipes may be adapted under that notice. Proto UI remains the author and maintainer of its own cross-adapter semantic implementation. A visual reference does not grant Base UI/React API parity, certification, or upstream ownership.

## Typography is a prototype responsibility

The reference is **not** a compulsory Archivo Black / Space Mono pairing. Its default is the proportional geometric DM Sans family. The customizer also offers Archivo, Space Grotesk, Space Mono and other alternatives; an optional face is not the default identity.

| Role | Prototype tokens | Default visual result |
| --- | --- | --- |
| Button, input, menu row, description, tooltip, ordinary content | `font-sans font-medium` | DM Sans, 500, authored case |
| Dialog title | `font-heading font-bold text-lg leading-none tracking-tight` | DM Sans, 700, 18px, line-height 1, -0.025em |
| Tabs trigger / Toggle | `font-heading font-bold text-sm` | DM Sans, 700, 14px/20px |
| Ordinary control/row/description | `text-sm` | 14px/20px, unless that part explicitly uses `leading-6` |
| Badge | `text-xs` | 12px/16px, 500 |
| Code and keyboard notation | consumer-authored mono role | Never imposed on all controls |

`BRUTALIST_THEME` supplies `font-sans` and `font-heading` as `"DM Sans", ui-sans-serif, system-ui, sans-serif`. Text-bearing prototypes emit these family tokens themselves. The CLI CSS renderer resolves them through `--pui-font-sans` and `--pui-font-heading`; Web Components, React, Vue and Vue 2 consume the same emitted grammar. A surrounding website selector is not the source of the component font.

The documentation application bundles an unmodified DM Sans variable TTF from [google/fonts at 5b35b7208dd4100571326fdf37f030b32a524232](https://github.com/google/fonts/tree/5b35b7208dd4100571326fdf37f030b32a524232/ofl/dmsans), under SIL OFL 1.1. The asset, full license, checksum and provenance live together under `apps/www/src/styles/assets/font/dm-sans/`. Font bytes are not injected into the prototype package or downloaded at runtime by a prototype. CLI consumers self-host or otherwise license/load DM Sans and set the declared variables; without it, the system sans fallback remains usable and must not be reported as a DM Sans visual pass. DM Sans does not supply Chinese glyphs; CJK text uses the host's actual fallback font, separately identified in evidence.

## Geometry and depth are component-specific

| Part | Radius / structural border | Elevation / nesting |
| --- | --- | --- |
| Button and Button-like Dialog/Dropdown/HoverCard triggers | 5px / 2px black | 4px 4px hard shadow at rest |
| Card Root | 5px / 2px black | 4px hard shadow; Header/Content/Footer do not add mandatory section frames |
| Dialog Content | 5px / 2px black | 4px hard shadow; owns fixed centering |
| Dropdown / Select / HoverCard popup | 5px / 2px black | No shadow; existing anchor/available-space owner retained |
| Tooltip | 5px / 2px black | Neutral surface, no shadow |
| Badge / Textarea | 5px / 2px black | No shadow |
| Tabs List | 5px / 2px black | Flat; 4px inset padding separates child controls |
| Tabs Trigger | 5px / pre-reserved 2px border | Transparent border at rest, black when selected; no elevation |
| Tabs Content | No compulsory frame | Content may compose a Card when a separate surface is intended |
| Toggle | 5px / 2px black | Flat; retained 2px inset active marker is a Proto UI non-color extension |
| Menu / Select item | 5px / pre-reserved 2px transparent border | Black active border without row-size change |
| Switch Root / Thumb | Full capsule / circle, 2px black | No shadow; Thumb alone moves |
| Checkbox | Square / 2px paired ink | A compact square is intentional; no outer shadow |
| Scroll Area | PUI decorated Root 5px; viewport square; thumb full-round | Root clipping contains child paint; tracks and corner retain their own geometry owners |
| Skeleton | 5px / 2px black | Neutral fill, no shadow; remains static in this PUI contract |
| Spinner | Full circle | Existing centered 2px open ring and reduced-motion behavior unchanged |
| Separator / Dialog Mask | No new radius | Flat rule / full-viewport scrim; no shadow |

A 5px exterior does not imply that all descendants must have zero radius or the same radius. Upstream explicitly gives nested Tabs/Menu controls `rounded-base`; this is not a concentric painted inset, and must not be reduced by an invented universal subtraction formula. PUI's `radius-sm: 3px` is available only for an actual inset painted edge, not a blanket descendant rule. The Scroll Area viewport remains square because the Root owns clipping; a second nested frame is unwanted. A rounded Root must clip retained track/corner paint at its outer boundary without altering Thumb travel or introducing a second hit surface.

## Colors and theme boundary

The reference offers multiple palettes. Align the PUI default with its current blue default rather than inventing a monochrome requirement: main `#5294ff`, pale blue page `#dcebfe` (8-bit sRGB normalization of `hsl(214,95%,93%)`), neutral white, black text/borders, flat black 80% scrim. Existing named accent props remain available: canary `#facc00`, mint `#05e17a`, lavender `#7a83ff`, coral `#ff4d50`, sky `#5294ff`, each paired with black ink. The familiar public color names describe PUI extension slots, not upstream API names.

The current upstream source ships no dark-mode palette. PUI keeps its established dark backgrounds `#171717`/`#262626`, light body ink, theme-relative focus ring and separately readable destructive text as an explicit extension. Color-pair and contrast tests must cover both modes. Do not replace a paired foreground independently of its fill, and do not make white borders/shadows appear everywhere simply by reusing `foreground` as structural black.

## Interaction-state matrix

- Elevated default Button-like controls: rest at zero translation / 4px hard shadow; hover and transient press at +4px,+4px / no outer shadow. Press does not add another 4px. Button-like controls currently retain PUI's instantaneous snap rather than the reference's 150ms transition-all; endpoint alignment does not claim timing identity. Upstream reverse is the separate negative-displacement variant; PUI does not claim to expose that API in this slice
- Flat controls (Select, Tabs, Toggle): keep geometry stable through hover/press; use their existing paired color, reserved border and persistent selected/active signals
- Focus: existing theme-relative hard ring with offset; retained Tabs Content fallback-native focus indication
- Disabled: preserve shape and paired surface while retaining existing opacity, pointer gate and Base disabled behavior
- Overlay enter/exit: retain current governed fade/zoom/side transitions, timing, present-state and portal ownership; the reference is not authority to remove lifecycle semantics
- Reduced motion: keep the accepted Spinner static fallback; no new automatic Skeleton pulse or compulsory motion is introduced

## Explicit PUI extensions and unchanged semantics

Existing public variants, color/size props, controlled/uncontrolled states, accessible names, focus, events and anatomy remain PUI contracts. In particular: Switch adopts the reference 24×48px frame and 16px disc with one 20px Thumb movement and 150ms transform/color transitions, with spatial movement disabled by reduced motion. The equivalent physical placement remains bounded under RTL ancestors but does not claim mirrored RTL semantics; Checkbox retains its mixed-precedence contrast protocol; Toggle keeps its non-color active inset; Skeleton remains passive and static; Spinner remains size-only/parent-owned; Scroll Area corner work remains #779/#788. A new Base subject or host guarantee requires a separate governed decision.

## Delivery and evidence

One source manifest drives CLI theme generation and every docs projection scope. Generated files must be regenerated with `styles:preset:generate`; do not patch generated inventories by hand. Only `font-sans`, `rounded-base`, `bg-white` and `transition-transform` are added to the existing CSS utility renderer in this slice; this is not native-host typography admission.

Validation must separately establish:

1. Draft spec/source/test agreement and semantic regression coverage
2. Complete CLI token resolution and theme closure, including family/weight/radius
3. Actual loaded-font metrics, real computed styles and mixed-case appearance across WC/React/Vue/Vue2
4. Base-driven hover, press, keyboard focus, checked/selected, disabled and portal/nested geometry in actual running components
5. Light/dark, desktop/320px, reduced motion where relevant, and font failure/fallback behavior
6. Exact source/harness SHA binding for every new screenshot; historical screenshots remain historical

Current evidence and remaining debt belong in the PR's per-commit report. A source review or green token test alone is not visual acceptance.

Select placeholders on the main blue fill retain paired black ink rather than neutral muted ink: the latter measures only 2.62:1 in Light and 2.01:1 in Dark. This deliberate readability adaptation must retain at least 4.5:1 text contrast in both modes.

The full font copyright and OFL are also published at `/fonts/dm-sans-OFL.txt`, with byte-equality and browser endpoint checks. Textarea retains a theme-relative foreground border as an explicit Dark accessibility extension; a black border on the Dark neutral surface would be only 1.39:1 against its inside and 1.17:1 against the page.
