# 0.3 alpha registry and BOM reconciliation · 2026-11-17 / 2026-11-18

This bounded evidence correction addresses F1/F3 in the retained BOM/release-notes audit (SHA-256 `3cc53523a8f423cfe78ef80196fa8bc856a65c5de9753de9def24f0f64b9f157`). It reconciles the already published `0.3.0-alpha.0` and `0.3.0-alpha.1` release notes with the registry and release facts that are now observable, and it records what remains missing for the `0.3.0-alpha.2` candidate. No publication, activation, tag, registry change, dist-tag move or release acceptance was performed, and no release candidate was frozen.

Source is bound to commit `0f0955a9d624e0ef5e250f56a0eaa0fc52bbfb53`, which was the `main` tip read by this reconciliation; it does not use the retained audit checkout's topic-branch HEAD as main. `main` has advanced since that read, so every state-dependent statement below is scoped to that commit or to its named observation time, and the integrator must re-read the final integrated `main` before landing these notes.

## Registry observations · 2026-11-17

Nine read-only HTTPS GETs were made from `2026-11-17T15:21:07.216Z` through `2026-11-17T15:21:10.002Z`: six exact-version requests and three package metadata requests. All returned HTTP 200. Exact-version URLs follow `https://registry.npmjs.org/@proto.ui%2f<name>/<version>`; package metadata URLs omit `/<version>`. Names are adapter-vue2, module-expose-event and module-image-view; versions are `0.3.0-alpha.0` and `0.3.0-alpha.1`. All six returned the requested name/version and a `dist.integrity` value. None provided `gitHead`; no release commit is inferred.

| Package | npm time for alpha.0 | npm time for alpha.1 | observed latest | observed next |
| --- | --- | --- | --- | --- |
| @proto.ui/adapter-vue2 | 2026-09-07T13:11:27.387Z | 2026-09-20T10:29:22.272Z | 0.0.0-bootstrap.0 | 0.3.0-alpha.1 |
| @proto.ui/module-expose-event | 2026-09-07T13:07:40.578Z | 2026-09-20T10:26:02.038Z | 0.0.0-bootstrap.0 | 0.3.0-alpha.1 |
| @proto.ui/module-image-view | 2026-09-07T13:08:19.884Z | 2026-09-20T10:27:16.389Z | 0.0.0-bootstrap.0 | 0.3.0-alpha.1 |

These timestamps are registry-provided package-version times, not release.publishedAt. Dist-tags and package metadata are observations at request time. The six version identities and their reported tarball integrities do not establish a global immutable release snapshot; tarballs were not downloaded or independently rehashed.

The same private packet holds four wider read-only sweeps, all observed on 2026-11-17:

| Packet | Requests | Observation window | Result |
| --- | --- | --- | --- |
| `registry-bom-sweep-alpha0.json` | 43 exact-version requests at `0.3.0-alpha.0` | 15:31:17Z – 15:31:44Z | 43 × HTTP 200, each with a `dist.integrity` |
| `registry-bom-sweep-alpha1.json` | 47 exact-version requests at `0.3.0-alpha.1` | 15:31:44Z – 15:32:10Z | 43 × HTTP 200 for the published identity set, 4 × HTTP 404 for the four later identities |
| `registry-disttag-sweep-alpha1.json` | 43 package-metadata requests | 15:39:42Z – 15:40:16Z | `next` = `0.3.0-alpha.1` for all 43; `latest` = `0.2.0` for 40 and `0.0.0-bootstrap.0` for adapter-vue2, module-expose-event and module-image-view; no `gitHead` key |
| `registry-publication-window-alpha0.json` / `-alpha1.json` | 43 package-metadata requests each | 16:10:59Z – 16:11:41Z | per-version npm publish times, `packumentModified`, and the same dist-tag values |

The earliest npm publication time for `0.3.0-alpha.0` is `2026-09-07T13:06:11.110Z` (`@proto.ui/core`) and the latest is `2026-09-07T13:13:21.196Z` (`@proto.ui/prototypes-brutalist`); for `0.3.0-alpha.1` they are `2026-09-20T10:24:41.722Z` (`@proto.ui/core`) and `2026-09-20T10:31:33.390Z` (`@proto.ui/module-test-sys`). The npm `latest` residue is not uniform across the ecosystem, so the release notes name the package each statement is about instead of describing the whole set.

## Registry and release observations · 2026-11-18 addendum

