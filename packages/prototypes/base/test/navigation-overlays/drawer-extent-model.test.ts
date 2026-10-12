import { expect, it } from 'vitest';
import * as drawer from '../../src/drawer/snap';
const model = (raw: Record<string, unknown> = {}, maximum?: { unit: string; value: number }) =>
  (drawer as any).drawerExtentModel(raw, maximum);
it.each([
  {},
  { snapPoints: undefined },
  { snapPoints: null },
  { snapPoints: [] },
  { snapPoint: 0.5 },
  { defaultSnapPoint: 0.5 },
])('keeps absent or empty vertical point sets intrinsic: %j', (raw) => {
  expect(model(raw)).toMatchObject({
    status: 'ready',
    mode: 'intrinsic',
    points: [],
    controlled: false,
    selection: null,
  });
});
it('sorts valid explicit points and retains owner-controlled nearest selection', () => {
  expect(model({ snapPoints: [1, 0.5, 0.5], snapPoint: 0.75 })).toMatchObject({
    status: 'ready',
    mode: 'fraction',
    points: [0.5, 1],
    selection: 1,
    controlled: true,
  });
});
it.each([{}, { snapPoint: undefined }, { snapPoint: null }])(
  'does not infer controlled ownership from empty raw selector %j',
  (selector) => {
    expect(model({ snapPoints: [0.5, 1], defaultSnapPoint: 0.5, ...selector })).toMatchObject({
      controlled: false,
      selection: 0.5,
    });
  }
);
it.each([true, 'bad', {}, [NaN], [Infinity], [0], [-1], [1.5], [0.5, NaN]])(
  'rejects malformed points without manufacturing a full panel: %j',
  (snapPoints) => {
    expect(model({ snapPoints })).toMatchObject({ status: 'invalid', reason: 'snap-points' });
  }
);
it.each(['left', 'right'])('leaves legacy horizontal mode bounded separately: %s', (side) => {
  expect(model({ side })).toMatchObject({
    status: 'ready',
    mode: 'fraction',
    points: [1],
    selection: 1,
  });
});
it('uses the supplied root-text family ceiling without knowing a family name', () => {
  expect(model({}, { unit: 'available-minus-root-text', value: 6 })).toMatchObject({
    maximum: { unit: 'available-minus-root-text', value: 6 },
    minimum: { unit: 'logical', value: 0 },
  });
});
it.each(['logical', 'root-text', 'available', 'available-minus-root-text'])(
  'preserves neutral %s lengths for host resolution',
  (unit) => {
    expect(model({ minExtent: { unit, value: 0.5 }, maxExtent: { unit, value: 1 } })).toMatchObject(
      { status: 'ready', minimum: { unit, value: 0.5 }, maximum: { unit, value: 1 } }
    );
  }
);
it.each([
  { unit: 'px', value: 1 },
  { unit: 'logical', value: -1 },
  { unit: 'root-text', value: NaN },
  { unit: 'logical', value: Infinity },
  { unit: 'available', value: 2 },
  12,
])('rejects malformed explicit min/max: %j', (length) => {
  expect(model({ minExtent: length })).toMatchObject({ status: 'invalid', reason: 'minimum' });
  expect(model({ maxExtent: length })).toMatchObject({ status: 'invalid', reason: 'maximum' });
});
it('validates then excludes the minimum from explicit snap sizing', () => {
  expect(model({ snapPoints: [0.5, 1], minExtent: { unit: 'logical', value: 900 } })).toMatchObject(
    { minimum: { unit: 'logical', value: 0 } }
  );
});
it('rejects a non-finite active owner selector without transferring control', () => {
  expect(model({ snapPoints: [0.5, 1], snapPoint: NaN })).toMatchObject({
    status: 'invalid',
    reason: 'snap-selection',
  });
});
it('applies intrinsic defaults on the top edge with explicitly empty length props', () => {
  expect(model({ side: 'top', minExtent: null, maxExtent: undefined })).toMatchObject({
    status: 'ready',
    mode: 'intrinsic',
    minimum: { unit: 'logical', value: 0 },
    maximum: { unit: 'available', value: 1 },
  });
});

it('rejects sparse point arrays rather than creating an undefined point', () => {
  expect(model({ snapPoints: Array(1) })).toMatchObject({
    status: 'invalid',
    reason: 'snap-points',
  });
});
it('copies inherited and non-enumerable length fields into an explicit normalized record', () => {
  const minimum = Object.create({ unit: 'logical', value: 24 });
  const maximum = Object.defineProperties(
    {},
    { unit: { value: 'root-text' }, value: { value: 6 } }
  );
  expect(model({ minExtent: minimum, maxExtent: maximum })).toMatchObject({
    status: 'ready',
    minimum: { unit: 'logical', value: 24 },
    maximum: { unit: 'root-text', value: 6 },
  });
});

it('uses one validated snapshot rather than rereading accessor-backed points and lengths', () => {
  let pointReads = 0;
  let lengthReads = 0;
  const points = Object.defineProperty([0], '0', { get: () => (++pointReads === 1 ? 0.5 : NaN) });
  const minimum = {
    unit: 'logical',
    get value() {
      return ++lengthReads === 1 ? 12 : NaN;
    },
  };
  expect(model({ snapPoints: points, minExtent: minimum })).toMatchObject({
    status: 'ready',
    points: [0.5],
  });
  expect(pointReads).toBe(1);
  expect(lengthReads).toBe(1);
});
