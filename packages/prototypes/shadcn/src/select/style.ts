import type { DefHandle, RunHandle } from '@proto.ui/core';
import {
  SHADCN_STYLE_SCOPE,
  setupShadcnStyleScope,
  setupShadcnStyleSelection,
  type ShadcnStyleProps,
} from '../style-scope';
export const SELECT_PROJECTED_STYLES = ['new-york-v4', 'rhea'] as const;
export function setupSelectStyle(def: DefHandle<ShadcnStyleProps>) {
  return setupShadcnStyleSelection(def, 'new-york-v4', {
    supportedStyles: SELECT_PROJECTED_STYLES,
  });
}
/** The Root delegates resolution to the shared family boundary, including portal logical descendants. */
export function setupSelectScope(def: DefHandle<ShadcnStyleProps>) {
  setupShadcnStyleScope(def);
  const validate = (run: RunHandle<ShadcnStyleProps>) => {
    const style = run.context.tryRead(SHADCN_STYLE_SCOPE)?.style ?? 'new-york-v4';
    if (!SELECT_PROJECTED_STYLES.includes(style as (typeof SELECT_PROJECTED_STYLES)[number]))
      throw new Error(`[shadcn-select] Unsupported style: ${style}`);
  };
  def.context.trySubscribe(SHADCN_STYLE_SCOPE, validate);
  def.lifecycle.onCreated(validate);
  def.lifecycle.onMounted(validate);
  def.lifecycle.onUpdated(validate);
}
