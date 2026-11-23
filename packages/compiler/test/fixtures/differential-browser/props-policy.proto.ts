import { definePrototype, tw } from '@proto.ui/core';

// Public reproduction of #1453: Props-driven style and rendered text have
// different owners. The no-watcher control removes only the marked registration.
export default definePrototype({
  name: 'props-policy-badge',
  setup(def) {
    def.props.define({
      label: { type: 'string', default: 'first' },
      tone: { type: 'string', default: 'offline' },
    });
    def.feedback.style.use(tw('props-policy-badge'));
    def.rule({
      when: (w) => w.prop('tone').eq('online'),
      intent: (i) => i.feedback.style.use(tw('props-policy-online')),
    });
    def.expose.event('phase', { payload: 'json' });
    // Calling an ordinary exposed method enters the Runtime synchronization
    // boundary. This method itself neither reads Props nor requests a render.
    def.expose.method('touch', () => {});
    def.lifecycle.onCreated((run) => run.expose.emit('phase', 'created'));
    def.lifecycle.onMounted((run) => run.expose.emit('phase', 'mounted'));
    def.lifecycle.onUpdated((run) => run.expose.emit('phase', 'updated'));
    def.lifecycle.onUnmounted((run) => run.expose.emit('phase', 'unmounted'));
    def.lifecycle.onBeforeDispose((run) => run.expose.emit('phase', 'beforeDispose'));
    // props-policy:watch-start
    def.props.watch(['label'], (run) => {
      run.expose.emit('phase', 'watch');
      run.update();
    });
    // props-policy:watch-end
    return (r) =>
      r.el('span', [
        r.el('i', { style: tw('props-policy-dot') }),
        r.el('strong', [r.read.props.get().label]),
        r.slot(),
      ]);
  },
});
