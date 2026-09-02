# Proto UI spec entity catalog

`spec/**` is the machine-governed source of truth for Proto UI. It models project semantics as versioned, related entities rather than as a collection of independent prose documents.

The catalog is intentionally incomplete. An entity being present does not mean it is stable, and an absent entity does not mean the implementation has no behavior. Always read lifecycle status, version, relations, tests, and migration context together.

## Entity types

The schema currently accepts nine entity types.

| Directory | Type | ID form | Responsibility |
| --- | --- | --- | --- |
| `contracts/` | `contract` | `C-<DOMAIN>-NNNN` | Normative, cross-cutting protocol rules and acceptance criteria. |
| `prototypes/` | `prototype` | `P-<IDENTITY>` | Stable identities and behavioral protocols for official prototypes or prototype parts. |
| `modules/` | `module` | `M-<DOMAIN>-NNNN` | Semantic module identities and the contracts they satisfy. |
| `adapters/` | `adapter` | `A-<PROFILE>-NNNN` | Official Adapter profile identities, target runtimes, Module support or omission, and provided host capabilities. |
| `decisions/` | `decision` | `D-<DOMAIN>-NNNN` | Stabilized design and governance choices, including rejected alternatives when relevant. |
| `host-caps/` | `host-cap` | `HC-<DOMAIN>-NNNN` | Capabilities expected from or projected to a host environment. |
| `tests/` | `test` | `T-<DOMAIN>-NNNN` | Conformance cases and mappings to executable fixtures or tests. |
| `versions/` | `version` | `V-<DOMAIN>-NNNN` | Release identity, channel, tag, package policy, and immutable publication evidence. |
| `knowledge/` | `knowledge` | `K-<DOMAIN>-NNNN` | Shared conceptual vocabulary and explanatory models used by other entities. |

Compiler is not a schema entity type at present. Adapter is now a first-class identity governed by `D-ADAPTER-PROFILE-0001`; do not use it as a substitute for behavioral contracts or infer a complete support matrix from an intentionally partial profile slice.

## Lifecycle and versions

Every entity declares `since` and one of these statuses:

- `draft`: cataloged work in progress. It is the current formal direction, not a stable public guarantee.
- `active`: an applicable current guarantee. Ordinary entities record the version at which that guarantee was admitted in `activeSince`; legacy active entities without activation provenance remain auditable rather than being backfilled automatically.
- `deprecated`: retained for compatibility or migration and accompanied by `deprecatedSince`.
- `removed`: historical after `removedSince`.

`since` records catalog/version-history introduction. It does not mean that a draft entity was already a stable guarantee. `activeSince` is the distinct activation boundary for ordinary active entities; it must not precede `since`. A snapshot query for identity availability uses `since`/`removedSince`, while a query for stable applicability additionally requires `status: active` and a reached `activeSince`. `replacedBy` points to a replacement of the same entity type. `revisions` records semantic changes against project versions. Relations may also have `since` and `until` bounds.

A package publication or dependency edge is evidence for lifecycle review, not automatic activation. Promotion remains an explicit semantic admission with applicable criteria, relations, and executable evidence.

## Core fields

Common fields include:

- `id`, `type`, `title`, `status`, and `since` for identity and lifecycle;
- `summary` and bilingual `statement` for the rule or model;
- `criteria` for individually addressable acceptance points;
- `openQuestions` for explicit unresolved gaps;
- `sources` for traceable implementation or document references;
- `revisions` for versioned semantic changes;
- `tags` for discovery.

Prototype entities may additionally define `anatomy` and `inherits.prototypes`. Adapter entities must define `adapterProfile` package and target metadata. Test entities may define `cases` and `implementations`. Version entities must define `release` metadata.

Adapter capability decisions are graph relations rather than duplicated inventory fields:

- `supports.modules` records reviewed positive support and requires a required, recommended, optional, or partial Module role;
- `omits.modules` records reviewed unsupported, not-applicable, or deferred Module decisions;
- `provides.hostCaps` records a faithfully provided capability and whether its realization is native, translated, or emulated;
- a Module absent from both `supports` and `omits` is uncataloged, not implicitly supported or unsupported.

Do not treat `summary`, tags, or filenames as substitutes for criteria and relations. A useful entity is an identity anchor in a graph, not merely a titled placeholder.

## Relations

