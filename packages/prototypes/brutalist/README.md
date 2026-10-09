# @proto.ui/prototypes-brutalist

Proto UI-maintained Neo-Brutalist design-language projection.

> **Release status:** public `0.2.0-rc.7` package published on npm under `next`. The stable `0.2.0` release train is under review and is not installable until publication completes.

## Purpose

Provides a Neo-Brutalist design-language projection: component-specific geometry, strong structural borders, role-specific hard shadows, flat paired colors, and explicit light/dark theme variables. Families project Base only when they share a transferable Base protocol; styled-only visual prototypes are defined directly.

The current workspace adapts visual recipes from [neobrutalism.dev / neobrutalism-components at `3306a802`](https://github.com/ekmas/neobrutalism-components/tree/3306a802724874a85f93079702b2795370a279d4), with MIT attribution preserved in [third-party notices](THIRD_PARTY_NOTICES.md). Neo-Brutalist design language and the upstream visual recipes are not Proto UI originals. Proto UI maintains its own semantic implementation and documented extensions; this does not imply upstream endorsement or component API compatibility.

## Published rc.7 scope

The published rc.7 package and the prepared 0.2.0 stable package include:

- shared Brutalist style tokens, light/dark theme grammar, and the CLI style preset;
- Button as the reference family;
- Base protocol projections: Toggle, Switch, Tabs, Hover Card, Dropdown, Select, Dialog, Scroll Area, Separator, and Textarea;
- direct styled-only, passive Badge, Card, and Skeleton families with no Base counterparts;
- public anatomy-family subpaths for every included family;
- public `proto-ui add` entries that generate facades from those family subpaths.

Brutalist Skeleton is passive, contentless, and excluded from the accessibility tree. The consuming async/loading region—not Skeleton—owns busy state, announcements, content replacement timing, and focus continuity.

Only families present in this package's exports and CLI registry are in the 0.2.0 release scope; draft PR #323 remains incubation history rather than a second release surface.

## Theme preset

`BRUTALIST_THEME` is the canonical Light/Dark semantic-color manifest. Both modes expose the same keys and explicit background/foreground pairs. `renderBrutalistThemeCss()` projects that manifest for package consumers; the CLI carries a checked generated copy so initialization also works before this package is installed.

```ts
import { BRUTALIST_THEME, renderBrutalistThemeCss } from '@proto.ui/prototypes-brutalist/theme';
```

Initialize a project with the matching project-wide preset:

```sh
proto-ui init --prototypes brutalist
```

Config v1 supports one enabled style preset. `proto-ui add` rejects a Brutalist component when another preset is enabled rather than silently replacing the application's theme. `--no-styles` remains an explicit consumer-owned styling mode; in that mode `add` succeeds with a note and the application must provide every required `--pui-*` semantic token.

## Button public API

| Prop       | Values                                             | Default             |
| ---------- | -------------------------------------------------- | ------------------- |
| `variant`  | `solid` \| `surface` \| `destructive`              | `solid`             |
| `color`    | `main` \| `mint` \| `lavender` \| `coral` \| `sky` | `main` (solid only) |
| `size`     | `default` \| `sm` \| `lg` \| `icon`                | `default`           |
| `disabled` | `boolean`                                          | `false`             |

Every fill co-selects its foreground. Solid accents keep black text in both Light and Dark. There is no `outline` variant: structural 2px borders are part of the shared grammar.

## Badge and Card boundaries

Badge exposes `tone: accent | info | danger` and remains passive, roleless, and non-focusable. Card exposes only Root, Header, Content, and Footer as passive visual regions. Status, navigation, activation, selection, and disclosure are composed from the protocols that own those semantics.

## Family imports

```ts
import { brutalistButton } from '@proto.ui/prototypes-brutalist/button';
import { brutalistBadgeRoot } from '@proto.ui/prototypes-brutalist/badge';
import {
  brutalistCardRoot,
  brutalistCardHeader,
  brutalistCardContent,
  brutalistCardFooter,
} from '@proto.ui/prototypes-brutalist/card';
import { brutalistSeparatorRoot } from '@proto.ui/prototypes-brutalist/separator';
import { brutalistSkeletonRoot } from '@proto.ui/prototypes-brutalist/skeleton';
import { brutalistTextareaRoot } from '@proto.ui/prototypes-brutalist/textarea';
```

## Maintenance

The package is admitted to the 0.2 launch-commitment set. Long-term family ownership and later semantic changes remain subject to Proto UI governance.

## Related packages

- `@proto.ui/core`
- `@proto.ui/hooks`
- `@proto.ui/module-text-control`
- `@proto.ui/prototypes-base`

## License

MIT

## Visual reference and fonts

The current draft visual grammar follows neobrutalism.dev at `3306a802724874a85f93079702b2795370a279d4`: DM Sans (500 base / 700 heading), component-owned 5px or full-round geometry, and role-specific hard shadows. See [third-party notices](THIRD_PARTY_NOTICES.md) and the [source-aligned design](../../../docs/superpowers/specs/2026-10-03-neobrutalism-source-aligned-design.md). Base semantics remain Proto UI-owned.

Consumers load DM Sans themselves (SIL OFL 1.1) and provide the generated theme variables. Prototypes emit `font-sans` or `font-heading`; the CSS renderer reads `--pui-font-sans` / `--pui-font-heading`. No prototype makes a network font request. The system sans fallback remains functional; a fallback rendering is not a verified DM Sans capture. CJK glyphs use the host fallback. The documentation app self-hosts the font with its full license.

## Field (draft workspace source)

The `./field` subpath exports `fieldRoot`, `fieldLabel`, `fieldControl`, `fieldDescription`, `fieldError` and `fieldValidity`. Root owns validation and consumer-owned async request leases; the default Control owns one host text editor. All six atoms share the same Base protocol, including controlled validity, required/length checks, disabled/readOnly, exact label/help/error relationships and stale-result rejection.

This is not Fieldset/Form or form submission. Native TextControl transport, OS accessibility, browser screenshots and optical/GPUI evidence remain separate gates. Package source and synthetic-DOM tests do not imply stable release admission.
