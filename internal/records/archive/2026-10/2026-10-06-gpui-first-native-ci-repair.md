# First Finf native CI repair

Date: 2026-10-06. Agent: dot; ModelTrace: not measured under the owner's current exemption.

Source: Finf PR #872 head `15d864de54210c2eebc4f4b2fec6235324989989`, tested through merge checkout `2eca14bb8995748c06a97e079304a4a082fce590` in [CI run 37518189128](https://github.com/Proto-UI/Proto-UI/actions/runs/37518189128).

## Actual result

- `rust` stopped at the format check. Its authorized diagnostic step ran the repository's Rust formatter and uploaded `gpui-rustfmt-15d864de54210c2eebc4f4b2fec6235324989989` (artifact 11438382393).
- `rust-macos` Clippy and `rust-interop` compilation both rejected six pointer-coordinate reads through private `gpui::Pixels.0` fields in `host.rs`. This was a compile failure, not a failing Label runtime test.
- The protocol-only real T0 `t0_peer` test ran and passed (1 test). The GPUI Button suite could not compile; subsequent GPUI suites, including Label, and the macOS accessibility/pixel stage did not run. No native screenshot was produced.

## Repair

Apply the exact seven-file formatter patch returned by CI, then replace the six private field reads with the public `Pixels::as_f32()` API. The method is present at the unchanged upstream pin `62e5991dd0f0c8a3af8d5e7e9c4652490d468db8` in `crates/gpui/src/geometry.rs`; it preserves logical pixel units rather than converting to physical pixels or rounding.

No GPUI source, Cargo dependency, toolchain requirement, semantic contract or test expectation is weakened. The local workspace still has no Rust toolchain, so native compilation, Clippy, format and runtime results for this repair must come from the next exact-head CI. `git apply --check` and `git diff --check` pass locally. Earlier TypeScript checks do not substitute for these pending native stages.

The first CI's unrelated Focus test type errors were routed to the Focus owner rather than edited in this packet. Full GPUI parity, genuine AccessKit relationship edges, passive selection and focus reentrancy remain open as recorded in the parity plan.
