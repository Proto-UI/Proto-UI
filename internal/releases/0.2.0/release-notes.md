# Proto UI 0.2.0

> Published on August 13, 2026 under the npm `latest` channel. All 40 public packages, the `v0.2.0` tag, the stable GitHub Release, and the immutable spec snapshot share this exact release identity.

Proto UI 0.2.0 promotes the complete 40-package rc.7 ecosystem surface to the first stable release on the 0.2 line. It keeps the global exact-version rule: applications should use the same `0.2.0` version for every public `@proto.ui/*` package.

## Highlights

### Executable package artifacts

- All 40 public packages ship compiled JavaScript and declaration output through reviewed package exports instead of exposing TypeScript source as runtime entrypoints.
- Package builds, export validation, native Node ESM import smoke, release staging, and tarball consumer tests share the same generated `dist` artifacts.
- The official CLI installs Adapter and Prototype packages at its own exact version so npm channels or semver ranges cannot mix release trains.

### Cross-adapter component protocols

- Web Component, React, and Vue share the Base Button, Toggle, Switch, Tabs, Hover Card, Dropdown Menu, Select, Dialog, Scroll Area, Separator, Textarea, Live Region, and Async Region surfaces admitted during the 0.2 candidates.
- Continuous nested triggers form one governed trigger group with explicit anchor, interaction surface, semantic activation route, and pointer-hit boundaries.
- Passive hosts no longer acquire an unintended focus surface, while Dialog focus looping and restoration remain covered across all three adapters.
- Textarea uses one host-mediated multiline control protocol with controlled and uncontrolled value ownership, normalized input/change/IME payloads, accessibility projection, and physical focus access.

### Prototype libraries and CLI workflows

- Base, Shadcn, Lucide, and the contributor-authored Neo-Brutalist library are part of the public release set.
- The Neo-Brutalist library includes Button, Badge, Card, Toggle, Switch, Tabs, Hover Card, Dropdown Menu, Select, Dialog, Scroll Area, Separator, Skeleton, and Textarea families, plus a first-class CSS preset.
- Shadcn Tabs default horizontal styling follows the pinned shadcn/ui v4 baseline while keeping Proto UI protocol ownership explicit.
- Lucide fixed-icon entrypoints remain tree-shakable and retain the required Lucide and Feather attribution evidence.

### Documentation and contributor governance

- The bilingual documentation includes reproducible onboarding, searchable UI-library overviews, Pagefind search, cross-adapter demos, and the information-flow guide.
- Release assets contain bilingual notes, a deterministic 40-package BOM, the immutable spec snapshot, and its checksum.
- Contribution intake records DCO sign-off, source provenance, AI-assistance disclosure, and an individual remediation path for otherwise valid unsigned commits.

## Stability boundary

`0.2.0` is the stable release for the 0.2 line, not a v1 compatibility promise. The active and draft spec entities remain the authoritative statement of which semantics are stable, still being validated, deprecated, or historical. Draft Scroll and Tooltip catalog slices do not become stable guarantees merely because their executable package surface is included in this release.

## Upgrade notes

- Keep every public `@proto.ui/*` dependency on exactly `0.2.0`.
- Consumers using public exports do not need to change their import paths from rc.7.
- Custom host integrations should use the trigger-group capability names; deprecated route-owner aliases remain transitional.
- Package-internal `src/*.ts` imports and assumptions that npm tarballs contain repository source or tests are not compatibility guarantees.

## Release validation

The protected `publish-all` workflow published all 40 public packages from the reviewed `70e2eb1a1bcd9264cf8c08e6ede210f96ee04606` commit through npm Trusted Publishing. Independent registry verification confirms all 40 exact versions, all 40 `latest` tags, integrity and shasum records for every package, and 216 exact internal dependency references. The workflow then created the `v0.2.0` tag, the stable GitHub Release, and the immutable spec snapshot whose SHA-256 digest is `98c09de2502e85fe94259ba7f936f4a4350ef5374d2d638969118f3ed3428478`.
