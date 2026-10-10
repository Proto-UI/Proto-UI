# Runtime Box underline Tabs (review candidate, not visual admission)

Date: 2026-10-10 UTC. Author: cyjin.yl, with dot assistance. Base: `c2cbb8d6fce71e949f84f0358189184783505989`; independent `feat/runtime-box-tabs` worktree. Frozen fifth snapshot was not edited.

## Request and references

The owner requested Runtime Box tabs matching the supplied horizontal text row. The actual image was viewed before implementation. It has a transparent/white background, muted inactive text, black active text and a thin text-width underline, without a pill or a thick card frame. Its competitor names are not runtime values; this implementation keeps Web Components, React, Vue and Vue 2.

- User image SHA-256: `0adf2a06929838f3a26cf1f7cf4d953e49c8508714b617b8cc0205e4b32da16c`.
- Fixed official calendar-page HTML used by the visual audit SHA-256: `3304d6f8af7194ee07f435879e43adbed7d214c8c1eca1189db179accb89d93f`.
- The audit's upstream row has gap-6, text-base/medium, muted inactive text and a 2px active pseudo-element underline. It is navigation upstream; Runtime Box correctly uses the existing Base Tabs protocol for same-page switching.
- New Bootstrap default presentation references [Bootstrap v2.3.2 navs.less](https://github.com/twbs/bootstrap/blob/v2.3.2/less/navs.less), read as static source only. Existing Apache-2.0 notice/license are retained. This is a bordered nav-tab projection, not jQuery execution or exact upstream DOM compatibility. Theme ink/focus indication and the missing -1px border overlap are explicit remaining visual differences.
- Liquid's default segmented material surface is independently authored using existing material/fallback declarations, not an official Apple Tabs clone.

## Ownership and implementation

No Base Tabs behavior, Rule/Compiler semantics, Focus core, Runtime/session or Delay implementation changes. Each style part calls its matching existing Base Tabs hook once. Root/List/Trigger/Content remain real independent prototypes. Shadcn and Brutalist retain default recipes; all four families expose opt-in List/Trigger `appearance: 'underline'`. Runtime selects that recipe explicitly.

Fixed-family pages compose the same-family Tabs in the same active runtime materialization as their content. Four real Content panels keep stable relationships; only the active panel contains the demo. Manual activation means arrows/Home/End move focus without remounting; Enter/Space or pointer activation requests a runtime generation. Root remains controlled by the committed runtime.

Readiness belongs to the existing generation inertness/event gate. It is not translated into every Tab's disabled prop. An initial experiment doing both entered an all-disabled/replay loop and exhausted a test worker; it was removed, not fixed by changing shared runtime or reducing tests. Unavailable options still use their own disabled prop. Old-generation callbacks and nested child valueChange events cannot request a new runtime.

The generic embed path uses real matching-family WC Tabs for its existing site chrome. It awaits old demo destruction, then relocates the single empty host's panel before mounting the next runtime. The helper gates loading as one inert application shell. It removes its event listener and disconnects Tabs after demo teardown. Legacy external select embeddings remain supported. Without JS the SSR shell presents readable runtime names and the existing noscript explanation; it does not claim inert text is an interactive tablist.

## Rule/static-resource review remains open

Previously state-only rules such as `w.state(selected).eq(true)` could lower to `data-[selected]:bg-background`. The legal mixed condition `w.all(w.prop('appearance').eq('default'), w.state(selected).eq(true))` uses the existing runtime evaluation path, producing current tokens such as `bg-background`. C-RULE-WHEN-0001 and C-RULE-RUNTIME-0001 allow this expression and execution; this does not itself prove unchanged delivery/paint guarantees.

The five original Shadcn/Brutalist selector assertions are **unchanged and red**. They are not waived by the new interaction tests. No new prop lowering or mirrored semantic state was introduced to satisfy a collector parser.

A comparison fixture preserves the exact pre-change Shadcn Trigger recipe from c2cbb8d6. Evidence compares default selected CSS facts, checks default→underline→default withdrawal and exact current tokens. React renderToString produces empty output for both pre/post trees; this records the existing SSR limit, not SSR styling support.

HappyDOM independently mis-matches `[data-pui-style~="border"]` against `border-0 border-b-2`. Its computed 1px border therefore cannot certify a native 2px underline. The test records this limitation separately from component behavior. Browser geometry and paint remain mandatory, not inferred from these simulated results.

## Integration and evidence

- Physical-only CSS commit: `4ba4dfec99bc2b0211bc29c50b94c20677c7ddd4`. Exact four mappings: flex-none, flex-nowrap, border-b-transparent, rounded-t-[0.25rem]. No component-name detection or Rule changes. Positive and near-spelling negative controls cover document/Shadow output.
- Separate manifest lists all eight new public identities and integration paths.
- Installed pnpm 10.32.1 with offline Corepack cache only. Existing dependencies reused. Normal Husky/DCO hooks, true author; no push or external comment.
- Focused tests/types and exact final totals are recorded in the completion note below. The unrelated baseline Dropdown recipe-closure failure remains visible; this task does not silently alter that registry.

## Required next gates

1. Independent review of the mixed appearance/state rule resource guarantee; original five static-selector assertions remain blocking that claim.
2. Regenerate preset/website styles using the proper generators after merge; verify packed CLI source-only family entries and CSS closure. No generated global files were hand-edited here. Shadow split admission is not claimed.
3. Official browser CI bound to the UI commit: all runtime labels visible, active underline 2px/text-width, inactive gray/no pill, keyboard manual activation and focus return, exactly one new runtime mount and prior teardown, repeated fast switching, page-header preference sync, 320px horizontal scroll, 200% text, light/dark and disabled/unavailable option behavior.
4. Capture the same state as the supplied reference plus a React-selected state and narrow keyboard-focus state. Publish new commit-bound artifacts; no old screenshot substitution. No local native GUI/no-sandbox run was performed.

ModelTrace: not measured. dot's model trace exemption is owner-authorized; source/test logs and exact limitations are preserved rather than claimed green.

## Completion note for local review slice

Focused combined run: 177 tests, 171 passed and 6 failed. Five failures are the unchanged old state-selector assertions described above; the sixth is the baseline Dropdown recipe closure missing Group/Label/Shortcut/Separator. The new runtime helper (8), controlled projection gates (4), real adapter shell and switching (40, including 16 new projected and 4 generic switching cases), complete four-family CSS (4), and physical mapping controls (2) all passed. The pre/post comparison file adds 3 passing bounded checks, including the explicit environment characterization. Scoped UI/family/test TypeScript check passed. Logs were kept with the task evidence; no full CI/native result claimed.

Shared registration replay must compare the destination's actual head before applying: primary was observed at 342955e238e6a632dbc010b70aa59d1a373ce440 after this worktree diverged. Global generators, navigation and admission stay with the release owner.

## Independent review follow-up: composition-owned focus

The exact reviewed head `6d2d983f` had **179 tests: 173 passing, 6 failing**. Five failures asserted the previous selected-state selector representation; one pre-existing Dropdown demo closure failure belongs to the frozen source's missing Group/Label/Shortcut/Separator registry. Neither is a historical allowance for new defects.

The materializer still searched for a combobox after Runtime became real Tabs. It now holds a private focus lease for each exact materialized composition and calls its existing `restoreFocus` protocol. Owner identity, exact active generation, lock/inert, candidate disposal, origin ownership and newer focus before the animation frame all remain guards. Teardown revokes the lease before asynchronous cleanup. No Focus, Runtime, session or Delay core was changed.

Evidence: 7 materializer tests and 8 added real-framework keyboard/interruption tests pass (WC/React/Vue/Vue2). Arrow/Home/End in manual mode only move focus; Enter and Space each request one real runtime switch and restore the newly selected Trigger. External focus, newer-focus-before-frame, locked/staging/changed-owner hosts, stale DOM callbacks, rapid requests and destruction suppress inappropriate restoration.

**Release blocker:** all three committed preset generators were stale at review. The integration owner must run the proper generators and test a real packed consumer **before further integration/push**. Source-collected CSS tests do not satisfy this gate. The following source/test work remains WIP until that resource proof, exact-commit official native screenshots and independent review exist.
