// Compile-only hook consumer: borrowed setters remain legal; family recipes only read.
import { asToggleGroupRoot } from '../src/toggle-group';
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import { toggleGroupRoot } from '../src/toggle-group';
declare const hook: ReturnType<typeof asToggleGroupRoot>;
const orientation: string = hook.stateHandles!.orientation.get();
hook.stateHandles!.orientation.set('vertical');
// @ts-expect-error existing state domain is string, not number
hook.stateHandles!.orientation.set(123);
// @ts-expect-error orientation reads are not numbers
const invalid: number = hook.stateHandles!.orientation.get();
// @ts-expect-error unknown state key is not public
hook.getState!('invented');
declare const instance: ProtoAdapterExposes<typeof toggleGroupRoot>;
// @ts-expect-error this slice does not introduce an AppMaker orientation expose
instance.orientation;
void orientation;
