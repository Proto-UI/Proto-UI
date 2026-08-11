# @proto.ui/prototypes-brutalist

Contributor-authored Neo-Brutalist Proto UI style library.

> **Release status:** public `0.2.0-rc.7` draft release candidate in the 40-package rc.7 BOM. The npm bootstrap identity exists, but rc.7 is not installable until the release rehearsal and publication complete.

## Purpose

Provides a Proto UI design-language foundation: square geometry, strong structural borders, hard offset shadows, flat paired colors, and explicit light/dark theme variables. Families project Base only when they share a transferable Base protocol; styled-only visual prototypes are defined directly.

This package is not owned by or claimed to be compatible with a named third-party component system. It uses only general Neo-Brutalist visual references.

## Current workspace scope

The rc.7 release-candidate package includes:

- shared Brutalist style tokens, light/dark theme grammar, and the CLI style preset;
- Button as the reference family;
- Base protocol projections: Toggle, Switch, Tabs, Hover Card, Dropdown, Select, Dialog, Scroll Area, Separator, and Textarea;
- direct styled-only, passive Badge, Card, and Skeleton families with no Base counterparts;
- public anatomy-family subpaths for every included family;
- public `proto-ui add` entries that generate facades from those family subpaths.

Brutalist Skeleton is passive, contentless, and excluded from the accessibility tree. The consuming async/loading region—not Skeleton—owns busy state, announcements, content replacement timing, and focus continuity.

Only families present in this package's exports and CLI registry are in the rc.7 release scope; draft PR #323 remains incubation history rather than a second release surface.

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

The package is admitted to the rc.7 launch-commitment set. Long-term family ownership and later semantic changes remain subject to Proto UI governance.

## Related packages

- `@proto.ui/core`
- `@proto.ui/hooks`
- `@proto.ui/module-text-control`
- `@proto.ui/prototypes-base`

## License

MIT
