import { definePrototype, tw } from '@proto.ui/core';

export default definePrototype({
  name: 'qt-template-siblings',
  setup(def) {
    def.props.define({ children: { type: 'boolean', default: true } });
    def.props.watch(['children'], (run) => run.update());
    def.feedback.style.use(tw('w-40 h-20'));
    return (renderer) =>
      renderer.read.props.get().children
        ? [
            renderer.el('div', { style: tw('w-8 h-4') }, 'first'),
            renderer.el('div', { style: tw('w-12 h-6') }, 'second'),
          ]
        : null;
  },
});
