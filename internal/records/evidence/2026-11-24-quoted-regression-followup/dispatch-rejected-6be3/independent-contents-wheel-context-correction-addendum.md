# Independent review addendum: platform workflow-context failure

## Correction to the previous review

The initial independent review missed a real dispatch-blocking defect in the new Contents evidence lane. Its statement that no unresolved substantive defect was found was incomplete. The original review is retained unchanged; this addendum records the missed issue and the subsequent source correction. Local YAML, shell, Node, collection and synthetic-selection checks did not establish that GitHub would accept every expression context.

This is a human-assisted/current-user local technical review. It is not a platform approval, and the reviewer performed no dispatch or external write.

## F-WORKFLOW-001 — unsupported runner context prevents creation of a run

Severity: **P1 for this evidence workflow**, because the requested focused diagnostic run cannot be created.

Rejected source: **`6be3babcac8bc11fd43679b446a486c93642fb74`**. File: `.github/workflows/browser-suite-repair-evidence.yml`, original lines 100 and 101. Original workflow SHA256: `7aabdc5998cc596d50651bd58d0e61eff8ab8f5e41f3bfdd822d5b8b8c1dba43`.

The two job-level environment assignments use `runner.temp`. The retained actual response at 2026-11-24 12:17:14 UTC is HTTP **422** and names both expressions as unrecognized in that context. The retained bounded readback reports one request, **zero created/observed runs**, and no native execution. This is a rejected request, not a failed browser run or a skipped test pass.

The [GitHub context availability table](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability) omits `runner` from job-level `env`, while permitting it for step-level `env`, `run` and `with`. This matches the platform response. The defect was available to static review, and I did not catch it in the earlier review.

## Inspected source correction

The correction is an uncommitted delta over the same 6be3 source. Its workflow SHA256 is **`2761aa28999067c560442d294f66ea282d12e47768ebfa29e6c5acb223045dd5`**.

The diff removes only the two unsupported job-level expressions and adds four shell lines in the first preparation step, now lines 105–108. It exports both paths from `RUNNER_TEMP` for that running shell, then persists them to `GITHUB_ENV` for subsequent steps. It initializes the paths before creating the evidence directory or recording the requested source.

The [official environment-file semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands#setting-an-environment-variable) distinguish the current step from later steps. The explicit shell exports and subsequent environment-file writes cover both. Quoting preserves a path containing spaces. No runner-reserved variable is overwritten.

Remaining `runner.temp` references are in legal step-level positions for the font helper and artifact upload. The requested/observed source binding, test selection, exit propagation, time limits, sandbox setting, and always-run receipt/selection/upload steps are otherwise unchanged. I found no new substantive issue in this narrow correction.

**Resolution boundary:** the known source defect is corrected in the inspected bytes. A real dispatch on the new published source is still required to establish platform acceptance. Successful platform acceptance would still not establish native or public-product success. Neither is claimed in this addendum.

## Evidence retention and validation limits

I directly read the saved request, HTTP response text, stderr and readback, and rehashed them. The response is retained tool-read text whose CRLF line endings were normalized to LF; the hashes below bind the saved text, not an assertion of original network-byte identity. The main follow-up narrative now records the rejection and explains the limits of prior checks.

I also rehashed the two original review files and confirmed they were not rewritten:

- `independent-contents-wheel-followup-review4aa.md`: `60c1379a31123250334cc20dc8d200fcf2d52a859f4ad9c3b65c6638df79cef8`.
- `independent-contents-wheel-followup-review4aa.json`: `a8598819cbfdc313046132d5511d60c9abbf941217e0a6e8c370f1d8c588dc38`.

The workflow author reports syntax/format checks, the original 33 scheduling/toolbar checks, a bounded structural comparison, and actual first-step/later-step shell probes with absent path variables and a `RUNNER_TEMP` containing spaces. I read `/tmp/contents-wheel-context-fix-validation/summary.json`. I did not execute these checks independently, install actionlint, dispatch the corrected workflow, or launch a native browser. Shell probes are not GitHub expression-parser validation.

The historical e47 original public Contents `+0` failure remains open. No product assertion, timeout or diagnostic claim is relaxed by this infrastructure correction.

## Retained rejection evidence

All paths below are relative to the recovery repository.

| File | Bytes | SHA256 |
| --- | --- | --- |
| `internal/records/evidence/2026-11-24-quoted-regression-followup/dispatch-rejected-6be3/response.http` | 1826 | `c5ebb81c751331a6b193d08dcd5a742b03294d4e2bc666d62fc1964744e1388c` |
| `internal/records/evidence/2026-11-24-quoted-regression-followup/dispatch-rejected-6be3/stderr.txt` | 283 | `cd497d239b361fdc054e4bd9a15c15b3b26cbcec7658495f2ea6c4b5632073e3` |
| `internal/records/evidence/2026-11-24-quoted-regression-followup/dispatch-rejected-6be3/request.json` | 205 | `5d88a2d3ccc528aac1684b26a339aeca81d7e31b77fe616d31e6da5fb1c089e9` |
| `internal/records/evidence/2026-11-24-quoted-regression-followup/dispatch-rejected-6be3/readback.json` | 462 | `0c4b0748bdd8c001036a66cf0ef089f4e7cc6be2b0b43bd95d8f7f93b7f30b5d` |
