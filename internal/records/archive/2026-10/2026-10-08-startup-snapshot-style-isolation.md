# Isolate startup snapshots from other typography owners

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

Scope: #872, official base `06d6ff33ba29fe57dcc3b62f236d021c961a868b`, Quickstart workflow run `37756502832`, artifact `11540153292`. Existing Runtime-based build-time prerender, reset-free shared helper and exact source/import consumer boundary remain intact. This is not Compiler SSR or a new public hydration guarantee.

## Cause and minimum repair

Official raw JSON and original first-frame/hydrated/failure images show the Note title at 21px before startup and 20px after startup. At 320px it spans two lines and contracts by 2px; the Note and following content move with it. This reproduces across all four Adapters and is not a font-download diagnosis.

The canonical CLI renderer already emits explicit `leading-*` after composite `text-*`, as required by the draft `P-SHADCN-TEXT-PROJECTION` and `P-BRUTALIST-TEXT-PROJECTION` criteria. The new late inline Button snapshot emitted `text-sm` globally again without `leading-normal`, overriding other Text owners' explicit leading. Reset removal did not prevent this cross-stylesheet collision.

`renderSnapshotTokenCss` now accepts an exact owner selector, retaining token membership and compiler variant conditions inside the original zero-specificity host selector. Header and Search use their distinct native startup owners. Unscoped output remains internal to declaration extraction and selector rebinding. Card consumes the same helper with per-snapshot ownership in its separately coordinated repair. No typography constants, geometry tolerances, acceptance assertions or compiler token ordering change.

## Evidence and remaining work

A source/CSSOM matching regression concatenates canonical CSS with the late snapshot: the unscoped negative control still produces 1.25rem, while the scoped candidate leaves another Text at explicit 1.5. Two added cases fail before repair; fifteen focused tests in three files pass after it. These are source/selector observations, not a replacement for native cascade or visual evidence.

Official exact-head rerun must preserve all 18 Quickstart cases, both cold/refresh paths and strict Note style/geometry checks. The separate React focus failures remain a separately diagnosed ownership problem; this commit does not claim to solve them. Local Chromium remains unavailable under the existing environment restriction; no bypass was attempted.
