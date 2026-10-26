import type { RootStyleEntry } from '@proto.ui/core/internal';
import { createOwnedTwTokenApplier, type OwnedTokenApplier } from './feedback-style';

// A bounded native-editor recipe, not a CSS-property/role heuristic. Keep the
// editor's existing token output and native intrinsic sizing. Its transparent
// owner boundary must also participate in the admitted parent allocation.
const BOUNDARY_TOKEN = 'w-full';

export function createNativeTextLayoutApplier(
  host: HTMLElement,
  editor: HTMLElement,
  getEntries: () => readonly RootStyleEntry[],
  hooks: { onChange?: () => void } = {}
): OwnedTokenApplier {
  const surface = createOwnedTwTokenApplier(editor);
  const boundary = createOwnedTwTokenApplier(host);
  return {
    apply(tokens) {
      const byToken = new Map(getEntries().map((entry) => [entry.token, entry]));
      const placement = tokens.filter((token) => {
        const entry = byToken.get(token);
        return (
          entry?.role === 'placement' &&
          entry.roleSource === 'canonical' &&
          entry.authorToken === BOUNDARY_TOKEN
        );
      });
      // Both projections use this same final merged output, before view commit.
      // Paint, padding, border, font and raw surface customization stay native.
      surface.apply(tokens);
      boundary.apply(placement);
      hooks.onChange?.();
    },
    clear() {
      surface.clear();
      boundary.clear();
      hooks.onChange?.();
    },
    getOwned: surface.getOwned,
  };
}
