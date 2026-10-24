import { type DefHandle, type RunHandle, tw } from '@proto.ui/core';
import { TABS_CONTEXT } from '@proto.ui/prototypes-base/tabs';
import { setupShadcnStyleSelection, type ShadcnStyleProps } from '../style-scope';

export const TABS_PROJECTED_STYLES = Object.freeze(['new-york-v4', 'nova', 'rhea'] as const);
/** Derived visual observation only: Base remains the sole orientation/selection owner. */
export function setupTabsVisual(def: DefHandle<ShadcnStyleProps>) {
  const style = setupShadcnStyleSelection(def, 'new-york-v4', {
    supportedStyles: TABS_PROJECTED_STYLES,
  });
  const orientation = def.state.enum('shadcnTabsVisualOrientation', 'horizontal', {
    options: ['horizontal', 'vertical'],
  });
  const sync = (run: RunHandle<ShadcnStyleProps>) => {
    orientation.set(
      run.context.read(TABS_CONTEXT).orientation,
      'reason: observe Base Tabs orientation for paint'
    );
  };
  def.context.subscribe(TABS_CONTEXT, sync);
  def.lifecycle.onMounted(sync);
  return { style, orientation };
}

export const TAB_TRIGGER_COMMON = tw(
  'relative inline-flex h-[calc(100%_-_1px)] flex-1 items-center justify-center whitespace-nowrap text-foreground/60 transition-all select-none gap-1.5 border border-transparent text-sm font-medium'
);
export const TAB_TRIGGER_RECIPES = {
  'new-york-v4': tw('rounded-md px-2 py-1'),
  nova: tw('rounded-md px-1.5 py-0.5'),
  rhea: tw('rounded-2xl px-1.5 py-0.5'),
};
