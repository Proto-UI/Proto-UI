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

`since` records catalog/version-history introduction. It does not mean that a draft entity was already a stable guarantee. `activeSince` is the distinct activation boundary for ordinary lifecycle-complete entities; it must not precede `since`. A snapshot query for identity availability uses `since`/`removedSince`, while a query for stable applicability additionally requires the activation boundary and lifecycle status. `replacedBy` points to a replacement of the same entity type. `revisions` records semantic changes against project versions. Relations may also have `since` and `until` bounds.

An ordinary entity's `removed` status is terminal; authoring cannot return that identity to draft, active or deprecated status.

Once `activeSince` is recorded, lifecycle changes must retain that activation history. Missing legacy provenance may remain unknown; clearing a known activation boundary is not a legacy migration.

Retain cataloged ordinary identities for historical queries. Retiring one requires its `removed` lifecycle and history rather than deleting its file or replacing its ID. Moving a file while preserving the same entity ID does not create a new lifecycle.

A package publication or dependency edge is evidence for lifecycle review, not automatic activation. Promotion remains an explicit semantic admission with applicable criteria, relations, and executable evidence.

Release evidence, the current workspace snapshot, and generated views are distinct artifacts. A workspace snapshot recalculated after a release can differ from the immutable snapshot digest recorded by the corresponding `V-*` entity.

### Ordinary-entity admission

Every new ordinary entity must explain its initial `draft` or `active` status in `lifecycleRationale`. Changing an existing entity's lifecycle status or version boundaries requires updating that rationale's content and preserving its preceding revision history; reordering language keys is not a rationale update. The field accepts localized text like `statement`; identify the unresolved semantics, missing evidence, or reviewed admission that justifies the status. A generic creation default is insufficient. New active authoring requires a supported `activeSince`. Transitioning an existing ordinary entity from non-active to `active` additionally requires explicit semantic admission and an appended revision at `activeSince` with a non-empty summary explaining the admission. Maintaining an already-active legacy entity does not require inventing missing activation provenance.

All promotions share four gates: reviewable statement, criteria, ownership and relations; no unresolved activation blocker; reconciled implementation and public-projection drift; and explicit bounds for remaining omissions. Apply the relevant additional evidence below.

| Type | Minimum admission evidence |
| --- | --- |
| Contract | Applicable criteria mapped to `T-*` cases and executable evidence, including negative boundaries and compatibility. |
| Prototype | Governed identity and anatomy, applicable Contract/Test evidence, real consumer and public export/docs alignment. |
| Module | Defined ownership and lifetime, satisfied Contract criteria, implementation tests and applicable Adapter integration. |
| Host Capability | Bounded host responsibility, lease and failure behavior, provider evidence and honest host/profile limits. |
| Adapter | Exact target/profile scope, reviewed Module support and omissions, provided capabilities and conformance evidence. |
| Test | Addressable cases, accurate criterion mappings, real implementation paths and reviewed results for required coverage. A catalog `passing` value is not a fresh test run. |
| Decision | Settled choice, authority, alternatives and scope, with affected entities consistent with the decision. |
| Knowledge | Supported explanatory model, clear limits and consistent dependent usage; do not invent runtime tests for explanatory text. |

A passing implementation must declare a path before it can cover cases or criteria in a lifecycle report. The shared Node loader verifies that passing paths resolve to repository files; the catalog-integrity CI check also requires Git tracking. Implementation-level `exercises` contributes candidate evidence and required-implementation diagnostics, but does not become a `verifies` claim for normative criteria.

Each admitted Test case must map to existing criteria on its applicable verified or exercised targets, including targets exercised by its consuming implementation. A case mapping on an exercised target does not create a `verifies` claim.

The authoring command checks applicable non-draft Test mappings as a workspace invariant whenever catalog inputs or `VERSION` change. A future deprecation or removal does not waive this check before its boundary; unknown legacy activation provenance also does not waive mapping integrity or become a proven activation date. Tests at a known deprecation boundary, removed from the selected version, or known draft are excluded. This includes Test edits and changes to their external targets, without requiring legacy activation history or lifecycle rationale to be backfilled.

Prototype readiness traces an available Contract through applicable `dependsOn.contracts`, criterion dependencies, or `satisfies.contracts`, including those reached through semantic Prototype dependencies or `inherits.prototypes`. Supporting references and unrelated graph paths do not supply this evidence.

Host Capability readiness also requires an available Adapter with an applicable `provides.hostCaps` declaration; generic Test evidence alone does not establish a provider or host/profile scope.

Module readiness requires an explicit `owns` relation to an available target of the declared relation type, applicable `satisfies.contracts`, and incoming Adapter `supports.modules`. These declarations provide traceability for semantic review; they do not establish execution success or imply full Adapter conformance beyond the declared support bounds.

Adapter readiness requires at least one applicable `supports.modules` or `omits.modules` declaration naming an available Module, and an applicable `provides.hostCaps` declaration naming an available Host Capability at the admission version. Future or expired declarations do not establish the Adapter's current reviewed scope. These minimum declarations do not replace the full capability and conformance obligations of its official profile.

Base-aware authoring uses the current release train from the repository's `VERSION`. It rejects a newly recorded or replaced `activeSince` earlier than that train, and rejects replacing an already recorded historical boundary even with a current or future value. Current-catalog contents, including newly authored Test mappings or undated implementation records, cannot establish or revise historical activation. Historical backfill requires independent audit of original admission and executable evidence through a separately reviewed provenance mechanism; this slice introduces no such mechanism. Unknown legacy provenance and unchanged recorded history remain intact.

