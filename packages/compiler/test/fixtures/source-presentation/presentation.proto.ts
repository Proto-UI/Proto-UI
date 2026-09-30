import { definePrototype, tw } from '@proto.ui/core';
import { asButton } from '../../../../prototypes/base/src/button/button.proto';

// One finite authored program is executed by Adapter and compiled for both profiles.
export default definePrototype({
  name: 'compiler-source-presentation',
  setup(def) {
    asButton();
    def.props.define({ present: { type: 'boolean', default: true }, accent: { type: 'boolean', default: false } });
    const earlier = def.state.bool('earlier', true);
    const later = def.state.bool('later', false);
    const count = def.state.numberDiscrete('count', 0);
    const dimmed = def.state.bool('dimmed', true);
    def.expose.state('count', count);
    def.expose.state('later', later);
    def.expose.method('setLater', (value: boolean) => { later.set(value); });
    def.expose.event('updated', { payload: 'void' });
    def.feedback.style.use(tw('bg-blue-500 w-48 h-16 opacity-100'));
    def.rule({
      when: (w) => w.state(dimmed).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-40')),
    });
    def.rule({
      when: (w) => w.state(earlier).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-green-500 w-56')),
    });
    def.rule({
      when: (w) => w.any(w.state(later).eq(true), w.prop('accent').eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-red-500 w-64')),
    });
    def.lifecycle.onCreated((run) => { run.lifecycle.setPresent(run.props.get().present); });
    def.props.watch(['present'], (run, next) => { run.lifecycle.setPresent(next.present); });
    def.lifecycle.onUpdated((run) => { run.expose.emit('updated'); });
    def.event.on('press.commit', (run) => {
      if (run.props.get().disabled) return;
      count.set(count.get() + 1);
    });
    def.event.onGlobal('key.down', (run, event) => {
      if (event.key === 'r') dimmed.set(false);
      if (event.key === 's') run.feedback.style.suppress(tw('w-48'));
      if (event.key === 'p') run.feedback.style.patch(tw('bg-purple-500 w-72'));
      if (event.key === 'c') run.feedback.style.clearPatch();
      if (event.key === 'u') run.update();
    });
    return (r) => r.el('span', { style: tw('bg-yellow-500 p-2') }, ['Presentation ', count.get()]);
  },
});
