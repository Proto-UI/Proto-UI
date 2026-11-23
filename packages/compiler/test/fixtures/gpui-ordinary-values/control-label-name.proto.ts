import { definePrototype } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { asButton } from '../../../../prototypes/base/src/button/button.proto';

// The actual Base Button supplies the operation and ControlLabel participation.
// This consumer only supplies its own explicit accessible name.
export default definePrototype({
  name: 'native-author-named-button',
  setup(def) {
    asButton();
    const name = def.state.string('consumerName', 'Consumer-owned button name');
    asAccessible().name(name);
    def.expose.method('setConsumerName', (next: string) => {
      name.set(next, 'reason: consumer name replacement');
    });
  },
});
