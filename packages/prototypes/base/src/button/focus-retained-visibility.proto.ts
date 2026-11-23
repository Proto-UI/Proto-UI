import { defineAsHook, tw } from '@proto.ui/core';
import { asFocusable } from '@proto.ui/hooks';

/** A visibility request, not a replacement for the host-observed focus fact. */
export interface FocusRetainedVisibilityProps {
  requestedVisible?: boolean;
}

/**
 * Keep a focused action available until focus leaves after its request ends.
 * The caller retains the mounted owner. Reusing the singleton focus target
 * preserves the control's own disabled, navigation and activation policies.
 */
export const asFocusRetainedVisibility = defineAsHook<FocusRetainedVisibilityProps>({
  name: 'as-focus-retained-visibility',
  setup(def) {
    const focus = asFocusable<FocusRetainedVisibilityProps>();
    def.props.define({
      requestedVisible: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ requestedVisible: false });
    def.rule({
      when: (when) =>
        when.all(when.prop('requestedVisible').eq(false), when.state(focus.focused).eq(false)),
      intent: (intent) => intent.feedback.style.use(tw('hidden')),
    });
  },
});
