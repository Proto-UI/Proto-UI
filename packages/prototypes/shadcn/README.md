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
npm install @proto.ui/prototypes-shadcn@0.3.0-alpha.0
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
```

The root package export remains available for compatibility. Shadcn families do not depend on sibling Shadcn families.

## Internal Structure

- `src/button/`
- `src/component-presets.ts`
- `src/component-presets.types.ts`
- `src/dialog/`
- `src/dropdown/`
- `src/hover-card/`
- `src/index.ts`
- `src/select/`
- `src/scroll-area/`
- `src/switch/`
- `src/tabs/`
- `src/toggle/`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/hooks`
- `@proto.ui/prototypes-base`

## License

The Proto UI integration code is MIT-licensed. The pinned shadcn/ui attribution and upstream MIT license are distributed in [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md); the Proto UI package license does not replace that upstream notice.
