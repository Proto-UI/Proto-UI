---
kind: ops
status: archived
date: 2026-11-26
baseline: e0260c09f
---

# Historical Binary Evidence Archive

Raw CI tarballs, split Git bundles, execution logs, screenshots, and untracked session dumps previously stored under `internal/records/evidence/` and 10 dated evidence subdirectories (~535 MB across 7,118 files) were moved out of `main` to keep repository clones fast.

## Archive Location

- **Orphan branch:** `archive/internal-evidence-2026-11`
- **Commit:** `cae25ae39f926e9556ec40fe2c7ed46a2025091f`
- **Contents:** Byte-identical copies of all 7,118 moved files (see `ARCHIVE_README.md` on that branch).

## Inspecting or Restoring Archived Files

```sh
# List archived paths
git ls-tree -r --name-only archive/internal-evidence-2026-11

# Read a single archived file without switching branches
git show archive/internal-evidence-2026-11:internal/records/evidence/<path>

# Extract a subdirectory into /tmp for inspection
git archive archive/internal-evidence-2026-11 internal/records/evidence/<subdir> | tar -x -C /tmp/restored-evidence
```

## Policy Going Forward

- Never commit `.tar.gz`, `.zip`, `.gz`, `.bundle*`, `.log`, or >100 KB images under `internal/`.
- Keep raw CI outputs in GitHub Actions artifacts, PR attachments, or a dedicated archive branch that is never merged into `main`.
- Enforced automatically by `corepack pnpm@10.32.1 check:internal-docs`.
