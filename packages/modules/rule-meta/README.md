# @proto.ui/module-rule-meta

Proto UI module that provides rule metadata capability for adapters.

## Purpose

Provides sampled host metadata reads and a mounted `colorScheme` invalidation lease for adapters running Proto UI prototypes. The bounded contract is [C-RULE-COLOR-SCHEME-0001](../../../spec/contracts/C-RULE-COLOR-SCHEME-0001.yaml), with ownership in [M-RULE-META-0001](../../../spec/modules/M-RULE-META-0001.yaml); both remain draft.

An authored `meta:colorScheme` dependency can subscribe when the current source and `RULE_META_GET_CAP` contain the exact same getter function. Each new mounted lease samples freshly. Unmounting, detach, capability reset/mismatch and terminal disposal release it and invalidate late callbacks. A leaving view that is still mounted remains subscribed. Rule owns the complete style Plan and Feedback contribution.

The default Web source covers the document root theme in same-document light DOM without intervening local theme markers. Custom getters remain sampled; this does not establish subtree, ShadowRoot, cross-document or generic reactive Meta support. Direct `reducedMotion` reads and Transition timing retain their existing behavior.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

```bash
npm install @proto.ui/module-rule-meta@0.3.0-alpha.0
```

## Internal Structure

- `src/caps.ts`
- `src/create.ts`
- `src/index.ts`
- `src/types.ts`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-base`
- `@proto.ui/module-rule`

## License

MIT
