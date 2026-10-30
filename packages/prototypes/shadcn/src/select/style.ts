import type { DefHandle, RunHandle } from '@proto.ui/core';
import {
  SHADCN_STYLE_SCOPE,
  setupShadcnStyleScope,
  setupShadcnStyleSelection,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from '../style-scope';
// P-SHADCN-SELECT-STYLE: every shared identifier is mapped for Select; the
// compatibility default remains new-york-v4 when nothing selects a profile.
export const SELECT_PROJECTED_STYLES = [
  'vega',
  'nova',
  'maia',
  'lyra',
  'mira',
  'luma',
  'sera',
  'rhea',
  'new-york-v4',
] as const satisfies readonly ShadcnStyleId[];
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
