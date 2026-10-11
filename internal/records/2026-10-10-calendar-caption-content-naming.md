# Calendar caption: remove the owned-ARIA demo override

Date: 2026-10-10 UTC. Follow-up to `efd7f3d9`.

Integration identified that the caption demo's `nameTriggers` / MutationObserver repeatedly overwrote Select's owned `aria-label`. An existing demo pattern was not a justification for crossing that ownership boundary. The override and observer are removed rather than moved elsewhere.

Month and Year are now real authored text in each Trigger's content slot, visually concealed with the existing `sr-only` surface convention. Select retains its existing nameFromContent ownership. The source/caption helper adds no Select or A11y protocol change. Current public docs describe this naming input and its verification limit.

The twenty family/host demo cases verify the actual Month/Year text plus changing canonical value, including an out-of-options year 1800. The isolated setup/clock test spies on both trigger targets and verifies the demo never writes `aria-label`. It does not forbid a legitimate future Adapter-owned accessible-name projection. The Shadcn year keyboard open/select/close/focus journey remains covered.

After removing the override, this checkout's `aria-label` was null in those twenty fixtures. Null alone does not prove an empty accessible name: a browser may derive a name through its role-specific native algorithm. Conversely, Happy DOM text presence is not a computed-accessible-name proof. That real-browser role/name observation remains an explicit integration gate; no shared A11y defect is declared or hidden by another DOM patch.

Verification: the website suite passed 22/22 after replacing the override with actual content. The final no-owned-attribute-write clock assertion and focused Calendar public TypeScript check pass. The earlier Calendar source checks and separate generated-CSS/native/compiled/packed blockers remain scoped as recorded; this correction does not turn them green.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
