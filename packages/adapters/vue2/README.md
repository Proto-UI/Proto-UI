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

## References

- `spec/adapters/A-VUE-2-0001.yaml`
- `internal/records/2026-08-26-vue2-official-adapter-admission.zh-CN.md`

## License

MIT
