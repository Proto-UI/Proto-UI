# @proto.ui/adapter-react

Translates Proto UI prototypes into React component functions for use with Proto UI adapters.

## Purpose

Translates Proto UI prototypes into React component functions that run through the Proto UI adapter contracts.

## View and Focus readiness

Physical target and A11y projection binding are independent of focus-event admission. A committed target remains available for blur and projection during an update, and a retained semantic object keeps its referenced identity across view replay. Explicit `programmatic` requests keep the synchronous accepted-effect rule: the Module synchronizes target facts. `native` requests require the resolved physical Trigger root and its event-owning view to be ready, then rely on observed focus facts. `entry` requests require the actual resolved target's event owner to be ready, including ordinary descendants; rejected entry intent is retained separately and re-resolves the target on readiness without owning descendant facts. Successful acquisition renews the private bounded layout retry allowance. Detached or disposed views are not current targets. This realizes the draft [HC-FOCUS-TARGET-0001](../../../spec/host-caps/HC-FOCUS-TARGET-0001.yaml) and the active React Adapter lifecycle boundary.

## Document theme

The default `colorScheme` reader follows root `class` / `data-theme` markers and then the system preference. Mounted colorScheme Rule consumers update their existing style contribution when that effective value changes; view detach and terminal disposal release their subscription.

The guarantee is limited to the default getter in same-document light DOM without intervening local theme markers. An explicit `getMeta` keeps sampled behavior; subtree, ShadowRoot and cross-document equivalence remain outside this slice. See [C-RULE-COLOR-SCHEME-0001](../../../spec/contracts/C-RULE-COLOR-SCHEME-0001.yaml) and [T-RULE-COLOR-SCHEME-0001](../../../spec/tests/T-RULE-COLOR-SCHEME-0001.yaml), both draft.

The mounted view writes its `data-pui-style` tokens during the Effects transaction so native positioning can measure the current styles. View readiness still waits for React to acknowledge the corresponding style revision and template commit. On detach, the view removes the attribute if it still contains the value that view wrote.

## Text Control values

For a statically declared Text Control root, the adapter mirrors the host lease's `defaultValue` patch into React's native `defaultValue` prop. Text Control remains the owner of the current editor value; this prevents React reconciliation from replacing an authored initial textarea value with an empty default while preserving dirty uncontrolled edits across later property updates. See [C-TEXT-CONTROL-0001](../../../spec/contracts/C-TEXT-CONTROL-0001.yaml), draft.

The editing lease also guards the physical editor's native `defaultValue` accessor against redundant string writes from React reconciliation. Equal defaults leave selection and cursor untouched; changed defaults still reach the native setter and remain available to form reset. The lease restores the prior property binding on detach or disposal. Current-value projection continues through Text Control's existing value and composition ownership.

The same Text Control patch owns the native form submission `name`. The adapter retains its string value in React's native `name` prop so an ordinary input commit preserves it. A new string updates the name; an explicit empty string clears submission participation, while an omitted name leaves the retained projection unchanged. The logical view keeps that projection across detach and remount, and React unmount discards it with the component. The projection reads the Module patch rather than the reconciled DOM.

## Public handle identity

The adapter publishes one public handle object per mounted adapter instance. React re-runs the imperative handle effect whenever a consumer supplies a new `ref` identity, so the current callback still receives the handle. The handle is allocated once and reused: `update`, `getExposes` and `invokeInCallbackScope` keep reading the live view while its identity stays stable across renders and commits.

## Props delivery and view updates

The React Adapter keeps `autoUpdateOnPropsChange: true` as its compatibility default. After a changed host Props snapshot, the Adapter requests an update in addition to invalidating the Props source. That request belongs to the host policy. The active [C-PROPS-0014](../../../spec/contracts/C-PROPS-0014.yaml) still requires the Props channel itself to resolve inputs and dispatch eligible watchers without implicitly committing a render.

With `autoUpdateOnPropsChange: false`, a host notification marks the raw source dirty. The next Runtime synchronization boundary reads the snapshot and delivers watchers. Ordinary callback scopes and rule evaluation can reach that boundary; observing the DOM does not. This lazy source notification differs from the compiled React DOM facade's immediate Props receipt. Compare them after a defined synchronization boundary, rather than requiring the manual Adapter to remain stale until a particular application event. See the active [React Adapter contract](../../../spec/adapters/A-REACT-18-19-0001.yaml) and draft [Props source capability](../../../spec/host-caps/HC-PROPS-SOURCE-0001.yaml).

For an already mounted component whose rendered text reads `label` and whose style Rule reads `tone`, the selected configurations have these outcomes after changed Props are synchronized:

| Configuration | No authored update request | `watch(['label'], run => run.update())` |
| --- | --- | --- |
| Default React Adapter | Host policy requests a text update; Rule style refreshes. | Text and Rule style update; eligible requests may coalesce. |
| React Adapter, `autoUpdateOnPropsChange: false` | Rule style refreshes; text waits for an explicit update. | The watcher requests the text update; Rule style refreshes. |
| Compiled `react-dom-source-v1`, default `explicit` policy | Rule style refreshes; text waits for an explicit update. | The watcher requests the text update; Rule style refreshes. |

Existing Adapter consumers can retain the default. When migrating a Props-driven template to an explicit policy, retain or author the update intent appropriate to that template:

```ts
def.props.watch(['label'], (run) => run.update());
```

