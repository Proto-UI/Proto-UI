# @proto.ui/adapter-vue2

Translates Proto UI prototypes into Vue 2.6 component options for the official Vue 2 Web Adapter profile.

## Status

The repository treats this as a public package beginning with `0.3.0-alpha.0`. Its governed profile is `A-VUE-2-0001`, targeting Vue `>=2.6.0 <2.7` on the Web platform.

The package cannot be installed from npm until the `@proto.ui/adapter-vue2` registry identity is created and the release workflow publishes it. Repository readiness does not imply that publication has happened.

## Usage

Inject the Vue 2 runtime and adapt a Proto UI prototype:

```ts
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';

const adapt = createVue2Adapter(Vue);
const Component = adapt(prototype);
```

The Adapter uses Vue 2 options lifecycle and `render(h)` APIs; it does not require the Vue 2.7 Composition API. `@proto.ui/adapter-vue` remains the separate Vue 3 Adapter.

## Document theme

The default `colorScheme` reader follows root `class` / `data-theme` markers and then the system preference. Mounted colorScheme Rule consumers update their existing style contribution when that effective value changes; view detach and terminal disposal release their subscription.

The guarantee is limited to the default getter in same-document light DOM without intervening local theme markers. An explicit `getMeta` keeps sampled behavior; subtree, ShadowRoot and cross-document equivalence remain outside this slice. See [C-RULE-COLOR-SCHEME-0001](../../../spec/contracts/C-RULE-COLOR-SCHEME-0001.yaml) and [T-RULE-COLOR-SCHEME-0001](../../../spec/tests/T-RULE-COLOR-SCHEME-0001.yaml), both draft.

## References

- `spec/adapters/A-VUE-2-0001.yaml`
- `internal/records/2026-08-26-vue2-official-adapter-admission.zh-CN.md`

## License

MIT
