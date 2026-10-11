# Finf B: first overlay source slice

Agent: dot  
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

Baseline: `5dab3a9ea0e5a6eccd2ae24d60050c2fa14c2654`, PR #872 / tracker #870. Current owner directed feature implementation first, consolidated acceptance later.

Implemented independent Popover, Alert Dialog and Drawer anatomy/context owners using existing Dialog, Overlay, FocusScope, Boundary and Transition patterns. Every atom has Base implementation and four direct-hook style projections. This is source WIP, not a Finf checkbox completion or lifecycle promotion.

- Popover: anchored, non-modal, controlled/uncontrolled, light dismissal and focus exit.
- Alert Dialog: fixed alertdialog semantics, outside-dismiss guard, Cancel initial focus, distinct Action intent and owner-controlled close requests.
- Drawer: modal edge panel, four edges, bounded scrolling and focus restoration.
- 15 real DemoSpecs and 30 bilingual pages accompany source; shared registry/export/nav integration is handed to the integrator in the adjacent JSON manifest.

Validation: focused TypeScript compilation covering all 15 source directories passed; 10 focused Web Component host tests passed before the final focus-exit refinement. A rerun is required on the final commit. Existing Astro config resolution warning and startup alert-description anatomy warning were observed and retained; no warning filter or assertion relaxation was introduced. No native compilation, native GUI, full CI, visual evidence, or packed consumer acceptance was claimed.

Remaining: Drawer swipe/drag/snap behavior; catalog semantic contracts and atom mapping; shared entry integration; cross-adapter/compiler/GPUI input and layout; real screenshots, safe-area audit, packed artifacts, independent review and exact-head aggregate CI.

The supported publisher could not commit because its local preflight still requires an authenticated `gh api repos/Proto-UI/Proto-UI` transport. No API response was fabricated. The local fallback retains normal Husky hooks and the exact three-line dot disclosure plus the actual author's DCO. The newly-created worktree initially lacked Husky's generated hook launchers; those were installed from the already-installed pinned dependency before amending the local, unpublished commit. The first amendment correctly rejected an incomplete disclosure; the corrected amendment is revalidated.
