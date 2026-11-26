# Sprint 1: producer lifetime and observable Rule sites

## Scope and current status

This checkpoint continues PR #1745 from `a3cee2510f47f3b1b6d3a1c34f09eea16cb9e9da` in human-assisted mode under the current user's instruction to finish Sprint 1. It contains four CLI services and six focused test files. It does not certify the original all-source coverage gate, Ready status, native browser performance, or a complete project caller graph.

Producer certificates now reject the recorded mutation, namespace, and dynamic-import lifetime hazards while preserving supported closed helper registration and local-container behavior. The collector and scanner share the closed helper checks. Unknown or escaped contexts remain unknown; no corpus allowlist or accepted-token substitute was introduced.

`scanRuleStateReadsWithSites` exposes each syntactic Rule site, the independent declaration scan, and actual production visits on one AST. Each visit retains its observations and closed-helper invocation path. A declaration or an uncalled helper is not converted into a runtime entry. The independent declaration pass uses a fresh summary and does not inherit a supplied summary's virtual sources or proof. The existing `scanRuleStateReads` production behavior and original coverage assertions remain intact.

## Executed validation

| Check | Actual result |
| --- | --- |
| Dynamic-import certificate control | Baseline 32/33; candidate 33/33 |
| Shared scanner dynamic-import control | Baseline 49/50; combined lifetime candidate 83/83 |
| Initial combined current-source CLI group | 499/505; six failures identified declaration observations mixed with production helper replay |
| Explicit raw-site API, complete related group | 513/513 across 19 complete files |
| Computed type-member site control | Baseline 8/9, with a real missing-site callback exception |
| Final observation-domain fix, same complete 19-file group | 514/514, zero skipped |
| Scoped CLI service TypeScript check | Exit 0 |
| Original complete lowered-hook coverage file | 198/199, zero skipped; still fails `blind` equal to `[]` |

The inventory initially skipped type nodes while the unchanged production visitor still visited computed type members. The new control reproduced `rawVisits` access on an absent site. Aligning only the inventory registration traversal with the original visitor fixes that exception without omitting production observations or declaring a type-level call to be a runtime entry.

The final complete coverage execution binds 5,900 source files before and after and reports `sourceUnchanged: true`. Its original 240-second test oracle is unchanged; the external process owner has a 300-second cap. The retained prior full inventory records 816 unresolved observations across 119 files: 642 subjects, 77 comparisons, 66 intents, 30 conditions, and one specification. The first `blind` assertion fails, so subsequent provenance/name assertions in that case are not claimed to have executed. Imported and named caller reconciliation remains work in progress.

The scoped type repair adds an explicit `ts.Node` annotation only. The retained runtime-equivalence check compares identical transpiled JavaScript bytes (270,717 bytes, SHA-256 `11328cd0da2e1726fae7cdf9341b26ba53de69f2cf3c71de1f232ee4afe6e774`). Scoped checks do not replace workspace or Astro acceptance.

## Evidence and limits

The [manifest](./evidence/2026-11-24-sprint1-producer-lifetime-and-rule-sites/manifest.json) records the exact final ten source blobs, original command receipts, outcomes, and each archived member's digest. The [raw evidence](./evidence/2026-11-24-sprint1-producer-lifetime-and-rule-sites/raw-evidence.zip) preserves failed baselines as well as passing controls, including the original complete gate failures. The 83-case run overlaps the final 514 cases and is not an additional acceptance total.

No native timeout, resource limit, compiler authority assertion, or Ready gate is weakened by this checkpoint. The separate actual Textarea caller intake and browser optimization experiments remain outside this finite commit while their unresolved behavior is investigated.
