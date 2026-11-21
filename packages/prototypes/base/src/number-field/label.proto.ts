import type { NumberFieldPartProps } from './types';
import type { NumberFieldLabelExposes } from './types';
import {
  defineAsHook,
  definePrototype,
  tw,
  type DefHandle,
  type RendererHandle,
  type RunHandle,
} from '@proto.ui/core';
import { asAccessible, asAxisInput } from '@proto.ui/hooks';
import { NUMBER_FIELD_CONTEXT, NUMBER_FIELD_FAMILY, numberFieldMethod } from './shared';
function setup(def: DefHandle<{}>) {
  def.anatomy.claim(NUMBER_FIELD_FAMILY, { role: 'label' });
  asAccessible().part(NUMBER_FIELD_FAMILY, { key: 'label' });
  const input = asAxisInput();
  input.configure({ anatomy: NUMBER_FIELD_FAMILY, inputRole: 'label', geometryRole: 'label' });
  const scrub = def.state.bool('scrub', false);
  def.rule({
    when: (w) => w.state(scrub).eq(true),
    intent: (i) => i.feedback.style.use(tw('cursor-ew-resize select-none')),
  });
  let cancelOwner: (() => unknown) | null = null;
  input.on((run, sample) => {
    if (sample.phase === 'cancel') {
      // Retain only the scoped semantic cancellation command, never a host
      // target. Detaching this Label must still end its original Root session.
      const cancel = cancelOwner;
      cancelOwner = null;
      cancel?.();
      return;
    }
    if (sample.phase === 'start') {
      const owner = run.anatomy.partsOf(NUMBER_FIELD_FAMILY, 'root')[0];
      const cancel = owner?.getExpose('cancelScrub');
      cancelOwner = typeof cancel === 'function' ? () => cancel() : null;
      if (!numberFieldMethod(run, 'beginScrub')) cancelOwner = null;
      return;
    }
    numberFieldMethod(run, 'scrubBy', sample.totalDelta);
    if (sample.phase === 'end') {
      numberFieldMethod(run, 'endScrub');
      cancelOwner = null;
    }
  });
  const sync = (run: RunHandle<NumberFieldPartProps>) => {
    const c = run.context.read(NUMBER_FIELD_CONTEXT);
    const enabled = c.scrub && !c.disabled && !c.readOnly && !c.composing;
    scrub.set(enabled, 'reason: number label scrub affordance');
    input.sync({
      axis: 'horizontal',
      direction: c.direction,
      disabled: !enabled,
      readOnly: c.readOnly,
    });
  };
  def.context.subscribe(NUMBER_FIELD_CONTEXT, sync);
  def.lifecycle.onMounted(sync);
  return (r: RendererHandle<any>) => r.slot();
}
export const asNumberFieldLabel = defineAsHook<NumberFieldPartProps, NumberFieldLabelExposes>({
  name: 'as-number-field-label',
  setup,
});
export default definePrototype<NumberFieldPartProps, NumberFieldLabelExposes>({
  name: 'base-number-field-label',
  setup,
});