The schema supports these relation groups:

- `relates`: non-owning association.
- `dependsOn`: semantic dependency.
- `inherits`: prototype inheritance only.
- `references`: supporting reference without dependency ownership.
- `refines`: a more specific expression of another entity.
- `satisfies`: an identity or implementation scope claims conformance to contracts.
- `verifies`: a test verifies entity criteria or anchors.
- `explains`: knowledge or decisions explain another entity.
- `exercises`: coverage reaches a surface without necessarily verifying its full semantics.
- `requires`: a capability or semantic prerequisite.
- `owns`: explicit semantic ownership.
- `supports`: positive Adapter-to-Module support, with an explicit support role.
- `provides`: Adapter-to-host-capability provision, with an explicit realization role.
- `omits`: reviewed Adapter-to-Module refusal, non-applicability, or deferral.

Relations are typed by target collection (`contracts`, `prototypes`, `modules`, `adapters`, `decisions`, `hostCaps`, `tests`, or `knowledge`). The loader validates that targets exist and have the declared type. Criteria-level references may use `anchors` to point to exact criterion IDs.

Prefer a precise directional relation over repeating the same fact in prose. When a relationship is time-bound, declare its version range rather than deleting historical context.

## Source-of-truth migration

The former primary contract layer lives under `internal/contracts/**`. Migration is progressive:

1. When a subject has an applicable spec entity, that entity is authoritative.
2. Legacy contract prose remains valuable for rationale, examples, timelines, and detailed explanation.
3. When no entity catalogs a subject yet, a legacy contract may be used as a transitional fallback after checking implementation, tests, and recent records.
4. A legacy document must not silently override an entity. Resolve drift by updating the projection, changing the entity through normal review, or explicitly recording an unresolved gap.
5. Stable conclusions from `internal/records/**` should be promoted into the appropriate entities; records themselves remain non-normative.

The migration is complete only when the relevant behavior, identity, relations, and executable coverage can be traced through the catalog. File counts alone are not a completion criterion.

## Authoring workflow

For the reusable vertical-slice method that connects Module ownership, host capabilities, Adapter profiles, conformance evidence, and drift handling, read [`MODULE-HOST-CAP-ADAPTER-CATALOGING.zh-CN.md`](./MODULE-HOST-CAP-ADAPTER-CATALOGING.zh-CN.md).

Before adding or changing an entity:

1. Search existing IDs, criteria, aliases, tags, and relations for the concept.
2. Read the corresponding implementation, executable tests, legacy contracts, and recent records.
3. Decide whether the change belongs in an existing entity, a new entity, a schema decision, or a non-normative record.
4. Model one coherent semantic slice. Do not batch-create empty module or host-cap identities from package/token inventories.
5. Add criteria and relations precise enough to trace expected behavior.
6. For normative behavior, add or update a `T-*` mapping and executable implementation path.
7. Add an appropriate revision when changing semantics already available in a version.
8. Regenerate projections and run validation.

For Adapter profiles, catalog one reviewed Module slice at a time. Add positive `supports`, explicit negative `omits`, provided host capabilities, profile criteria, and executable Adapter evidence together; do not prefill the remaining matrix from package dependencies alone.

Use localized text objects when both Chinese and English expressions carry project meaning. Preserve canonical API names and entity IDs in English/code form.

## Validation and projections

The schema is defined in `packages/spec/schema/src/index.ts`. Directory loading and workspace relation validation live in `packages/spec/engine/src/node.ts`.

Useful commands:

```sh
corepack pnpm@10.32.1 workspace:dev
corepack pnpm@10.32.1 workspace:generate
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 spec:docs:agent
corepack pnpm@10.32.1 check:agent-doc
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 test
```

Important projections include:

- `apps/workspace/public/spec-workspace.json`, generated for the internal workspace UI;
- release snapshots under `artifacts/spec-releases/` when created by the release workflow;
- `internal/agent/PROJECT-UNDERSTANDING.zh-CN.md`, generated locally for Agent orientation and intentionally ignored by Git.

Generated views are disposable projections. Change the entities or the generator, then regenerate; do not hand-edit or commit a local generated view. `workspace:dev` generates the workspace dataset before startup, watches `spec/**/*.yaml`, and refreshes the UI after later entity changes. Use `workspace:generate` when only the local JSON projection is needed.
