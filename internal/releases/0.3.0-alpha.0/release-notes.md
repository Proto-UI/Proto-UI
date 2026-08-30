# Proto UI 0.3.0-alpha.0

> Draft release notes. This release has not been published. npm, Git tag, GitHub prerelease, dist-tag, and immutable snapshot evidence remain pending.

Proto UI 0.3.0-alpha.0 opens the 0.3 architecture, API, and prototype evolution train. Alpha is intentional: this line may include reviewed architecture changes, top-level API changes, and new capabilities. It is not a release candidate or a stable compatibility promise.

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
- Keeps the first `@proto.ui/module-image-view` npm identity bootstrap, protected release-workflow configuration, and registry readiness as explicit pre-publication gates; bootstrap must not claim `latest` or `next`.

## Official Vue 2 Adapter

- Admits `@proto.ui/adapter-vue2` as the official Web Adapter profile for Vue `>=2.6.0 <2.7`, separate from the Vue 3 `@proto.ui/adapter-vue` package.
- Adds Vue 2 to the public Previewer registry and the shared Dialog, Select controlled-value, and Scroll Area Move conformance journeys.
- Adds public package metadata, exact-version BOM participation, lifecycle/view-epoch regression evidence, and the `A-VUE-2-0001` profile.
- Keeps first npm identity bootstrap and Trusted Publisher configuration as explicit pre-publication gates; this draft does not claim the package is already available from npm.

## Publication status

This preparation does not publish packages, create `v0.3.0-alpha.0`, move npm `next`, or activate `V-PROTO-UI-0009`. Those actions require merge to `main`, a complete release rehearsal over the final reviewed package set, protected publication, and a separate evidence review.
