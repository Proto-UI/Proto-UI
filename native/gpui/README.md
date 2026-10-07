# Proto UI native workspace

This separate Cargo workspace contains the real Rust side of the GPUI host Adapter direction tracked in #687 and the unified parity work in #872. It is outside the pnpm workspace, but the T0 interop tests also require the repository's Node dependencies.

Current crates:

- `crates/proto-ui-host-protocol`: bounded wire messages, framing and the session/epoch/lease state machine, without a GPUI dependency.
- `crates/proto-ui-style`: source-recorded token/theme data, color and length resolution.
- `crates/proto-ui-gpui`: actual GPUI layout, host-owned composition, native pointer/key routing, focus, a bounded AccessKit projection and T0 host orchestration.

GPUI and its platform backend are pinned in `Cargo.toml` to `zed-industries/zed@62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`. The companion private TypeScript package is `packages/adapters/gpui-peer`; it runs the existing Runtime semantics. It is not a second Rust semantic Runtime or an admitted public Adapter package.

The source includes end-to-end T0 tests for Button, Toggle, Switch, Tabs, Transition and Checkbox. The current Label candidate adds a dedicated typed association channel, native view leases, and Checkbox/Switch tests. Its exact-head native and accessibility results must be read from CI before treating it as verified. Full Base coverage, all styled-family projections, text/IME/scroll/overlay, complete A11y, native material, native Compiler parity and a deployable native gallery remain unfinished.

In particular, recorded theme/token availability, a successful layout/paint callback, a rejected unsupported declaration, or a Web preview does not prove native visual/material conformance. See `internal/records/2026-10-06-gpui-parity-and-liquid-glass-plan.md` for source-bound gaps and the implementation sequence.

The root-content AvailableSpace candidate now carries separate Module, peer-view and opaque lease generations. The actual window root uses one `Window.fully_visible_bounds()` frame for max-size and the exact fixed-center recipe. It withdraws unknown or retired geometry and checks the real root entity. Nested physical roots, consumer-positioned roots, general fixed/transformed surfaces, anchored Select/Popover positioning and complete Dialog/Overlay behavior still require their corresponding implementation and native acceptance. See `internal/records/2026-10-07-gpui-available-space-reconstruction.md`; passing protocol tests alone does not close those gaps.

## Verification

Run from the repository root for peer/protocol tests:

```sh
corepack pnpm@10.32.1 exec vitest run packages/host-protocol packages/adapters/gpui-peer
corepack pnpm@10.32.1 check:gpui-message-fixture
corepack pnpm@10.32.1 check:gpui-session-fixtures
```

Run from `native/gpui`:

```sh
cargo fmt --all --check
cargo test -p proto-ui-host-protocol -p proto-ui-style
cargo test --workspace
cargo test -p proto-ui-gpui --test control_label_t0 -- --ignored --test-threads=1
cargo test -p proto-ui-gpui --features macos-accessibility-test --test accesskit_macos
```

The full GPUI workspace is currently verified on the macOS lane. `cargo test --workspace` does not run ignored T0 tests or the feature-gated real-window accessibility test. `.github/workflows/ci.yml` runs Linux protocol/style checks, macOS GPUI checks, and a separate T0 interop job. Those jobs require an actual nonzero test result.

The Rust protocol and TypeScript protocol replay shared vectors. Message and session fixtures are generated through `scripts/gpui`; never edit their JSON manually. Native CI, OS accessibility, decoded pixels, performance, and public support admission are distinct evidence boundaries.
