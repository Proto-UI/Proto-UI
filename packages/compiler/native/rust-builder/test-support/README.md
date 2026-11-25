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

cargo +1.98.1 check --locked \
  --manifest-path packages/compiler/native/rust-builder/test-support/generated/GpuiExpandedPinned/Cargo.toml
```

The first workspace inherits the actual Verdant fork: `cyjin-yl/z3rm@e5f2f9db75e97613232b5c1946333e61fa3828ab`. `generated/GpuiPinned` and `generated/GpuiExpandedPinned` are separate standalone workspaces that check the compiler's default dependency: `zed-industries/zed@62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`. The expanded fixture includes native children, created/props-watch callbacks, and numeric range/step policies. These are separate validation results. Neither constitutes migration of the entire Verdant application.

Format the hand-written Rust packages with `cargo fmt -p proto-ui-rust-ast-builder` and `cargo fmt -p proto-ui-gpui-native-tests`, using the respective manifest paths. Do not format `generated/` manually: its exact bytes are produced by the standard AST printer.

## Native host API

Each generated `ComponentProps` has typed public `prop_<name>` fields of type `Option<Option<T>>`: `None` means missing; `Some(None)` means provided-empty; `Some(Some(value))` means a provided scalar. Host language types reject values of the wrong scalar type. Numeric range/non-finite and enum-domain failures still follow the compiled props fallback policy.

`Component::new(props)` resolves defaults and returns `Result`. The component stores native resolved values and previous-valid history per instance. `update_props(props)` applies a full raw snapshot. Missing values use defaults without reviving history; empty/invalid values use previous-valid values before defaults. `empty: accept` resolves to `None`; `empty: error` fails only if no non-empty fallback exists. `set_props(props, cx)` also notifies GPUI. The `read_prop_<name>` getters return `Option<T>`.

Native `host:click` listeners invoke the compiled action methods in declaration order and stop on validation failure. State writes do not request a template update. Writes used by rules can repaint Root feedback through the separate path described below. An authored `run.update()` records an instance update request, which the native listener consumes to call `cx.notify()` after its callback sequence. Host `set_props` and `set_children` request their own native updates. `take_error()` returns a callback validation failure to the host. Lowered synchronous helper calls become immediately invoked Rust closures, preserving their own early-return scope and propagating validation failures.

Template reads use a committed props/state snapshot. Native pointer frames and child-only projection updates cannot expose state changes before a Proto update. The initial snapshot is captured after created callbacks; an explicit update captures inputs at that statement; `set_props` captures the host props commit after resolution and watchers. Rule feedback has a separate path: writes to a state used by a rule mark Root feedback dirty and request native repaint, while template reads retain their previous snapshot. Root rule conditions use live state and committed props. The rule test inspects actual GPUI painted quads as well as text layout.

The admitted request must be terminal on every callback path and occur at most once. Admission checks the entire same-event handler sequence, preserving each handler's return boundary; resolved watchers are checked conservatively in registration order. An early request followed by another action would require the render snapshot captured at that exact point, so it is rejected. Created-time requests are also rejected until an appropriate native context/initial-render protocol exists.

Numeric discrete state follows the authoring contract: fractions and Infinity are allowed unless an explicit option/bound/positive-step policy excludes them; NaN assignments are rejected. Nonempty options take precedence over bounds and step. Range `clamp` only normalizes the initial value; subsequent invalid writes fail and retain the previous value. Number text uses the ECMAScript-compatible `ryu-js` formatter.

Every component has a distinct native host Root. A template element is a child of that Root, with its own style cascade. Root feedback and event handlers remain on the Root. Fragments and empty output retain that container. A template may contain at most one anonymous slot. Slot-bearing components expose a native `ComponentChild` enum with `Text(String)` and `View(gpui::AnyView)` variants plus `set_children(Vec<ComponentChild>, cx)`. Projection preserves their order and Entity identity; replacing the vector releases its owned handles through GPUI's normal ownership rules.

`created` callbacks run once after props hydration and before the component's first render. Initial hydration does not invoke props watchers. Later full snapshots compare resolved values using `Object.is` semantics, including distinct positive and negative zero. Matching keyed and all-prop watchers run in their shared declaration order. Previous resolved snapshots are stored separately from previous-valid fallback history. Watcher errors stop later callbacks; preceding live state changes and resolved values remain readable, while the template retains its last successful commit. These capabilities do not imply mount/unmount or commit-phase lifecycle support.

## Evidence and scope

The TypeScript tests cover source-to-HIR-to-Rust emission, the actual Base Text and Surface source files, native props/children, numeric policies, callback scheduling, helper return scopes, safe string literals, and structured rejection. The Rust tests exercise actual GPUI input dispatch and `Render`, mixed native child identity and release, Base props/content, created and resolved watchers, explicit update notifications, props history and instance isolation, numeric edge cases, callback order, and text literals. The current receipts give exact executed counts and dependency pins.

`src/recorder.rs` is a test-only `PlatformTextSystem` implementation that records real GPUI text-layout requests and delegates layout to GPUI's `NoopTextSystem`. It observes the generated element tree reaching GPUI layout. It does not interpret HIR and does not claim pixel-rendering or screenshot coverage.

This target admits `div`/`span` trees, fragments, one anonymous native children slot, scalar props/state, the supported typed expression/action subset, root `host:click`, created callbacks, resolved props watches, and the supported independent style declarations. Fully lowered authored hooks can use those same operations. Overlapping declarations on the same element are rejected until canonical cascade lowering exists; independent Root and template styles do not conflict. Boolean template children, semantic buttons/press intents, mounted/updated/unmounted/dispose callbacks, raw watchers, context, expose, anatomy, and other unlowered operations produce `PUI_GPUI_UNSUPPORTED`. Missing Cargo/driver, failed driver build, and rejected driver responses produce `PUI_GPUI_BUILDER001`, `002`, and `003` respectively.

The readable `.txt` receipts remove trailing whitespace only. Each corresponding `.txt.gz` file preserves the exact captured bytes.
