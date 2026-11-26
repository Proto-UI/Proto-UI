# GPUI upstream pin and toolchain probe

Date: 2026-09-22

Status: non-normative build observation for #687, following `2026-09-22-gpui-adapter-architecture-decision.md`. This record fixes no dependency, adds no crate to the repository, admits no `A-GPUI-*` profile, and makes no support claim. It records what was measured on one machine on one day so the next slice starts from evidence rather than from the crates.io metadata the decision record cited.

Refs: #466 (closed ruling), #687 (this work), #690 (decision record), #691 / #692 / #693 (protocol and peer slices).

## The pin

`zed-industries/zed` at `62e5991dd0f0c8a3af8d5e7e9c4652490d468db8` (`main`, 2026-09-22).

The decision record cited crates.io `gpui` 0.2.2, published 2025-10-22. That release predates both capabilities this work depends on, so it cannot be the dependency:

- the web platform for `wasm32-unknown-unknown`, merged 2026-02-26 in zed#50228;
- AccessKit support in `gpui`, merged 2026-05-27 in zed#56065.

A git revision is therefore required rather than preferred. This one was chosen because it was `main` on the day of measurement, and the probes below verify it specifically.

The merge dates bound when each capability entered upstream history; they do not make a later revision sufficient. A revision after 2026-05-27 may still revert, gate, rename or regress either capability, and this record verifies exactly one revision, not the set of all later ones. A re-pin must therefore re-check both capabilities on the revision it selects — at minimum that the accessibility API resolves and that the browser target still builds — rather than inferring them from a commit date. That is the same discipline the follow-up section already asks for at each conformance wave.

## What was measured

Host: macOS 26.6.2 on aarch64, Xcode Command Line Tools only (no full Xcode, no `xcrun metal`), `cargo` and `rustc` 1.96.1 stable.

### Native build

A throwaway crate depending only on `gpui` at the pin, with default features:

```toml
gpui = { git = "https://github.com/zed-industries/zed", rev = "62e5991dd0f0c8a3af8d5e7e9c4652490d468db8" }
```

```rust
fn main() {
    let _role = gpui::Role::Button;
    println!("gpui pin spike ok");
}
```

Result: 322 crates compiled in 46.93 s; the binary runs. Two facts follow.

- `gpui::Role` resolves, so the pin re-exports AccessKit. The accessibility API the decision record assumed (`role()`, the `aria_*` builders, `on_a11y_action`) is present at this revision and absent from 0.2.2.
- No `runtime_shaders` feature was needed. The decision record assumed that feature would be required to build without the Metal shader compiler; at this revision the macOS renderer goes through `gpui_wgpu` and the default feature set builds with Command Line Tools alone. `runtime_shaders` still exists, but on `gpui_platform` rather than on `gpui`, and this work does not need it.

The only warning is a future-incompatibility notice for the transitive `block` 0.1.6 crate. It is upstream's dependency, not a choice made here.

### Browser-target build of the core

The same crate, built as a library for `wasm32-unknown-unknown` with `gpui` at `default-features = false`:

Result: 287 crates compiled in 45.83 s on the **stable** toolchain, producing a 5,536,351-byte debug `.wasm`. Two facts follow.

- The `gpui` core itself needs no nightly toolchain, no `RUSTC_BOOTSTRAP`, and no `-Z build-std` to reach the browser target. Upstream's own example runner sets `RUSTC_BOOTSTRAP=1`, and community notes describe nightly plus `rust-src` as a requirement; at this revision that requirement comes from the threaded web platform, not from the core. This makes the single-threaded lane more plausible than the decision record assumed, and it makes gap 3 below the thing actually standing in the way.
- A debug artifact of a crate that only names one enum variant is **not** a size signal. Most of `gpui` is unreferenced here and release-mode dead-code elimination would remove it, while the real artifact links the whole host. The 25 MiB preview limit stays untested until a real host is linked.

### Crate layout at the pin

