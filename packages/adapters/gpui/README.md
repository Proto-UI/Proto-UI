# @proto.ui/adapter-gpui (spike)

**Discussion draft — do not adopt.** Companion to the port-strategy ruling requested in
issue #466 and the design note in `docs/superpowers/specs/2026-08-22-gpui-adapter-spike-design.md`.

This package validates that a TypeScript-hosted GPUI bridge can satisfy the Proto UI
adapter contract for one vertical slice (Base Button). It is intentionally
`private: true` / `protoUi.release.scan: false`; it must not ship until #466 is ruled on.

See the design doc for cap mapping, omissions, and the deterministic bridge harness.
