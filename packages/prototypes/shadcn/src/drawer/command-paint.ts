import { tw, type DefHandle, type State } from '@proto.ui/core';
import type { ShadcnStyleProps } from '../style-scope';
import { setupOverlayStyle } from '../dialog/style';
import {
  SHADCN_BUTTON_BASE_TOKENS,
  SHADCN_BUTTON_OUTLINE_VARIANT_TOKENS,
  SHADCN_BUTTON_DEFAULT_SIZE_TOKENS,
  SHADCN_BUTTON_WRAP_DEFAULT_SIZE_TOKENS,
  SHADCN_BUTTON_OUTLINE_HOVER_TOKENS,
  SHADCN_BUTTON_FOCUS_TOKENS,
  SHADCN_BUTTON_DISABLED_TOKENS,
} from '../button/paint';

/** Existing New York demo-Button appearance is retained as a Proto extension.
 * The modern upstream Trigger and Close are headless, so selecting one of
 * those profiles withdraws this paint without changing the Drawer command.
 */
export function setupDrawerCommandPaint(
  def: DefHandle<ShadcnStyleProps & { wrap?: boolean }>,
  state: { hovered: State<boolean>; focusVisible: State<boolean>; disabled: State<boolean> }
) {
  def.props.define({ wrap: { type: 'boolean', empty: 'fallback' } });
  def.props.setDefaults({ wrap: false });
  const style = setupOverlayStyle(def);
  def.rule({
    when: (w) => w.state(style).eq('new-york-v4'),
    intent: (i) =>
      i.feedback.style.use(tw(SHADCN_BUTTON_BASE_TOKENS, SHADCN_BUTTON_OUTLINE_VARIANT_TOKENS)),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('wrap').eq(false)),
    intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_DEFAULT_SIZE_TOKENS)),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.prop('wrap').eq(true)),
    intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_WRAP_DEFAULT_SIZE_TOKENS)),
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
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(state.disabled).eq(true)),
    intent: (i) => i.feedback.style.use(tw(SHADCN_BUTTON_DISABLED_TOKENS)),
  });
}
