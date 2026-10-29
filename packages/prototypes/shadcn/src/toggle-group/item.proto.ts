import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asToggleGroupItem, TOGGLE_GROUP_FAMILY } from '@proto.ui/prototypes-base/toggle-group';
import { SHADCN_STYLE_IDS, setupShadcnStyleSelection } from '../style-scope';
import { TOGGLE_COMMON, TOGGLE_PROFILE, TOGGLE_FOCUS, TOGGLE_SIZE } from '../toggle/profiles';
import { setupCollectionHover } from '../toolbar/action-visual';
import type { ShadcnToggleGroupItemProps, ShadcnToggleGroupItemExposes } from './types';
import { TOGGLE_GROUP_VISUAL_AXIS } from './visual';

/** Upstream ToggleGroupItem reuses toggleVariants; only that paint is shared.
 * asToggleGroupItem remains the sole Base hook, not asToggle or asButton.
 * This maps the existing default-size/default-variant public subset. No size,
 * variant or spacing API is silently manufactured from the upstream API.
 * New York's zero-spacing edge radii use existing logical anatomy order.
 * The vertical counterpart is a Proto axis extension, not a Radix API claim.
 * Neither DOM sibling selectors nor a replacement collection owner is used.
 */
export default definePrototype<ShadcnToggleGroupItemProps, ShadcnToggleGroupItemExposes>({
  name: 'shadcn-toggle-group-item',
  modules: asToggleGroupItem.modules,
  setup(def) {
    const behavior = asToggleGroupItem();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-toggle-group] Item state unavailable.');
    const style = setupShadcnStyleSelection(def, 'nova');
    const hovered = setupCollectionHover(def, state.disabled);
    const first = def.state.bool('toggleGroupVisualFirst', false);
    const last = def.state.bool('toggleGroupVisualLast', false);
    const axis = def.state.string('toggleGroupVisualAxis', 'horizontal');
    const syncOrder = (run: RunHandle<ShadcnToggleGroupItemProps>) => {
      const index = run.anatomy.order.indexOfSelf(TOGGLE_GROUP_FAMILY, 'item');
      first.set(index === 0, 'toggle group first logical item');
      last.set(
        index >= 0 && run.anatomy.order.nextOfSelf(TOGGLE_GROUP_FAMILY, 'item') === null,
        'toggle group last logical item'
      );
    };
    def.anatomy.subscribeParts(TOGGLE_GROUP_FAMILY, 'item', (run, parts) => {
      if (parts.length) syncOrder(run);
      else {
        first.set(false, 'toggle group membership withdrawn');
        last.set(false, 'toggle group membership withdrawn');
      }
    });
    def.lifecycle.onMounted(syncOrder);
    def.lifecycle.onUpdated(syncOrder);
    const syncAxis = (run: RunHandle<ShadcnToggleGroupItemProps>) => {
      axis.set(
        run.context.tryRead(TOGGLE_GROUP_VISUAL_AXIS)?.orientation ?? 'horizontal',
        'toggle group observed axis'
      );
    };
    def.context.trySubscribe(TOGGLE_GROUP_VISUAL_AXIS, syncAxis);
    def.lifecycle.onCreated(syncAxis);
    def.lifecycle.onMounted(syncAxis);
    def.feedback.style.use(tw(TOGGLE_COMMON));
    def.feedback.style.use(tw('shrink-0 bg-transparent'));
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'new-york-v4'
                ? 'h-9 w-auto min-w-0 shrink-0 px-3 rounded-none shadow-none gap-2 text-sm font-medium transition-[color,box-shadow]'
                : TOGGLE_PROFILE[profile]
            )
          ),
      });
      if (profile !== 'new-york-v4') {
        def.rule({
          when: (w) => w.state(style).eq(profile),
          intent: (i) => i.feedback.style.use(tw(TOGGLE_SIZE[`${profile}-default`])),
        });
      }
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(state.active).eq(true)),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'new-york-v4'
                ? 'bg-accent text-accent-foreground'
                : profile === 'sera'
                  ? 'bg-muted text-foreground'
                  : 'bg-muted'
            )
          ),
      });
      def.rule({
        when: (w) =>
          profile === 'new-york-v4'
            ? w.all(
                w.state(style).eq(profile),
                w.state(hovered).eq(true),
                w.state(state.disabled).eq(false),
                w.state(state.active).eq(false)
              )
            : w.all(
                w.state(style).eq(profile),
                w.state(hovered).eq(true),
                w.state(state.disabled).eq(false)
              ),
        intent: (i) =>
          i.feedback.style.use(
            tw(
              profile === 'new-york-v4'
                ? 'bg-muted text-muted-foreground'
                : 'bg-muted text-foreground'
            )
          ),
      });
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
        intent: (i) => i.feedback.style.use(tw(TOGGLE_FOCUS[profile])),
      });
    }
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(first).eq(true),
          w.state(axis).eq('horizontal')
        ),
      intent: (i) => i.feedback.style.use(tw('rounded-l-md')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(last).eq(true),
          w.state(axis).eq('horizontal')
        ),
      intent: (i) => i.feedback.style.use(tw('rounded-r-md')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(first).eq(true),
          w.state(axis).eq('vertical')
        ),
      intent: (i) => i.feedback.style.use(tw('rounded-t-md')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(last).eq(true),
          w.state(axis).eq('vertical')
        ),
      intent: (i) => i.feedback.style.use(tw('rounded-b-md')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('z-10 forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(state.focused).eq(true),
      intent: (i) => i.feedback.style.use(tw('z-10')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('pointer-events-none opacity-50')),
    });
    return behavior.render;
  },
});
