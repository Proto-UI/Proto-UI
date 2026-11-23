# Preserved Sprint 6 originals

These eight deterministic gzip/tar archives preserve all 869 original untracked evidence/record files left at source `07f330261756dc95f10d3bb0d763827ab161c388`. `manifest.json` is the complete path, byte-count, SHA-256, Git-blob-SHA-1 and mode inventory. No historical result or original embedded source identity was rewritten.

The manifest records the original full-byte extraction comparison. `verify-preserved.py` independently checks each archive and every member again without requiring GitHub or a browser:

```sh
python internal/records/evidence/2026-11-23-sprint6-preserved/verify-preserved.py
```

To reconstruct the original repository-relative paths in a new, empty directory, provide that destination:

```sh
python internal/records/evidence/2026-11-23-sprint6-preserved/verify-preserved.py --restore /tmp/sprint6-restored
```

The destination must not already exist. All archive hashes and member identities are checked before extraction. Restored historical Markdown files under `internal/records/` retain their original relative links. Some links also target files already tracked in the source checkout; those are not duplicated in this archive.

`baseline-terminal-jobs.json` is a new API readback of the now-completed baseline cycle, separate from the unchanged archived snapshot that still showed it pending. The baseline run failed; this archive does not convert it to success. These are evidence preservation and readback operations, not fresh product, native-image or physical-hardware acceptance.