For admission through this current-catalog path, the entity must have no reported readiness gaps at `activeSince`; Test entities and relations outside that version cannot supply evidence. Prototype readiness includes recorded anatomy. This mechanical evidence check does not replace independent semantic approval. Lifecycle maintenance that leaves activation provenance unchanged retains the legacy audit boundary.

Entity authoring and first inclusion of a governed surface in a release train both trigger lifecycle review. Release preparation records a disposition per reviewed semantic slice: `promote`, `remain-draft` with a named blocker, or `not-applicable` with a reason. `promote` proposes admission for review; it neither changes status nor grants permission to activate an entity.

### Activation blockers and legacy migration

Use the existing `openQuestions[].blocks` list for explicit targets:

- `activation:<ENTITY_ID>` blocks stable admission of that ordinary entity.
- `criterion:<ENTITY_ID>#<CRITERION_ID>` identifies an exact criterion whose evidence or semantics remain open.
- `implementation:<TEST_ID>#<IMPLEMENTATION_ID>` identifies a mapped executable implementation that remains incomplete.

Targets must exist. Criterion and implementation targets do not implicitly activate or block every related entity; add the exact `activation:` targets when the unresolved question weakens an admission. A bounded follow-up may identify only its criterion or implementation target. Existing free-form values remain readable and are reported as unclassified. Neither those values nor an empty list proves that an entity is ready; reviewers must classify their effect on the intended guarantee.

Base-aware authoring rejects new or edited unclassified blocker values, even when lifecycle fields are unchanged. Only the same raw value on the same entity and question identity retains the legacy exception; new questions or identities cannot inherit it. Removing a legacy value or replacing it with a canonical target is allowed.

Unchanged legacy entities may lack `lifecycleRationale`. Once recorded, the rationale may be clarified but cannot be removed, including when lifecycle fields are unchanged. Report the legacy gap and audit it when that slice is reviewed rather than rewriting the entire catalog. Legacy ordinary `active`, `deprecated`, and `removed` entities without durable activation provenance also remain valid catalog entries, but historical stable-applicability queries cannot infer an activation version for them. While available, they retain an `activationProvenanceMissing` diagnostic even when a known deprecation boundary already makes `stableAtVersion` false. Audit original admission records and commits before adding `activeSince`; never substitute `since` or package publication. Tightening the transitional schema to require activation history across the whole catalog requires a separate reviewed migration decision.

Audit existing entities incrementally: Module/Contract/Test chains consumed by active Adapter profiles, released core contracts, released Prototype families, Host Capabilities, Decisions/Knowledge, then deliberately experimental slices. Keep ready admission, missing executable evidence, blocking questions, metadata gaps, implementation drift and intentional experimental scope distinct in each result.

### Release readiness reports

`pnpm release:lifecycle` reports all ordinary entities available in the selected release-version snapshot of the current catalog. This is a conservative review inventory, not a claim that every entity has shipped or belongs to a published stable guarantee. It reports recorded evidence, missing rationale, declared blockers, unclassified legacy values, activation-provenance gaps and dispositions from `internal/releases/<version>/lifecycle-dispositions.json`. Reviewers record explicit entity sets, rationale and evidence for each slice; drafts without a disposition remain in `unreviewedEntities`.

Duplicate slice IDs or duplicate entity membership withhold the affected dispositions from reviewed counts and entity projections. The authored entries remain in report diagnostics so scoped checks can explain the conflict.

`pnpm release:lifecycle -- --check --entities C-A11Y-PART-RELATIONSHIP-0001,T-A11Y-PART-RELATIONSHIP-0001` requires a disposition for every draft in that named scope. Omitting `--entities` checks all drafts in the full report inventory and fails on missing dispositions. Non-draft metadata and activation-provenance gaps remain visible for audit without making their dispositions mandatory. A passing scoped check does not mean the remaining catalog has been reviewed. Report generation never performs promotion, validates publication, or replaces the `V-*` evidence workflow. See [`release-workflow.md`](../internal/governance/release-workflow.md) for the preparation trigger.

Draft disposition requirements use the selected report version. An available ordinary entity is a known draft when its current status is `draft` or the selected version precedes its recorded `activeSince`; `draftAtVersion` records that distinction while `status` retains the current catalog value. Missing activation provenance does not imply a historical draft. The workspace withholds lifecycle results when the catalog is invalid, independently of per-version disposition-plan validity.

A scoped check retains global structural errors and errors in any disposition slice used by the selected entities; errors in unrelated slices remain outside that scope. Authoring discovers the current catalog through the same loader as reports, so a file-type change or symbolic link cannot stand in for a retained catalog identity.

The report's `dispositionSlices` retains all authored entries for the matching version, including conflicting memberships, for complete scoped diagnostics. A row's `disposition` remains the unique applicable result; conflicted rows are not counted as reviewed.

## Core fields

Common fields include:

- `id`, `type`, `title`, `status`, `since`, and (for ordinary lifecycle history) `activeSince` for identity and lifecycle;
- `lifecycleRationale` for the reason a new or lifecycle-changed ordinary entity has its status;
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
7. Add an appropriate revision when changing semantics already available in a version. For a new ordinary entity or changed lifecycle, record `lifecycleRationale` and run `pnpm check:spec-authoring -- --base <base-sha>` against the reviewed base; classify activation blockers explicitly.
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
