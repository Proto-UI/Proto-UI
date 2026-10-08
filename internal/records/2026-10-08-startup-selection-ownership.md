# Preserve untouched selection during startup typography

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

Scope: #872's two React delayed-upgrade ownership failures in official Quickstart run `37756502832` at `06d6ff33ba29fe57dcc3b62f236d021c961a868b`.

## Evidence and source defect

Both official failures retain the original code element, original text node and selection, but final focus is false. That does not prove that focus never blurred. The old harness wrote ownership JSON only after its assertion, so its failed run has no active-element/event trace that can uniquely identify the native focus transition.

The Website Typography owner captures the document-wide selection and unconditionally calls `Selection.setBaseAndExtent` after moving its own source nodes. This includes an unchanged selection inside `pre`, which target collection deliberately excludes. A selection rewrite may execute browser focus steps; retaining the same node and endpoints does not make that write a guaranteed no-op. The earlier focus restoration happens before the selection write and therefore cannot protect against that side effect.

The minimum repair compares both resolved directional endpoints with the current selection after the move. It restores changed endpoints exactly as before, including source-boundary remapping around retired wrappers. It leaves an unchanged selection alone. This changes neither Prototype semantics nor Adapter ownership, and does not impose a document-wide focus-restoration timer.

## Discriminating control and native verification boundary

Two source controls place a retained selection in code while a button or native anchor owns focus. They wrap the actual Selection setter with an explicitly injected focus side effect because Happy DOM does not model native browser selection focus steps. Both fail on the previous source's unnecessary setter call. The repaired candidate passes these controls and the full 29-test Typography suite. Together with 32 ownership, six harness-contract and eight geometry tests, 75 focused tests pass. This is source-level causal evidence for the defect, not proof of the official browser's exact path.

The native suite still requires all 18 cases and every original strict ownership fact, including `focused: true`. It now records initial focus success, bounded real focusin/focusout/selectionchange events, and the real Selection setter's before/after active element and call stack. The wrapper calls the original setter with the original receiver/arguments; it does not synthesize focus or selection. Original code/navigation identity remains independently observed. Raw before/after viewport captures use the existing CDP path, avoiding a whole-document font wait while scripts are paused. Facts and diagnostics are saved before assertions; failure PNG/JSON and trace are retained on errors.

An exact-head official rerun must establish whether this repair resolves the two native failures. If it does not, the recorded trace must drive the next diagnosis; no skip, weakened focus assertion or acceptance change is authorized. Local Chromium was not run or bypassed. Whole-tree types/build, final consumer wall and independent review remain with the combined candidate owner.
