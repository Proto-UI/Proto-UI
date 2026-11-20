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

All values below are milliseconds, preserving the JSON summary numbers. Decimal length reflects JavaScript's serialized elapsed-time value, not measurement accuracy.

| Prefilter dimensions | Before p50 | Before p95 | After p50 | After p95 |
| --- | --- | --- | --- | --- |
| 128 × 64 | 1.3627280000000042 | 2.394804000000022 | 0.4142610000000104 | 0.7564899999999852 |
| 256 × 128 | 5.747591000000057 | 8.998820000000023 | 1.7947010000000319 | 3.3420849999999973 |
| 512 × 256 | 22.60074399999985 | 27.62034000000017 | 5.94377099999997 | 8.438276999999971 |
| 1024 × 512 | 97.22996599999988 | 177.6046150000002 | 24.99177099999997 | 37.44577500000014 |

| Contrast dimensions / profile | Before p50 | Before p95 | After p50 | After p95 |
| --- | --- | --- | --- | --- |
| 128 × 64 / neutral | 7.120108999999957 | 9.611149999999952 | 0.12776999999999816 | 0.4312449999999899 |
| 128 × 64 / tinted | 33.15838299999996 | 50.181037999999944 | 0.15868399999999383 | 1.8790020000001277 |
| 256 × 128 / neutral | 24.779391999999916 | 27.704400000000078 | 0.36325699999997596 | 0.49571900000000824 |
| 256 × 128 / tinted | 131.69322199999988 | 143.46539800000028 | 0.7134550000000672 | 0.9395729999996547 |

## Repository script execution

The following values came from the portable script's actual invocation with `--out internal/records/evidence/2026-11-21-liquid-optical-cpu/repository-script`. The variation from the original run is visible and retained.

| Prefilter dimensions | Before p50 | Before p95 | After p50 | After p95 |
| --- | --- | --- | --- | --- |
| 128 × 64 | 1.4451999999999998 | 1.867181999999957 | 0.44416499999999814 | 0.8941639999999893 |
| 256 × 128 | 6.655676999999969 | 14.058762000000002 | 2.4575419999999895 | 4.877998999999932 |
| 512 × 256 | 27.128105000000232 | 43.46370300000012 | 10.123542999999927 | 20.18178499999999 |
| 1024 × 512 | 92.75076399999944 | 109.47601499999928 | 23.609886000000188 | 33.587140999999974 |

| Contrast dimensions / profile | Before p50 | Before p95 | After p50 | After p95 |
| --- | --- | --- | --- | --- |
| 128 × 64 / neutral | 3.998859000000266 | 7.58672099999967 | 0.06993899999997666 | 0.23510299999998097 |
| 128 × 64 / tinted | 21.23848999999973 | 43.5946040000008 | 0.08971900000051392 | 0.17884899999990012 |
| 256 × 128 / neutral | 15.389681999999084 | 18.954228000000512 | 0.2818120000010822 | 0.4708989999999176 |
| 256 × 128 / tinted | 75.5519009999989 | 91.48734200000035 | 0.5164850000001024 | 0.9583220000004076 |

## Correctness evidence and limits

The focused `web-material-program.test.ts` run passed all 46 tests. Its frozen old contrast predicate covers alpha 0, 249 and 250–255, foreground palette boundaries, neutral and tinted paths, sRGB and premultiplied edge values, threshold transitions, and deterministic chromatic samples. The prefilter reference checks exact output bytes across several dimensions and inputs. Resource tests verify same-size reuse, resizing, clear and invalidation behavior. A scoped TypeScript check of the program and test with their imports passed.

The portable script was executed, both reports contain four cases with 31 before and 31 after samples, their percentile summaries match the retained samples, and their source hashes match the measured program. Script syntax, focused formatting and diff whitespace were checked. These checks do not execute a GPU, page or display.

The execution environment was shared, with other repository build/check activity during the work. CPU affinity, scheduler contention, clock frequency and thermals were not controlled or recorded. The scratch reproduction and repository execution show substantially different absolute timings from the first run. Retaining all runs prevents selection of only the fastest result.

The benchmark isolates arithmetic and allocations inside these kernels. It excludes full source admission, texture upload, GPU work, `readPixels` transfer, PNG encoding, image decoding, DOM style/layout/paint, compositor scheduling and the physical display. It also does not time the readback-buffer reuse change or one-time lookup-table initialization. A 120 Hz display allows about 8.33 ms between presentation opportunities; the retained larger prefilter cases can exceed that interval by themselves. No 120 fps or 10 ms end-to-end claim follows from this CPU evidence. The exact candidate still requires a separately recorded browser pipeline measurement and hardware display/input latency validation.

An initial whole-workspace type check exhausted its default heap. The 6 GiB retry reached four diagnostics outside this slice: the compiler's `ExpressionIR` conversion and `ts.setParentRecursive` usage, and two analysis fixtures referencing a not-yet-generated shadow style module. That historical attempt did not establish a passing repository gate; subsequent generation and integration checks belong to the combined change's evidence.