Two bounded read-only registry probes, one read-only GitHub fact readback and one read-only GitHub compare-API ancestry readback were added on 2026-11-18. They close the specific gaps that the 2026-11-17 packet left open.

- `r2/registry-alpha2-exact-version-sweep.json`: 47 exact-version requests, one for every package named by the candidate `0.3.0-alpha.2` BOM, observed 2026-11-18T06:16:32Z – 06:17:32Z. All 47 returned HTTP 404. No package of this candidate resolves at `0.3.0-alpha.2`, so the candidate is not published, and the CLI producer `@proto.ui/cli@0.3.0-alpha.2` is a candidate identity only, not a published one.
- `r2/registry-new-identity-packument-probe.json`: 4 package-metadata requests for the identities that the published `0.3.0-alpha.1` BOM does not contain, observed 2026-11-18T06:17:39Z – 06:17:44Z. All four returned HTTP 404 `Not found`. `@proto.ui/module-axis-input`, `@proto.ui/module-control-label`, `@proto.ui/module-native-link` and `@proto.ui/module-table-structure` have no npm package identity at all, not merely a missing `0.3.0-alpha.1` version.
- `r2/evidence/github-release-fact-readback-2026-11-18.json`: read-only GitHub REST reads observed 2026-11-18T06:17:58Z – 06:18:34Z. Release workflow run `34125326136` (`Release Packages`, `workflow_dispatch`, head `f0a9c95e988ee882a5815e319a8211e69924b968`) completed `success`, and tag `v0.3.0-alpha.0` resolves to that same commit. Release workflow run `35504873221` (head `e7961001af1d313b1518be694f866b0e98337b0d`) completed `success`, and tag `v0.3.0-alpha.1` resolves to that same commit. The `v0.3.0-alpha.0` GitHub Release is a published prerelease created 2026-09-07T12:11:15Z and published 2026-09-07T13:11:41Z; the `v0.3.0-alpha.1` GitHub Release is a published prerelease created 2026-09-20T10:01:27Z and published 2026-09-20T10:28:40Z. Both releases carry the reviewed BOM, localized note, spec snapshot and checksum assets, and each asset digest equals the SHA-256 of the retained local copy of that asset. Tag `v0.3.0-alpha.2` and the `v0.3.0-alpha.2` GitHub Release do not exist.
- `r2/evidence/git-ancestry-facts-2026-11-18.json`: read-only GitHub compare reads. The Tooltip composition and horizontal Drawer consumer repair `155d6d206`, the browser-shard balance merge `7780dba23` (#1482) and the projection portal seal merge `1954cd3566` (#1480) are contained in the bound source commit, and the head of pull request #1490 is not. The local clone is shallow and blob-filtered, so the compare API, not a local ancestry check, is the authority for these statements.

The private review packet's `registry-receipts.json` retains each exact URL, request/completion time, HTTP status, headers, raw response path, native response SHA-256, byte count, integrity and absent gitHead. Its `registry/` directory retains all nine response bodies. The 2026-11-18 receipts retain the same fields without response headers. The header set of the 2026-11-17 receipts includes provider cookies; those values stay in the private packet and are not reproduced here or in any repository artifact.

## Historical reconciliation

The 2026-09-14 preparation record reported next at alpha.0 for these three packages. Today's registry metadata reports alpha.0 publication on September 7 and alpha.1 publication on September 20. This is consistent with alpha.0 existing on September 14; it does not independently reconstruct the September dist-tag value. The historical observation is preserved unchanged. No retained raw September registry response was supplied by that record, so the exact historical tag transition remains unverified.

The alpha.0/alpha.1 note banners saying the version was wholly unpublished are too broad in light of the exact npm versions now observed. The corrected bilingual notes state the completed publication, the bounded registry evidence and the observation dates. They do not activate V-PROTO-UI-0009 or V-PROTO-UI-0010, claim that every historical BOM package exists, or invent a successful protected workflow, Git tag, GitHub Release or snapshot digest. The old preparation actions remain historical descriptions.

The published release assets themselves are immutable and were not modified by this reconciliation. The retained copies of `release-notes-0.3.0-alpha.0.zh-CN.md` and `release-notes-0.3.0-alpha.1.zh-CN.md` still carry their original pre-publication wording; only the repository notes change. The release workflow's separate step for replacing a published release body with the merged English note remains an action for the integrator, after review and after the evidence change merges.

## BOM identity discrepancies

Two repository artifacts still describe a `0.3.0-alpha.1` identity that the published release and the registry do not have. They are recorded here rather than rewritten, because the correct disposition of a historical release directory is a governance decision, not a side effect of an evidence correction.

- `internal/releases/0.3.0-alpha.1/package-bom.json` names 47 packages, all at `0.3.0-alpha.1`, including the four identities that the registry does not have. The published asset `package-bom-0.3.0-alpha.1.json` names 43, and the registry holds exactly those 43 at `0.3.0-alpha.1`. The repository file was created for the alpha.1 preparation on 2026-09-20 and was amended afterwards, on 2026-09-22, 2026-10-02, 2026-10-14 and 2026-10-29, so it is a current-tree snapshot rather than the published BOM.
- `spec/versions/V-PROTO-UI-0010.yaml` states a 47-package `0.3.0-alpha.1` identity. The entity is still `draft` and its own draft-boundary criterion forbids it from claiming npm publication, a Git tag, a GitHub prerelease, next-channel activation or snapshot evidence, so the statement stays inside the draft boundary until the entity is activated.

The `0.3.0-alpha.2` candidate BOM is not affected: it names 47 packages, all at `0.3.0-alpha.2`, and every one of them matches a current public package manifest in the bound source tree.

## Alpha.2 scope and acceptance

Both current-tree alpha.1/alpha.2 BOMs contain 47 identical package names, with no added/removed identity and globally changed exact versions. This is a repository artifact comparison; it is not a comparison of verified published package sets. The bilingual alpha.2 notes add only the Control Label scope supported by their existing text and the November 15 preparation record, plus known issues grounded in the current-tree November 16 blocker record and its later reconciliation. The original 43-package September plan is not silently relabeled as a 47-package historical publication.

Later bounded 18/18 recipe and 24/24 unfrozen consumer evidence is retained with its limits. Open full host/visual/native and final-regression conditions remain visible. Alpha.2 remains unpublished: no package resolves at `0.3.0-alpha.2`, no `v0.3.0-alpha.2` tag or GitHub Release exists, and V-PROTO-UI-0011 remains draft. No claim is made that all latest-main repairs have already completed release acceptance.

The exact missing same-candidate gate remains: freeze one main SHA; bind the reviewed complete BOM, staged tarball integrities and spec inputs; run the existing release rehearsal and real installation/package/CLI consumers, all four supported Web hosts, admitted Prototype coverage, docs and relevant native interactions on that SHA; retain per-host/per-Prototype outcomes, failed/skipped/not-run cases and complete regression receipts. Sample-level consumer coverage and the unfrozen 24/24 result do not meet this gate. Any change requires rebuilding/rebinding and renewed affected acceptance. Reconcile spec dispositions and every retained blocker before the publication decision.

## Release-workflow checklist status

Against `internal/governance/release-workflow.md` sections 7.3 and 7.4, the `0.3.0-alpha.0` and `0.3.0-alpha.1` releases now have recorded evidence for the successful workflow URL, its head SHA and run times; the exact npm version of every package named by the published BOM, not only the CLI; the intended dist-tag resolving to that exact version for every one of them; the `v<version>` tag resolving to the same 40-character workflow head SHA; the GitHub Release prerelease state and its reviewed BOM, localized notes, spec snapshot and checksum assets; and the snapshot digest matching its published checksum file. The V entity does not yet record `publishedAt`, the tagged commit or `specSnapshotDigest`, so the entities remain draft and no activation is claimed.

## Residual risk and next parent check

F2 is a control-strength risk only: the publisher recomputes selection, while the release-dispatch/rehearsal asset check and manual complete-BOM registry audit provide the recorded binding. No publisher, CI, BOM generator, test or verification asset was changed here.

The parent must independently review the six-note diff and response/source hashes, archive the private receipts durably, and re-read the final integrated main and any newer blocker/repair receipts before landing these proposed notes. On the eventual frozen candidate run `pnpm release:assets:check` and the governed rehearsal/consumer acceptance; preserve actual failures. No audit, CI, tests, builds, formatters or release commands were rerun for this packet. Complete release-activation evidence still requires every BOM package and intended dist-tag, successful protected-workflow URL/head/time, release-tag commit, GitHub Release assets and immutable snapshot checksum under release-workflow sections 7.3–7.4.
