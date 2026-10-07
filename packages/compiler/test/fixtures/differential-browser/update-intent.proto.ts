import { definePrototype } from '@proto.ui/core';

export default definePrototype({
  name: 'compiler-update-intent',
  setup(def) {
    def.props.define({
      next: { type: 'number', empty: 'fallback' },
      requested: { type: 'boolean', empty: 'fallback' },
      present: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ next: 0, requested: false, present: true });
    const count = def.state.numberDiscrete('count', 0);
    def.expose.state('count', count);
    def.expose.event('updated', { payload: 'void' });
    def.props.watch(['next'], (_run, next) => {
      count.set(next.next);
    });
    def.props.watch(['requested'], (run, next) => {
      if (next.requested) run.update();
    });
    def.props.watch(['present'], (run, next) => {
      run.lifecycle.setPresent(next.present);
    });
    def.lifecycle.onUpdated((run) => {
      run.expose.emit('updated');
    });
    return (renderer) => renderer.el('p', '' + count.get());
  },
});
