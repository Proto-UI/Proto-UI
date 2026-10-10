import type { BorrowedStateHandle, ExposeOf, Prototype } from '@proto.ui/core';
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import { asFormField, formField } from '../src/form';
import type { FieldRootProps } from '../src/field';
import { formField as shadcn } from '../../shadcn/src/form';
import { formField as neo } from '../../brutalist/src/form';

function borrowed(handle: ReturnType<typeof asFormField>) {
  const field = handle.getAsHookHandle?.('as-field-root');
  if (!field) throw new Error('Expected the captured public FieldRoot handle');
  const invalid: boolean = field.stateHandles!.invalid.get();
  const borrowedInvalid: BorrowedStateHandle<boolean, FieldRootProps> = field.stateHandles!.invalid;
  const pending: boolean = field.stateHandles!.pending.get();
  // @ts-expect-error nested FieldRoot facts are not flattened onto FormField
  handle.stateHandles!.invalid;
  // @ts-expect-error known nested invalid state retains its boolean domain
  const wrong: string = field.stateHandles!.invalid.get();
  // @ts-expect-error no invented captured state
  field.stateHandles!.formInvalid;
  // @ts-expect-error the inherited borrowed state retains its boolean domain
  borrowedInvalid.set('invalid');
  return [invalid, pending, wrong];
}
void borrowed;

type PropsOf<T> = T extends Prototype<infer P, any> ? P : never;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type ShadcnProps = Assert<Equal<PropsOf<typeof shadcn>, PropsOf<typeof formField>>>;
type NeoProps = Assert<Equal<PropsOf<typeof neo>, PropsOf<typeof formField>>>;
type ShadcnExposes = Assert<Equal<ExposeOf<typeof shadcn>, ExposeOf<typeof formField>>>;
type NeoExposes = Assert<Equal<ExposeOf<typeof neo>, ExposeOf<typeof formField>>>;

function publicField(field: ProtoAdapterExposes<typeof shadcn> | ProtoAdapterExposes<typeof neo>) {
  const invalid: boolean = field.invalid.get();
  field.resetValidation();
  // @ts-expect-error the public invalid expose is read-only
  field.invalid.set(true);
  // @ts-expect-error no new validation owner API
  field.setInvalid(true);
  return invalid;
}
void publicField;
