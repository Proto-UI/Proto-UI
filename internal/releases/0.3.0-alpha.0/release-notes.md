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
- Aligns the current 41 public packages under the exact `0.3.0-alpha.0` ecosystem identity.
- Gives 0.3 contributions an exact declared V-entity version while keeping each feature or package change independently reviewable.
- Keeps future public package identities and their registry bootstrap work in the implementation PRs that introduce them.
- Keeps publication blocked until the `@proto.ui/module-expose-event` npm identity is bootstrapped and configured for the protected workflow.

## Publication status

This preparation does not publish packages, create `v0.3.0-alpha.0`, move npm `next`, or activate `V-PROTO-UI-0009`. Those actions require merge to `main`, a complete release rehearsal over the final reviewed package set, protected publication, and a separate evidence review.
