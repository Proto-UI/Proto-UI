# Sprint 6: isolated owned Canvas2D transport probe

## Result and remaining question

An isolated, executable native probe now compares an owned Canvas2D snapshot with the PNG produced by the **same actual production render**. The production renderer, image cache, material sink, carrier, optical profiles, original performance budget and application workload are unchanged. Native execution is pending; this record contains source review, controlled ownership failures and source-only validation. It does not establish a performance improvement or a production transport.

The source base is `24e553961e7a898b74b959792d35f49364f35efc`, the accumulated candidate observed in [the matched frame run](https://github.com/Proto-UI/Proto-UI/actions/runs/45249737653). The parent requested this experiment after that run retained the dynamic 10 ms gap. A later execution must name its own exact clean commit, including this probe, and retain its actual browser/renderer and source closure.

The implementation and frozen native inventory are described in the [experiment README](../../experiments/liquid-canvas-transport/README.md). Its question is whether a separately owned copy can preserve checked pixels and expose a smaller transport stage on an actual renderer. The current `contact-v1` pseudo-element takes an image URL; a copied canvas is not an admitted replacement. No decision or withdrawn implementation from #1667 is revived.

## Ownership and observation boundary

The experimental owner keeps one current and at most one synchronous staging snapshot, each within the existing 4 MiB output bound. Logical CSS dimensions and outset independently determine physical backing dimensions; the actual Document DPR and producer backing must agree. Capture binds the exact producer frame and an epoch advanced before every render attempt, including a failed attempt. A completed copy has its own lifetime, so another consumer's later render cannot revoke or change it. Ticket reads separately require the same owner, source, actual geometry and Document. Returned arrays are copies.

Retirement detaches the selected cohort before host cleanup. Disposal closes admission first. Same-owner capture recursion refuses the nested attempt and invalidates the outer operation; cleanup reentry may still establish a successor. Retired tickets keep only seven validated scalar identity fields.

The native collector wraps only its own producer canvas's `toDataURL`. It always calls the real encoder exactly once with the original arguments for a successful render, returns the original string, and restores the method. Snapshot observation alternates before and after that encoder. The original renderer still validates source pixels, executes the unchanged optical shader, reads back and checks contrast before observation.

The resulting PNG uses actual `prepareOpticalImage`. This deliberately measures the cold decoder interface, not the runtime cache policy or decoder CPU time. An additional native decode, outside the measured interval, supplies an independent PNG pixel oracle. Full raw RGBA and native black/white composites are compared exactly. A conversion difference remains a failure. Copied-pixel readiness is not compositor paint.

`ownedCaptureSubmitMs` includes allocation, ownership/geometry guards, native copying and old-resource cleanup. Raw `nativeDraw` timestamps surround the native port call, including its setup and checks. Neither name represents a pure `drawImage` duration.

## Review findings and retained repairs

Independent design review fixed three boundaries before implementation: physical versus logical units and real DPR; producer epoch during capture versus independent retained-copy lifetime; and caller-mutable readback arrays. The reviewed design bytes are retained with their original SHA-256, `8424a965a4157a5f1b50e14e134c0aedcd0d3da586e0c14c430916d78a1c1357`.

The subsequent controlled host-fault review found and reproduced three defects. Their original red probes and source snapshots remain in the archive:

1. A throwing dimension setter during native-port construction escaped rollback. Width and height assignment now share the construction `try`, and both zero-dimension cleanups are attempted while preserving the original error.
2. A typed-array `length` getter could dispose the owner after the prior current check and still let a result escape. Validation and copying now end with another current-owner check.
3. Spreading a structurally compatible identity retained an extra `frame → target` field in a retired ticket. Identity now copies only its seven declared scalars.

The final owner SHA-256 is `7d825e6c162345a6b4f591b04e295e095212ce03fd9963b02def98e77ae06ac2`. The original probes run against it record both construction/readback failures and identity retention as resolved. These are controlled port/host tests, not native pixel observations. The archive distinguishes the independently executed review results from the implementing agent's final formatted-source reruns. Two historical files were reconstructed by reversing the exact later changes and verified against independently recorded original digests; the reconstruction receipt names that provenance.

A further independent reader review found that equality alone admitted missing or uniformly malformed SHA/tree identifiers at the header gate, and an empty browser string also passed its own gate. The original header-only red probe is retained; its deliberately empty inventory still made overall acceptance false. The repaired source gate requires full forty-character lowercase hexadecimal commit/tree IDs as well as all original equality, cleanliness and closure conditions. Browser identity must be nonempty after trimming. Thirteen focused positive/negative header controls were added, and the original three rejection probes are green. This repair strengthens receipt completeness; it is not a native result.

## Actual validation

| Check | Observed result | Scope |
| --- | --- | --- |
| Owner and reader Node controls | 51 passed, 0 failed, cancelled or skipped | 24 owner controls and 27 header/inventory/comparator/artifact controls; no browser |
| Strict TypeScript | Exit 0 | Experimental owner only, ES2022 and DOM, no ambient types |
| Actual browser dependency bundle | 58 inputs; 109,689 bytes; 0 warnings | Includes the actual renderer and decoder; syntax/closure only |
| Repository document references | Exit 0; 0 errors | Includes the experiment entrypoint and README |
| Formatting and diff whitespace | Passed | The eight source/README paths |
| Native pixel, stage and lifetime collection | Not run | Parent owns exact-source native execution |

The full native denominator is **72 pixel cases + 120 stage samples + 20 lifetime cases + 6 negative controls**. Every failed or unattempted row stays in the receipt. Static and dynamic samples each retain sixty rows in six twenty-sample blocks, with both observation orders. Dynamic output requires sixty distinct actual PNG hashes. Invalid source and unsafe contrast must reject before the observer. Cleanup is inspected immediately and after two actual rAF callbacks. Raw A/B retained snapshots let the independent reader verify cross-consumer isolation as well as the main pixel matrix.

The reader rejects missing/duplicate cases, changed artifacts, incomplete planes, wrong dimensions, byte differences, reversed timing, incomplete renderer/decoder work, ineffective negative controls, no output progress and remaining resources. It reports all stage values over 10 ms without using them to settle the original product budget. The two transport observations are serial and share one render; subtracting their measured costs from the original application latency is not a valid product A/B conclusion.

## Reproducible next action

In a clean committed checkout containing the experiment, with the locked dependencies and Node 24, the parent can run:

```sh
node --import tsx scripts/analysis/liquid-canvas-transport.mjs OUTPUT --expected-sha EXACT_HEAD
```

`OUTPUT` is a fresh directory outside the source checkout. `EXACT_HEAD` is the full actual commit. The collector uses the existing sandboxed browser harness and an owned intercepted origin. It does not set `GITHUB_ACTIONS`, substitute a renderer, relax sandbox settings or fetch an external page/image. Every bundle input is checked against the commit, archived, and rechecked at the end.

The original source-bound receipt can be read again without a browser:

```sh
node --import tsx scripts/analysis/liquid-canvas-transport.mjs --analyze OUTPUT/report.json
```

Native fidelity or measured stage success would still leave actual carrier integration, presentation, full four-host consumption, physical GPU/120 Hz, input-to-photon and the original product 10 ms acceptance separate. The current source-only result grants none of those conditions.

## Retained evidence

The [source/control archive](artifacts/2026-11-24-sprint6-owned-canvas-transport/source-controls.tar.gz) contains 103 members: source closure, exact source patch, frozen design, original review probes and red snapshots, later greens, small-suite output, TypeScript configuration, bundle evidence, document check and authorization/authority notes. Its SHA-256 is `ae54599ab4e3bd5d85154d9800b485525710cbb93c054c2788577d9fad10e390` (260,428 bytes). The [manifest](artifacts/2026-11-24-sprint6-owned-canvas-transport/manifest.json) supplies per-file digests. All archive members were read back and checked against their recorded bytes before handoff.