This is the lawful fix reported by the Shenko consumer in [#1453](https://github.com/Proto-UI/Proto-UI/issues/1453). Changing the React `key` to force a remount is unnecessary and loses owner/DOM continuity. A watcher is one valid update cause; events, public methods and other admitted callback paths can also request an update. Absence of this particular watcher alone does not prove a defect.

The focused [Props policy consumer](../../compiler/test/props-update-policy.test.ts) executes the same authored source in all six configurations and checks repeated text/style changes, native slot content, stable DOM/public handles, committed lifecycle callbacks and disposal. Its browser counterpart also observes computed CSS. These are public reproduction fixtures, not a complete Shenko or OpenGreendam/verdant application acceptance. [Compiler policy documentation](../../compiler/README.md#observable-policy) describes the other profile defaults, explicit selection and source-located Props update advice. That advisory reports a proved absence of an authored request in a closed invocation graph; it does not reject consumers that use another update cause, and unresolved callables remain unknown. The upstream positive-scheduling owner question `C-PROPS-0014-Q-CORE-UPDATE-OWNER` remains open; this diagnostic does not change that normative status or the Adapter's compatibility default.

## Component props and accessible names

React facade inputs follow the prototype's declared API. They do not extend all HTML attributes. `className` / `hostClassName` / `surfaceClassName`, their `style` counterparts, and `dir` have explicit Adapter channels. Generic `aria-*`, `data-*`, `title`, `id`, `role` and `tabIndex` inputs are not implicitly forwarded. Development builds warn once per undeclared key and logical instance; the warning omits prop values. A declared prototype prop with one of those names still belongs to that prototype. A custom `getProps` mapping may consume an input into the prototype's documented props. Prototype-owned roles and ARIA state remain authoritative.

For an icon-only Button, Toggle or Toggle Group Item, create a stable `createControlLabelRef()` from `@proto.ui/core` and pass `instanceAssociations={{ controlLabel: ref }}` to both the control and an independent Label. The rendered Label supplies the accessible name. Label activation reuses the command's ordinary operation; `activation={false}` makes the Label naming-only. The same existing association also supports Checkbox, Switch, Radio Group Item, Input and Textarea. The opaque reference never enters portable Props. Among these targets, the private Compiler admits Button, Toggle and the Label to standalone Web source and keeps an explicit unsupported diagnostic for the others, including Toggle Group Root and Item. Use a native application wrapper for application metadata, and the documented component API for semantic input. See the draft [Control Label contract](../../../spec/contracts/C-CONTROL-LABEL-0001.yaml) and [host-input diagnostic contract](../../../spec/contracts/C-REACT-HOST-PROPS-0001.yaml).

## Package Role

Adapter package intended to be used together with Proto UI prototypes and the shared runtime stack.

## Install

<!-- proto-ui-release-status:start -->

> **Unpublished release preparation:** `0.3.0` has not been published. The command below is an example for use after publication; it is not currently an installable version.

<!-- proto-ui-release-status:end -->

```bash
npm install @proto.ui/adapter-react@0.3.0
```

## Internal Structure

- `src/adapt.ts`
- `src/index.ts`
- `src/platform/`
- `src/runtime/`
- `src/template.ts`
- `src/types.ts`

## Related Internal Packages

- `@proto.ui/adapter-base`
- `@proto.ui/core`
- `@proto.ui/hooks`
- `@proto.ui/module-a11y`
- `@proto.ui/module-anatomy`
- `@proto.ui/module-as-trigger`
- `@proto.ui/module-axis-input`
- `@proto.ui/module-boundary`
- `@proto.ui/module-context`
- `@proto.ui/module-control-label`
- `@proto.ui/module-event`
- `@proto.ui/module-expose-event`
- `@proto.ui/module-expose-state`
- `@proto.ui/module-expose-state-web`
- `@proto.ui/module-feedback`
- `@proto.ui/module-focus`
- `@proto.ui/module-hit-participation`
- `@proto.ui/module-image-view`
- `@proto.ui/module-native-link`
- `@proto.ui/module-overlay`
- `@proto.ui/module-positioning`
- `@proto.ui/module-props`
- `@proto.ui/module-rule-expose-state-web`
- `@proto.ui/module-rule-meta`
- `@proto.ui/module-scroll`
- `@proto.ui/module-text-control`
- `@proto.ui/runtime`
- `@proto.ui/types`

## Portal destination compatibility (draft)

Portal views use native React `createPortal` with a stable adapter-owned container. The default destination is still `document.body`; an eligible registered scene can supply another destination. Non-portal views retain their existing DOM structure.

The portal host is now a child of one `div[data-pui-portal-mount]` container, rather than a direct child of the destination. The container has `display: contents`, no role or tabindex, and no painted box. React owns its children; only the adapter's container is placed once per physical view epoch. Open views defer destination changes until close/detach and the next view, immediately releasing material instead of moving a focused subtree. Disposal removes that container. The application must retain the destination until view release; external removal does not guarantee focus or view continuity.

Consumers using selectors such as `body > [data-pui-root]` must account for this single wrapper. Descendant inheritance and selector matching can differ in a scene; applications must test their own direct-child CSS, direction, focus and dismissal. This contract does not promise native Shadow DOM event or style equivalence. A scene must satisfy the same-document, connected, cycle and clipping/transform guards; invalid destinations fall back to body rather than broadening material source scope.

## License

MIT
