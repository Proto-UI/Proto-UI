import { asAccessible } from '@proto.ui/hooks';
import { definePrototype, tw } from '@proto.ui/core';
import type {
  BrutalistSpinnerRootExposes,
  BrutalistSpinnerRootProps,
  BrutalistSpinnerSize,
} from './types';

// D-BRUTALIST-STYLED-ONLY-ADMISSION-0001-SPINNER-API
const SPINNER_SIZE_TOKENS: Record<BrutalistSpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

// D-BRUTALIST-STYLED-ONLY-ADMISSION-0001-SPINNER-VISUAL
// Keep the open edge and other sides in one v0 border-color intent.
const SPINNER_VISUAL_TOKENS =
  'inline-block shrink-0 rounded-none border-2 border-[transparent_currentColor_currentColor_currentColor] bg-transparent animate-spin will-change-transform';

export const BrutalistSpinnerRoot = definePrototype<
  BrutalistSpinnerRootProps,
  BrutalistSpinnerRootExposes
>({
  name: 'brutalist-spinner-root',
  setup(def) {
    // P-BRUTALIST-SPINNER-DIRECT-OWNERSHIP: always aria-hidden, roleless,
    // non-focusable, and contentless; loading/busy/announcement stay parent-owned.
    const accessible = asAccessible();
    accessible.tree({ hidden: true });
    // D-BRUTALIST-STYLED-ONLY-ADMISSION-0001-SPINNER-API
    def.props.define({
      size: {
        type: 'enum',
        empty: 'fallback',
        options: ['sm', 'md', 'lg'],
      },
    });
    def.props.setDefaults({ size: 'md' });
    // D-BRUTALIST-STYLED-ONLY-ADMISSION-0001-SPINNER-BOUNDARY
    // Spinner is always aria-hidden, roleless, non-focusable, and contentless;
    // loading/busy/announcement semantics stay parent-owned.
    // D-BRUTALIST-STYLED-ONLY-ADMISSION-0001-SPINNER-VISUAL
    def.feedback.style.use(tw(SPINNER_VISUAL_TOKENS));
    // P-BRUTALIST-SPINNER-MOTION-REDUCED-MOTION: the reduced-motion fallback
    // is a generated @media (prefers-reduced-motion: reduce) rule emitted by
    // the CLI renderer whenever animate-spin projects; the open edge stays.
    // D-BRUTALIST-STYLED-ONLY-ADMISSION-0001-SPINNER-API
    (Object.keys(SPINNER_SIZE_TOKENS) as BrutalistSpinnerSize[]).forEach((size) => {
      def.rule({
        when: (w) => w.prop('size').eq(size),
        intent: (i) => i.feedback.style.use(tw(SPINNER_SIZE_TOKENS[size])),
      });
    });
    return () => null;
  },
});
