import { sliderRoot, sliderValuesRoot } from '@proto.ui/prototypes-base/slider';
import type { ProtoReactProps } from '@proto.ui/adapter-react';
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';

const oldScalar: ProtoReactProps<typeof sliderRoot> = {
  value: 20,
  onValueChange: (event: { value: number }) => {
    const value: number = event.value;
    void value;
  },
};
const vector: ProtoReactProps<typeof sliderValuesRoot> = {
  value: Object.freeze([20, 80]),
  onValueChange: (event) => {
    const value: number | readonly number[] = event.value;
    void value;
  },
};
const newScalar: ProtoReactProps<typeof sliderValuesRoot> = { value: 20 };
// @ts-expect-error The legacy actual scalar export is not widened.
const oldArray: ProtoReactProps<typeof sliderRoot> = { value: [20, 80] };
// @ts-expect-error The new actual entry does not admit nonnumeric arrays.
const wrongArray: ProtoReactProps<typeof sliderValuesRoot> = { value: ['20'] };
const narrowCallback: ProtoReactProps<typeof sliderValuesRoot> = {
  // @ts-expect-error An array-capable entry requires a union-capable callback.
  onValueChange: (event: { value: number }) => {
    void event;
  },
};
declare const api: ProtoAdapterExposes<typeof sliderValuesRoot>;
api.requestValue(20);
api.requestValues([20, 80]);
// @ts-expect-error Scalar operation rejects arrays at the public type boundary.
api.requestValue([20, 80]);
// @ts-expect-error Vector operation rejects a scalar.
api.requestValues(20);
// @ts-expect-error Snapshot remains scalar/vector/null, never silently a scalar.
const scalarOnly: number = api.getValue();
// @ts-expect-error The actual list State exposure is read-only.
api.values.get().push(1);
void [oldScalar, vector, newScalar, oldArray, wrongArray, narrowCallback, scalarOnly];
