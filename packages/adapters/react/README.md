# @proto.ui/adapter-react

Translates Proto UI prototypes into React component functions for use with Proto UI adapters.

## Purpose

Translates Proto UI prototypes into React component functions that run through the Proto UI adapter contracts.

## View and Focus readiness

Physical target and A11y projection binding are independent of focus-event admission. A committed target remains available for blur and projection during an update, and a retained semantic object keeps its referenced identity across view replay. Explicit `programmatic` requests keep the synchronous accepted-effect rule: the Module synchronizes target facts. `native` requests require the resolved physical Trigger root and its event-owning view to be ready, then rely on observed focus facts. `entry` requests require the actual resolved target's event owner to be ready, including ordinary descendants; rejected entry intent is retained separately and re-resolves the target on readiness without owning descendant facts. Successful acquisition renews the private bounded layout retry allowance. Detached or disposed views are not current targets. This realizes the draft [HC-FOCUS-TARGET-0001](../../../spec/host-caps/HC-FOCUS-TARGET-0001.yaml) and the active React Adapter lifecycle boundary.

## Document theme

The default `colorScheme` reader follows root `class` / `data-theme` markers and then the system preference. Mounted colorScheme Rule consumers update their existing style contribution when that effective value changes; view detach and terminal disposal release their subscription.

The guarantee is limited to the default getter in same-document light DOM without intervening local theme markers. An explicit `getMeta` keeps sampled behavior; subtree, ShadowRoot and cross-document equivalence remain outside this slice. See [C-RULE-COLOR-SCHEME-0001](../../../spec/contracts/C-RULE-COLOR-SCHEME-0001.yaml) and [T-RULE-COLOR-SCHEME-0001](../../../spec/tests/T-RULE-COLOR-SCHEME-0001.yaml), both draft.

## Text Control values

For a statically declared Text Control root, the adapter mirrors the host lease's `defaultValue` patch into React's native `defaultValue` prop. Text Control remains the owner of the current editor value; this prevents React reconciliation from replacing an authored initial textarea value with an empty default while preserving dirty uncontrolled edits across later property updates. See [C-TEXT-CONTROL-0001](../../../spec/contracts/C-TEXT-CONTROL-0001.yaml), draft.

## Public handle identity

The adapter publishes one public handle object per mounted adapter instance. React re-runs the imperative handle effect whenever a consumer supplies a new `ref` identity, so the current callback still receives the handle. The handle is allocated once and reused: `update`, `getExposes` and `invokeInCallbackScope` keep reading the live view while its identity stays stable across renders and commits.

## Package Role

Adapter package intended to be used together with Proto UI prototypes and the shared runtime stack.

## Install

```bash
npm install @proto.ui/adapter-react@0.3.0-alpha.1
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
