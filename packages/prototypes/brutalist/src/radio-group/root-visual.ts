import { tw, type DefHandle } from '@proto.ui/core';
import type { BrutalistRadioGroupRootProps, BrutalistRadioGroupRootExposes } from './types';
export function setupRadioGroupRootVisual(
  def: DefHandle<BrutalistRadioGroupRootProps, BrutalistRadioGroupRootExposes>
) {
  def.feedback.style.use(tw('grid w-full gap-2 text-foreground'));
}
