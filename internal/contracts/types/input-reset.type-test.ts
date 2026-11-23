import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import type { ExposeMethod } from '@proto.ui/core';
import input, { type InputRootExposes } from '@proto.ui/prototypes-base/input';
import shadcnInput from '@proto.ui/prototypes-shadcn/input';
import brutalistInput from '@proto.ui/prototypes-brutalist/input';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type Reset = (value?: string) => boolean;

type PublicMethod = Assert<Equal<InputRootExposes['resetValue'], ExposeMethod<Reset>>>;
type BaseMethod = Assert<Equal<ProtoAdapterExposes<typeof input>['resetValue'], Reset>>;
type ShadcnMethod = Assert<Equal<ProtoAdapterExposes<typeof shadcnInput>['resetValue'], Reset>>;
type BrutalistMethod = Assert<
  Equal<ProtoAdapterExposes<typeof brutalistInput>['resetValue'], Reset>
>;

declare const exposed: ProtoAdapterExposes<typeof input>;
const latestDefault: boolean = exposed.resetValue();
const explicitValue: boolean = exposed.resetValue('restored');
// @ts-expect-error Reset accepts canonicalizable strings, never native editors or numeric coercion.
exposed.resetValue(42);
// @ts-expect-error Native selection/IME commands do not become a public reset options object.
exposed.resetValue({ value: 'restored', selectionStart: 0 });
void [latestDefault, explicitValue];
