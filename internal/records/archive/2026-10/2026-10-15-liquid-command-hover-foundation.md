# Liquid command hover foundation, 2026-10-15

Status: local draft implementation and evidence preparation; exact-head native/visual acceptance is pending. This record is observational. `C-LIQUID-GLASS-COMMAND-INTERACTION-0001` and its test mapping govern the bounded slice.

## Reference and decision

The owner requested that glass-family hover states be compared carefully with Apple. WWDC25 “Elevate the design of your iPad app”, iPadOS 26, 9:20–10:05 describes a refractive highlight above the hovered command and moving between group targets, and explicitly retires the old magnetic/rubber-band pointer. Source: https://developer.apple.com/videos/play/wwdc2025/208/?time=560 . The Motion HIG distinguishes direct-touch emphasis from indirect input: https://developer.apple.com/design/human-interface-guidelines/motion . Neither source provides a universal Web scale, timing or shadow number.

The current host exposes a primary-pointer held-contact session, not free hover coordinates or an independently controlled hover-light channel. The unregistered MaterialContact draft is not production capability. Therefore the first implementation uses shared private physical token data and explicit Rules in each owning prototype. The shadow/inner edge is a project candidate requiring actual visual review. It does not claim the iPadOS 26 moving platter, native pixel matching or cross-platform equivalence.

## Bounded source scope

Six parts: Button, Toggle, Accordion Trigger, Collapsible Trigger, Select Trigger and Dropdown Trigger. Existing Base owners retain events, state, focus, activation, open/value/selection and cancellation. Accordion eligibility excludes both disabled and collapseBlocked while preserving its distinct focus and ARIA behavior. Hover is independent of press and selection; its ring withdraws for focus-visible, whose forced-colors outline remains explicit. Dropdown retains its focused-but-not-focus-visible elevation. Disabled paint removes interaction emphasis without making the complete control translucent.

The four older Trigger material candidates adopt the already defined pointer self-contact request; Button and Toggle retain their existing request. This changes the private carrier footprint even at rest. Source boundaries, nearby authored paint, clipping and occupied pseudo-elements can cause safe fallback. Positive fixtures use real transparent spacing, and negative fixtures retain ordinary close-boundary cases. No source admission guard is relaxed. A semantic pointerleave can clear pressed while a held contact remains active; re-entry must not fabricate a new optical session.

Form Submit/Reset were included in the initial eight-part design. Portable behavior passed, but the real CLI collector lacks asFormSubmit/asFormReset recognition in resolveKnownAsHookStateHandles. Their two closure failures are retained. They are held out of the deliverable source slice rather than aliased to asButton or given another state owner. Their existing behavior remains until a separately reviewed CLI prerequisite and follow-up projection are available.

## Prerequisite and evidence boundaries

A separate Base cleanup slice first reproduces press.cancel/window blur residue in Toggle, Accordion, Collapsible, Select and Dropdown commands, and missing Toggle/Dropdown unmount cleanup. The fix belongs to Base; the family must not write borrowed states. It preserves persistent semantic values and request counts. No router or Runtime change belongs here.

New portable/closure tests are failing-before evidence. The retained native job adds a separate four-runtime, dual-theme hover fixture and leaves the original thirteen Toggle scenarios and structured interior-detail/contrast gates intact. Screenshots, material receipts, source identity and negative controls are prerequisites to optical acceptance; source presence, CSS tokens or nonzero whole-image differences are insufficient. Local native browser execution is unavailable under the established environment restriction, so local checks are nonbrowser only and native execution is delegated to the normal exact-head CI path.

The e0360902 selected-glass run failed before all thirteen browser scenarios at generated draft style-token consistency. This is retained as a prebrowser failure, not an optical test result. Its one-file generator repair is a separate change. New hover generated outputs must be produced with the official generator and checked together with the complete preset gate.

## Remaining work

- Exact-candidate native captures, independent visual comparison and any failure repair.
- Separate CLI Form-hook closure repair and subsequent Submit/Reset recipe acceptance.
- Role-specific later slices for other commands, drag thumbs and the remaining family parts; passive containers must not acquire fake command behavior.
- A separately defined shared input/host/provider capability before cursor-following optical hover, light-only feedback or cross-part MaterialContact can be claimed.

## Independent review corrections

The initial local closure suite missed the Accordion disabled OR collapseBlocked quiet-paint branch. The existing CLI collector projected that w.any expression as a conjunction. A new source-derived test reproduced two failures; the prototype now expresses the same semantics as two independent Rules, with disabled-only, blocked-only, both and neither runtime/token comparisons. The broader legal w.any lowering gap remains assigned to its owner, rather than being silently treated as unsupported syntax or fixed in this slice.

Native evidence review also required surrounding screenshot pixels for outer shadow/focus borders, isolated cleanup of preferences and held mouse/touch between parts, and correction of an element-focus-transfer assertion that incorrectly implied whole-window cancellation. Root, material and padded-context captures now remain distinct, cleanup errors abort dependent continuation, and only the actual window cancellation route asserts clearing of held contact. These are evidence corrections; they do not broaden Base, router or host behavior.
