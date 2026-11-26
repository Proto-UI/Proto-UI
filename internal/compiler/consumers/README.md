# Registered consumer source intake

## Scope & Limits

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

The frontend records the file/directory conditions consulted by module resolution, including absent higher-priority files, package metadata and candidate directories.

- `probePath(relativePath, kind)` checks the observed condition. The kind is file or directory, and `.` selects the snapshot root. `directorySourceSnapshot` provides this read-only capability.
- A custom reader returns a boolean for a known condition or `undefined` when proof is unavailable. Missing probes or snapshot mappings keep verification incomplete and evidence nonreusable.
- A revision label alone is not existence proof. Probe results are diagnostic evidence, not extra source files or component entries.

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

`inputDigest` binds the manifest, current bytes, configuration, resolution probes and shared closure.

- Changed helpers, newly appearing resolution candidates, missing files or changed configuration invalidate prior input receipts. Numeric configuration preserves positive/negative zero.
- `priorInputEvidenceReusable` applies only to input evidence. The tool always returns `sourceValid: null`, `compilationVerified: false` and `conformanceVerified: false`; source admission and execution require their own evidence.

Focused tests:

```sh
node --test packages/compiler/test/source-manifest.node-test.mjs
```

## Registered intakes

[Shenko intake and remaining migration](shenko-intake.md) records its observed revisions, original-file bindings, unregistered declarations and unfinished common-source work.
