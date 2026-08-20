import { definePrototype, tw } from '@proto.ui/core';
import type { BrutalistSkeletonRootExposes, BrutalistSkeletonRootProps } from './types';

export const BrutalistSkeletonRoot = definePrototype<
  BrutalistSkeletonRootProps,
  BrutalistSkeletonRootExposes
>({
  name: 'brutalist-skeleton-root',
  setup(def) {
    // P-BRUTALIST-SKELETON-DIRECT-OWNERSHIP, P-BRUTALIST-SKELETON-VISUAL-ONLY
    def.a11y.tree({ hidden: true });
    // P-BRUTALIST-SKELETON-CONSUMER-SIZE — the consuming composition owns dimensions.
    // P-BRUTALIST-SKELETON-VISUAL-GRAMMAR
    def.feedback.style.use(
      tw(
        'block rounded-none border-2 border-foreground bg-lavender shadow-[2px_2px_0_0_var(--pui-foreground)]'
      )
    );
    return () => null;
  },
});
