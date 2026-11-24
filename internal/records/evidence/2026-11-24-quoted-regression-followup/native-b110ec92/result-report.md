# Product-fix candidate b110: native result remains failed

## Exact execution

Run [45398259913](https://github.com/Proto-UI/Proto-UI/actions/runs/45398259913), job [138459735307](https://github.com/Proto-UI/Proto-UI/actions/runs/45398259913/job/138459735307), workflow 373828512, event `workflow_dispatch`, attempt 1. The checkout and all source receipts bind `b110ec92f5b1c5d256c79b831c0b86b9caaec3e3`. Both run and job concluded **failure**.

Setup, official CJK fonts, the two controls, afterTest retention and artifact upload succeeded. The original single public matrix case executed and failed its unchanged `expected +0 not to be +0` assertion at homepage-dogfood.browser.test.ts:1260:35. Its duration was about 80.6 seconds; this was not the 180-second case timeout. Nine unrelated homepage cases were unselected by the exact filter.

## Executed combination accounting

| Scope | Observed result |
| --- | --- |
| Authored native controls | 2 passed, 0 skipped; uncancelled 0→400, cancelled 0→0 |
| Shadcn: WC / React / Vue / Vue2 × click / Enter / Space | 12 successful wheel receipts, each 0→500 with retained owner, uncancelled trusted wheel, and unchanged document offset |
| Corresponding Shadcn completion evidence | 12 normal-close observations and four complete keyboard-focus screenshot receipts |
| Brutalist / WC / click | Failed: the same Content records a trusted scroll callback at top=500, then another at top=0 approximately 60.5 ms later; final sampled offset remains 0 |
| Remaining expected combinations | 23 not executed after the failure |

There are **13 actual wheel receipts out of the planned 36: 12 successful and one failed**. The original Vitest matrix case as a whole is still failed. The Shadcn results establish useful progress without certifying the unexecuted combinations or whole homepage/full CI.

The exact new failure is `artifact/runtime/contents-command/brutalist-wc-click-wheel.json`, with its failure PNG in the same directory. Unlike the prior92d trace, the new trace directly records a positive offset followed by zero. It still does not identify which operation caused that later change. No inferred cause has been promoted to a native repair result.

## Source, generated output and archive integrity

Before/after Git SHA matches exact b110, with dirty=false both times. Each phase's **14 source-file hashes** was checked against the actual b110 Git object bytes, including the host/test and style-lease/root-space dependencies. Every archived generated output was rehashed against its recorded bytes and SHA256.

All **five actual afterTest CSS/shadow outputs are byte-identical to the failing92d run's retained generated outputs**. This comparison is between actual native-run files, not only source declarations or local generation. Node v24.22.3, pnpm10.32.1 and Chrome157.0.8103.78 were recorded.

Artifact14922293422 is **736357 bytes**. Its ZIP SHA256 `481c083413e3781b43aded9c0cda781ecaa00e1b0b2a314fe790a453b11612da` matches GitHub's published digest; all 65 members were safely extracted after that check.

The durable bundle retains one original ZIP, the complete connector-decoded job log (gzip), terminal API snapshots, summary and integrity manifests. It does not duplicate every extracted screenshot. Extracted members remain separately available under `artifact/` for investigation. Job logs are decoded UTF-8, not original HTTP response bytes.

This watcher performed no dispatch, rerun, cancellation, source edit or external mutation. The original failure receipt and partial progress have been supplied to the owning investigator and independent reviewer.

