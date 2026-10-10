/** Actual public consumer domains and negative nested-ownership boundaries. */
import type { ExposeOf } from '@proto.ui/core';
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import { asFieldTextControl, fieldControl } from '../src/field';
import { fieldControl as shadcn } from '../../shadcn/src/field';
import { fieldControl as neo } from '../../brutalist/src/field';
import { fieldControl as bootstrap } from '../../bootstrap-2-3-2/src/field';
import { fieldControl as liquid } from '../../liquid-glass/src/field';

function borrowed(handle: ReturnType<typeof asFieldTextControl>) {
  const own = handle.stateHandles!;
  const value: string = own.value.get();
  const focus: boolean = own.focusVisible.get();
  const child = handle.getAsHookHandle?.('as-field-control');
  if (!child) throw new Error('Expected the declared public Field binding');
  const invalid: boolean = child.state.invalid.get();
  const pending: boolean = child.state.pending.get();
  const required: boolean = child.state.fieldRequired.get();
  const report: boolean = child.report({ value: 'Ada', reason: 'input' });
  // @ts-expect-error authored child states are not flattened
  own.invalid;
  // @ts-expect-error authored child states are not flattened
  own.pending;
  // @ts-expect-error expose aliases do not rename or flatten captured state handles
  own.required;
  // @ts-expect-error invalid is a boolean domain, not an unknown/string getter
  const wrong: string = child.state.invalid.get();
  // @ts-expect-error borrowed policy state takes booleans
  child.state.invalid.set('invalid');
  // @ts-expect-error no invented public child member
  child.imaginaryValidationOwner();
  return [value, focus, invalid, pending, required, report, wrong];
}
void borrowed;

function publicControl(
  control:
    | ProtoAdapterExposes<typeof fieldControl>
    | ProtoAdapterExposes<typeof shadcn>
    | ProtoAdapterExposes<typeof neo>
    | ProtoAdapterExposes<typeof bootstrap>
    | ProtoAdapterExposes<typeof liquid>
) {
  const value: string = control.value.get();
  const invalid: boolean = control.invalid.get();
  const pending: boolean = control.pending.get();
  const required: boolean = control.required.get();
  control.focusSelf({ reason: 'keyboard' });
  // @ts-expect-error public exposes remain exact, not Record<string, unknown>
  control.imaginaryValidationOwner();
  return [value, invalid, pending, required];
}
void publicControl;
const publicInvalid = null as unknown as ExposeOf<typeof shadcn>['invalid'];
void publicInvalid;
