# GPUI recorded two-colour mix repair

## Bounded outcome

This repairs concrete two-colour Oklab/OkLCh lowering in `proto-ui-style` for the recorded Shadcn secondary-hover token. It does not admit GPUI as a public 0.3 Adapter or close the native regression gate. The fresh candidate run passes all 10 new mix tests and 12 of 13 existing colour tests. The complete theme × vocabulary check advances past the original mix failure and stops at a separate four-value `border-color` input, retained below.

The original failure is [run 45385473253, Linux Rust job 138415142421](https://github.com/Proto-UI/Proto-UI/actions/runs/45385473253/job/138415142421), at `fde59e8517b52f4c0a3fd19453a5d586e9fe7f3f`. The repair starts from `337be07287ba4770e1020d300d7d25b4792d06de`. The parser, existing colour test, style fixture and theme fixture are byte-identical between those two revisions; the archive contains their SHA-256 comparison.

The raw input is `color-mix(in oklch, #f5f5f5, #333333 5%)`. The space before the final percentage exists. `theme.substitute` has no demonstrated whitespace defect and is unchanged. Bootstrap is the first theme encountered by the cross-product test; it does not own the failing mix token. That token is authored in Shadcn Button profiles and action visuals, lowered by the shared CLI style renderer, and present in the native vocabulary.

## Owner and implementation

The repair is confined to the existing concrete colour parser. It recognizes two literal colours in explicit `in oklab` or default-shorter `in oklch`, using the already supported hex, RGB/RGBA, Lab and transparent forms. Parenthesis-aware separation preserves commas inside RGB functions. Optional suffix percentages are completed and normalized, including the final alpha multiplier. Interpolation premultiplies colour coordinates by alpha; polar hue keeps its independent weight interpolation and shortest arc. An achromatic endpoint has powerless hue and carries the other endpoint's hue.

Lab input remains outside the destination gamut until interpolation is complete. The existing local-MINDE output mapping then projects the result to sRGB. Transparent attenuation retains the existing exact RGB components. The public API and the theme/vocabulary fixtures do not change. Other spaces, explicit hue strategies, nested and multi-colour mixes, unresolved/current colours, and unsupported literal syntaxes remain diagnostics.

The fixed specification references are [CSS Color 5, 16 November 2026, §3](https://www.w3.org/TR/2026/WD-css-color-5-20261116/#color-mix) and [CSS Color 4, 23 November 2026, §13](https://www.w3.org/TR/2026/CRD-css-color-4-20261123/#interpolation), including [alpha](https://www.w3.org/TR/2026/CRD-css-color-4-20261123/#interpolation-alpha), [shorter hue](https://www.w3.org/TR/2026/CRD-css-color-4-20261123/#hue-shorter), and the sample conversion matrices in §19. The independent numerical reference uses double-precision conversion through XYZ, whereas the implementation reuses its existing single-precision linear-sRGB/Oklab routines. Expected vectors are constants in the tests; they are not calculated by the implementation under test. A separate analytical neutral-grey calculation also checks the original failure's 95:5 weight.

`HC-FEEDBACK-STYLE-SINK-0001` and `C-HOST-SURFACE-PROJECTION-0001` remain draft. This host-lowering repair changes neither final style ownership nor Prototype/Rule semantics. No lifecycle, Adapter-profile or public release promise is promoted.

## Actual validation and original failures

The owned Linux x64 run used Rust/Cargo 1.99.1 and rustfmt 1.10.0, the existing full native workspace and lockfile, `--locked --offline`, one build job and one test thread. It did not build or run the full GPUI matrix.

| Observation | Result | Boundary |
| --- | --- | --- |
| Original baseline, `cargo test -p proto-ui-style --test color` | 12 pass / 1 fail; exit 101 | Reproduces the original two-colour mix rejection |
| Initial candidate with the baseline's shared target directory | 12 pass / 1 fail; exit 101 | Repeated the old mix rejection; retained, not used as candidate acceptance |
| Candidate with its own fresh target directory, both test files, `--no-fail-fast` | `color_mix`: 10/10; `color`: 12/13; aggregate exit 101 | Original mix succeeds, complete gate exposes the next four-colour declaration |
| rustfmt and rustfmt check for all three changed Rust files | Exit 0 | Formatting only; independently rereviewed |
| Local `git diff --check` | Exit 0 | Patch integrity only |

The first candidate attempt used one target directory for two same-name path crates. The new target rebuild changed no semantics or assertions and avoids relying on a possibly reused baseline artifact. Both raw attempts and dependency-input receipts remain in the archive. No assertion, test selection, timeout or completeness denominator was relaxed to obtain a green aggregate; there is no green aggregate.

The fresh run occurred at 12:35:21–12:35:43 UTC. Its source bindings are:

| Path under `native/gpui/crates/proto-ui-style` | SHA-256 |
| --- | --- |
| `src/color.rs` | `375eef905dd3510549829ec9be225ce0b169d74459f232e8071461ae976c1e2b` |
| `tests/color.rs` | `ac8fefcdae5fdb8a67a3b64b27e8ca03287976ff43fd360b9796a73ad7c65606` |
| `tests/color_mix.rs` | `41de475071f27806ea31ecb6ebbd358ce2f897cbc8fe7fd398b588d3fb197d29` |

Independent source review found no blocking issue at the pre-format bindings and confirmed the final delta is only wrapping and optional trailing commas. Those source reviews did not execute Cargo and do not constitute platform approval or complete native acceptance. Actual rendered pixels, operating-system input/accessibility, the full GPUI workspace and the minimum supported Rust version remain outside these receipts.

## Newly exposed boundary remains open

The original complete test now stops at `border-[#e5e5e5_#e5e5e5_#fff_#e5e5e5]`, whose declaration is `border-color: #e5e5e5 #e5e5e5 #fff #e5e5e5`. The authored consumer is Bootstrap Select Separator (`packages/prototypes/bootstrap-2-3-2/src/select/separator.proto.ts`): different top and bottom colours are intentional. The CLI renderer emits a valid CSS four-edge shorthand.

The native mapper in `native/gpui/crates/proto-ui-gpui/src/style.rs` currently routes `border-color` to one `StyleRefinement.border_color` through the scalar colour parser. A four-edge shorthand is not one colour. Its smallest next owner is property/shorthand and native paint lowering. Choosing the first colour, rewriting the Prototype, deleting the all-vocabulary test or filtering Bootstrap would not establish the intended paint.

The release list places independent Bootstrap/native expansion in 0.4 when no committed 0.3 consumer depends on it. That scope distinction is relevant to this newly exposed token, but it does not automatically dispose of the existing red strong gate. Its owner must retain or explicitly reconcile that criterion. This change makes no such exemption and does not claim that this is the only remaining native failure.

## Evidence

`2026-11-24-gpui-two-color-mix-evidence.tar.gz` contains the original CI log, baseline/candidate raw Cargo logs, exact commands/tool versions, input/source bindings, independent reference-vector generator and outputs, candidate Rust source snapshots, and the independent source/format review reports. `manifest.json` hashes every member. The unchanged original full theme × vocabulary assertion remains in `tests/color.rs`; only its superseded two-colour Unsupported control now checks the still-unsupported LCH interpolation space.
