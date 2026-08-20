import { definePrototype, tw } from '@proto.ui/core';
import { asTabsContent } from '@proto.ui/prototypes-base/tabs';
import { BRUTALIST_PANEL_TOKENS } from '../style';
import type { BrutalistTabsContentExposes, BrutalistTabsContentProps } from './types';

const tabsContent = definePrototype<BrutalistTabsContentProps, BrutalistTabsContentExposes>({
  // P-BRUTALIST-TABS-CONTENT-ENTRY
  name: 'brutalist-tabs-content',
  setup(def) {
    // P-BRUTALIST-TABS-CONTENT-BASE-INHERITANCE
    const contentState = asTabsContent().stateHandles;
    if (!contentState) {
      throw new Error(
        '[brutalist-tabs-content] asTabsContent must project Tabs content state handles.'
      );
    }
    const { hidden } = contentState;

    // P-BRUTALIST-TABS-CONTENT-FOCUS-INDICATION — do not suppress the native
    // focus-visible outline when Base Tabs Content selects the root fallback.
    // P-BRUTALIST-TABS-CONTENT-VISUAL-GRAMMAR — square bordered panel: BRUTALIST_PANEL_TOKENS
    // (rounded-none, border-2 border-black, hard shadow, bg-secondary-background, text-foreground)
    // over a block w-full min-h-28 p-4 text-sm content surface.
    def.feedback.style.use(
      tw(`block w-full min-h-28 p-4 text-sm leading-6 ${BRUTALIST_PANEL_TOKENS}`)
    );
    // P-BRUTALIST-TABS-CONTENT-HIDDEN-STATE — hidden collapses the panel via the `hidden` token.
    def.rule({
      when: (w) => w.state(hidden).eq(true),
      intent: (i) => i.feedback.style.use(tw('hidden')),
    });
  },
});

export default tabsContent;
