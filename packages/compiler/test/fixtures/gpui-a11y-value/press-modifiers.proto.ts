import { definePrototype } from '@proto.ui/core';
import { asTrigger } from '@proto.ui/hooks';
export default definePrototype({
  name: 'native-press-modifier-transport',
  setup(def) {
    asTrigger();
    def.expose.event('pressed', { payload: 'json' });
    def.event.on('press.commit', (run, event) => {
      run.expose.emit('pressed', {
        shift: event.shiftKey ?? false,
        ctrl: event.ctrlKey ?? false,
        alt: event.altKey ?? false,
        meta: event.metaKey ?? false,
      });
    });
    return (r) => r.slot();
  },
});
