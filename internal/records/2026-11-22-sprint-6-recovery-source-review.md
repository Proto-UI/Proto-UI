# Sprint 6 recovery candidate — independent source review

This is a source-review receipt, not a native acceptance result or a formal final PR approval packet. The reviewer did not implement this slice.

## Exact reviewed candidate

- Parent: `647ee7ad7e3e343cf18fc488b10a9a8fb877a389`.
- Index tree: `0d8d72af9c46232f38be26f7aaa73ec293b668c0` (18 files).
- Patch: `sprint6-evidence/recovery-candidate.patch`, SHA-256 `6309d471833211d0e4d1d5ab3244239f4bcc9049da4e2c2c6de5ddcdef02b6fe`.
- These identities were independently read from the main repository index and local patch.

## Source conclusion

No remaining source blocker was found in the reviewed tree. The following changes preserve the original acceptance assertions:

1. Website theme updates require the exact renderer-owned theme entry. Authored nested tokens cannot acquire ownership by matching token names or palette values. The former dynamic test incorrectly expected an explicitly authored nested value to be overwritten; the revised oracle preserves that value and positively verifies the renderer-owned outer theme update.
2. The visible preview canvas additionally observes its physical device-pixel box. This is a finite event-driven signal for DPR-only changes; existing resolution media subscription, coalescing, and disposal remain. The local fault test does not establish a native browser result.
3. The material fixture reserves both adjacent expanded paint envelopes and its deliberate movement. The full-footprint negative first measures actual neighbouring host rectangles and rejects an overlapping premise. The original outside-host/inside-paint obstruction, recovery timeout, and clipping negatives remain.
4. Trace discovery falls back to the actual Chromium Perfetto descriptor only when required categories are missing from legacy discovery. The original five categories remain required. The parser rejects malformed fields and duplicate singular names within one category message; the `gpu` then `other` negative prevents falsely admitting an overwritten field. Separate category messages can legitimately repeat a name. No requested names are substituted for browser evidence.
5. Portal geometry waits at most 12 real frames for header/layout publication, retains all settling observations, and fails if settling does not occur. The original three-frame baseline, six-frame handover, content-width and 1 px geometry assertions remain.
6. The Bootstrap editor fixture places each native editor in an equivalent ordinary flow slot. The original paint deep equality, including `display`, remains; actual parent display is retained and grid/flex parents are rejected.
7. The separate Liquid controls lane has a fixed 31-case inventory, four actual Web hosts, explicit missing/duplicate/failure/error terminal handling, independent cleanup, and an exact candidate-SHA check. Its provider-free fallback/CDP-composition scope remains explicit.

The integrator reports 144 focused tests, 39 state-control/helper tests, 14 workflow checks and scoped browser TypeScript checking passed. This receipt does not replace those retained reports or claim the reviewer reran them.

## Native status and attribution boundary

The four original selected material/release failures at `9b6448e`, the two Bootstrap editor paint failures at `647ee7a`, and the four prominent-tint failures remain part of the evidence history. This tree has no new native pass in this receipt. The later exact candidate must be run through the real Actions lanes.

The changed fixture layout should be the common baseline for subsequent optical-profile performance comparisons. A cost change between different fixture layouts cannot be attributed solely to the shader/profile change.

The separately discovered Navbar Theme/Search visual defects in the `647ee7a` screenshots are outside this recovery patch and remain assigned to the Bootstrap follow-up. No full-family, Apple parity, 120 Hz, physical input-to-photon, Compiler, GPUI, Qt, Flutter, or external-application acceptance is implied.
