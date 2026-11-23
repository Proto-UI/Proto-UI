import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asFocusable } from '@proto.ui/hooks';

type Props = { disabled?: boolean; participates?: boolean; blockTab?: boolean };
export default definePrototype<Props>({
  name: 'native-sequential-focus-target',
  setup(def) {
    def.props.define({
      disabled: { type: 'boolean', default: false },
      participates: { type: 'boolean', default: true },
      blockTab: { type: 'boolean', default: false },
    });
    const focus = asFocusable();
    def.feedback.style.use(tw('w-full h-full'));
    const sync = (run: RunHandle<Props>) => {
      focus.setDisabled(run.props.get().disabled ?? false);
      focus.setNavParticipation(run.props.get().participates === false ? 'none' : 'auto');
    };
    def.lifecycle.onCreated(sync);
    def.props.watch(['disabled', 'participates'], sync);
    def.expose.state('focused', focus.focused);
    def.expose.state('focusVisible', focus.focusVisible);
    def.expose.method('focus', () => focus.focus());
    def.expose.method('blur', () => focus.blur());
    def.event.on('key.down', (run, event) => {
      if (event.key === 'Tab' && run.props.get().blockTab)
        event.control.requestDefaultActionPrevention();
    });
    return (renderer) => renderer.el('button', 'Tab target');
  },
});
