# Adoption review: explicit built-in window preference sources

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

The actual `PrototypePreviewer/preview-material-scene.ts` passes an explicit `createWebMaterialPreferences(win)` result into the material sink. Independent review reproduced destination reduced-transparency being ignored even after GPU/document rebinding, because the explicit source still subscribed to the original window. Testing only the absent-options default did not cover this real consumer path.

Built-in preference instances now privately record their originating Window in a WeakMap. Binding resolution recreates a known built-in window source when its owner differs from the destination. An arbitrary custom provider is preserved, including its policy and subscription lifecycle; no inferred override is applied to custom providers and no public options shape changes.

The explicit built-in negative control is red before and green after this fix. A custom-provider control remains green and verifies that rebinding neither replaces its conservative policy nor installs browser preference listeners. All 64 adoption/sink/preferences/independent tests pass. Media facts and GPU paint are test doubles; native system-media delivery remains separate evidence.
