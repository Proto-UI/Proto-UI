import { definePrototype, tw } from '@proto.ui/core';
import { asSeparatorRoot } from '@proto.ui/prototypes-base/separator';
import type { ShadcnSeparatorRootExposes, ShadcnSeparatorRootProps } from './types';

const ROOT_BASE_TOKENS = ['shrink-0', 'bg-border'].join(' ');

const separatorRoot = definePrototype<ShadcnSeparatorRootProps, ShadcnSeparatorRootExposes>({
  name: 'shadcn-separator-root',
  setup(def) {
    // P-SHADCN-SEPARATOR-BASE-INHERITANCE,
    // P-SHADCN-SEPARATOR-CURRENT-BASE-DEVIATIONS
    const separatorState = asSeparatorRoot().stateHandles;
    if (!separatorState) {
      throw new Error(
        '[shadcn-separator-root] asSeparatorRoot must project Separator root state handles.'
      );
    }
    const { orientation } = separatorState;

    // P-SHADCN-SEPARATOR-CURRENT-VISUAL-SURFACE
    def.feedback.style.use(tw(ROOT_BASE_TOKENS));

    // P-SHADCN-SEPARATOR-STATE-DRIVEN-GEOMETRY
    def.rule({
      when: (w) => w.state(orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('h-px w-full')),
    });

    def.rule({
      when: (w) => w.state(orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-full w-px')),
    });

    // P-SHADCN-SEPARATOR-CONTENTLESS: the caller prototype owns its own renderer,
    // so the inherited Base contentless renderer has to be restated here.
    return () => null;
  },
});

/**
 * P-SHADCN-SEPARATOR-DIRECT-ENTRY exposes the current Root projection.
 * P-SHADCN-SEPARATOR-COMPATIBILITY-SUBSET centralizes every upstream difference;
 * P-SHADCN-SEPARATOR-AS-CHILD-OMISSION is intentional under D-AS-CHILD-OMISSION-0001,
 * while data-slot, className and native prop forwarding remain parity gaps.
 */

export type {
  ShadcnSeparatorRootProps,
  ShadcnSeparatorRootExposes,
  ShadcnSeparatorRootStateHandles,
  ShadcnSeparatorRootAsHookContract,
} from './types';
export default separatorRoot;
