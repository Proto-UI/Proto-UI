import { definePrototype } from '@proto.ui/core';
import { asButton } from '../../../../prototypes/base/src/button/button.proto';

// A consumer-authored Button composition. Presence is a fixture prop, not a new Base Button prop.
export default definePrototype({
  name: 'compiler-retained-owner-button',
  setup(def) {
    asButton();
    def.props.define({ present: { type: 'boolean', empty: 'fallback' } });
    def.props.setDefaults({ present: true });
    const count = def.state.numberDiscrete('count', 0);
    def.expose.state('count', count);
    def.expose.event('viewEnded', { payload: 'void' });
    def.lifecycle.onCreated((run) => {
      run.lifecycle.setPresent(!!run.props.get().present);
    });
    def.props.watch(['present'], (run) => {
      run.lifecycle.setPresent(!!run.props.get().present);
    });
    def.event.on('press.commit', (run) => {
      if (run.props.get().disabled) return;
      count.set(count.get() + 1);
    });
    def.lifecycle.onUnmounted((run) => {
      run.expose.emit('viewEnded');
    });
  },
});
