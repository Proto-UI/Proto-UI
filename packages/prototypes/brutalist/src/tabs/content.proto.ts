import { definePrototype, tw } from '@proto.ui/core';
import { asTabsContent } from '@proto.ui/prototypes-base/tabs';
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
    // P-BRUTALIST-TABS-CONTENT-VISUAL-GRAMMAR — content without a second compulsory frame.
    def.feedback.style.use(
      tw('block w-full min-h-28 p-4 font-sans font-medium text-sm leading-6 text-foreground')
    );
    // P-BRUTALIST-TABS-CONTENT-HIDDEN-STATE — hidden collapses the panel via the `hidden` token.
    def.rule({
      when: (w) => w.state(hidden).eq(true),
      intent: (i) => i.feedback.style.use(tw('hidden')),
    });
  },
});

export default tabsContent;
