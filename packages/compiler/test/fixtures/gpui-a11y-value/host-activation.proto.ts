import { definePrototype } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';

// A declared host input can have a different meaning from an ordinary press.
// There is deliberately no Trigger hook in this independently authored control.
export default definePrototype({
  name: 'native-axis-command',
  setup(def) {
    const count = def.state.numberDiscrete('count', 0);
    const accessible = asAccessible();
    accessible.role('button');
    accessible.action('activate', { event: 'host:axis-next' });
    def.expose.state('count', count);
    def.expose.event('changed', { payload: 'json' });
    def.event.on('press.commit', () => count.set(count.get() + 100));
    def.event.on('host:axis-next', (run) => {
      count.set(count.get() + 7);
      const detail: Readonly<{ count: number }> = Object.freeze({ count: count.get() });
      run.expose.emit('changed', detail);
    });
    return (renderer) => renderer.slot();
  },
});
