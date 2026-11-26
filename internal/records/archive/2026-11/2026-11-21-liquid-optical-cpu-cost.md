# Liquid optical CPU cost — 2026-11-21

This record preserves a bounded CPU optimization and its measurements against commit `543c8a2990239dec7c08458a902da3f5a97b49dd`. The user requested smoother Liquid Glass rendering and a target of 120 fps with 10 ms latency. The numerical kernels became cheaper in the retained runs; these measurements do not establish either browser target. The record is grouped under the requested 2026-11-21 delivery date. The repository-script run was captured at `2026-11-20T19:00:39.623Z`; its UTC timestamp is retained without adjustment.

## Owning sources and scope

The implementation belongs to [`packages/adapters/base/src/material/program.ts`](../../packages/adapters/base/src/material/program.ts). The governing [material contract](../../spec/contracts/C-FEEDBACK-MATERIAL-0001.yaml), [optical test definition](../../spec/tests/T-WEB-LIQUID-OPTICAL-0001.yaml), and [visual sink capability](../../spec/host-caps/HC-FEEDBACK-VISUAL-SINK-0001.yaml) remain draft. Their safety, quality, paint ownership, source admission and revocation requirements still apply. This record does not advance a lifecycle or native acceptance state.

The candidate changes three internal operations:

- The readback contrast scan uses exact sRGB lookup tables and scalar arithmetic. It still checks every relevant pixel, the original 4.5 contrast threshold, tint polarity, the black and white composites for alpha 250–254, and the requirement for opaque coverage. Table entries use the original floating-point expressions; this is not a quantized approximation.
- The separable seven-tap prefilter retains the `[1, 6, 15, 20, 15, 6, 1]` kernel, clamped edges and rounding after each pass. Column offsets are computed once. Integer sums remain at most 16320, so `(sum + 32) >>> 6` gives the original `Math.round(sum / 64)` result for every channel.
- One current-size readback buffer is reused. A size change replaces it; clear, context loss and disposal release the reference. The caller's source pixels are still validated on each render, including when the source object is reused.

The public render signature, shader sources, uniform values and PNG transport are unchanged by this slice. The new internal stage counters help distinguish source preparation, readback, contrast and encoding work. Their accounting boundaries differ: successful renders increment `renders` and `renderMilliseconds`, a successful complete scan contributes `contrastMilliseconds`, and preparation/readback counters can include work preceding a rejected render. They must not be interpreted as a complete failed-frame latency distribution.

## Reproduction

Install the repository's declared development dependencies, make the baseline commit available locally, and run from the repository root:

```sh
node scripts/analysis/liquid-optical-cpu-benchmark.mjs --out /tmp/proto-ui-liquid-cpu-20261121
```

[`scripts/analysis/liquid-optical-cpu-benchmark.mjs`](../../scripts/analysis/liquid-optical-cpu-benchmark.mjs) defaults to the current working directory and the baseline above. `--repo DIRECTORY` and `--base COMMIT` are optional overrides. `--out DIRECTORY` is required and resolves from the invoking working directory. Choose a fresh output directory: the script refuses to overwrite either retained JSON report. It does not fetch a missing baseline or read environment variables.

The script extracts the actual baseline and candidate numerical functions, then transpiles their TypeScript with esbuild targeting ES2022. The source anchors deliberately fail if a later implementation no longer has the expected shape; such a failure requires updating and reviewing the diagnostic, not silently using a different workload. Source loading, transpilation, lookup-table initialization and fixture construction happen outside the measured interval.

For each case, both functions receive eight warmup calls. Thirty-one paired measurements follow, alternating the before/after ordering on each pair. Each sample is the elapsed `performance.now()` time for one kernel call. The reports retain every sample in collection order. p50 is sorted rank 16 and p95 is sorted rank 30, without interpolation. There is no timing threshold or automatic performance acceptance gate.

The prefilter workload uses deterministic opaque RGBA bytes at 128 × 64, 256 × 128, 512 × 256 and 1024 × 512. The old and new output arrays must match byte for byte before timing each case. The contrast workload uses 128 × 64 and 256 × 128, both neutral and tinted, with a white foreground, dark RGB channel bytes in 0–63 and alpha values cycling through 250–255. Both implementations must return the same opaque coverage count. This intentionally exercises the extra near-opaque composite checks. It is a stress fixture, not a measured distribution of pixels on the public Button page. Its large tinted-kernel reductions must not be projected onto whole-page performance.

