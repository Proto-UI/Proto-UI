# Registered consumer source intake

This directory records supplied consumer inputs under [SOURCE-COMPATIBILITY](../../../spec/contracts/C-COMPILER-FOUNDATION-0001.yaml) and the [lint inventory contract](../../../spec/contracts/C-COMPILER-LINT-0001.yaml). An intake binds files to a selected repository revision and original bytes. It does not establish that those files are valid Proto 0.4, have been migrated, compile for a target, or behave correctly through an Adapter.

## Reusable intake and verification

[`source-manifest.ts`](../../../packages/compiler/src/source-manifest.ts) exposes:

- `createSourceManifest(request, { snapshots })`: read an explicit file list and bind original-byte SHA-256 digests. Missing files remain listed with null digests and keep the inventory incomplete.
- `parseSourceManifest(value)`: validate the portable schema, exact repository revisions, relative paths, distinct file/entrypoint identities and all five required targets.
- `verifySourceManifest(manifest, options)`: compare the selected snapshots, original bytes, versions and configuration, then check the supplied shared frontend closure against the registered files and roots.
- `sourceManifestDigest(manifest)`: produce a canonical manifest identity.
- `directorySourceSnapshot({ repositoryId, revision, directory })`: read a selected directory and probe file/directory existence without changing it or executing its source. A custom snapshot reader can instead obtain bytes and existence evidence from exact Git objects or a revision-bound remote store.

The directory reader does not authenticate a revision label or perform a Git checkout. Obtain the exact snapshot and its provenance first. Verification compares its supplied full revision with the manifest and checks every declared file's bytes; an optional independently obtained `gitBlob` also checks the Git blob identity. The reader refuses paths that escape the selected directory.

File roles distinguish `entrypoint`, ordinary `dependency`, `configuration` and `evidence`. Component registrations are a separate `entrypoints` list with an export identity. Two `.proto.ts` filenames do not automatically mean two components, and one source file may contain several declarations. Export names in an intake remain registrations until semantic binding analysis establishes them; matching a registered file's bytes is not component acceptance.

The manifest's requested language and rule versions describe the intended analysis. `sourceState: "unmigrated"` remains explicit for historical inputs. `reportedCounts` preserves attributed intake claims with their units and revisions; those numbers are never added to verified file or component counts.

### Using the shared frontend

Build the Program through the existing controlled frontend and pass its `ProtoAnalysis` to the verifier. This module has no second module resolver, parser admission table or lint implementation. It checks the frontend's roots, reached source files, resolution-input files, positive/negative existence probes, configuration hash and closure digest against the selected source snapshots.

The frontend records file and directory conditions that module resolution actually consulted, including a missing higher-priority source file, package metadata or candidate directory. The verifier checks these conditions with the snapshot's optional `probePath(relativePath, kind)` capability, where `kind` is `file` or `directory` and `.` denotes the snapshot root. `directorySourceSnapshot` supplies this read-only capability. A custom reader returns a boolean for an observed condition or `undefined` when proof is unavailable; lacking a needed probe, or lacking an exact snapshot mapping for it, keeps verification incomplete and input evidence nonreusable. A revision label alone is not existence proof. Probe results are diagnostic evidence and are not counted as additional source files or component entries.

```ts
import { directorySourceSnapshot, verifySourceManifest } from '@proto.ui/compiler/source-manifest';
import { analyzeProtoFiles } from '@proto.ui/compiler/frontend';

// manifest was loaded with parseSourceManifest; configuration is the actual
// selected language/rule/compiler/target/binding configuration for this run.
const snapshot = directorySourceSnapshot({
  repositoryId: 'consumer',
  revision: manifest.repositories.find((repo) => repo.id === 'consumer').revision,
  directory: exactConsumerSnapshot,
});
const analysis = analyzeProtoFiles({
  currentDirectory: exactConsumerSnapshot,
  rootNames: manifest.entrypoints.map((entry) => entry.path),
  compilerOptions: selectedCompilerOptions,
});
const result = verifySourceManifest(manifest, {
  snapshots: [snapshot],
  configuration,
  analysis,
  previousEvidence: previousInputReceipt,
});
```

For multiple repositories, provide one selected snapshot for each repository identity and use the same resolution configuration as the shared frontend. Bind `configuration.frontendConfigurationHash` to the actual frontend's `sourceClosure.configurationHash` when creating a new intake. Do not overwrite an existing expected hash merely to make verification pass.

`matched` means the declared input set and supplied shared closure match. `incomplete` means a snapshot, path, digest, scope registration or shared analysis is still missing. `mismatch` identifies changed bytes, revisions, configuration or a stale analysis. Missing inputs stay in the denominator.

`inputDigest` binds the manifest, current bytes, configuration, observed resolution probes and shared closure. A changed helper, newly appearing resolution candidate, missing file or changed configuration prevents reuse of a previous input receipt. Numeric configuration preserves the observable distinction between positive and negative zero. `priorInputEvidenceReusable` applies only to this input evidence. The tool always returns `sourceValid: null`, `compilationVerified: false` and `conformanceVerified: false`; it cannot promote input bookkeeping into language admission or execution evidence.

