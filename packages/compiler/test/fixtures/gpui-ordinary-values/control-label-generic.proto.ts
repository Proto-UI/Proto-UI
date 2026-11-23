import { definePrototype } from '@proto.ui/core';
import { asAccessible, asControlLabel } from '@proto.ui/hooks';

export default definePrototype({
  name: 'generic-passive-caption',
  setup(def) {
    const label = asControlLabel().label();
    def.expose.method('enable', () => label.sync({ naming: true, activation: true }));
    return (renderer) => renderer.r.slot();
  },
});

export const SetupLabel = definePrototype({
  name: 'generic-setup-caption',
  setup() {
    const label = asControlLabel().label();
    label.sync({ naming: true, activation: true });
    return (renderer) => renderer.r.slot();
  },
});

export const Target = definePrototype({
  name: 'generic-request-target',
  setup(def) {
    asAccessible().role('button');
    def.expose.event('requested', { payload: 'json' });
    const target = asControlLabel().target((run, request) => {
      const before = request.isCurrent();
      const after = request.isCurrent();
      if (after) run.expose.emit('requested', { before, after, same: request === request });
    });
    target.sync({ naming: true, activation: true });
    def.lifecycle.onCreated(() => target.sync({ naming: false, activation: true }));
    def.expose.method('syncTarget', () => target.sync({ naming: false, activation: false }));
    return (renderer) => renderer.r.slot();
  },
});
