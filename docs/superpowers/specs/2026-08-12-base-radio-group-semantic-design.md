# Base Radio Group Semantic Design

**Issue:** [#349](https://github.com/Proto-UI/Proto-UI/issues/349)  
**Status:** Approved semantic checkpoint  
**Target:** `0.3.0`, draft catalog entities

## Decision

Admit one Base `radio-group` family with three prototype identities:

- `P-BASE-RADIO-GROUP` — group/root; sole selected-value owner, collection provider, roving-focus owner, and `radiogroup` accessibility object.
- `P-BASE-RADIO-GROUP-ITEM` — one focusable `radio` choice inside the group; derives checked/effective-disabled state and requests group selection.
- `P-BASE-RADIO-GROUP-INDICATOR` — optional repeatable visual part inside an item; derives checked/disabled facts and owns no input, focus, activation, accessibility-control, or form semantics.

“Radio” is the semantic role realized by `Radio Group Item`, not a standalone Base root. No `P-BASE-RADIO` carrier is created. This prevents item-local checked ownership from competing with group value ownership.

Rejected alternatives:

1. **Native `<input type="radio">` first** — rejected for this slice because name/form-owner grouping, submission, reset, validation, input/change bubbling, and adapter-native target ownership require a Form/host capability not cataloged here.
2. **Checkbox-derived items** — rejected by `D-BASE-PROTOTYPE-INDEPENDENCE-0001`; Radio selection is group-owned and cannot be obtained from Checkbox’s item-local toggle protocol.
3. **Separate Root + List + Item family** — rejected because the `radiogroup` object is already the semantic collection and roving owner; a List part would add anatomy without an independent information path.
4. **Generic single-selection Contract now** — rejected; Tabs, Select, and Radio have materially different activation, empty-value, focus, popup, and content semantics. Radio-specific rules belong in P entities until a cross-prototype invariant is proven.

Target lifecycle: new P/T entities remain `draft`, `since: 0.3.0`; existing `0.2.0-rc.7` release evidence is untouched.

## Identity and anatomy

| Role | Entity / authoring entries | Cardinality | Owner |
| --- | --- | ---: | --- |
| Group root | `P-BASE-RADIO-GROUP`; `base-radio-group-root`, `asRadioGroupRoot()` | exactly 1 | value, controlledness, group disabled, collection, roving focus, group name/a11y |
| Item | `P-BASE-RADIO-GROUP-ITEM`; `base-radio-group-item`, `asRadioGroupItem()` | `1..*` in a valid authored group; runtime may transiently reach 0 | item value input, effective disabled, focus/press feedback, selection request, radio a11y |
| Indicator | `P-BASE-RADIO-GROUP-INDICATOR`; `base-radio-group-indicator`, `asRadioGroupIndicator()` | `0..*` per item | derived visual feedback only |

Family: `base-radio-group`. Relations: root contains item; item contains indicator. Item is meaningful only inside the nearest same-domain group root. Indicator consumes nearest item context, not group context directly.

No Label or Description prototype is admitted. Group naming uses a host-neutral text input; item naming comes from content or host projection. Reusable label/description relationships can be added only after their own protocol is cataloged.

## Props, state, exposes, events, and context

### Group root

Props:

```ts
interface RadioGroupRootProps {
  value?: string;          // controlled selected protocol value
  defaultValue?: string;   // uncontrolled initial value; default ''
  disabled?: boolean;      // disables every item; default false
  a11yLabel?: string;      // host-neutral explicit group name; default ''
}
```

No callback prop. No `orientation`, `loop`, `name`, `required`, `form`, `invalid`, or visual variant in the first Base slice.

Exposes:

- state: `value: string`, `disabled: boolean`, and Collection’s current `count`;
- event: `valueChange`, payload at least `{ value: string }`;
- methods: `requestValue`, `focusFirst`, `focusLast`, `focusNext`, `focusPrev`, `focusSelected`, `getCollectionItems`, and `getCollectionCount`.

`requestValue` is the narrow same-domain selection route. It accepts only a non-empty value belonging to an enabled item in this group. It returns false for disabled, missing, empty, duplicate-ambiguous, or already-selected requests. It does not move focus.

Group context publishes current value, controlledness, group disabled, canonical selected item identity, and current roving item identity. Context carries facts only; items call the group’s request method through anatomy rather than turning Context into a versioned command bus.

### Item

Props:

```ts
interface RadioGroupItemProps {
  value: string;           // valid authoring requires non-empty and unique in the group
  disabled?: boolean;      // default false
}
```

No `checked`, `defaultChecked`, or item-owned change callback. Effective disabled is `group.disabled || item.disabled`.

Exposes:

- state: `checked`, `disabled`, `hovered`, `focused`, `focusVisible`, `pressed`;
- method: `focusSelf`;
- event: `select`, payload at least `{ value: string }`, emitted only for an accepted new selection request.

Item context publishes `checked` and effective `disabled` for descendant indicators.

### Indicator

No props. Exposes derived `checked` and `disabled` states plus `isChecked()`. It has no trigger, focus, event, value, checked owner, form behavior, or independent control role.

## Selection and structural invariants

- At most one item is checked. The group’s value is the only selected-value owner.
- An item is checked only when it is the canonical first collection item whose non-empty value equals the group value. This safety rule prevents multiple `aria-checked=true` items even under invalid duplicate authoring.
- Non-empty item values must be unique. A request targeting a non-canonical duplicate is rejected; duplicate diagnostics are not promoted to a generic Contract in this slice.
- Empty selection is valid. Uncontrolled default `''`, controlled `''`, and controlled/uncontrolled unmatched values produce no checked item.
- User interaction can move from empty to one selected item but cannot clear the selection. The App Maker can clear controlled selection by supplying `value=""`.
- Structural churn never silently rewrites group value and never emits `valueChange`: removing, disabling, or changing the selected item can leave value unmatched; reintroducing a matching item restores its derived checked state.
- A selected item may become disabled and remain checked. It leaves roving eligibility; focus entry falls back to the first enabled item. A subsequent enabled selection replaces the value.
- Controlled requests emit `valueChange` but do not mutate final value/checked state. Uncontrolled accepted requests update value first and emit exactly once. A later controlled prop update is the only authority that changes controlled final state.

## Focus and keyboard model

The group root declares `asFocusRoving()` with `navigation: 'arrow'`, `orientation: 'both'`, `loop: true`, and selected-or-first entry. Collection supplies explicit item order; Focus Roving owns movement and default prevention. Items do not reimplement sibling navigation.

| Input | Result |
| --- | --- |
| Tab / Shift+Tab into group | Focus checked enabled item; otherwise first enabled item. Empty selection remains empty on entry. Exactly one enabled item is in natural Tab order; other enabled items remain programmatically focusable with `tabindex=-1` on Web. |
| Space on focused enabled unchecked item | Select it; prevent page scrolling. |
| Space on checked item | No value change and no duplicate signal. |
| Enter | No selection outside a future Toolbar-specific protocol. |
| Right / Down | Focus next enabled item and select it; wrap. |
| Left / Up | Focus previous enabled item and select it; wrap. |
| Home / End | Focus and select first / last enabled item. This is an explicit Proto UI roving extension beyond the minimum APG radio table. |
| Pointer activation | Focus and select the target on successful commit; canceled press does not select. |
| Disabled item / disabled group | No focus request, activation, selection request, or transient pressed/hovered state; disabled items are skipped. |

To preserve empty initial selection without selecting on plain Tab entry, the root maintains a current roving item identity. Entry focuses that current item without a value request; a focus move to a different member caused by Focus Roving requests selection. On blur, the root re-reads item `focused` exposes: if focus left the group, current resets to the checked enabled item or first enabled item; if focus moved to a sibling, that sibling becomes current and selection follows the roving move. `focusSelf()` marks its target current before requesting focus, so programmatic focus does not itself select. Pointer-down focus is distinguished by `pressed`; selection occurs only on successful press commit, and cancellation restores selected-or-first current.

Toolbar-contained Radio Group behavior is deferred. It has different arrow/selection coupling and requires a Toolbar domain rather than an implicit flag.

No public Base `orientation` or `loop` prop is admitted now: the APG non-toolbar pattern accepts both arrow axes and wraps, while layout is visual. Radix’s orientation-restricted and configurable-loop API is recorded only as Shadcn compatibility evidence, not copied into Base semantics.

## Accessibility

- Group root projects one `radiogroup` object, dynamic disabled state, and the non-empty `a11yLabel` as its accessible name.
- App Makers must provide a group accessible name through `a11yLabel` or an equivalent host projection. The API does not expose raw `aria-*` props.
- Each item projects one `radio` object, `checked: true|false`, effective disabled, content-derived accessible name, and an activate action.
- Items remain actual/owned descendants of the group; no parallel radio control objects or `aria-owns` reconstruction are introduced.
- Indicator contributes no independent radio/control semantic object.
- Group descriptions, item descriptions, `aria-required`, `aria-invalid`, set position, and explicit label/description relation parts are deferred. DOM/host order and the Collection snapshot remain available, but the first slice does not invent a generic relationship protocol.

## Form and native-control boundary

Radio is form-relevant, but the first Base slice deliberately guarantees no form behavior. Deferred together:

- `name`, submitted value, form owner, hidden/native inputs;
- `required`, constraint validation, invalid/message semantics;
- form reset and default checkedness restoration;
- native `input`/`change` event timing and bubbling;
- native radio grouping by form owner/tree/name.

These rules are coupled in the HTML Standard and need a Form/host capability. The implementation must not render fake hidden inputs or claim partial form support.

## Catalog graph

New entities:

- `P-BASE-RADIO-GROUP`
- `P-BASE-RADIO-GROUP-ITEM`
- `P-BASE-RADIO-GROUP-INDICATOR`
- `T-BASE-RADIO-GROUP-0001`
- `T-BASE-RADIO-GROUP-ITEM-0001`
- `T-BASE-RADIO-GROUP-INDICATOR-0001`

No new `C-*` entity.

Reuse and cite:

- `C-AS-COLLECTION-0001`, `C-AS-COLLECTION-ITEM-0001`, `M-COLLECTION-0001`
- `C-AS-FOCUSABLE-0001`, `C-AS-FOCUS-ROVING-0001`, `D-FOCUS-ROVING-NAVIGATION-OWNERSHIP-0001`
- `C-AS-TRIGGER-0001`, `C-EVENT-TYPE-0001`, `C-EVENT-TYPE-0002`, `M-EVENT-0001`
- `C-A11Y-0001`, `M-A11Y-0001`, `HC-A11Y-0001`, `D-A11Y-SEMANTIC-DOMAIN-0001`
- Anatomy, Context, Props, State, and Expose contracts already used by Checkbox/Tabs/Select
- `D-BASE-PROTOTYPE-INDEPENDENCE-0001`

Reference P entities are evidence, not dependencies: `P-BASE-CHECKBOX`, `P-BASE-TABS*`, and `P-BASE-SELECT*`.

## Base implementation slice

One Base PR after semantic approval:

1. P/T catalog entities and exact anchors.
2. `packages/prototypes/base/src/radio-group/{shared,types,root.proto,item.proto,indicator.proto,index}.ts`.
3. Base package/root exports and `base-radio-group` CLI compound registry entry.
4. Behavior tests in `packages/prototypes/base/test/radio-group.test.ts` plus focused Web Component/React/Vue projection journeys for role, checked, disabled, and roving `tabindex` parity.
5. English/Chinese Base Radio Group docs, a real three-adapter demo, preview loader/sidebar surfaces.
6. Generated Agent/spec projections. No mutation of immutable release evidence and no current-version bump.

The implementation introduces no `any`, `: any`, or `as any`.

## Verification matrix

Executable coverage must prove:

- exact anatomy/cardinality and direct/asHook authoring entries;
- empty/default/unmatched values and at-most-one checked item;
- uncontrolled and controlled request ownership and exact event counts;
- group/item disabled interaction and dynamic structural changes;
- duplicate-value safety;
- pointer/Space/Enter behavior;
- both-axis wrap, Home/End, disabled skipping, selected-or-first entry, and two independent groups;
- Web Component/React/Vue `radiogroup`/`radio`, checked/disabled, and `tabindex=0/-1` parity;
- indicator derivation and absence of independent semantics;
- absence of form props/native input/submission claims.

Run focused red/green tests, catalog validation, type checks, Agent projection generation/check, CLI component preset checks, production docs build, and a real Chromium demo journey across all three adapters.

## Later Shadcn projection slice

A separate issue/PR depends on the merged Base slice. It adds styled Shadcn root/item/indicator prototypes, component preset/CLI/docs/demo surfaces, and upstream visual/data-attribute parity. It must not silently claim Radix `name`, `form`, `required`, native input, `orientation`, `dir`, or configurable `loop` behavior that Base has not admitted. Full upstream form/API parity remains blocked on the corresponding Base/Form decisions.

## Evidence consulted

Repository authority/evidence:

- `spec/prototypes/P-BASE-CHECKBOX.yaml`
- `spec/prototypes/P-BASE-TABS*.yaml`
- `spec/prototypes/P-BASE-SELECT.yaml`
- `spec/contracts/C-AS-COLLECTION-0001.yaml`
- `spec/contracts/C-AS-COLLECTION-ITEM-0001.yaml`
- `spec/contracts/C-AS-FOCUS-ROVING-0001.yaml`
- `spec/modules/M-COLLECTION-0001.yaml`
- Checkbox/Tabs/Select implementations and tests
- `internal/records/2026-07-06-as-collection-catalog.zh-CN.md`
- `internal/records/2026-07-06-focus-roving-navigation-ownership.zh-CN.md`
- `internal/records/2026-08-12-tabs-roving-web-focus-projection.zh-CN.md`

External evidence (non-repository evidence does not override Proto UI spec):

- WAI-ARIA APG Radio Group Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/radio/
- WAI-ARIA 1.2 `radio`/`radiogroup`: https://www.w3.org/TR/wai-aria-1.2/#radio and https://www.w3.org/TR/wai-aria-1.2/#radiogroup
- HTML Living Standard native Radio Button state: https://html.spec.whatwg.org/multipage/input.html#radio-button-state-(type=radio)
- Current Radix Radio Group docs/source, consulted only for later Shadcn compatibility: https://www.radix-ui.com/primitives/docs/components/radio-group
