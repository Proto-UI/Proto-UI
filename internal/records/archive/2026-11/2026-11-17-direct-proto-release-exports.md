# Preserve directly authored exports through release staging

## Original consumer failure

This repair follows [PR #1479's direct source export finding](https://github.com/Proto-UI/Proto-UI/pull/1479#discussion_r4586811133), reproduced on the exact PR #1490 base `385d7c706c9e4c35280878efbb6e42d63d7df786`. It changes release manifest projection, not compiler admission or publication authority.

Both `protoSourceTargets` and the compiler's `sourceExport` already recognize a direct `.proto.ts` string as an authored entry. The release source collector retains that entry and its relative source/type closure. However, `rewriteExports` protected only entries beneath a `proto` condition. A direct `./src/behavior.proto.ts` became `./dist/behavior.proto.js`, although staging copied the authored TypeScript and did not produce that JavaScript target.

The real `stagePackage` reproduced this mismatch for both a root-string export and a direct `./behavior` subpath. In both cases the original source and helper were present in staging, while the rewritten export target was absent. The existing export validation correctly failed with `missing ./dist/behavior.proto.js`; it is retained.

The inspected workspace's authored export is the Base Transition `proto` condition. No existing workspace manifest is claimed to have the direct-string failure. The affected direct form is an admitted external package shape, exercised with real package directories and consumer installation. No package manifests are bulk rewritten.

## Owning-layer repair

`rewriteExports` now preserves strings ending in `.proto.ts`, using the same direct-source discriminator as the existing source collector. Its existing explicit `proto` condition remains intact. The rest of the release implementation is byte-identical: ordinary `.ts` runtime targets still become `.js`, type targets become `.d.ts`, and arrays, nested conditions, null entries, dependency version rewriting, staging validation and publication controls retain their existing behavior.

Three focused regression cases were added to `proto-source-package.test.mjs`: real staging for root and subpath source exports, and a mixed nested/array manifest that retains authored leaves alongside ordinary runtime and type conversions. All five pre-existing source-package cases and their fixture remain unchanged.

## Executed evidence

The [machine receipt](evidence/2026-11-17-direct-proto-release-exports.json) retains the source hashes, command results, original failures, package metadata, installed-file hashes and compiler source-resolution observations. The implementation was tested as an uncommitted delta on the exact base above; a base SHA alone is not the candidate identity.

| Check | Actual result |
| --- | --- |
| Original real staging probe, root and subpath | 0 passed / 2 failed; staged source existed, rewritten JavaScript did not |
| Three new regression cases before repair | 0 passed / 3 failed for the intended export mismatch |
| Same three cases after the one-line repair | 3 passed / 0 failed |
| Complete `proto-source-package.test.mjs` and `publish-manifest.test.mjs` | 12 passed / 0 failed / 0 skipped |
| Direct root and subpath offline tarball installation and source resolution | Both passed |
| Ordinary runtime root import of the package with a direct source subpath | Passed under Node ESM |

The three new cases are included in the final twelve, not an additional unique test total. The full related run retains the real Transition source/machine/types closure, explicit `proto` packaging, erased types, runtime-only publication, workspace version conversion, notices, and missing/escaping/ambiguous/symlink source rejection controls.

The coordinated verification used Node `v24.22.1`, npm `11.14.1` and pnpm `10.32.1`. The staging, packed-consumer and final related-test sequence completed from `2026-11-17T09:32:26.150Z` to `09:32:31.897Z`, in 5.75 seconds. Code hashes were unchanged across that sequence.

## Actual packed-source consumers

Each fixture went through the real release manifest and staging functions, then `npm pack --offline --ignore-scripts`. A fresh consumer installed that local tarball with offline installation and scripts disabled. Installed manifest exports and every selected source file were compared against the staged package. The real `FileSourceGraph` then loaded a consumer entry from the installed package; its manifest provenance digest matched the installed manifest bytes.

| Installed fixture | Preserved source export | Actual source-loader resolution |
| --- | --- | --- |
| `@example/direct-root@1.0.0` | Root string `./src/behavior.proto.ts` | `node_modules/@example/direct-root/src/behavior.proto.ts` and its helper |
| `@example/direct-subpath@1.0.0` | `./behavior` maps to `./src/behavior.proto.ts` | `node_modules/@example/direct-subpath/src/behavior.proto.ts` and its helper |

Neither tarball contains an invented `dist/behavior.proto.js`. The subpath fixture also retains `./dist/index.js` and `./dist/index.d.ts` for its ordinary root export; a fresh Node ESM import returned its expected runtime value. The root-string fixture is intentionally an authored-source entry, not a claim of loader-free runtime TypeScript support.

The tarball SHA-256 values are:

- Root: `aeab09b6f354193041ef54eff5a2059771fe6b841b5691e69a7d343ccf6c1f48`.
- Subpath: `2608987d96c2da2c18cac1cafda80b64051c1ee131f6de93bc3c3052422868ef`.

This evidence proves package-source reachability through the repaired publication projection. It does not claim a complete release rehearsal, a new compiler profile, generated component/native-browser acceptance, or registry publication. No whole-package build, `npm publish`, release version, permission or workflow change was performed. Independent review and integration remain separate from this implementation receipt.
