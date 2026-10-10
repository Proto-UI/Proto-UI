import { defineAsHook, definePrototype, type DefHandle, type RendererHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { INPUT_OTP_FAMILY } from './shared';
function setup(def: DefHandle<{}>) {
  def.anatomy.claim(INPUT_OTP_FAMILY, { role: 'separator' });
  asAccessible().tree({ hidden: true });
  return (r: RendererHandle<any>) => r.slot();
}
export const asInputOtpSeparator = defineAsHook({ name: 'as-input-otp-separator', setup });
export default definePrototype({ name: 'base-input-otp-separator', setup });
