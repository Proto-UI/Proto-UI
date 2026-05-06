import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asButton } from '../button';
import { TOOLTIP_CONTEXT, TOOLTIP_FAMILY } from './shared';
import type {
  TooltipTriggerAsHookContract,
  TooltipTriggerExposes,
  TooltipTriggerProps,
} from './types';

function setupTooltipTrigger(def: DefHandle<TooltipTriggerProps, TooltipTriggerExposes>): void {
  def.anatomy.claim(TOOLTIP_FAMILY, { role: 'trigger' });
  asButton();

  def.props.define({
    disabled: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({ disabled: false });

  def.context.subscribe(TOOLTIP_CONTEXT);

  const updateFlags = (
    run: any,
    patch: Partial<{ triggerHovered: boolean; triggerFocused: boolean }>
  ) => {
    const ownDisabled = !!run.props.get().disabled;
    const ctx = run.context.read(TOOLTIP_CONTEXT);
    if (ownDisabled || ctx.disabled) {
      run.context.update(TOOLTIP_CONTEXT, (prev: any) => ({
        ...prev,
        triggerHovered: false,
        triggerFocused: false,
      }));
      return;
    }
    run.context.update(TOOLTIP_CONTEXT, (prev: any) => ({ ...prev, ...patch }));
  };

  def.event.on('pointer.enter', (run) => {
    updateFlags(run, { triggerHovered: true });
  });
  def.event.on('pointer.leave', (run) => {
    updateFlags(run, { triggerHovered: false });
  });
  def.event.on('native:focus', (run) => {
    updateFlags(run, { triggerFocused: true });
  });
  def.event.on('native:blur', (run) => {
    updateFlags(run, { triggerFocused: false });
  });
}

export const asTooltipTrigger = defineAsHook<
  TooltipTriggerProps,
  TooltipTriggerExposes,
  TooltipTriggerAsHookContract
>({
  name: 'as-tooltip-trigger',
  mode: 'once',
  setup: setupTooltipTrigger,
});

const tooltipTrigger = definePrototype({
  name: 'base-tooltip-trigger',
  setup: setupTooltipTrigger,
});

export default tooltipTrigger;
