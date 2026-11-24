# Generated GPUI component validation

This workspace runs the compiler's generated Rust components against the GPUI revision used by Verdant. The generated crates contain ordinary Rust state, props resolution, callback methods, and `gpui::Render` implementations. They do not depend on the Proto-UI runtime or evaluate the compiler's HIR at runtime.

The compiler-time driver in the parent directory constructs `syn` syntax nodes and prints them with `prettyplease`. It does not use `quote!`, `parse_quote!`, or parse assembled Rust source. The driver has its own checked-in `Cargo.lock`; the TypeScript emitter builds it with `cargo build --locked` into a cache keyed by its source, manifest, lockfile, and Cargo version.

## Reproduce

Run from the repository root. The TypeScript test creates these fixtures through the actual frontend/target API and writes the Rust AST printer's output unchanged.

```sh
PUI_GPUI_ARTIFACT_DIR="$PWD/packages/compiler/native/rust-builder/test-support/generated" \
  corepack pnpm@10.32.1 exec vitest run packages/compiler/test/gpui-ast-codegen.test.ts

cargo +1.98.1 check --locked \
  --manifest-path packages/compiler/native/rust-builder/test-support/Cargo.toml \
  --workspace --all-targets

cargo +1.98.1 test --locked \
  --manifest-path packages/compiler/native/rust-builder/test-support/Cargo.toml \
  -p proto-ui-gpui-native-tests

cargo +1.98.1 check --locked \
  --manifest-path packages/compiler/native/rust-builder/test-support/generated/GpuiPinned/Cargo.toml
```

The first workspace inherits the actual Verdant fork: `cyjin-yl/z3rm@e5f2f9db75e97613232b5c1946333e61fa3828ab`. `generated/GpuiPinned` is a separate standalone workspace that checks the compiler's default dependency: `zed-industries/zed@62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`. These are separate validation results. Neither constitutes migration of the entire Verdant application.

Format the hand-written Rust packages with `cargo fmt -p proto-ui-rust-ast-builder` and `cargo fmt -p proto-ui-gpui-native-tests`, using the respective manifest paths. Do not format `generated/` manually: its exact bytes are produced by the standard AST printer.

## Native host API

Each generated `ComponentProps` has typed public `prop_<name>` fields of type `Option<Option<T>>`: `None` means missing; `Some(None)` means provided-empty; `Some(Some(value))` means a provided scalar. Host language types reject values of the wrong scalar type. Numeric range/non-finite and enum-domain failures still follow the compiled props fallback policy.

`Component::new(props)` resolves defaults and returns `Result`. The component stores native resolved values and previous-valid history per instance. `update_props(props)` applies a full raw snapshot. Missing values use defaults without reviving history; empty/invalid values use previous-valid values before defaults. `empty: accept` resolves to `None`; `empty: error` fails only if no non-empty fallback exists. `set_props(props, cx)` also notifies GPUI. The `read_prop_<name>` getters return `Option<T>`.

Native `host:click` listeners invoke the compiled action methods in declaration order, stop on validation failure, and notify GPUI. `take_error()` returns a callback validation failure to the host. Numeric discrete state follows the authoring contract: fractions and Infinity are allowed unless an explicit option/bound excludes them; NaN assignments are rejected. Number text uses the ECMAScript-compatible `ryu-js` formatter.

## Evidence and scope

The five TypeScript tests cover source-to-HIR-to-Rust emission, native props structures, numeric lowering, safe string literals, and structured rejection. The six Rust tests exercise actual GPUI input dispatch and `Render`, props history and instance isolation, signed zero/fractions/Infinity, invalid NaN assignment, ordered callbacks, and text literals.

`src/recorder.rs` is a test-only `PlatformTextSystem` implementation that records real GPUI text-layout requests and delegates layout to GPUI's `NoopTextSystem`. It observes the generated element tree reaching GPUI layout. It does not interpret HIR and does not claim pixel-rendering or screenshot coverage.

This target currently admits explicit `div`/`span` trees, scalar props/state, the supported typed expression/action subset, root `host:click`, and the supported independent style declarations. Overlapping style declarations are rejected until canonical cascade lowering exists. Boolean template children, semantic buttons/press intents, slots, lifecycle, watches, context, expose, range/step/clamp state, and other unlowered operations produce `PUI_GPUI_UNSUPPORTED`. Missing Cargo/driver, failed driver build, and rejected driver responses produce `PUI_GPUI_BUILDER001`, `002`, and `003` respectively.

The readable `.txt` receipts remove trailing whitespace only. Each corresponding `.txt.gz` file preserves the exact captured bytes.
