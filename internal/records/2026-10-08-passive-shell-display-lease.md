# Passive shell borrowed display lease repair

## Scope and authority

Review [#872 / 5454709394](https://github.com/Proto-UI/Proto-UI/pull/872#pullrequestreview-5454709394) identified that passive-shell teardown returned borrowed content to its original parent without restoring its inline display. The reproduced baseline is `1656d41d5bebd593f1082464ae38943228fde0bc`.

`D-HOST-PROTOTYPE-PROJECTION-SCOPE-0001` remains **draft**. Its `ATOMIC-GENERATION`, `FAIL-CLOSED` and `NEGATIVE-BOUNDARY` criteria guide this Website-local correction. No Prototype, Adapter, public API, renderer semantics or spec lifecycle changes.

## Observed failure and repair

The real shell composition wrote `content.style.display = 'contents'` in candidate setup, before publication. Normal teardown, failed first materialization, failed publication, and old candidate completion could therefore leave or overwrite the content owner's inline display. Returning the original node alone did not return its presentation state.

Display acquisition now occurs only during synchronous publication. A generation-bound lease retains the prior value, priority and absent/empty style-attribute state. Successful replacement inherits the original snapshot only while the current declaration is still owned. Rollback restores its immediate predecessor; final release restores the borrowed value only when the current value and priority still match the composition's own declaration. A newer external declaration is left intact. If a subsequent successful replacement explicitly borrows that declaration again, it becomes the new restoration target.

This is compare-and-restore ownership: an external write of the identical `display: contents` value and empty priority is indistinguishable from the owned declaration. No observer or renderer interception is introduced to invent stronger attribution. Unrelated external inline declarations remain intact.

Candidate setup only styles its own slot. Failed, stale and post-destroy materializations never acquire the borrowed display. Old candidate disposal is generation-guarded and cannot release a newer owner's lease. `destroy()` restores display and returns the original subtree synchronously before the content renderer tears down.

## Executable evidence

Node `24.19.0`, pnpm `10.32.1`, Vitest `2.1.9`, Happy DOM, one worker. Tests call the actual `createPassiveShellComposition`, real public SurfaceRoot Prototypes and installed WC/React/Vue/Vue2 Adapters. Pass-through loader and renderer wrappers inject only bounded delays or failures; setup remains real. These are DOM/inline-CSS observations, not native-browser cascade, layout, focus or paint evidence.

The expanded same-suite baseline produced **37 failures / 16 passes**. Every failing assertion concerned the leaked or overwritten display, its priority or style-attribute state. The repaired suite passed **53 / 53**.

Coverage includes:

- Absent/empty style attributes, ordinary display, `!important` priority and unrelated inline declarations.
- First materialization failure after actual setup, publication failure before and after content movement, and synchronous restoration on destroy.
- Failed replacement with the old shell retained, followed by a successful replacement and final restoration.
- Delayed first publication capturing current author state; external writes before setup failure, during publication rollback and before a later successful replacement.
- Late stale setup, late render completion after destroy, delayed old-renderer disposal and repeated destroy.
- Original content and uncontrolled input identities, input value, and original sibling order.

The six-file focused integration command passed **159 tests / 6 files**:

```sh
COREPACK_HOME=/tmp/corepack corepack pnpm@10.32.1 exec vitest run \
  apps/www/src/components/PrototypePreviewer/passive-shell-composition.test.ts \
  apps/www/src/components/PrototypePreviewer/runtime-preview-surface.test.ts \
  apps/www/src/components/PrototypePreviewer/projected-previewer-shell.integration.test.ts \
  apps/www/src/components/PrototypePreviewer/projection-scope.test.ts \
  apps/www/src/components/PrototypePreviewer/projection-theme.test.ts \
  apps/www/src/components/PrototypePreviewer/native-content-lease.test.ts \
  --maxWorkers=1 --minWorkers=1
```

A focused TypeScript check extending the repository configuration and including the changed implementation/test plus repository ambient declarations passed. This does not replace the full workspace/docs typecheck or final combined-tree CI. Formatting and whitespace checks passed.

## Carrier audit and remaining evidence

The only production caller is `runtime-preview-surface.ts`. Its recipe creates both the mount and the content's home wrapper independently of the original child demo. The existing width/min-width writes target those composition-owned carriers; the original child root's width/overflow remains renderer-owned. No additional carrier mutation issue was found in that call path, and those writes were left unchanged.

This is a separate follow-on increment. Native-browser visual evidence, independent final-diff review, final combined-tree checks and exact published-head CI remain separate. No screenshot is presented as evidence of this candidate. This work performs no remote/ref/comment mutation.

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.
