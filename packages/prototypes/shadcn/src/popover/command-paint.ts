import { tw, type DefHandle, type State } from '@proto.ui/core';
import { SHADCN_STYLE_IDS, type ShadcnStyleProps } from '../style-scope';
import { MODERN_OVERLAY_STYLES, setupOverlayStyle } from '../dialog/style';
import {
  SHADCN_ACTION_BASE,
  SHADCN_ACTION_TEXT,
  SHADCN_ACTION_RADIUS,
  SHADCN_ACTION_FOCUS,
  SHADCN_ACTION_SIZES,
  SHADCN_BUTTON_OUTLINE,
  SHADCN_BUTTON_OUTLINE_HOVER,
} from '../button/profiles';
import {
  SHADCN_BUTTON_BASE_TOKENS,
  SHADCN_BUTTON_DEFAULT_SIZE_TOKENS,
  SHADCN_BUTTON_OUTLINE_VARIANT_TOKENS,
  SHADCN_BUTTON_OUTLINE_HOVER_TOKENS,
  SHADCN_BUTTON_FOCUS_TOKENS,
  SHADCN_BUTTON_DISABLED_TOKENS,
} from '../button/paint';

const DARK_OUTLINE = {
  vega: 'border-input bg-input/30',
  nova: 'border-input bg-input/30',
  maia: '',
  lyra: 'border-input bg-input/30',
  mira: 'bg-input/30',
  luma: 'bg-transparent',
  sera: '',
  rhea: 'bg-transparent',
  'new-york-v4': 'border-input bg-input/30',
} as const;
const DARK_OUTLINE_HOVER = {
  vega: 'bg-input/50',
  nova: 'bg-input/50',
  maia: 'bg-input/50',
  lyra: 'bg-input/50',
  mira: 'bg-input/50',
  luma: 'bg-input/30',
  sera: 'bg-input/30',
  rhea: 'bg-input/30',
  'new-york-v4': 'bg-input/50',
} as const;

/** Existing Proto command appearance, not an upstream Popover Close export.
 * The default keeps the independently adopted c2a67849 Nova density. Every
 * explicit modern profile maps its own default outline Button paint only.
 * No Button hook, event, variant/size API or second activation owner is added.
 */
export function setupPopoverCommandPaint(
  def: DefHandle<ShadcnStyleProps>,
  state: {
    hovered: State<boolean>;
    focusVisible: State<boolean>;
    disabled: State<boolean>;
    pressed: State<boolean>;
  },
  command: 'trigger' | 'close'
) {
  const style = setupOverlayStyle(def, 'nova');
  def.rule({
    when: (w) => w.state(style).eq('new-york-v4'),
    intent: (i) =>
      i.feedback.style.use(
        tw(
          SHADCN_BUTTON_BASE_TOKENS,
          SHADCN_BUTTON_DEFAULT_SIZE_TOKENS,
          SHADCN_BUTTON_OUTLINE_VARIANT_TOKENS
        )
      ),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('new-york-v4'),
        w.state(state.hovered).eq(true),
        w.state(state.disabled).eq(false)
      ),
    intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_OUTLINE_HOVER_TOKENS)),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(state.focusVisible).eq(true)),
    intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_FOCUS_TOKENS)),
  });
  for (const profile of MODERN_OVERLAY_STYLES) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            SHADCN_ACTION_BASE,
            SHADCN_ACTION_TEXT[profile],
            SHADCN_ACTION_RADIUS[profile],
            SHADCN_ACTION_SIZES[`${profile}-default`],
            SHADCN_BUTTON_OUTLINE[profile]
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_OUTLINE_HOVER[profile])),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.state(state.focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw(SHADCN_ACTION_FOCUS[profile])),
    });
  }
  for (const profile of SHADCN_STYLE_IDS) {
    if (DARK_OUTLINE[profile])
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.meta('colorScheme').eq('dark')),
        intent: (i) => i.feedback.style.use(tw(DARK_OUTLINE[profile])),
      });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.meta('colorScheme').eq('dark'),
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(DARK_OUTLINE_HOVER[profile])),
    });
  }
  // The trigger carries hasPopup=dialog; upstream's active movement excludes
  // popup triggers. The separate Close has no popup and borrows its own press.
  if (command === 'close') {
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.state(style).eq('new-york-v4')),
          w.state(state.pressed).eq(true),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('translate-y-px')),
    });
  }
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_DISABLED_TOKENS)),
  });
}
