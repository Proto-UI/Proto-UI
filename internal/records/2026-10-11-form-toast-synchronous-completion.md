# Form and Toast synchronous completion verification

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.

Base: `8a25c1f2a8c70d806afa83de5bac2af389763676`. Local-only candidate; no remote write.

## Findings and bounded repairs

- Form: actual Web Component/Runtime state subscribers changing the control at pending=false or submitted=true caused the final submit payload to contain an unvalidated value. Completion now derives the payload from the same entries snapshot used for validity checks. It preserves later field edits as live state rather than overwriting them.
- The completion also yields after each synchronous notification if cancel/reset/disable, terminal disposal, or a newer submission retired its authority. Nested requestSubmit remains permitted; its own ID wins. No callback exception is swallowed.
- Toast: ordinary DOM removal was not a reproducer because that host path does not synchronously terminally dispose the Action. A direct real Runtime fixture with synchronous disposal in the application event sink reproduced an invalid `run.anatomy.partsOf` continuation. The Action now ends that continuation when its mounted view epoch changes. Ordinary action ordering remains action intent, transition beforeLeave, openChange; fresh remounted input still works.

The independent portable responsibilities are in the new draft transitional contracts `internal/contracts/prototype-base/form-completion.v0.md` and `toast-action.v0.md`. Form/Toast are not yet cataloged as admitted prototype entities. This change does not claim stable admission and edits no Compiler, IR, Adapter, Runtime, or Module implementation.

## Evidence

Node v24.19.0; already installed Vitest v2.1.9. Isolated worktree workspace links point to this worktree's own Proto sources. No new third-party source was downloaded or executed.

- Final new regression file against unchanged base: 10 failed / 3 passed, including exact unvalidated-value payload, stale canceled/nested submission, Runtime disposal, and stale unmount/remount dismissal assertions. Against candidate: 13 passed.
- Eight focused test files: 64 passed. Files: form-toast-reentry, form-primitives, form-composite-controls, form-actions-material, form-field-invalid-feedback, form-family-projections, form-composite-family-projections, navigation-overlays/controls.
- Existing `form-actions-quality.test.ts`: 8 failed / 5 passed both at base and candidate. These are passive recipe/physical CSS expectations, outside this logic repair. They were not changed, hidden, or reclassified as passing.
- `tsc -p packages/prototypes/base/test/tsconfig.form-projection.json --noEmit`: passed.
- Workspace tsc: blocked by two absent generated shadow-style modules at shadow-s3/admission.ts and shadow-s4/dialog.ts. Full website generation/build and native browser evidence not run.
- Prototype catalog: fails on existing uncataloged-protocol debts. Full base/candidate diagnostic outputs compare byte-identically. This is not catalog admission evidence.
- `git diff --check`: passed.

Tests exercise actual Runtime and actual Web Component integration in synthetic hosts. They are not native-browser, all-Adapter, Compiler/GPUI, screenshot, packed-consumer, or CI evidence. The custom Runtime event target directly calls registered listeners so callback exceptions cannot be hidden by DOM exception reporting. Root-only terminal retirement with a surviving Action remains a distinct boundary, not certified by this Action-local repair.

Next: independent exact-tree review, then an authorized publisher may integrate; preserve all baseline failures and re-run combined evidence if the target head changes.
