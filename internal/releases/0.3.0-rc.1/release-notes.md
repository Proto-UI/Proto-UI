# Proto UI 0.3.0-rc.1

> Draft release notes. This candidate has not been published. These preparation assets do not establish an installable RC, a passing final rehearsal or release acceptance.

Proto UI `0.3.0-rc.1` is a preparation draft for the intended first numbered candidate. The effective 0.3 scope is retained, but the audit has not established eligibility for the RC stage. All 47 public `@proto.ui/*` packages share this exact proposed version. Its intended npm channel is `next` and its intended Git tag is `v0.3.0-rc.1`.

## Candidate scope

- Base, Shadcn, Brutalist and Lucide, together with the supported website, CLI and retained Web-host prerequisites, remain the committed 0.3 surface. The candidate includes the current package source and the reviewed corrections already merged into the preparation base; the final integrated source still needs its own evidence.
- The RC stage permits final verification, interaction and accessibility repairs, compatibility fixes, packaging and documentation corrections. Its entry condition is still unmet while committed capabilities require new semantics or interfaces; the existing stage decision governs their resolution before publication.
- Bootstrap, Liquid Glass and the Compiler/consumer criteria explicitly deferred by the effective 0.3 plan remain 0.4 work. Their source and historical evidence are retained without expanding the RC's admission claims.
- `@proto.ui/compiler`, GPUI peer/native targets and repository-only tools remain outside the public npm package set. Packaging shared infrastructure does not establish native or compiler acceptance.

## Package and version boundary

The [BOM](package-bom.json) lists all 47 public packages, their exact version, release role and publish order. The four 0.3-line module identities are `@proto.ui/module-axis-input`, `@proto.ui/module-control-label`, `@proto.ui/module-native-link` and `@proto.ui/module-table-structure`.

Consumers must keep public Proto UI packages on the same complete version. Package-local install examples describe the candidate only for use after publication; the published trial pages and ordinary Quick Start remain on their existing verified paths. `@next` is a convenience channel, not an exact test identity.

The draft `0.3.0-alpha.2` and stable `0.3.0` preparation assets remain separate records. `V-PROTO-UI-0012` remains the stable `0.3.0` draft, and `V-PROTO-UI-0013` retains the draft `0.4.0` scope. This RC is governed independently by draft `V-PROTO-UI-0014`; it does not move `latest` or activate either stable train.

## Lifecycle review

The RC lifecycle inventory contains 1,322 ordinary entities available at `0.3.0-rc.1`, including 1,262 drafts. The [dispositions](lifecycle-dispositions.json) carry forward the existing reviewed family, deferred-family and shared slices for those available entities. All 1,262 drafts retain `remain-draft`; the 15 historical Compiler contracts/tests retain their separate `not-applicable` disposition. No ordinary entity is promoted by this preparation.

Four records introduced at stable `0.3.0` are outside this prerelease's version-filtered inventory and are not backdated: `P-BRUTALIST-DRAWER-FOOTER`, `P-BRUTALIST-DRAWER-HEADER`, `T-BRUTALIST-DRAWER-STRUCTURE-0001` and `T-TOAST-STACK-0001`. Sixty non-draft entities still lack recorded activation provenance, and 113 legacy block targets remain unclassified. Disposition coverage is not independent admission or execution evidence.

## Known blockers and evidence still required

- Dropdown criteria `issue.1100.005` and `issue.1161.002` require submenu and checkbox/radio groups. The effective [0.3 placement](https://github.com/Proto-UI/Proto-UI/issues/1161#issuecomment-6700043691) and [superseding scope decision](https://github.com/Proto-UI/Proto-UI/issues/1100#issuecomment-6700065987) retain this requirement.
- At integrated source `1cff2e7e73e8b5c3c9c767d4399d521d2605049c`, `P-BASE-DROPDOWN-MENU` excludes those variants and the exported Base implementation has only ordinary menu items. This capability gap blocks the RC stage; preparation neither defers it nor declares the scope complete.
- The same source audit found retained gaps in Autocomplete grouping (`issue.1095.001`), Combobox multiple selection with chips and its accessibility group (`issue.1095.002`), and Command grouping with controlled active state (`issue.1095.003`). Existing ordinary components remain implemented; these additional semantics and interfaces are missing.
- Menubar and ContextMenu retain submenu and checkbox/radio recipe requirements (`issue.1095.006` and `issue.1095.008`). Their current exports lack those parts. The [effective scope decision for #1095](https://github.com/Proto-UI/Proto-UI/issues/1095#issuecomment-6700063976) supersedes its earlier whole-issue 0.4 deferral.
- Across these six groups, seven original criteria remain unresolved under their existing 0.3 placement.
- The 2026-11-28 public registry check found all 47 package identities, with 43 ready and four blocked by the existing bootstrap policy. Each new module above has both `0.0.0-stage` and a deprecated `0.0.0-bootstrap.0`, with `latest` on bootstrap and no `next`.
- The bootstrap is therefore not the sole version. Registry prerequisites remain subject to the existing gate and separate authorized repair. Private Trusted Publisher authorization requires independent verification.
- The integration owner must combine the current CI repairs and rerun the complete release rehearsal, strict package budgets, applicable generated-input checks and retained 0.3 acceptance gates on the final source. These focused checks do not establish those results. Original failures and skipped or unexecuted work remain evidence debt until resolved.
- Package publication, Git tag creation, the GitHub prerelease, immutable snapshot/checksum verification and subsequent V-entity activation have not occurred as part of this preparation.

The [preparation record](../../records/2026-11-28-0.3.0-rc.1-release-prep.zh-CN.md) records the base, exact commands, observed results and remaining owners. Protected publication must run from the reviewed `main` candidate with the complete workspace package set and the `next` channel.
