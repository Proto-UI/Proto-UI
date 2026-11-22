import { definePrototype, type A11ySetValueEventPayload } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';

export default definePrototype({
  name: 'native-numeric-accessibility-request',
  setup(def) {
    def.props.define({ disabled: { type: 'boolean', default: false } });
    const value = def.state.numberRange('value', 0.5, { min: 0, max: 1 });
    const minimum = def.state.numberDiscrete('minimum', 0);
    const maximum = def.state.numberDiscrete('maximum', 1);
    const disabled = def.state.bool('disabled', false);
    const readOnly = def.state.bool('readOnly', false);
    const valueText = def.state.string('valueText', 'Half');
    const calls = def.state.numberDiscrete('calls', 0);
    const once = def.state.numberDiscrete('once', 0);
    const onceZero = def.state.numberDiscrete('onceZero', 0);
    const onceOne = def.state.numberDiscrete('onceOne', 0);
    const prunedZero = def.state.numberDiscrete('prunedZero', 0);
    const prunedOne = def.state.numberDiscrete('prunedOne', 0);
    const prunedTwo = def.state.numberDiscrete('prunedTwo', 0);
    const beforeDeclaration = def.state.numberDiscrete('beforeDeclaration', 0);
    const afterDeclaration = def.state.numberDiscrete('afterDeclaration', 0);
    const obsolete = def.state.numberDiscrete('obsolete', 0);
    const accessible = asAccessible();
    accessible.role('slider');
    accessible.name('Native value request');
    accessible.state('valueNow', value);
    accessible.state('valueMin', minimum);
    accessible.state('valueMax', maximum);
    accessible.state('valueText', valueText);
    accessible.state('disabled', disabled);
    accessible.state('readOnly', readOnly);
    def.lifecycle.onCreated((run) => disabled.set(run.props.get().disabled));
    // Structural schema evidence survives pruning, without registering an action
    // on this instance. All callback arities still validate direct host ingress.
    if (false) accessible.action('setValue', { event: 'host:pruned-numeric' });
    def.event.on('host:pruned-numeric', () => prunedZero.set(prunedZero.get() + 1), { once: true });
    def.event.on('host:pruned-numeric', (_run) => prunedOne.set(prunedOne.get() + 1), {
      once: true,
    });
    def.event.on('host:pruned-numeric', (_run, _event) => prunedTwo.set(prunedTwo.get() + 1), {
      once: true,
    });
    // A later declaration cannot retroactively retype an earlier generic route.
    def.event.on('host:ordered-numeric', () => beforeDeclaration.set(beforeDeclaration.get() + 1), {
      once: true,
    });
    function declareOrderedNumeric() {
      accessible.action('setValue', { event: 'host:ordered-numeric' });
    }
    declareOrderedNumeric();
    def.event.on('host:ordered-numeric', () => afterDeclaration.set(afterDeclaration.get() + 1), {
      once: true,
    });
    accessible.action('setValue', { event: 'host:obsolete-value' });
    accessible.action('setValue', { event: 'host:numeric-request' });
    def.expose.state('value', value);
    def.expose.state('calls', calls);
    def.expose.state('once', once);
    def.expose.state('onceZero', onceZero);
    def.expose.state('onceOne', onceOne);
    def.expose.state('prunedZero', prunedZero);
    def.expose.state('prunedOne', prunedOne);
    def.expose.state('prunedTwo', prunedTwo);
    def.expose.state('beforeDeclaration', beforeDeclaration);
    def.expose.state('afterDeclaration', afterDeclaration);
    def.expose.state('obsolete', obsolete);
    def.expose.event('requested', { payload: 'json' });
    def.expose.method('accept', (next: number) => value.set(next));
    def.expose.method('setDisabled', (next: boolean) => disabled.set(next));
    def.expose.method('setReadOnly', (next: boolean) => readOnly.set(next));
    def.event.on('host:obsolete-value', () => obsolete.set(obsolete.get() + 1));
    def.event.on('host:numeric-request', (run, opaque) => {
      const event = opaque as A11ySetValueEventPayload;
      if (run.props.get().disabled) return;
      calls.set(calls.get() + 1);
      run.expose.emit('requested', { type: event.type, value: event.value });
      const control = event.control;
      control.requestDefaultActionPrevention();
    });
    def.event.on(
      'host:numeric-request',
      (_run, opaque) => {
        const event = opaque as A11ySetValueEventPayload;
        if (Number.isFinite(event.value)) once.set(once.get() + 1);
      },
      { once: true }
    );
    def.event.on('host:numeric-request', () => onceZero.set(onceZero.get() + 1), { once: true });
    def.event.on('host:numeric-request', (_run) => onceOne.set(onceOne.get() + 1), { once: true });
    return (r) => r.slot();
  },
});
