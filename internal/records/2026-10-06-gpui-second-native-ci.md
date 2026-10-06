# GPUI: second exact-head native CI

Agent: dot. ModelTrace: not measured (owner-authorized exemption).

Source: `689c5614608b1ec0391a70f6c9f69c8b29361f32`, CI run
[37521369232](https://github.com/Proto-UI/Proto-UI/actions/runs/37521369232).

## Actual results

- PASS: Rust formatting and Linux/macOS Clippy. The original six private
  `Pixels.0` reads are repaired using the upstream public `as_f32()` method.
- PASS: [rust-interop job](https://github.com/Proto-UI/Proto-UI/actions/runs/37521369232/job/112467322524),
  including the real Node peer plus GPUI T0 Label suite: **5 passed, 0 ignored**.
  Cases cover Checkbox activation/focus and current computed naming, controlled
  Switch behavior, disabled qualification, drag/secondary/modifier rejection,
  and association removal. This does not establish a native AccessKit relation
  edge, reentrant synchronous focus, other targets or real window pixels.
- PASS: exact-head TypeScript check.
- FAIL: Linux length inventory encountered the new valid Dialog mixed-basis
  min expression. The parser correctly reported `NeedsBasis`, while the old
  inventory assumed all current valid expressions could resolve symbolically.
- FAIL: macOS style-map tests referenced the retired `left-1/2` source token
  and had not recorded the new Dialog max-height/max-width value-level gaps.
- NOT RUN: real macOS AccessKit step and Label PNG capture were blocked by the
  preceding test failure. The job's uploaded metadata is not pixel evidence.

## Bounded repair

Keep the two percentage semantics tests, using a still-current token for
Feedback (`left-[100%]`) and a synthetic 50% declaration for the pure map.
Track the exact one-element `NeedsBasis` source set, separately from invalid
CSS, so new or disappearing gaps still fail. Add the exact two unsupported
available-space values to the native inventory and a negative control proving
that neither is truncated to a plain fraction.

This changes only tests and this record. It does not claim that passing the
inventory implements native `HC-AVAILABLE-SPACE-0001`, min/calc lowering,
Dialog layout or any remaining native material capability. Those real
capabilities remain required and unchecked. The follow-up's Rust tests and
formatting still require the original-pin CI; no local Rust execution occurred.
