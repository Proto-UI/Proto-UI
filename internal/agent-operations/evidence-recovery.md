# Recover retained project evidence

The optional `scripts/agent-operations/evidence-recovery.mjs` helper indexes already-produced evidence and restores verified copies into a new directory. It uses the existing Actions artifact and immutable evidence-branch paths. It grants no storage, publication, review or integration authority and does not add an Issue or PR intake requirement. The existing factual manual evidence path remains available.

This guide accompanies the Issue #841 source candidate dated 2026-11-10. The fresh-workspace experiment, controlled outcomes, workflow adoption and public demonstration require actual Main execution; source examples below are proposed commands, not execution receipts.

## Index existing output

Use Node 24. Write the manifest outside the evidence directory so indexing cannot include its own output. The index includes all regular files, including failed, partial, not-run and invalid-JSON diagnostics. Symlinks and special files are refused. Every file receives a SHA-256, byte count and content type. Existing JSON metadata and v2 handoffs remain complete structured documents in the manifest; their original files remain part of the recoverable inventory.

```sh
node scripts/agent-operations/evidence-recovery.mjs index \
  --repository Proto-UI/Proto-UI \
  --directory /tmp/already-produced-evidence \
  --artifact-json /tmp/existing-upload-artifact-outputs.json \
  --run-json /tmp/existing-workflow-run.json \
  --output /tmp/evidence-manifest.json
```

`--artifact-json` accepts the existing `actions/upload-artifact@v4` output object (`artifact-id`, `artifact-digest`, `artifact-url`) or the original GitHub artifact API record. `--run-json` accepts the existing run API record. Neither is required. Without a run record, an existing metadata `run` URL or the current Actions runtime ID can locate the run; access failures remain recorded. Without an upload identity or immutable mirror, files are explicitly `local-only`, rather than published or cross-workspace recoverable.

For the existing evidence-branch upload path, add the actual storage commit and prefix after the separately authorized upload. This reads the immutable Git inventory; it does not perform an upload. `--public` records that this already-published mirror is public. Omit it when public access has not been established.

```sh
node scripts/agent-operations/evidence-recovery.mjs index \
  --repository Proto-UI/Proto-UI \
  --directory /tmp/already-produced-evidence \
  --evidence-commit FULL_EXISTING_STORAGE_COMMIT \
  --evidence-prefix evidence/pr-N/source-key \
  --output /tmp/evidence-manifest.json
```

The remote indexing form consumes existing metadata without downloading screenshots. It combines metadata SHA-256 values with the pinned Git inventory's sizes, types and blob identities. Git SHA-1 values never substitute for missing SHA-256 values. A truncated Git inventory is rejected. Missing hashes remain unknown and cannot produce a verified recovery.

Source head/tree, PR, workflow source/run/attempt, artifact ID, retention/expiry, access, environment, result, comparison, inspected scope and review limits are retained where the original inputs provide them. Missing fields stay `unknown`. `role` and `variant` preserve explicit baseline/candidate and source/packed classifications; filenames alone do not create those classifications. Multiple subject heads remain a conflict, rather than being collapsed into a newer successful head. Workflow source revision and run/subject head are separate identities.

Handoff references retain type, reference, digest, revision and result. A reference matching an indexed file points to that recoverable file. A reference with no admitted transfer source remains a readable gap, including local paths from another workspace. A handoff's presence does not authenticate its contents or prove freshness.

## Restore without running producers

```sh
node scripts/agent-operations/evidence-recovery.mjs recover \
  --manifest /tmp/evidence-manifest.json \
  --directory /tmp/new-recovery-attempt \
  --expect-head ORIGINAL_FULL_SUBJECT_HEAD
```

The manifest argument may also be a public raw GitHub URL pinned to a full commit. Existing `GH_TOKEN` or `GITHUB_TOKEN` can supply GitHub API read access. The helper does not discover credentials in downloaded material. It sends the API credential only to `api.github.com`, never to raw mirrors or the expiring artifact download redirect. Signed download capabilities are not persisted in the report.

The command creates a new directory exclusively and never clears an existing attempt. It retains the original manifest bytes, then writes non-executable, mode-0600 files under `files/` and a `recovery-report.json` mapping original paths to recovered paths. It copies only hash-matching files. ZIP data uses the existing bounded extractor in `scripts/preview/extract-artifact.mjs`; archives and individual responses are capped at 50 MiB compressed/transfer size, with the extractor's additional expansion/file limits. No recovered HTML, JavaScript, executable, test, browser or other evidence producer is launched.

Each listed file has an outcome and next action:

| Outcome | Meaning |
| --- | --- |
| `recovered` | Original SHA-256 and any known byte size match a copy; pinned Git blob identity or admitted artifact/run identity also matches. |
| `unavailable` | No obtainable original copy, missing listed file, missing original digest, local-only reference, network failure, or HTTP 404. A 404 does not establish expiry. |
| `expired` | The artifact API explicitly reports expiry, or the transfer returns HTTP 410. |
| `hash-mismatch` | A copy or archive differs from its original digest, size or pinned blob identity. Replacement bytes are not materialized. |
| `unknown-access` | The service returned HTTP 401 or 403. Existing authorized read access must be established separately. |
| `source-head-mismatch` | The requested subject differs, or the artifact/run identity differs. Another head is not relabeled as the original evidence. |

A primary failure remains in the per-file attempts even when a mirror recovers the original bytes. A valid mirror avoids re-running protected producers. If no valid copy exists, the report records recovery verification debt. Verified bytes with no established public display/read link produce publication debt separately. Failed, partial and not-run source results and review limits remain unchanged; recovering a failed report does not turn it into a passing test.

Exit code 0 means the requested operation produced its report with no recovery debt, 2 means the recovery report contains unavailable/unverified material, and 1 means invalid input or an operation failure. These exit codes describe recovery, never product acceptance. Unknown source binding cannot prove a current-head result. Use `--expect-head` for a same-source recovery claim.

## Real retained PR example

[PR #815's original progress comment](https://github.com/Proto-UI/Proto-UI/pull/815#issuecomment-5980070519) identifies source `b5954d3a35bc3a9e5b29d88befdaebc94ad748ef`, tree `cfe8f7956e3dad8c43fb270c211045a556631298`, run `37201787565`, artifact `11303371816` and storage commit `a9d1c73672ad4268a3622fc75fc6b96f7312e015`. On 2026-11-10, the artifact metadata endpoint returned HTTP 404; this is an unavailable lookup, with no claim that the actual artifact expired. The run API still reported attempt 1 and `.github/workflows/passive-atom-docs-evidence.yml`.

[The pinned metadata](https://github.com/Proto-UI/Proto-UI/blob/a9d1c73672ad4268a3622fc75fc6b96f7312e015/evidence/pr-815/b5954d3a/metadata.json) lists six files: two full-document PNGs, two JSON reports, font environment and pixel-comparison report. Indexing also retains the metadata file itself, giving seven listed files. Its historical 64-test/66-PNG result remains a historical claim; these seven files do not become the complete 66-PNG artifact, nor a new screenshot review.

Main's proposed experiment uses a fresh, absent output directory:

```sh
node scripts/agent-operations/evidence-recovery.mjs index \
  --repository Proto-UI/Proto-UI --pr 815 \
  --metadata https://raw.githubusercontent.com/Proto-UI/Proto-UI/a9d1c73672ad4268a3622fc75fc6b96f7312e015/evidence/pr-815/b5954d3a/metadata.json \
  --evidence-commit a9d1c73672ad4268a3622fc75fc6b96f7312e015 \
  --evidence-prefix evidence/pr-815/b5954d3a --public \
  --output /tmp/issue841-pr815-manifest.json
node scripts/agent-operations/evidence-recovery.mjs recover \
  --manifest /tmp/issue841-pr815-manifest.json \
  --directory /tmp/issue841-pr815-fresh \
  --expect-head b5954d3a35bc3a9e5b29d88befdaebc94ad748ef
```

Record the actual command output, recovered file SHA-256 values, source mapping, unavailable primary lookup, action counts, access conditions and reader inspection. The target is one recovery invocation, zero manual per-file URL collection and zero browser reruns for those listed materials. Preserve earlier directories; repeat into a different absent directory when a second fresh-workspace comparison is needed. Publication of a real PR demonstration requires Main's separately authorized evidence write; local `/tmp` files are not public URLs.

## Controlled checks and remaining acceptance

Main runs `node --test scripts/agent-operations/test/evidence-recovery.test.mjs` serially. These injected simulations cover expired-primary/matching-mirror recovery, no mirror, missing files, wrong hashes, wrong head/run, partial screenshot coverage, access refusal, local-only inputs, unchanged failures/not-run references, original script bytes without execution, credential-free redirect transfer and preservation of existing attempts. They do not establish actual GitHub expiry, access loss, full visual inspection or assistive-technology results.

Issue #841 also requires the real fresh-workspace/public-PR demonstration and adoption by one real browser-evidence workflow plus the existing evidence-branch path. The separately prepared shared integration patch is Main-owned and unapplied during this bounded implementation. No Issue criterion, independent review, lawful integration or closure is claimed by authoring this helper or validating handoff metadata.
