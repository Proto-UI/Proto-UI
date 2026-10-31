import { definePrototype } from '@proto.ui/core';

// Ordinary generated-crate consumer input, not a component-name special case.
export default definePrototype({
  name: 'native-captured-composition',
  setup(def) {
    def.props.define({
      next: { type: 'number', empty: 'fallback' },
      requested: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ next: 0, requested: false });
    const count = def.state.numberDiscrete('count', 0);
    def.expose.state('count', count);
    def.props.watch(['next'], (_run, next) => {
      count.set(next.next);
    });
    def.props.watch(['requested'], (run, next) => {
      if (next.requested) run.update();
    });
    return (renderer) => {
      const child = renderer.el('span', 'A' + count.get());
      const capture = () => child;
      const helperAlias = capture;
      const factory = () => capture;
      const escaped = factory();
      if (escaped !== capture) return null;
      if (!helperAlias) return null;
      const alias = helperAlias();
      return renderer.el('section', [child, [null, alias], renderer.slot()]);
    };
  },
});
