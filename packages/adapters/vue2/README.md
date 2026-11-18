# @proto.ui/adapter-vue2

Translates Proto UI prototypes into Vue 2.6 component options for the official Vue 2 Web Adapter profile.

## Status

The repository treats this as a public package beginning with `0.3.0-alpha.0`. Its governed profile is `A-VUE-2-0001`, targeting Vue `>=2.6.0 <2.7` on the Web platform. The unreleased `0.3.0-alpha.2` train updates this package's local projection but does not change that availability boundary.

The `@proto.ui/adapter-vue2` registry identity already exists on npm under `next`; the unreleased `0.3.0-alpha.2` package cannot be installed until the release workflow publishes it. Repository readiness does not imply that alpha.2 publication has happened.

## Usage

Inject the Vue 2 runtime and adapt a Proto UI prototype:

```ts
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';

const adapt = createVue2Adapter(Vue);
const Component = adapt(prototype);
```

The Adapter uses Vue 2 options lifecycle and `render(h)` APIs; it does not require the Vue 2.7 Composition API. `@proto.ui/adapter-vue` remains the separate Vue 3 Adapter.

On component destruction, the owning Runtime finishes State disconnect notifications and subscription cleanup before the Adapter invalidates exposed callables. Retained callables become unavailable after terminal disposal; repeatable view detach keeps the instance's exposed surfaces alive.

Terminal owner destruction supersedes a pending Presence leave transition rather than waiting for its duration. Exposed callables remain available to terminal cleanup until the Runtime completes that pass. In the ordinary pending-leave case, cleanup and invalidation finish before `$destroy()` returns. The availability boundary is Runtime terminal completion, including when destruction reenters an already-running cleanup callback; component destruction beginning is not a separate invalidation boundary. This does not turn a repeatable view detach into terminal disposal.

The `beforeDestroy` hook returns the Runtime disposal promise to Vue 2. Disposal rejection is reported through Vue's ancestor `errorCaptured` hooks and `Vue.config.errorHandler` (or Vue's default error reporting), with the original rejection value. Vue does not await that promise before completing `$destroy()`; this reporting bridge defines neither recovery nor continuation for other lifecycle callback failures.

## Document theme

The default `colorScheme` reader follows root `class` / `data-theme` markers and then the system preference. Mounted colorScheme Rule consumers update their existing style contribution when that effective value changes; view detach and terminal disposal release their subscription.

The guarantee is limited to the default getter in same-document light DOM without intervening local theme markers. An explicit `getMeta` keeps sampled behavior; subtree, ShadowRoot and cross-document equivalence remain outside this slice. See [C-RULE-COLOR-SCHEME-0001](../../../spec/contracts/C-RULE-COLOR-SCHEME-0001.yaml) and [T-RULE-COLOR-SCHEME-0001](../../../spec/tests/T-RULE-COLOR-SCHEME-0001.yaml), both draft.

## References

- `spec/adapters/A-VUE-2-0001.yaml`
- `internal/records/2026-08-26-vue2-official-adapter-admission.zh-CN.md`

## License

MIT
