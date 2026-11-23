# Native authored input atoms

This human-directed change follows the draft definitions in `C-A11Y-0001`, `C-EVENT-TYPE-0002`, `C-TEXT-CONTROL-0001`, `C-SCROLL-AXIS-SYNC-0001` and `C-COMPILER-SCALAR-INPUT-0001`. It moves generic physical support that had been edited only in a consumer's generated SDK into the upstream generator.

## Implemented boundaries

- Native activate maps to AccessKit Click. Explicit host routes remain explicit; Expose/default routes execute authored press policy before outward emission.
- A Boolean State controls accessibility fact applicability, including declaration replacement, initial/final-setup validation and fail-closed runtime omission.
- Text reset retires its editing lease while preserving controlled authority. Native UTF-16 selection and ordinary editing reject active composition and stale or foreign views. Tests cover retained IME handlers and reset history.
- Native scroll hosts can attach an existing physical ScrollHandle with an exclusive retained lease, so virtual lists keep one actual scroll surface. The existing callback-only axes sync API is lowered independently of policy.
- Checked scalar input syntax and readonly JSON output are lowered generically. Terminal branch effects no longer invalidate a distinct continuing flow path.
- Click/context modifier facts are forwarded without inventing pointer metadata for assistive activation.

`internal/compiler/gpui-authored-inputs.md` and `internal/compiler/gpui-scroll-host-binding.md` document the precise ownership boundaries. ControlLabel and actual official Base Button composition are a separate follow-up in this same task, not claimed by this checkpoint.

## Receipts at the local implementation checkpoint

Node 24.22.3 / Corepack pnpm 10.32.1:

- 100 tests passed: authored inputs (31), numeric A11y (23), ordinary flow soundness (36), reviewer flow recheck (10).
- 51 tests passed: scroll axis sync, GPUI SDK compatibility, native support capabilities, GPUI capabilities and diagnostic registry.
- Expression typing: 10 tests passed.
- Compiler-only TypeScript entry plus new test typecheck passed with a bounded configuration extending the repository tsconfig.
- Prototype catalog check passed. Agent snapshot generated from 1293 entities with Node's tsx loader; the tsx CLI IPC socket is unavailable in this sandbox.
- The real consumer producers successfully emitted unedited Rust from sources. Scroll producer includes 30 modules. These are generation receipts only.

The all-workspace TypeScript command was killed by resource limits and is not a pass. Native Cargo execution is pending on the user's separate native build machine: this workspace has insufficient free disk and another live build owns its cached Cargo target. Native test presence and generation are not reported as native success. Neither these host tests nor compile checks prove OS IME or platform accessibility delivery.

The newer upstream numeric provenance repair at `1061dc1` was integrated before the consumer pin checkpoint. After integration, 166 focused tests passed across authored inputs, numeric schema, every public emitter numeric admission, ordinary flow, reviewer flow recheck and scroll-axis sync. The bounded compiler TypeScript check also passed. Source-bound native receipts and review remain pending; no stable lifecycle or release acceptance is asserted here.
