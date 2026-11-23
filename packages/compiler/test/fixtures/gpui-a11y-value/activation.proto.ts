import { definePrototype } from '@proto.ui/core';
import { asAccessible, asTrigger } from '@proto.ui/hooks';

// An ordinary authored command, independent of the Base Button implementation.
// C-EVENT-TYPE-0002 owns input intent; only this callback owns the outward signal.
export default definePrototype({
  name: 'native-assistive-command',
  setup(def) {
    def.props.define({ disabled: { type: 'boolean', default: false } });
    asTrigger();
    const disabled = def.state.bool('disabled', false);
    const selected = def.state.bool('selected', false);
    const applicable = def.state.bool('applicable', false);
    const obsolete = def.state.bool('obsolete', true);
    const count = def.state.numberDiscrete('count', 0);
    const accessible = asAccessible();
    accessible.role('button');
    accessible.name('Native authored command');
    accessible.state('disabled', disabled);
    accessible.state('pressed', obsolete);
    accessible.state('pressed', selected, { when: applicable });
    accessible.state('selected', selected, { when: applicable });
    accessible.state('expanded', selected, { when: applicable });
    accessible.action('activate', { event: 'invoked' });
    def.lifecycle.onCreated((run) => disabled.set(run.props.get().disabled));
    def.expose.state('count', count);
    def.expose.state('selected', selected);
    def.expose.event('invoked', { payload: 'json' });
    def.expose.method('setDisabled', (next: boolean) => disabled.set(next));
    def.expose.method('setApplicable', (next: boolean) => applicable.set(next));
    def.expose.method('setSelected', (next: boolean) => selected.set(next));
    def.expose.method('setObsolete', (next: boolean) => obsolete.set(next));
    def.event.on('press.commit', (run, event) => {
      if (disabled.get()) return;
      count.set(count.get() + 2);
      selected.set(!selected.get());
      event.control.requestDefaultActionPrevention();
      run.expose.emit('invoked', { count: count.get(), selected: selected.get() });
    });
    return (r) => r.slot();
  },
});