Focused tests:

```sh
node --test packages/compiler/test/source-manifest.node-test.mjs
```

## Shenko intake observed on 2026-11-25

[`shenko-73d091ff.intake.json`](shenko-73d091ff.intake.json) is deliberately partial. Its selected source snapshot is the branch containing [decision 0010](https://github.com/cyjin-yl/shenko/blob/73d091ff581debe486b4bc809c3d001fbbdd3cb0/docs/decisions/0010-proto-ui-adapter-and-compiler-source-compatibility-2026-11-25.md). The following observations are separate revisions:

| Observation | Shenko revision | Proto-UI revision |
| --- | --- | --- |
| Selected decision branch | `73d091ff581debe486b4bc809c3d001fbbdd3cb0` | Its pin is `710a90df2ea57d9f93d7d09e43ebfb2b7b8e5057` |
| Separately observed `main` | `5e009cf7b59820f5cc002a8fc3604af22889edb3` | Its pin is `6ca8f262a074ed19cb24b35d5cc199b5b0e23e08` |
| Consumer's reported 204-file count | Not a supplied source manifest | Reported against `67fd94f5` |

The two pin files were read from those exact revisions. They must not be combined with the reported count as though all three observations described one verified source closure.

The [upstream review](https://github.com/Proto-UI/Proto-UI/pull/1915#issuecomment-7170144913) reports 16 adopted families, 204 upstream files (97 shadcn and 107 base), 98 `.proto.ts` filenames, 18,483 lines, and two separately reported consumer Prototypes. It offers to provide a consumer manifest; neither that comment nor decision 0010 supplies the 204 paths with per-file digests. The older checked-in `docs/evidence/nightly-6782627-20261116/compiler-inputs.json` binds upstream `7521cd501f454b4e013ec6e9656fb4b6e4951514`; it is not the missing manifest at `67fd94f5` or the selected `710a90df` pin.

### What was actually bound

The two default-export files registered in the inspected [`SHENKO_PROTOTYPES`](https://github.com/cyjin-yl/shenko/blob/73d091ff581debe486b4bc809c3d001fbbdd3cb0/crates/shenko-ui/web/compiler.mjs) list were retrieved as original GitHub blob bytes. Their Git blob identities were recomputed before their SHA-256 digests were recorded.

| File under `crates/shenko-ui/web/prototypes/` | Bytes | Raw-byte SHA-256 |
| --- | --: | --- |
| `transport-badge.proto.ts` | 1,995 | `2ee02ccc9ca4fdd8bb4d031d4d390ba4fe78113d290cd9f011735f77c1d272ae` |
| `message-bubble.proto.ts` | 1,553 | `50915675a5fb64b14bf4784594819ea64a76ceb2234e15f7db3321be03f61e8d` |

The intake also binds two configuration files (`upstream-pin.json` and the consumer host `tsconfig.json`) and four evidence files (the compiler/build scripts, `ui-kit.tsx`, and decision 0010). Those six files are not six additional component entries. No dependency files have yet been registered; this means the dependency manifest is missing, not that the two inputs have no dependencies. Their imports of `@proto.ui/core` still require the exact upstream closure.

The consumer React/DOM tsconfig is recorded as host configuration evidence. It must not be loaded as the new Proto authoring environment. No controlled frontend configuration digest is bound in this partial intake.

### Additional actual declarations

The inspected [`ui-kit.tsx`](https://github.com/cyjin-yl/shenko/blob/73d091ff581debe486b4bc809c3d001fbbdd3cb0/crates/shenko-ui/web/src/ui-kit.tsx) also defines four local Prototype bindings used through the Adapter:

| Prototype binding          | Adapter consumer     |
| -------------------------- | -------------------- |
| `verticalScrollViewport`   | `ScrollViewportY`    |
| `horizontalScrollViewport` | `ScrollViewportX`    |
| `bothScrollViewport`       | `ScrollViewportBoth` |
| `readingViewport`          | `ReadingViewport`    |

They are recorded as unregistered declarations in one additional module. They are not silently counted as four completed entries, nor omitted to force a 206-component total. Their selection/binding and reached-source scope still need to join the registered consumer inventory.

### Remaining work

Obtain or derive the complete path-and-byte manifest at one explicitly selected upstream revision using the shared frontend, register the additional local declarations, and bind the actual resolution configuration. Preserve any differences from the consumer's historical reported inventory. Then perform the governed common-source migration and independent Adapter/generated consumer checks across the required five-target scope.

The inspected sources still declare legacy build-time compilation for the two own `.proto.ts` files and Adapter use for the adopted families. Decision 0010 specifies moving the two files to Adapter when the pin crosses compiler retirement; that conditional transition was not executed by this intake. Neither consumer repository nor application pin was changed, no old compiler was run, and no source was certified as valid Proto 0.4.
