# Package workspace

Package manifests and [pnpm-workspace.yaml](../pnpm-workspace.yaml) define the workspace. The [package surface map](../internal/governance/package-surface-map.md) and [launch policy](../internal/governance/launch-package-policy.md) define delivery roles; a directory's presence does not establish a public release or complete conformance.

| Directory | Responsibility |
| --- | --- |
| [core/](core/README.md), [types/](types/README.md), [hooks/](hooks/README.md) | Authoring syntax, shared protocol types, and author-facing helpers. |
| [runtime/](runtime/README.md) and [modules/](modules/) | Runtime execution and reusable semantic owners. |
| [adapters/](adapters/) | Host translation and adapter-specific integration. Read the exact package/profile rather than assuming equal target coverage. |
| [prototypes/](prototypes/) and [compositions/](compositions/) | Prototype families and composed consumer patterns. Family release scope follows the [current plan](../internal/governance/release-0.3-plan.md). |
| [compiler/](compiler/README.md) | 0.4 compiler foundation and explicit unavailable boundary. The old implementation is retired; replacement backends are not implemented. |
| [cli/](cli/README.md) | Project initialization, facade generation, and style/token tooling. |
| [spec/](spec/) | Schema, loading, graph, snapshot, and validation tools for the [spec catalog](../spec/README.md). |
| [host-protocol/](host-protocol/README.md) | Private host protocol model; model tests do not establish native integration. |
| [web-conformance/](web-conformance/README.md) | Shared Web conformance harness and assertions. |

Keep usage and development instructions next to their package. Some package README bodies or release sections are produced by [release metadata synchronization](../scripts/release/sync-metadata.mjs); check the package's `preserveReadme` rule before editing. Follow [documentation maintenance](../internal/governance/documentation-policy.md) for generated content and [release evidence](../internal/releases/README.md) for the distinction between workspace preparation and published installation advice.
