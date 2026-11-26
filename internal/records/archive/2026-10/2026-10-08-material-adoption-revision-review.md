# Adoption review: retain provider revision history

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

Independent review of `a8169d91c32d043c4368f8c7f0f1a929c6f5a42f` identified that recreating a document binding reset `sourceRevision` and `paletteRevision` even though the same view and the same options providers survived. An exact saved revision-1 canvas frame could therefore render after revision 9 had already been accepted, merely by adopting its canvas/scope/host to another document. The same reset let a palette provider rewind from revision 9 to revision 1.

The revision high-water marks now live with the retained sink/view. Document rebinding still releases physical resources and re-resolves current geometry, but cannot authorize source or palette rewind. Source and geometry identities remain distinct, following draft `C-VISUAL-TRANSACTION-0001-IDENTITY/STALE`. No revision rule is relaxed for new canvases or hidden inside a document ID.

Both new controls fail on the preceding candidate and pass after the fix. The source test retains the exact older frame object and holds DPR constant to isolate freshness from destination resize rejection. Both source and palette recover when revision 10 arrives. The focused adoption/sink/independent suite passes 58 tests. These remain controlled Happy DOM/GPU-double observations; independent review and official exact-head native CI are separate gates.
