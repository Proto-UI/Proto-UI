import { describe, expectTypeOf, it } from 'vitest';
import type {
  TextControlHandle,
  TextControlLineMode,
  TextControlMultilinePatch,
  TextControlPatch,
  TextControlPatchCommon,
  TextControlSingleLinePatch,
} from '../src/text-control';

type Props = { value?: string };

describe('text-control line-mode patch discrimination', () => {
  it('exposes a common patch shape with no rows/wrap', () => {
    expectTypeOf<TextControlPatchCommon>().not.toHaveProperty('rows');
    expectTypeOf<TextControlPatchCommon>().not.toHaveProperty('wrap');
  });

  it('resolves single-line patch to the common shape (no rows/wrap)', () => {
    expectTypeOf<TextControlPatch<'single'>>().toEqualTypeOf<TextControlSingleLinePatch>();
    expectTypeOf<TextControlSingleLinePatch>().not.toHaveProperty('rows');
    expectTypeOf<TextControlSingleLinePatch>().not.toHaveProperty('wrap');
  });

  it('resolves multiline patch with rows and wrap', () => {
    expectTypeOf<TextControlPatch<'multiline'>>().toEqualTypeOf<TextControlMultilinePatch>();
    expectTypeOf<TextControlMultilinePatch>().toHaveProperty('rows');
    expectTypeOf<TextControlMultilinePatch>().toHaveProperty('wrap');
  });

  it('keeps the unresolved patch shape as the multiline superset for back-compat', () => {
    expectTypeOf<
      TextControlPatch<TextControlLineMode>
    >().toEqualTypeOf<TextControlMultilinePatch>();
    expectTypeOf<TextControlPatch>().toHaveProperty('rows');
    expectTypeOf<TextControlPatch>().toHaveProperty('wrap');
  });

  it('narrows the sync parameter by line mode', () => {
    expectTypeOf<TextControlHandle<Props, 'single'>['sync']>()
      .parameter(0)
      .toEqualTypeOf<TextControlSingleLinePatch>();
    expectTypeOf<TextControlHandle<Props, 'multiline'>['sync']>()
      .parameter(0)
      .toEqualTypeOf<TextControlMultilinePatch>();
  });

  it('rejects rows and wrap on a single-line patch at compile time', () => {
    // Excess-property checks prove a single-line caller cannot pass rows/wrap.
    const rejectRows = () => {
      // @ts-expect-error rows is not valid in a single-line patch
      const patch: TextControlPatch<'single'> = { rows: 3 };
      void patch;
    };
    const rejectWrap = () => {
      // @ts-expect-error wrap is not valid in a single-line patch
      const patch: TextControlPatch<'single'> = { wrap: 'soft' };
      void patch;
    };
    expectTypeOf(rejectRows).toBeFunction();
    expectTypeOf(rejectWrap).toBeFunction();
  });

  it('accepts rows and wrap on a multiline patch', () => {
    const accept = (patch: TextControlPatch<'multiline'>) => patch;
    expectTypeOf(accept).toBeCallableWith({ rows: 3, wrap: 'hard', value: 'ok' });
  });
});