## Environment and provenance

The repository-script reports collect this allowlisted environment at startup:

| Field | Observed value |
| --- | --- |
| Node.js | `v24.22.3` |
| V8 | `13.6.233.17-node.63` |
| Platform / architecture | `linux` / `x64` |
| Kernel release | `6.18.57` |
| CPU model reported by Node | `INTEL(R) XEON(R) PLATINUM 8573C` |
| Logical CPUs / available parallelism | 9 / 9 |
| Reported total memory | 10451423232 bytes |
| esbuild | `0.25.12` |
| Baseline commit | `543c8a2990239dec7c08458a902da3f5a97b49dd` |
| Baseline program SHA-256 | `844be51a9b40a16f04e53888602bcd5235117b7949359cf20042203e477d156d` |
| Candidate program SHA-256 | `f2716d56a5dd14947d3fddc8d585892b3e0a31fe96dea600054898aca4826f4b` |
| Executed repository script SHA-256 | `1e2d7fc727bf911cb95f9380c052e7dd7b47d0b85a77ae558647879238d7f22d` |

The first two runs were made in the same shared executor. Their original reports collected less metadata, and remain unchanged. The later hardware observation is not a retroactive measurement of their CPU load, frequency or thermal conditions. No host name, account identity, environment variable values or credentials are included in these reports.

All six JSON files preserve their exact serialized samples and summary values:

| Run | Prefilter report | Contrast report | Provenance |
| --- | --- | --- | --- |
| Original measurement | [JSON](evidence/2026-11-21-liquid-optical-cpu/original/prefilter-benchmark.json) | [JSON](evidence/2026-11-21-liquid-optical-cpu/original/contrast-benchmark.json) | Initial numerical comparison; retained unchanged |
| Scratch script reproduction | [JSON](evidence/2026-11-21-liquid-optical-cpu/scratch-script-reproduction/prefilter-benchmark.json) | [JSON](evidence/2026-11-21-liquid-optical-cpu/scratch-script-reproduction/contrast-benchmark.json) | First reusable extraction script; includes its own script hash |
| Repository script execution | [JSON](evidence/2026-11-21-liquid-optical-cpu/repository-script/prefilter-benchmark.json) | [JSON](evidence/2026-11-21-liquid-optical-cpu/repository-script/contrast-benchmark.json) | Actual execution of the repository script with environment metadata |

## Original measurements

Times below are milliseconds, rounded to three decimal places for readability. The linked JSON retains the complete samples and unrounded summaries; displayed precision is not a claim of measurement accuracy.

| Prefilter dimensions | Before p50 | Before p95 | After p50 | After p95 |
| -------------------- | ---------- | ---------- | --------- | --------- |
| 128 × 64             | 1.363      | 2.395      | 0.414     | 0.756     |
| 256 × 128            | 5.748      | 8.999      | 1.795     | 3.342     |
| 512 × 256            | 22.601     | 27.620     | 5.944     | 8.438     |
| 1024 × 512           | 97.230     | 177.605    | 24.992    | 37.446    |

| Contrast dimensions / profile | Before p50 | Before p95 | After p50 | After p95 |
| ----------------------------- | ---------- | ---------- | --------- | --------- |
| 128 × 64 / neutral            | 7.120      | 9.611      | 0.128     | 0.431     |
| 128 × 64 / tinted             | 33.158     | 50.181     | 0.159     | 1.879     |
| 256 × 128 / neutral           | 24.779     | 27.704     | 0.363     | 0.496     |
| 256 × 128 / tinted            | 131.693    | 143.465    | 0.713     | 0.940     |

## Repository script execution

The following values came from the portable script's actual invocation with `--out internal/records/evidence/2026-11-21-liquid-optical-cpu/repository-script`. The variation from the original run is visible and retained.

| Prefilter dimensions | Before p50 | Before p95 | After p50 | After p95 |
| -------------------- | ---------- | ---------- | --------- | --------- |
| 128 × 64             | 1.445      | 1.867      | 0.444     | 0.894     |
| 256 × 128            | 6.656      | 14.059     | 2.458     | 4.878     |
| 512 × 256            | 27.128     | 43.464     | 10.124    | 20.182    |
| 1024 × 512           | 92.751     | 109.476    | 23.610    | 33.587    |

