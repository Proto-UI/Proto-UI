# Vue 2 preserves consumer-owned native direction

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Reproduced owning-layer failure

Main CI `37724536947`, browser shard 8 job `113140723434`, fails both Vue 2 portal-direction journeys at the nested-option assertion: author-injected native `dir="ltr"` yields computed RTL after subsequent view work. Other host/runtime journeys are distinct evidence; the portable/raw Props review is not this bug.

The Vue 2 root VNode always included `dir: undefined` when the consumer supplied no framework direction input. Vue 2's attribute patch removes undefined old keys on later renders, so the Adapter inadvertently claimed that native attribute and erased author DOM direction during an unrelated view commit.

A minimal test uses the actual Vue 2 runtime and Adapter, writes native `dir="ltr"` on its mounted root, then requests an ordinary Proto update. The original implementation removes the attribute (`null` instead of `ltr`), while the explicit framework direction update/revocation control passes. The repair omits the VNode key when direction is genuinely absent, while retaining an actual supplied value. This preserves author-native `ltr`, `rtl` and `auto` through updates; explicit framework `ltr → rtl → undefined` still revokes its old attribute.

No default/custom raw Props classifier, portal ancestry helper, CSS direction policy or Prototype semantics changes. The prior declared-dir compatibility evidence remains valid.

## Verification and boundary

- Original focused reproduction: 1 failed / 1 passed, with the intended native attribute removal assertion.
- Repaired focused suite with Props normalization and Base/React/Vue portal-direction controls: 16/16 pass in five files.
- Full Vue 2 Adapter selection: 53 files, 261/261 pass; workspace TypeScript passes.

These checks use the real Vue 2 renderer in happy-dom and prove DOM attribute ownership, not native computed-style or pixels. The unchanged eight-case native portal-direction probe remains the official acceptance gate for the originally reported nested-RTL failure after integration. No local Chromium run or complete browser pass is claimed.
