# Reject stale Table projection continuations after synchronous reentry

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Review finding and reproduction

Independent review of `3b3afc5e2bd6c6fc1cc9971879f3e388f7dacec0` found `TABLE-REENTRANT-STALE-PROJECTION` (P2). A destination Table's legal custom-element `aria-rowcount` callback moves a just-transferred, still-connected row back to its source. Both roots then report three rows, but the outer destination `recompute()` resumes its old plan and writes row/cell index `4` and the destination header IDREF over the newer source facts. A same-domain span change from a root attribute callback exposes the same stale continuation.

The seven independent Table controls reproduce two failures on the reviewed source. The additional permanent 13-case suite reproduces eleven failures and two passing cleanup controls on that same source. It covers callbacks at root role/row-count/column-count writes; cell role, row/column index, row/column span and labelled-by writes; the connected cross-root round trip; caption withdrawal; terminal cell removal; and a second logical rebind during Table's own departure cleanup. These are real custom-element attribute callbacks in the installed HappyDOM host, not native-browser acceptance or manually injected expected State.

## Bounded correction

- Each root recompute owns a revision and its current domain. A nested recompute, lifetime end, or changed member scope invalidates the older plan. The old plan cannot continue into another member or overwrite a newer snapshot.
- Each part serializes its own State/A11y writes synchronously with a latest-wins pending projection. A reentrant request replaces the pending plan; the current external setter returns completely before the newer plan runs. Every State or relation setter checks both the part revision and the root/member lease. This avoids an older A11y setter's internal continuation overwriting a newer projection on the same physical part.
- A scope change is published before its cleanup writes. Reentrant cleanup cannot replace a newer scope with a captured old value. After a callback, the existing binding path re-reads actual logical ancestry, including when the renderer coalesces the next `updated` completion. The old root is still recomputed from its current inventory.
- Terminal release invalidates active plans and removes pending part writes. Clearing uses one guarded complete withdrawal rather than composing separately resumable row/cell/root clears. The existing author-value ownership, same-domain no-extra-recompute guard, and four-adapter semantics remain covered.

There is no timer, deferred microtask batch, observer filter, browser-specific Table service, new API, or acceptance deadline change. `C-TABLE-STRUCTURE-0001-CHURN`, `C-TABLE-STRUCTURE-0001-DOMAIN-ISOLATION`, and `C-TABLE-STRUCTURE-0001-A11Y-PROJECTION` retain their draft lifecycle and existing meaning.

## Validation and separate open boundary

The final focused selection passes 22 files / 148 tests: the previous 126 controls, the reviewer's nine independent controls, and 13 new permanent controls. The nine review-only tests were executed from exact local copies and are retained with the review artifacts rather than represented as newly committed tests. Six focused source/test roots and their imported graph pass TypeScript. Earlier non-triggering callback fixtures and the initial test-only superclass typing failure are retained as fixture/type corrections, not product failures.

A broader adoption probe remains an explicitly separate failure on both the reviewed source and this candidate: during WC `markProtoInstance`, an A11y target-change callback runs before the new logical-parent assignment; another physical move from that callback can be overwritten by the outer parent assignment. Its captured stack enters `notifySurfaceListeners`/`onTargetChange` before Table's State withdrawal, and the final physical and logical parents disagree. This change does not modify Base Adapter parent binding or claim to fix that boundary. The Table-owned departure test adds only a read-only expose to the official Cell setup so it can distinguish a genuine Table role-State withdrawal from that earlier Adapter notification; it does not suppress either report.

Independent re-review is still required. No 420-cell replay, native Matrix test/profile, whole-workspace build, or latency improvement is claimed. The previous Matrix timeout remains open, and all original native cases, assertions, and deadlines are unchanged.
