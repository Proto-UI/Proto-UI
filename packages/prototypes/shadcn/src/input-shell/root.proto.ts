import { definePrototype } from '@proto.ui/core';
import { SHADCN_STYLE_IDS } from '../style-scope';
import { INPUT_SHELL_PAINT } from './context';
import type { InputShellProps } from './types';
import { setupInputShellPaint } from './visual';
export const INPUT_SHELL_PROJECTED_STYLES = SHADCN_STYLE_IDS;
export const inputShell = definePrototype<InputShellProps>({
  name: 'shadcn-input-shell',
  setup(def) {
    def.context.provide(INPUT_SHELL_PAINT, { grouped: true });
    def.props.define({
      focusVisible: { type: 'boolean' },
      disabled: { type: 'boolean' },
      focusIndicator: { type: 'enum', options: ['ring', 'none'], empty: 'fallback' },
    });
    def.props.setDefaults({ focusVisible: false, disabled: false, focusIndicator: 'ring' });
    setupInputShellPaint(def);
    return (r) => [r.r.slot()];
  },
});
export default inputShell;
