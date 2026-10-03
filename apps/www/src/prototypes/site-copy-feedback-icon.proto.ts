import { definePrototype } from '@proto.ui/core';
import { renderLucideCopyIcon } from '../../../../packages/prototypes/lucide/src/icons/copy';
import { renderLucideLoaderCircleIcon } from '../../../../packages/prototypes/lucide/src/icons/loader-circle';
import { renderLucideCheckIcon } from '../../../../packages/prototypes/lucide/src/icons/check';
import { renderLucideCircleAlertIcon } from '../../../../packages/prototypes/lucide/src/icons/circle-alert';
import type { CopyState } from '../components/site-copy-controller';

/** Website Copy's four feedback glyphs, using the existing Lucide render helpers.
 * One stable Prototype host renders one SVG. The application owns Clipboard state,
 * the feedback lifetime and decorative semantics; this is not a generic icon API. */
const SiteCopyFeedbackIcon = definePrototype<{ state: CopyState }>({
  name: 'site-copy-feedback-icon',
  setup(def) {
    def.props.define({
      state: { type: 'enum', empty: 'fallback', options: ['idle', 'pending', 'success', 'error'] },
    });
    def.props.setDefaults({ state: 'idle' });
    return (renderer) => {
      const state = renderer.read.props.get().state;
      const render =
        state === 'pending'
          ? renderLucideLoaderCircleIcon
          : state === 'success'
            ? renderLucideCheckIcon
            : state === 'error'
              ? renderLucideCircleAlertIcon
              : renderLucideCopyIcon;
      return render(renderer, { size: 18 });
    };
  },
});

export default SiteCopyFeedbackIcon;
