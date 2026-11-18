# Proto UI 0.3.0-alpha.0

> Published on September 7, 2026 under the npm `next` channel. The 43 public packages named by the published `package-bom-0.3.0-alpha.0.json` release asset, the `v0.3.0-alpha.0` tag, the prerelease GitHub Release and the immutable spec snapshot share this exact release identity.

Proto UI 0.3.0-alpha.0 opens the 0.3 architecture, API, and prototype evolution train. Alpha is intentional: this line may include reviewed architecture changes, top-level API changes, and new capabilities. It is not a release candidate or a stable compatibility promise.

## Accessible author handle

- Replaces `def.a11y` with `asAccessible()` from `@proto.ui/hooks` and replaces the core `A11yDefAPI` type with `AccessibleHandle`, without compatibility aliases.
- Repeated setup calls share the instance handle; retained methods remain setup-only. Dynamic declarations continue to follow existing State values.
- Migrates official prototypes and keeps A11y semantics separate from focus, keyboard interaction and structural target resolution. This is a 0.3 migration, not a 0.2 backport.

## Expose Event ownership

- Adds the public `@proto.ui/module-expose-event` package and standalone `ExposeEventModuleDef`.
- Moves outward-signal facade implementation and `EXPOSE_EVENT_SINK_CAP` consumption out of the User-to-Component Event Module.
- Uses the Expose core registry as the only declaration registry, removing the duplicate Event-owned key map.
- Migrates the standard Runtime and the React, Vue, and Web Component Adapter profiles to `expose-event` wiring.
- Retains deprecated source re-exports and the exact legacy token identity in `@proto.ui/module-event`; Adapter wiring itself must migrate from `event` to `expose-event`.

## Release governance

- Declares alpha, beta, and rc as explicit stabilization stages. rc is reserved for a build believed ready for stable promotion.
- Aligns the current 43 public packages under the exact `0.3.0-alpha.0` ecosystem identity.
- Gives 0.3 contributions an exact declared V-entity version while keeping each feature or package change independently reviewable.
- Keeps future public package identities and their registry bootstrap work in the implementation PRs that introduce them.
- Completes the `@proto.ui/module-expose-event` npm identity bootstrap and Trusted Publisher binding ahead of release; its deprecated placeholder is not release evidence.

## Image View

- Adds the public `@proto.ui/module-image-view` package and admits it to the exact 43-package release identity as the host-mediated image presentation protocol used by Base Image and Runtime.
- Covers generation-bound loading, stale completion rejection, replacement visual clearing, explicit accessibility mode, and direct `source` projection with executable fake-host and runtime evidence.
- Keeps the first `@proto.ui/module-image-view` npm identity bootstrap, protected release-workflow configuration, and registry readiness as explicit pre-publication gates; for this package the registry still resolves `latest` to the deprecated `0.0.0-bootstrap.0` version and `next` to `0.3.0-alpha.1` (observed 2026-11-17).

## Official Vue 2 Adapter

- Admits `@proto.ui/adapter-vue2` as the official Web Adapter profile for Vue `>=2.6.0 <2.7`, separate from the Vue 3 `@proto.ui/adapter-vue` package.
- Adds Vue 2 to the public Previewer registry and the shared Dialog, Select controlled-value, and Scroll Area Move conformance journeys.
- Adds public package metadata, exact-version BOM participation, lifecycle/view-epoch regression evidence, and the `A-VUE-2-0001` profile.
- Keeps first npm identity bootstrap and Trusted Publisher configuration as explicit pre-publication gates; `@proto.ui/adapter-vue2` now has published npm versions `0.3.0-alpha.0` and `0.3.0-alpha.1` (observed 2026-11-17).

## A11y direct-reference transport

- Gives each logical A11y instance one opaque semantic-object ref and lets module-internal owners set ordered direct-ref relationships without exposing protocol keys or host ids.
- Adds fail-closed Web projection for missing or duplicate bindings, document-scoped target reservations across view replacement and owner-document movement, immediate snapshot replay after projector replacement, dependency-targeted reconciliation, and deterministic projector cleanup while preserving existing string, State-backed, and additive relation behavior.
- Fixes scalar cleanup to restore overwritten host baselines and preserve later host changes; heading detach uses shared ownership instead of unconditionally deleting `aria-level`.
- Fixes explicit-id takeover to release the physical target's generated-ID ownership before capturing a scalar baseline, including shared-target records in one registry; terminal cleanup no longer restores a retired generated id as host data, while true host baselines remain preserved.
- Re-resolves surviving generated-reference dependents when a shared explicit-id contribution changes or is released, including writer updates and detached terminal disposal, while preserving reservation availability and host-baseline provenance.
- Keeps the anatomy family/domain/role/key matcher and Tabs migration from #549 / PR #553 outside this lower-level transport slice.

## Release validation

The protected release workflow run <https://github.com/Proto-UI/Proto-UI/actions/runs/34125326136> concluded `success` for head `f0a9c95e988ee882a5815e319a8211e69924b968`, which is also the commit that the `v0.3.0-alpha.0` lightweight tag resolves to. npm wrote the first package at `2026-09-07T13:06:11.110Z` and the last at `2026-09-07T13:13:21.196Z`; the prerelease GitHub Release was published at `2026-09-07T13:11:41Z`. The immutable spec snapshot attached to that release has SHA-256 `1d908781ac057312c7a6e17b0c51cbe5ba3ac505b13bca24088de976ff36fcdd`, matching its published checksum file. Every one of the 43 packages still exists at exactly `0.3.0-alpha.0` in the registry, but the `next` dist-tag has since advanced to `0.3.0-alpha.1`, which is the state the following release established. npm did not publish a `gitHead` for these versions, so the commit binding comes from the release workflow head and the tag target rather than from registry metadata.

These publication facts were re-read from the npm registry and the GitHub release API on 2026-11-17 and 2026-11-18. They describe this published release only: they do not activate `V-PROTO-UI-0009`, and they make no claim about any later release train.
