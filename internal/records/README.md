# Internal Records

This directory stores dated engineering records: design memos, ADRs, audits, investigations, and time-bound decisions.

## Scope & Limits

- Records are **non-normative, time-bound observations**; they never override `spec/**` entities or establish release commitments.
- Read records by topic and date—do not assume the newest file supersedes older records on other topics, and do not rewrite history to make the past look cleaner.
- Binary evidence (`.png`, `.mp4`, `.log`, `.tar.gz`, raw test dumps) is **banned from `main`**. Historical binary evidence lives on the unmerged orphan branch documented in [EVIDENCE_ARCHIVE.md](EVIDENCE_ARCHIVE.md).

## Directory layout and retention

| Bucket | Path | What belongs here |
| --- | --- | --- |
| Active records & design memos | `internal/records/YYYY-MM-DD-topic.md` | Current investigations, ADRs, and active sprint notes referenced by open work. |
| Archived history | `internal/records/archive/YYYY-MM/` | Superseded, unreferenced historical records kept for factual traceability. |
| Binary / raw evidence | GitHub PR attachments, Actions artifacts, or unmerged archive branch | Screenshots, browser traces, logs, and `.tar.gz` bundles (never `main`). |

When a decision stabilizes, promote it into `spec/**`, `internal/contracts/**`, `internal/governance/**`, or `apps/www/src/content/docs/**` instead of letting a record act as a shadow spec.

## Recommended frontmatter and structure

Follow the [internal engineering writing guide](../governance/engineering-writing-guide.md) (conclusion first, single-slot scope & limits, narrative–receipt split):

```yaml
---
kind: decision | investigation | audit | sprint-note
status: active | superseded | archived
date: YYYY-MM-DD
baseline: <commit-sha-or-spec-id>
receipts:
  - <PR / Actions URL or companion .json path>
---
```

Recommended sections (target ≤ 200 lines; place large inventories or SHA tables in a companion `.json`):

1. **Conclusion / Decision** (in the first 5 lines)
2. **Scope & Limits** (one slot for baseline, non-goals, and unknowns)
3. **Observed facts & problem statement**
4. **Rationale & rejected alternatives**
5. **Follow-up work**

## In-repo reference examples

- `2026-04-06-dialog-design.md` — concise design exploration with clean structure
- `2026-06-29-focus-logical-tree-model.zh-CN.md` — focused conceptual model with diagrams
- `AUDIT-2026-08-20.zh-CN.md` — structured engineering audit without defensive bloat
