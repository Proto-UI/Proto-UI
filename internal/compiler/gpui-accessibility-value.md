# GPUI numeric accessibility requests

`C-COMPILER-GPUI-A11Y-VALUE-0001` governs this private source profile repair. The host capability is an atomic numeric request. It contains no Slider, knob, application, range, revision, undo or gesture policy.

```ts
import { definePrototype, type A11ySetValueEventPayload } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';

export default definePrototype({
  name: 'numeric-request-example',
  setup(def) {
    const accessible = asAccessible();
    accessible.role('slider');
    accessible.action('setValue', { event: 'host:numeric-request' });
    def.expose.event('requested', { payload: 'json' });
    def.event.on('host:numeric-request', (run, opaque) => {
      // The compiler proves this view from the preceding action declaration;
      // this assertion cannot manufacture a schema for an arbitrary host event.
      const event = opaque as A11ySetValueEventPayload;
      run.expose.emit('requested', event.value);
    });
    return (r) => r.slot();
  },
});
```

The compiler infers the same callback payload without an explicit annotation. The exported type documents the native schema for ordinary TypeScript authors, whose generic `host:*` callback starts as `unknown`. It does not change portable semantic Event payloads or assert support in another host. With no `event` option, `setValue` uses `host:a11y-set-value`. A custom route must be a literal nonempty `host:*` name for typed compiler admission, declared before its local listener.

This is a checked structural declaration in the compilation unit, not proof that a conditional declaration runs in every instance. The bridge still requires an actually registered action on the current native owner. Every numeric registration checks ingress even when its callback omits the payload parameter; a typed callback retains that check if pruning removes an unexecuted declaration.

The GPUI callback passes its `Option<&accesskit::ActionData>` to one SDK bridge. Only finite `NumericValue` enters the configured local route, as `{type, value}` plus the existing scoped `control` capability. The number is neither rounded, clamped nor written to State. The numeric listener additionally validates direct host dispatch before invoking the callback or consuming `once`. The ordinary owner attachment and disposal checks still apply.

The production accessibility Element projects `valueNow`, `valueMin` and `valueMax` to AccessKit's numeric value and range properties. It preserves zero and fractional values and omits invalid or non-finite facts. `valueText` is a separate string projection. Existing `disabled` and `readOnly` boolean state projection remains in place. A stored State binding or Slider role alone does not establish the native numeric interface; tests must inspect the projected AccessKit node, and OS acceptance must inspect the actual platform interface.

Linux AT-SPI exposes this as its `Value.CurrentValue` setter, not as an Increment/Decrement entry in the `Action` interface. A direct SDK bridge test does not prove OS delivery through GPUI's registered callback. That last link requires a real platform accessibility request to a rendered native control; record it separately from compiler, Runtime and native bridge results.
