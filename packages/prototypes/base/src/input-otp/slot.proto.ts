import type { State } from '@proto.ui/core';
import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { INPUT_OTP_CONTEXT, INPUT_OTP_FAMILY } from './shared';
import type { InputOtpSlotProps } from './types';
function setup(def: DefHandle<InputOtpSlotProps>) {
  def.anatomy.claim(INPUT_OTP_FAMILY, { role: 'slot' });
  def.props.define({
    index: {
      type: 'number',
      empty: 'fallback',
      validator: (v) => Number.isInteger(v) && v >= 0 && v < 32,
    },
  });
  def.props.setDefaults({ index: 0 });
  const character = def.state.string('character', ''),
    active = def.state.bool('active', false),
    filled = def.state.bool('filled', false);
  def.expose.state('character', character);
  def.expose.state('active', active);
  def.expose.state('filled', filled);
  asAccessible().tree({ hidden: true });
  const sync = (run: RunHandle<InputOtpSlotProps>) => {
    const c = run.context.read(INPUT_OTP_CONTEXT),
      index = run.props.get().index ?? 0;
    character.set(c.value[index] ?? '', 'reason: OTP slot character');
    filled.set(character.get() !== '', 'reason: OTP slot filled');
    active.set(
      c.focused && index === Math.min(c.value.length, c.length - 1),
      'reason: OTP insertion hint'
    );
    run.update();
  };
  def.context.subscribe(INPUT_OTP_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.props.watchAll(sync);
  return () => character.get();
}
export const asInputOtpSlot = defineAsHook<
  InputOtpSlotProps,
  Record<string, unknown>,
  { state: { character: State<string>; active: State<boolean>; filled: State<boolean> } }
>({ name: 'as-input-otp-slot', setup });
export default definePrototype({ name: 'base-input-otp-slot', setup });
