import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { ACCORDION_ITEM_FAMILY, rejectAccordionDuplicatePart } from './shared';
import type {
  AccordionHeadingProps,
  AccordionHeadingExposes,
  AccordionHeadingAsHookContract,
} from './types';
function setupAccordionHeading(def: DefHandle<AccordionHeadingProps, AccordionHeadingExposes>) {
  def.anatomy.claim(ACCORDION_ITEM_FAMILY, { role: 'heading' });
  def.props.define({
    level: {
      type: 'number',
      empty: 'fallback',
      validator: (value) => Number.isInteger(value) && value >= 1 && value <= 6,
    },
  });
  def.props.setDefaults({ level: 3 });
  const level = def.state.numberDiscrete('level', 3);
  def.expose.state('level', level);
  const accessible = asAccessible();
  accessible.role('heading');
  accessible.level(level);
  def.lifecycle.onCreated((run) => {
    rejectAccordionDuplicatePart(run, 'heading');
    level.set(run.props.get().level ?? 3, 'reason: accordion heading level');
  });
  def.props.watch(['level'], (_run, next) =>
    level.set(next.level ?? 3, 'reason: accordion heading level')
  );
}
export const asAccordionHeading = defineAsHook<
  AccordionHeadingProps,
  AccordionHeadingExposes,
  AccordionHeadingAsHookContract
>({ name: 'as-accordion-heading', setup: setupAccordionHeading });
export default definePrototype({ name: 'base-accordion-heading', setup: setupAccordionHeading });
