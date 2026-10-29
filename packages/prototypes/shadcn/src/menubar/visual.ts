import type { DefHandle, RunHandle } from '@proto.ui/core';
import {
  SHADCN_STYLE_SCOPE,
  setupShadcnStyleScope,
  setupShadcnStyleSelection,
  type ShadcnStyleProps,
} from '../style-scope';

export const MENUBAR_PROJECTED_STYLES = ['new-york-v4', 'rhea'] as const;
/** Shared selector protocol only; Base owns menu state and all input policy. */
export function setupMenubarStyle(def: DefHandle<any>, root = false) {
  if (!root)
    return setupShadcnStyleSelection(def, 'new-york-v4', {
      supportedStyles: MENUBAR_PROJECTED_STYLES,
    });
  setupShadcnStyleScope(def);
  const style = def.state.enum('menubarResolvedStyle', 'new-york-v4', {
    options: MENUBAR_PROJECTED_STYLES,
  });
  const sync = (run: RunHandle<ShadcnStyleProps>) => {
    const next = run.context.tryRead(SHADCN_STYLE_SCOPE)?.style ?? 'new-york-v4';
    if (!MENUBAR_PROJECTED_STYLES.includes(next as (typeof MENUBAR_PROJECTED_STYLES)[number]))
      throw new Error('[shadcn-menubar] Unsupported style: ' + next);
    style.set(next as (typeof MENUBAR_PROJECTED_STYLES)[number], 'reason: Menubar family style');
  };
  def.context.trySubscribe(SHADCN_STYLE_SCOPE, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.lifecycle.onUpdated(sync);
  return style;
}
