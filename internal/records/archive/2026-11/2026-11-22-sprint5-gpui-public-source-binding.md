# Sprint 5 GPUI public candidate and runtime source binding

This follow-up binds the GPUI implementation and the actual Verdant consumer to public compiler revision [`ecf057b681e8b2eeaa43ef36bf6d2c5a060a4d81`](https://github.com/Proto-UI/Proto-UI/commit/ecf057b681e8b2eeaa43ef36bf6d2c5a060a4d81), tree `41dad8f7c40e7bbc0652d4f3b6cea8f1a675da18`. It supplements the [original source delivery record](2026-11-22-sprint5-gpui-source-delivery.md), retaining the identities and results of the original processes. The acceptance source is this published code candidate; later record-only commits do not require an unpublished compiler pin.

## TypeScript fixture correction and actual native rerun

The independent full-workspace typecheck found five errors in `scalars.proto.ts`: two intentionally out-of-domain `includes` needles and three accesses through TypeScript's unknown catch value. Broader receiver declarations were rejected by the canonical finite-string-array admission, so the correction preserves the admitted finite array. The two deliberate ECMAScript negative controls now carry specific `@ts-expect-error` explanations. The catch block only throws its authored string literal, so three erased `as string` assertions give TypeScript the established local fact. No runtime operand, exception, expected value or native assertion changed.

TypeScript 5.9.3 produces byte-identical JavaScript before and after this correction when types and comments are removed: SHA-256 `f31f80d5e7fae3a18f9722af5444cc2dab3365c5c1d73f224ae26658c986d2ab`. The scoped fixture typecheck passed with zero diagnostics, and the existing canonical GPUI scalar tests passed **14/14**. These are scoped results; the independent integration run owns the full-workspace typecheck result.

Regeneration changed `scalars/Component.rs` and its original generated Cargo manifest. The other **108 of 110** compared files, including the independent Node scalar oracle, remained byte-identical. The actual native consumer was therefore rebuilt and rerun: **29 generated modules, 39 tests passed, zero failed and zero ignored**. Compilation took 43.53 seconds, and the tests took 0.84 seconds. This process used implementation `5da7a4d254544543040c209fad7c9d63f85fda80` plus the precise fixture patch recorded in [validation.json](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint5-gpui-public/validation.json), not an invented process at a later integration commit.

The [retained native log](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint5-gpui-public/native-tests.log.gz) has uncompressed SHA-256 `0a02c23d90de856a46a434020a3d59df1ef87e5028c575df2131ade2efc75e5c`. Expected caught panics remain in the log, including the unsupported physical FocusEntry negative control; they were not removed or reclassified as physical support.

## Binding those bytes to the published compiler

A fresh detached checkout of `ecf057b6` installed the frozen dependencies offline, remained clean, and ran the unchanged native producer. The [complete comparison](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint5-gpui-public/equivalence.json) records:

- **110/110 emitted source, support and test files equal** to the latest actually executed native artifacts.
- **All 29 consumer Cargo manifests and the lockfile equal**, in addition to the original generated manifests already included in the 110-file comparison.
- **The full producer receipt equal**, including the source hashes, mutation negative control, Node oracle and current Base Button unsupported-consumer diagnostics.

The [exact producer receipt](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint5-gpui-public/native-source-receipt.json.gz) is retained without formatting changes. This establishes byte equivalence to the published source candidate; it does not claim a second native execution at that commit.

The refreshed [operation and lowering inventory](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint5-gpui-public/source-lowering-inventory.json) is generated from this same clean public source. It accounts for all **194 operation declarations**, **183 GPUI profile declarations**, **29 generated modules**, expression/statement/intrinsic families and the content-bound SDK. Declarations and generated demand remain distinct from per-operation runtime conformance. Full native record/array representations, reached helper source selection and retained optimized link/initialization costs remain unfinished as documented in the original record.

## Actual OpenGreendam/verdant consumer with a public pin

The application source remains the explicit public revision [`91a775546ebd21a87d76d76568195a6513437719`](https://github.com/OpenGreendam/verdant/commit/91a775546ebd21a87d76d76568195a6513437719). The original application compiler pin was `e56b2d1a3d6b688a1cbc6930dab1d6757304d733`. The original public checkout and unrelated active Verdant worktrees were not changed.

The real App and Session migration previously passed the ordinary application build and **158 App + 24 Session tests, 182 total**, with zero failures and zero ignored tests. That migration supplies the actual mounted `PitchGestureSurfaceHandle` to the Session and device planners; it does not restore an owner-free API, copy the gesture reducer, or patch emitted Rust. The [retained App/Session log](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint5-gpui-public/verdant-tests.log.gz) preserves the actual process output. The original worker build, ready/capabilities/shutdown probe with empty resources and executable `--help` result keep their original source bindings in [validation.json](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint5-gpui-public/validation.json).

A separate application candidate now pins the published compiler revision `ecf057b6`. Its unchanged producer and original `--check` both passed from the clean public compiler checkout. **All 20 generated artifacts are byte-identical** to the artifacts consumed by the actual 182-test application run. A comparison of **746 application files** found exactly two changes from the executed candidate: `frontend/proto-ui/compiler.pin.json` and the producer receipt. Rust application sources, generated Rust, Cargo manifests and the Cargo lockfile are unchanged. The generated package remains `generated-gpui-49e4bc3d059f93b183b577ae8ca52b4f`, using the application's actual single workspace GPUI fork at `e5f2f9db75e97613232b5c1946333e61fa3828ab`. The fixture GPUI pin at `62e5991dd0f0c8a3af8d5e7e9c4652490d468db8` is a separate dependency graph.

The [complete public-pin application patch](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint5-gpui-public/verdant-candidate.patch.gz) applies cleanly to the fixed application source. Its uncompressed SHA-256 is `87b162ad50ada6e60bbdebef4f6c0451235cf490375abfd4c0f3525d39d6cfb2`, and its candidate index tree is `1ef5b23667f165a07bc9398a130d433656b13ca3`. The [exact final producer receipt](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint5-gpui-public/verdant-receipt.json.gz) is retained. This is a reviewable isolated application candidate; it does not claim that Verdant has accepted, published or merged the migration.

To reproduce the application route, apply that complete patch to the fixed public Verdant source, use a clean Proto-UI checkout at the published compiler revision with its declared Node 24 / pnpm 10.32.1 dependencies, and invoke the original producer:

```sh
node frontend/proto-ui/tools/build-proto-ui.mjs --upstream /absolute/Proto-UI
node frontend/proto-ui/tools/build-proto-ui.mjs --upstream /absolute/Proto-UI --check
cargo +1.98.1 test --manifest-path frontend/Cargo.toml --locked -p verdant-app -p verdant-session
```

The ordinary Linux development libraries and the single pinned GPUI graph are required. The prior run preserved the App's existing font-kit/X11/Wayland features and supplied genuine missing development libraries; no feature was disabled to obtain a pass.

## Retained boundaries

These results exercise real compiler-produced Rust, actual GPUI framework owners and the real Verdant consumer. `TestAppContext` is not an OS-visible window, physical pointer/IME, audio device or assistive-technology acceptance. The local Xvfb socket failure remains a failure, and no remote window result is invented. The independent GPUI Adapter route, current Base Button ControlLabel native association, complete per-operation/native platform conditions, and the explicitly owned Qt/Flutter packages in the original record remain separate. No parent issue is fully closed by these source-binding receipts.