| Contrast dimensions / profile | Before p50 | Before p95 | After p50 | After p95 |
| ----------------------------- | ---------- | ---------- | --------- | --------- |
| 128 × 64 / neutral            | 3.999      | 7.587      | 0.070     | 0.235     |
| 128 × 64 / tinted             | 21.238     | 43.595     | 0.090     | 0.179     |
| 256 × 128 / neutral           | 15.390     | 18.954     | 0.282     | 0.471     |
| 256 × 128 / tinted            | 75.552     | 91.487     | 0.516     | 0.958     |

## Correctness evidence and limits

The focused `web-material-program.test.ts` run passed all 46 tests. Its frozen old contrast predicate covers alpha 0, 249 and 250–255, foreground palette boundaries, neutral and tinted paths, sRGB and premultiplied edge values, threshold transitions, and deterministic chromatic samples. The prefilter reference checks exact output bytes across several dimensions and inputs. Resource tests verify same-size reuse, resizing, clear and invalidation behavior. A scoped TypeScript check of the program and test with their imports passed.

The portable script was executed, both reports contain four cases with 31 before and 31 after samples, their percentile summaries match the retained samples, and their source hashes match the measured program. Script syntax, focused formatting and diff whitespace were checked. These checks do not execute a GPU, page or display.

The execution environment was shared, with other repository build/check activity during the work. CPU affinity, scheduler contention, clock frequency and thermals were not controlled or recorded. The scratch reproduction and repository execution show substantially different absolute timings from the first run. Retaining all runs prevents selection of only the fastest result.

The benchmark isolates arithmetic and allocations inside these kernels. It excludes full source admission, texture upload, GPU work, `readPixels` transfer, PNG encoding, image decoding, DOM style/layout/paint, compositor scheduling and the physical display. It also does not time the readback-buffer reuse change or one-time lookup-table initialization. A 120 Hz display allows about 8.33 ms between presentation opportunities; the retained larger prefilter cases can exceed that interval by themselves. No 120 fps or 10 ms end-to-end claim follows from this CPU evidence. The exact candidate still requires a separately recorded browser pipeline measurement and hardware display/input latency validation.

An initial whole-workspace type check exhausted its default heap. The 6 GiB retry reached four diagnostics outside this slice: the compiler's `ExpressionIR` conversion and `ts.setParentRecursive` usage, and two analysis fixtures referencing a not-yet-generated shadow style module. That historical attempt did not establish a passing repository gate; subsequent generation and integration checks belong to the combined change's evidence.

## Later prepared-source cache

The larger [browser observation](2026-11-21-liquid-glass-frame-budget.md#expanded-third-browser-results) retains sixty presses per backdrop mode and does not meet the 10 ms target. Its dynamic-contact windows also show 24/25/25 source preparations beyond their aggregate source-revision advances. A later bounded cache reuses up to four still-current prepared sources, capped at 4 MiB of retained filtered RGBA bytes. Exact frame/revision/dimensions/pixel-view/canvas/scope identity, weak historical ownership, old-revision retirement and one-current-texture upload coherence are described in the [follow-up record](2026-11-21-liquid-glass-frame-budget.md#bounded-source-preparation-follow-up).

The new program hash is `c084788bfc4974d09274ab832ab98c81ef4fd33f218b45eb5ea2f4ce476e2a29`. Its numerical kernels and admission/contrast thresholds remain unchanged. The original CPU reports above keep their original source binding; they are not relabeled as measurements of this cache. The follow-up passes 110 focused program/style tests, scoped TypeScript and formatting checks.

The subsequent [fourth native run](2026-11-21-liquid-glass-frame-budget.md#fourth-browser-results-bounded-cache) uses the unchanged expanded browser probe. Dynamic-contact windows perform 272 preparations for 272 aggregate source-revision advances and retain explicit cache-hit, upload and capacity observations. Its same-runner baseline/candidate mean renderer costs fall from 5.894 to 2.472 ms for static contact and 10.289 to 3.537 ms for dynamic contact. These compare the cumulative optimization with the original baseline; different runners prevent attributing the difference from the third run to LRU alone. All sixty-press distributions remain available, and event-to-commit p95 of 12.215/40.720 ms still fails the 10 ms target. CPU improvement is therefore not treated as complete pipeline acceptance.
