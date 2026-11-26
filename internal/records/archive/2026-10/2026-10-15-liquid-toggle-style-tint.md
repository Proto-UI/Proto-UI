# Liquid Toggle: finite selected style tint

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Definition and scope

This local candidate starts from PR #887 head `347edd6cac4d3990709ead8e0d9778e0907b3ce0`. The governing draft entities are `C-FEEDBACK-MATERIAL-0001`, `C-RULE-INTENT-FEEDBACK-MATERIAL-0001`, `P-LIQUID-GLASS-TOGGLE`, `T-LIQUID-GLASS-TOGGLE-0001` and `T-WEB-LIQUID-OPTICAL-0001`.

Apple's [button Toggle style](https://developer.apple.com/documentation/swiftui/togglestyle/button) motivates selected tint and an appropriate foreground. This is a button-style Toggle with Base-owned `role=button` and `aria-pressed`; UISwitch geometry is not its specification. Apple HIG [Toggles](https://developer.apple.com/design/human-interface-guidelines/toggles), [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), and [Materials](https://developer.apple.com/design/human-interface-guidelines/materials) inform the comparison, without establishing pixel, animation, native shader, or platform equivalence.

The portable addition is only optional `tint: 'style-fill'` on a complete liquid-glass candidate. Final style still owns fill and foreground; this is not a CSS color, sampled DOM color, shader parameter, new semantic state or new Runtime API. Core validates and snapshots the finite data field. Existing Runtime whole-candidate delivery suffices, with new same-flush and removal regressions; Runtime production, Compiler and IR are unchanged.

## Host and fallback

- Trusted provider capability explicitly advertises supported tint variants. Malformed or absent capability falls back; untinted candidates do not depend on that field. The first-party host admits regular only.
- The opt-in host profile includes all lighting before a bounded linear-light tint map, preserving source-dependent detail without crossing the opaque fallback pair's luminance bound. The historical neutral static and contact shader literals remain byte-for-byte unchanged.
- Tint/profile participate in pipeline identity, stale material checks, decode leases, cancellation/rest publication and diagnostics. Old neutral first-paint seeds reject tinted candidates, including a same-palette substitution.
- Selected style uses primary fill and primary foreground together; inactive remains secondary. Unsupported provider, explicit opaque, disabled, unknown/reduced transparency, unsafe contrast and source loss keep the same state's readable opaque presentation. Forced colors retain UA ownership. Reduced motion retains static selected tint.
- Text underline remains a non-color selected mark; border width and geometry remain fixed. Icon-only selection is a separate unfinished design slice.

## Revised visual assertions

Only obsolete visual equalities are replaced. No-provider active fill no longer equals inactive fill: each must match its governed state palette and reach opaque contrast of at least 4.5. Optical active foreground no longer equals inactive foreground: active must match primary foreground, inactive secondary foreground. Optical host backgrounds still both remain transparent; their CSS values cannot prove optical contrast.

The original eight runtime/theme cases, unknown-preferences startup case and two public-locale cases remain. Their input, focus, disabled cancellation, controlled rejection, source, preference, geometry and cleanup assertions remain. Captures bind a decoded image to the same frozen receipt, CSS foreground and host content ROI. Passing content has a nonempty fully opaque sample set and minimum contrast of 4.5; empty, partial-alpha and transparent content cannot pass.

A separate twelfth test is explicitly algorithm-only. Its nine fixed sources, two palettes and four motion phases compare the same source revision, bytes, geometry, contact and fixed time. Neutral versus tint and tint versus zero-refraction use decoded RGB differences at common opaque coordinates. Same-histogram spatial inversion checks source response. The test saves actual PNGs and rejected-control reasons before assertions. It neither bypasses nor demonstrates provider admission, and cannot replace four-runtime public-page evidence.

## Review correction and evidence boundary

Independent review reproduced a near-opaque readback issue with GL mocks: raw premultiplied RGB at alpha 250 could pass while its white-backdrop composite failed. The tinted path now checks black/white compositing bounds on the original safe side and requires at least one fully opaque pixel. The no-tint guard stays unchanged. Content coverage still requires the real receipt-bound browser ROI, rather than inferring it from this host guard.

Local checks cover finite grammar/capability rejection, scalar contrast bounds, mock-GL ABI, stale decode/contact cancellation, seed rejection, prototype semantics, Runtime delivery, snapshot arithmetic, delivery registrations, scoped TypeScript, Astro script extraction, bundle construction and source-input checks. These are not real GPU/browser execution. The standard token generator adds exactly the two new active palette tokens.

The prototype catalog check fails identically on the exact baseline and candidate: 536 existing issues, with byte-identical output. Changed-entity lifecycle authoring passes. Do not fix or hide unrelated catalog debt in this slice.

Historical [04a evidence](https://github.com/Proto-UI/Proto-UI/actions/runs/38654570729/job/116161164963) and [347edd6 evidence](https://github.com/Proto-UI/Proto-UI/actions/runs/38656454140/job/116167274475) passed the earlier eleven scenarios. They predate tint and do not validate this candidate. The new candidate must receive an exact-head natural CI run, retained PNG/JSON review and independent acceptance before claiming selected optical delivery. Native Apple equivalence, icon-only selected marking and broader native/Compiler realization remain open.
