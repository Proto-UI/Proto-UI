# Accordion dense own-key validation

Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and observed baseline

Finf [#872 review finding](https://github.com/Proto-UI/Proto-UI/pull/872#discussion_r4210567521), checked against `c0f83b30f613e6dafd6ae2e7a83589ca3427f6d2`. Draft `P-BASE-ACCORDION-OWNER/CONTROLLED/KEYS` requires a canonical non-empty string-key set, with single/multiple normalization, initialization-only defaults, and dormant unknown keys.

The local `stringArray` validator used `every`, which skips holes and accepts inherited indexed strings. At this baseline the generic Props JSON gate already rejects ordinary holes and explicit undefined. Its `index in value` check still accepts an inherited indexed string. This distinction matters: six inherited-index initialization/update cases really failed; ordinary-hole controls were already green and are not claimed as newly reproduced failures.

## Bounded repair

The Accordion-owned validator now checks each index with `Object.hasOwn`, then requires a non-empty string. It rejects the entire malformed array. It does not filter out bad elements, invent a partial selection, change Props globally or alter normalization of accepted arrays.

The Web Component test matrix covers `openItems` and `defaultOpenItems`, `single` and `multiple`, initialization and updates, new Array, leading/middle/trailing holes, explicit undefined, inherited index and empty-string entries. It asserts canonical keys/count, all actual Trigger `aria-expanded` attributes, request silence, and recovery to valid selection. Valid empty sets, duplicates and dormant unknown keys remain explicit controls. Invalid controlled updates retain the previous valid Props value; default changes remain initialization-only.

Source binding (SHA-256):

- `packages/prototypes/base/src/accordion/root.proto.ts`: `2a5cf60f0162c0244d35b1df85f7656ccad2501caf9605b740f34d7e2796ff99`
- `packages/prototypes/base/test/accordion.test.ts`: `258c17247c2eabd7e3a425f0cc54f77859f200abd9ade94df567c21322193cb0`

## Verification and remaining work

Before repair, Base Accordion: six failed and 87 passed. After repair, all 93 Base Accordion tests and all 80 Accordion integration tests across React/Vue/Vue2/Web Component pass. The broader bounded run passed 372 tests across all 18 selected TextControl, Field, Input, Textarea and Accordion files. Commands use Node 24.19.0, pnpm 10.32.1, Vitest 2.1.9/Happy DOM 15.11.7, with `--maxWorkers=2 --minWorkers=1`. `check:prototype-catalog` and `check:types:workspace` pass (the existing website style generator was run to restore missing generated shadow-style modules before the latter).

This is synthetic DOM protocol/Adapter evidence, not native-browser painting, OS input, material, GPUI or nine-dimension acceptance. Independent current-head review, integrated package/type/native validation, commit-bound public reporting and publication are still required in the integration lane. No lifecycle/API changes, push or external mutation are included here.
