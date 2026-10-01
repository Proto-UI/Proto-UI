# Proto UI native workspace

Rust side of the GPUI host Adapter direction tracked in #687. It is a separate Cargo workspace, outside the pnpm workspace, so the Node toolchain never has to know about it and `cargo` never has to know about the package graph.

Current contents:

- `crates/proto-ui-host-protocol` — the host half of the version 0 protocol: wire types and the session state machine, with no GPUI dependency.

The GPUI translation layer, the style compiler and the fixtures arrive in later slices. The upstream revision this workspace will build against is recorded in `internal/records/2026-09-22-gpui-upstream-pin.md`; no crate here depends on GPUI yet.

## Conformance

`crates/proto-ui-host-protocol` is a port of `packages/host-protocol/src/model.ts`, not an independent design. Both are replayed against the same files in `packages/host-protocol/vectors/`, so a port that drifts fails on the side that drifted.

```sh
cargo test --workspace            # from native/gpui
pnpm exec vitest run packages/host-protocol   # from the repository root
```
