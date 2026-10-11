# Generic preview owned Portal theme projection

## Scope and authority

The native Modal receipt for `ce9b96d0f18e9635552efb3a075753bc38486d2c` in [run 38063650953](https://github.com/Proto-UI/Proto-UI/actions/runs/38063650953) showed Brutalist AlertDialog Action and Cancel with transparent backgrounds despite their distinct semantic tokens. The Website canvas carried the correct family variables, but the explicit Content/Mask portals left that physical ancestor. This record describes a Website consumer repair, not a new automatic Adapter theme-inheritance guarantee.

`C-HOST-SURFACE-PROJECTION-0001` F, `C-PROTOTYPE-STYLE-CLOSURE-0001` and `D-HOST-PROTOTYPE-PROJECTION-SCOPE-0001` PORTAL-CLOSURE remain **draft**. The Web Component README documents physical-destination theme inheritance. Existing normalized surface projection is the supported path for consumer presentation intent; logical Context/Anatomy do not transport arbitrary CSS inheritance.

## Bounded change

- A DemoNode can explicitly declare `previewTheme: 'portal'` with a unique nonempty ref. Only the actual Brutalist AlertDialog Content/Mask opt in. No component-name, route, token or Prototype-family heuristic discovers targets.
- The existing resolver/watcher still produces the only theme input. Generic composition supplies that complete map through each owned node's `surfaceStyle`; authored style entries remain later overrides. The demo's source tree, setup, behavior ownership and cleanup are retained.
- Only opted-in styles normalize string/mixed-array declarations to a record. CSSOM parses declaration strings; equivalent camel/kebab names are canonicalized per entry, custom property case is retained, and repeated declarations move to their last position so shorthand/longhand order is preserved. Object empty strings clear declarations; empty CSS declarations retain CSSOM behavior. This avoids an observed pre-existing Vue 2 mixed-string array problem without changing unmarked nodes or `api.setProps`. Important declarations remain rejected before parsing.
- The four Website renderers expose an independent `api.setSurfaceStyle` channel, forwarding into their existing normalized Adapter props. It never writes a DOM ref as a substitute for the presentation surface. The optional type member preserves compatibility with legacy/custom setup hosts; a marked composition rejects a host lacking the channel.
- Current appearance is replayed across framework acquisition and physical Portal reappearance. Updates after disposal or host replacement are ineffective. Independent demo scopes and authored style overrides remain isolated.
- Pending/failed different-family shell requests cannot prematurely recolor retained owned surfaces. The Website passive-shell composition now offers an optional synchronous appearance publication/rollback lease at its existing scope-controller commit boundary. The exact candidate theme map and generation receipt publish before content migration can synchronously reenter; rollback restores owned input before returning content. Same-family changes use the actual controller receipt; nested updates cannot be overwritten by an outer completion. Existing callers without the callback retain their old path. This does not add a second theme resolver or replace the shell transaction controller.

Base, shared Adapters, Runtime, Compiler, CLI, global theme/body values and the official Finf browser suite are unchanged. Overlay-owned scroll locking may still alter body overflow as before.

## Independent review correction

The first local candidate tree `7c51625df8c8564a348e444f36ddc8f43b6cc8b5` was rejected and remains unpublished. Independent review found four-renderer failures for mixed camel/kebab aliases (`410px`, `420px`, `430px` incorrectly ended at `420px`), repeated shorthand ordering, and synchronous reconnect reentry from committed family B into a failed return to A. Its prior green tests missed those cases; Promise-tail family bookkeeping was insufficient.

The replacement follows the transaction boundary already described in `internal/records/2026-10-05-passive-shell-theme-transaction.md`, rather than promoting candidate preparation to commit. The reviewer's unchanged twelve external counterexamples now pass. Added author controls cover aliases, case-sensitive custom properties, vendor-key normalization, empty/removal semantics, forbidden priority, callbacks before/after content migration, nested updates, partial normalized publication failure, rollback failure and successful retry. A further four-renderer red control showed that synchronous destruction inside appearance publication could briefly reconnect retired content; an alive check before migration now lets the existing controller revoke that generation without reconnecting it. Original no-callback shell tests continue to exercise the old API. These results still require independent review of the replacement exact tree.

## Evidence and limits

The initial four-renderer red control measured the actual rendered Mask missing `--pui-radius` (`''` instead of `5px`). The candidate supplies every map key to Content/Mask, preserves mixed authored padding/width/radius overrides, follows the real theme watcher from light to dark while open, and retains current values after close/reopen. Additional cases cover appearance during pending framework mount, independent scopes, removed theme keys, source-tree immutability, host replacement, old APIs after disposal, invalid ownership refs and failed family replacement followed by successful retry.

These are installed-framework/real-Adapter DOM tests in Happy DOM. They prove explicit normalized inputs and lifecycle effects, not native computed paint, font loading, pixel appearance or full browser accessibility/focus acceptance. The watcher fixture follows the real client's order: subscribe after the initial shell is ready. Earlier fixtures subscribed during initial shell preparation and produced intermittent missed observation; those failures are retained in the local evidence packet, not relabeled as native regressions.

The broader Previewer suite also exposes eight existing `select-draft-projections.integration.test.ts:141` toolbar-marker failures. An independent clean worktree at the exact ce9 baseline reproduces all eight (2 pass / 8 fail); this repair does not change those assertions or repair that separate path.

A sandboxed local Chromium launch fails with `socket() failed: Operation not permitted` and SIGABRT. No sandbox bypass was attempted. Native light/dark/open/reopen paint, the unchanged Action/Cancel color distinction, 5px radius/DM Sans, and fresh screenshots remain exact-published-head CI evidence debt. No old screenshot represents this candidate. Local source/type/format results and raw red/green logs are bound in the parent review packet; final publication, DCO hooks, independent review and CI remain separate gates.

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.
