# Direct native ControlLabel checkpoint

The compiler now lowers the direct `asControlLabel` operations through generic
typed host atoms. Actual Base Button, Label and Input files compile unchanged
through this path. The native association reference never enters Props and does
not dispatch an Expose signal as input. The complete Input also gained its own
public lifecycle-safe `resetValue` operation in the preceding source commit.

This checkpoint additionally corrects two observed native input transport
defects: GPUI's `menu` name maps to `ContextMenu`, and a Button Space default
prevention request does not suppress its separate semantic press intent. Native
pointer press payloads retain all portable modifiers. Their consumers use
actual native events and compiled source, not emitted-string presence checks.

## Recorded local evidence

- 114 compiler tests passed across the authored-input, numeric accessibility,
  SDK compatibility, scroll-axis and direct control-label suites.
- Bounded compiler TypeScript checking passed when executed sequentially.
  An overlapping attempt was killed by the environment and is not a pass.
- All three changed ControlLabel specification entities passed schema checking;
  the prototype catalog checker passed.
- The official native producer emitted complete Button, Label and Input crates
  with one shared SDK. The input producer also emitted five compiled controls,
  including the physical pointer-modifier case. Neither producer edits Rust.
- The Input source commit has 60 passing runtime tests across Base, Shadcn and
  Brutalist Input, including 18 reset cases, plus its focused type-contract check.

Native execution for this new checkpoint is deliberately not asserted here.
The generated consumers and SDK library tests must be run against the pinned
GPUI source before publication. Test-platform execution is separate from OS
assistive technology and real IME delivery.

## Bounded support

See `internal/compiler/gpui-control-label.md`. Anatomy descriptors remain
explicitly unsupported, arbitrary native-view slot content is not assumed
passive for pointer activation, and the native label gets no independent Tab
or keyboard action. Naming and an explicitly enabled assistive action remain
available on its actual visible semantic subject under the exact pair lease.
