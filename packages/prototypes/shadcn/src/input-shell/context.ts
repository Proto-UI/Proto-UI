import { createContextKey, type DefHandle, type RunHandle } from '@proto.ui/core';
import type { ShadcnStyleProps } from '../style-scope';
// Private visual containment only. Not a semantic Association or another editor state source.
export const INPUT_SHELL_PAINT = createContextKey<{ grouped: true }>('shadcn-input-shell-paint');
export function setupInputShellContainment<
  Props extends ShadcnStyleProps,
  Exposes = Record<string, unknown>,
>(def: DefHandle<Props, Exposes>) {
  const grouped = def.state.bool('insideInputShell', false);
  const sync = (run: RunHandle<Props>) =>
    grouped.set(
      run.context.tryRead(INPUT_SHELL_PAINT)?.grouped === true,
      'reason: observe passive input shell paint'
    );
  def.context.trySubscribe(INPUT_SHELL_PAINT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.lifecycle.onUpdated(sync);
  return grouped;
}
