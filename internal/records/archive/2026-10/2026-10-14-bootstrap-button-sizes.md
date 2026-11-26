# Bootstrap Button fixed-source sizes

Date: 2026-10-14. Candidate against PR #887 head `45d9496f93eedb7ec1a08c7c89161356b492227b` (tree `1dcf7a72697c23d73a9ace2f6fccd3bb474220f8`). This is not a publication or full-family acceptance record.

## Defined scope and source

Continue the upstream-unit alignment with `size: default | large | small | mini`, default `default`, for the existing default/primary variants. Draft lifecycle, Base interaction ownership and all prior non-sizing limitations remain intact. No new color variants, link/block recipe, icon-sprite geometry or other component changes are included.

The fixed reference was read directly from [twbs/bootstrap v2.3.2 compiled CSS lines 3198–3329](https://github.com/twbs/bootstrap/blob/v2.3.2/docs/assets/css/bootstrap.css#L3198-L3329), blob `b725064aab21e434d29209d259d3892478aa9536`, with `less/buttons.less` and `less/variables.less` as the corresponding authored sources. Every size retains 20px line height and 1px borders:

| Size | Vertical / horizontal padding | Font size | Radius | Single-line border-box height |
| --- | --- | --- | --- | --- |
| default | 4px / 12px | 14px | 4px | 30px |
| large | 11px / 19px | 17.5px | 6px | 44px |
| small | 2px / 10px | 11.9px | 3px | 26px |
| mini | 0px / 6px | 10.5px | 3px | 22px |

These heights follow from content line height, padding and border; no fixed-height constraint is added. All size-dependent values move into mutually exclusive prototype Rules, including default, so changing sizes does not retain competing default dimensions. Fractional px typography reuses the existing bounded parser. The only physical translation addition is the finite `rounded-[3px]` token beside the existing 4px/6px entries. No arbitrary radius grammar, Compiler/IR/collector, Runtime, Adapter, global page CSS or other family/component changes are included.

## Consumer and evidence design

The public Button demo uses real prototypes for all four sizes and both variants; the extra examples feed the existing activation count. The existing real-four-Web fixture keeps each instance mounted while switching large → mini → small → default at root16 and root32. Each variant/size/runtime checks computed padding, fractional font size, 20px line height, border width, radius and height; real pointer/Enter/Space activation with a separate exact +1 assertion per input; original connected-node identity after size, disabled and restoration updates; disabled suppression; and explicit enabled restoration. PNG filenames and JSON observations retain size, root font and upstream source version; the existing workflow retains the actual tested source SHA.

The patch-only public demo API cannot remove keys. Browser tests explicitly restore default rather than passing undefined or claiming a removal. Unit tests really remove the size through a complete raw-props snapshot and check default restoration for both variants. Root-font changes are not browser zoom.

## Validation and remaining work

- Before implementation, the new large-size unit assertions failed for both variants because `px-[19px]` was absent, and the new 3px radius translation assertion failed. The existing 63 tests passed. This is retained as the discriminating baseline, separate from a preliminary assertion that asked the old static default values to appear in rule-only output.
- The six focused suites subsequently passed 179 tests: Button 6, CSS renderer 60, source collection 84, Shadow split 14, family closure 5, disabled paint 10. The radius regression also rejects negative, fractional/unregistered, function and injected radius values while retaining 4px/6px behavior.
- Draft-family tokens were generated normally and check mode passed. Official CLI build, website token generation and workspace TypeScript checking passed. Two changed catalog inputs pass spec-authoring against the exact base. Browser/demo source syntax checks and the targeted TypeScript program (including its dependency graph) pass; these are not browser execution.
- Aggregate prototype catalog still fails with 536 diagnostics. An isolated exact-base checkout reproduces byte-identical output; these remain existing debt rather than a green aggregate.

Exact-candidate real-browser execution and screenshots remain pending. Earlier default-only evidence does not establish these new size cases. Browser zoom, actual four-runtime prop removal, icon-sprite alignment and native/compiler/full-family acceptance remain unverified. Other Form/AlertDialog/Dropdown/Select/Toggle sizing gaps retain their owners and are not taken over.

Next: finish exact-patch independent review, publish only through the parent task's authorized writer, then inspect the naturally triggered exact-head browser matrix and screenshots before recording any native-browser acceptance.

Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
This role declaration is not authenticated model identity, permission, independent review, or acceptance.
