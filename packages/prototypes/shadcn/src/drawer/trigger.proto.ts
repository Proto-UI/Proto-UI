import { definePrototype, tw } from '@proto.ui/core';
import { asDrawerTrigger, type DrawerTriggerExposes } from '@proto.ui/prototypes-base/drawer';

import type { DrawerTriggerProps } from './types';
import {
  SHADCN_BUTTON_BASE_TOKENS,
  SHADCN_BUTTON_DEFAULT_SIZE_TOKENS,
  SHADCN_BUTTON_WRAP_DEFAULT_SIZE_TOKENS,
  SHADCN_BUTTON_OUTLINE_VARIANT_TOKENS,
  SHADCN_BUTTON_OUTLINE_HOVER_TOKENS,
  SHADCN_BUTTON_FOCUS_TOKENS,
  SHADCN_BUTTON_DISABLED_TOKENS,
} from '../button/paint';

export default definePrototype<DrawerTriggerProps, DrawerTriggerExposes>({
  name: 'shadcn-drawer-trigger',
  setup(def) {
    const behavior = asDrawerTrigger();
    def.props.define({ wrap: { type: 'boolean', empty: 'fallback' } });
    def.props.setDefaults({ wrap: false });
    const wrap = def.state.bool('drawerCommandWrap', false);
    def.lifecycle.onCreated((run) => wrap.set(!!run.props.get().wrap));
    def.props.watch(['wrap'], (_run, next) => wrap.set(!!next.wrap));
    def.feedback.style.use(tw(SHADCN_BUTTON_BASE_TOKENS, SHADCN_BUTTON_OUTLINE_VARIANT_TOKENS));
    def.rule({
      when: (w) => w.state(wrap).eq(false),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_DEFAULT_SIZE_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(wrap).eq(true),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_WRAP_DEFAULT_SIZE_TOKENS)),
    });
    const state = behavior.getState!;
    def.rule({
      when: (w) =>
        w.all(w.state(state('hovered')!).eq(true), w.state(state('disabled')!).eq(false)),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_OUTLINE_HOVER_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_DISABLED_TOKENS)),
    });
  },
});