`gpui` no longer contains the platform backends. The workspace splits into `gpui`, `gpui_platform` (which routes per target to `gpui_macos`, `gpui_windows`, `gpui_linux`, `gpui_web`), `gpui_wgpu`, and `gpui_util`. Feature names moved with that split: `font-kit` and `runtime_shaders` are features of `gpui_platform` and its backends, not of `gpui`. An early probe that requested them on `gpui` failed resolution, which is how the split was found.

## Upstream gaps for the browser lane

Three gaps were identified by reading `crates/gpui_web` at the pin. Each blocks the browser lane described in the decision record, and each has a bounded upstream change that would remove it.

### 1. One canvas, one window, created by the platform

`prepare_canvas` creates a `canvas` element and appends it to `document.body`; `gpui_web` documents itself as a "single document-owned canvas with one top-level window". There is no parameter for an existing container element.

The decision record's browser architecture places one transparent page-level canvas under many previewer surfaces, which is compatible with a single canvas, but not with the platform choosing where that canvas lives. The website must own the element's position, stacking and pointer-events.

Bounded upstream change: accept an optional existing `HtmlCanvasElement` or container in the platform constructor and skip creation when one is supplied.

### 2. Input cannot be injected

Listeners are registered on the canvas (`pointerdown`, `pointerup`, `pointermove`, `pointerleave`, non-passive `wheel`, key events through a hidden IME mirror, drag, context menu), and `dispatch_input(PlatformInput)` is private.

The browser architecture needs input to arrive from DOM nodes layered above the canvas, because those nodes are also the accessibility surface and the focus truth. With listeners bound to a canvas that must be `pointer-events: none`, no input would arrive at all.

Bounded upstream change: make the existing `dispatch_input` entry point public, or accept an input source other than the canvas.

### 3. The multithreaded build cannot be switched off downstream

`crates/gpui_web` declares `default = ["multithreaded"]`. The workspace declares `gpui_web = { path = "crates/gpui_web" }` without `default-features = false`, so `gpui_platform` pulls it with defaults. Cargo features are additive, so a downstream crate that also depends on `gpui_web` with `default-features = false` does not remove the feature: it stays enabled.

This matters because the owner's five-year browser constraint and the repository's preview deployment both rule out shared memory. The preview pipeline strips `_headers` from the artifact and the trusted worker template sets no `Cross-Origin-Opener-Policy` or `Cross-Origin-Embedder-Policy`, so `SharedArrayBuffer` is unavailable there; its content security policy also sets `worker-src 'none'`.

Bounded upstream change: add `default-features = false` to the workspace `gpui_web` entry and forward an explicit `multithreaded` feature through `gpui_platform`.

Until these land, the browser lane needs a `[patch]` onto a fork carrying them. Carrying a patch is acceptable for a lane that is explicitly blocked on a separate admission; it is not acceptable as the long-term shape, and the patch should stay minimal enough to upstream as three small pull requests.

## What was not measured

- A `wasm32-unknown-unknown` build of `gpui_web` itself, single-threaded or otherwise. The feature gap above means a faithful single-threaded probe requires the patched fork first. The core builds for the target; the platform does not follow from that.
- Whether the WebGL2 path renders correctly. `gpui_wgpu` enables the wgpu `webgl` feature on wasm and ships `shaders_webgl.wgsl`, which decodes instance data from a texture rather than a storage buffer, so the shape is right; nothing here demonstrates output.
- Any Linux or Windows build. The decision record already pins the first fixture to macOS, and platform admission stays separate.
- Artifact size. The only wasm artifact produced was the unrepresentative debug probe described above, so the 25 MiB preview limit remains untested.

## Follow-up

1. Fork the pin, apply the three bounded changes, and re-run the browser probe single-threaded with a WebGL2 backend preference.
2. Record the resulting artifact size against the preview limit before designing the loading path.
3. Open the three upstream pull requests independently of this work's schedule; the protocol and host logic do not depend on their shape.
4. Re-pin explicitly at each conformance wave and record the revision, rather than letting a floating dependency decide.

Review trigger: a new pin, an upstream change that closes one of the three gaps, or a toolchain change on the development host.
