import { definePrototype, tw } from '@proto.ui/core';
import { asFocusScope } from '@proto.ui/hooks';

export default definePrototype({
  name: 'native-sequential-focus-scope',
  setup(def) {
    const scope = asFocusScope();
    scope.configure({ entry: 'manual', restore: 'none', trap: true, loop: true });
    def.feedback.style.use(tw('w-full h-full'));
    def.expose.method('activate', () => scope.activate());
    def.expose.method('deactivate', () => scope.deactivate());
    return (renderer) => renderer.slot();
  },
});
