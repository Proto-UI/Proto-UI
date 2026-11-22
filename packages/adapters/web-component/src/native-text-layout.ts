import type { RootStyleEntry } from '@proto.ui/core/internal';
import { createOwnedTwTokenApplier, type OwnedTokenApplier } from './feedback-style';

// A bounded native-editor recipe, not a CSS-property/role heuristic. Keep the
// editor's existing token output and native intrinsic sizing. Its transparent
// owner boundary must also participate in the admitted parent allocation.
const BOUNDARY_TOKEN = 'w-full';
// field-sizing:content makes an empty textarea's min-content the placeholder
// width. The custom-element host is the flex item, so that min-content
// defeats width:100% and the editor overshoots the parent slot. The editor
// keeps its intrinsic block size; only the boundary may shrink.
const BOUNDARY_MIN_FLAG = 'data-pui-text-boundary-min';

export function createNativeTextLayoutApplier(
  host: HTMLElement,
  editor: HTMLElement,
  getEntries: () => readonly RootStyleEntry[],
  hooks: { onChange?: () => void } = {}
): OwnedTokenApplier {
  const surface = createOwnedTwTokenApplier(editor);
  const boundary = createOwnedTwTokenApplier(host);
  const syncBoundaryMin = (active: boolean) => {
    if (active) {
      if (!host.hasAttribute(BOUNDARY_MIN_FLAG)) {
        host.setAttribute(BOUNDARY_MIN_FLAG, host.style.minWidth);
      }
      host.style.minWidth = '0';
      return;
    }
    if (!host.hasAttribute(BOUNDARY_MIN_FLAG)) return;
    const previous = host.getAttribute(BOUNDARY_MIN_FLAG) ?? '';
    host.removeAttribute(BOUNDARY_MIN_FLAG);
    host.style.minWidth = previous;
  };
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
      syncBoundaryMin(placement.length > 0);
      hooks.onChange?.();
    },
    clear() {
      surface.clear();
      boundary.clear();
      syncBoundaryMin(false);
      hooks.onChange?.();
    },
    getOwned: surface.getOwned,
  };
}
