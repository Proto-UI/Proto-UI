import { defineAsHook, definePrototype, type FocusableHandle } from '@proto.ui/core';
import { asFocusable, asFocusScope, asFocusRoving } from '@proto.ui/hooks';

const asAfter = defineAsHook({ name: 'native-after', setup() {} });
const asOuter = defineAsHook<{}, {}, { asHooks: { asFocusable: FocusableHandle } }>({
  name: 'native-outer',
  setup() {
    asFocusable();
    asAfter();
    asFocusable();
  },
});

export default definePrototype({
  name: 'native-logical-focus-scope',
  setup(def) {
    const top = asFocusable();
    const capture = asOuter();
    const child = capture.getAsHook?.('asFocusable')!;
    const after = capture.getAsHook?.('native-after')!;
    const handle = capture.getAsHookHandle?.('asFocusable')!;
    def.expose.value('builtinCaptureProof', {
      name: child.name,
      privileged: child.privileged,
      mode: child.mode,
      order: child.order,
      afterOrder: after.order,
      afterPrivileged: after.privileged,
      sameRaw: child.result === top,
      sameHandle: child.handle === top,
      sameGetter: handle === top,
      initiallyFocused: handle.focused.get(),
    });
    const scope = asFocusScope();
    const roving = asFocusRoving();
    scope.configure({ entry: 'manual', restore: 'none', emptyPolicy: 'none' });
    roving.configure({ navigation: 'arrow', orientation: 'horizontal', loop: true });
    def.expose.method('first', () => scope.focusFirst());
    def.expose.method('next', () => roving.focusNext());
    def.expose.method('last', () => roving.focusLast());
    return (renderer) => renderer.el('section', renderer.slot());
  },
});
export const Target = definePrototype({
  name: 'native-logical-focus-target',
  setup(def) {
    const focus = asFocusable();
    let late = () => {};
    let rejected = false;
    def.event.on('key.down', (_run, event) => {
      late = () => event.control.requestDefaultActionPrevention();
      event.control.requestDefaultActionPrevention();
      if (event.key === 'throw' || event.key === 't') throw 0;
    });
    def.event.on('key.up', () => {
      try {
        late();
      } catch {
        rejected = true;
      }
    });
    def.expose.method('expiredInputRejected', () => rejected);
    def.expose.state('focused', focus.focused);
    def.expose.method('focus', () => focus.focus());
    def.expose.method('disable', (disabled: boolean) => focus.setDisabled(disabled));
    return (renderer) => renderer.el('button', 'target');
  },
});
