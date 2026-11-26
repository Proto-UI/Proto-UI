# Focused Contents wheel execution on 92d

## Exact source and result

- Run: https://github.com/Proto-UI/Proto-UI/actions/runs/45392795625
- Job: https://github.com/Proto-UI/Proto-UI/actions/runs/45392795625/job/138440634742
- Source: `92d3331636ff6337c87fc557f4b0334d426398dd`; event `workflow_dispatch`; attempt 1.
- Branch: `fix/contents-wheel-followup-20261124`; workflow ID `373828512`.
- Run created 2026-11-24 12:21:57 UTC. Final run/job result: **failure**.
- This observer performed only reads and local evidence export. Root performed the preceding authorized dispatch; its HTTP 204 acknowledgment is separately retained.

The two original native controls both executed and passed with zero skips. The uncancelled control moved its authored viewport from 0 to 400; the cancelled control stayed at 0. Both receipts retain their source, browser, and completion observations.

The original selected public Popover case executed and failed `expected +0 not to be +0` at the unchanged 1000 ms movement assertion, in the first Shadcn / WC / click attempt. The nine other homepage cases were skipped by the exact title filter. The remainder of the selected case's combinations was not completed. Server readiness reached HTTP 200 before this product assertion failed.

## Newly retained observations

The public receipt is `artifact/runtime/contents-command/shadcn-wc-click-wheel.json`. Before/final samples retain the same positioned, connected public Content: viewport height 776, scroll height 6230, range 5454, offset 0. Trusted wheel deltaY 500 reaches Content without cancellation.

The new inspection contains 15 hit-ancestry nodes, the retained dispatch path, and two trusted scroll callbacks from the same Content. Both callback observations sample top=0 and left=0; `droppedScrolls=0`. These observations do not identify a resetting owner or exclude movement between samples. Path geometry is explicitly inspection-time geometry.

The final screenshot is `artifact/runtime/contents-command/shadcn-wc-click-wheel-failure.png`. The control receipts are in `artifact/runtime/contents-wheel-controls/`.

## Environment and integrity

Node v24.22.3, pnpm 10.32.1, Chrome 157.0.8103.78; the official CJK preparation and supported toolbar preference completed. Before/after Git snapshots both identify exact source 92d and record dirty=false.

Artifact 14918983751 has 33 files. The downloaded ZIP is 165121 bytes with SHA256 `96d17cae5635a8b811c9611bfdb9e9f4053b9bde835de11030036bade5e021f0`, matching GitHub's digest before extraction. All copied generated-output files were rehashed against their source metadata. After execution, all five CSS/shadow outputs exist and their bytes are archived. The wrapper alone existed before generation; missing pre-generation files remain explicitly recorded.

The complete job log is connector-decoded UTF-8, not raw HTTP response bytes; see `log-provenance.json`. The ZIP members retain their downloaded bytes. See `artifact-manifest.json` and `result-summary.json` for exact hashes and results.

## Boundary

The workflow context repair now passed actual platform parsing, runner initialization, and evidence retention. The public Contents product bug remains reproduced on this new source. This is neither a complete homepage/full-CI pass nor proof of a product repair. The actual receipt was supplied to the product investigator and independent reviewer for the next bounded diagnosis.

