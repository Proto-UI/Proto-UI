import type { DefHandle, RunHandle } from '@proto.ui/core';
import {
  SHADCN_STYLE_SCOPE,
  setupShadcnStyleScope,
  setupShadcnStyleSelection,
  type ShadcnStyleProps,
} from '../style-scope';
export const COMMAND_PROJECTED_STYLES = ['new-york-v4', 'rhea'] as const;
export function setupCommandStyle(def: DefHandle<any>, root = false) {
  if (!root)
    return setupShadcnStyleSelection(def, 'new-york-v4', {
      supportedStyles: COMMAND_PROJECTED_STYLES,
    });
  setupShadcnStyleScope(def);
  const style = def.state.enum('commandResolvedStyle', 'new-york-v4', {
    options: COMMAND_PROJECTED_STYLES,
  });
  const sync = (run: RunHandle<ShadcnStyleProps>) => {
    const next = run.context.tryRead(SHADCN_STYLE_SCOPE)?.style ?? 'new-york-v4';
    if (!COMMAND_PROJECTED_STYLES.includes(next as (typeof COMMAND_PROJECTED_STYLES)[number]))
      throw new Error(`[shadcn-command] Unsupported style: ${next}`);
    style.set(
      next as (typeof COMMAND_PROJECTED_STYLES)[number],
      'reason: observe Command family scope'
    );
  };
  def.context.trySubscribe(SHADCN_STYLE_SCOPE, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.lifecycle.onUpdated(sync);
  return style;
}
