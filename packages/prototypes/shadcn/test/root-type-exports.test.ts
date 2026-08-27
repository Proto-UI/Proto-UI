import { describe, expectTypeOf, it } from 'vitest';
import type {
  ShadcnScrollAreaRootAsHookContract as RootScrollAreaRootAsHookContract,
  ShadcnScrollAreaRootExposes as RootScrollAreaRootExposes,
  ShadcnScrollAreaRootProps as RootScrollAreaRootProps,
  ShadcnScrollAreaScrollbarAsHookContract as RootScrollAreaScrollbarAsHookContract,
  ShadcnScrollAreaScrollbarExposes as RootScrollAreaScrollbarExposes,
  ShadcnScrollAreaScrollbarProps as RootScrollAreaScrollbarProps,
  ShadcnScrollAreaThumbAsHookContract as RootScrollAreaThumbAsHookContract,
  ShadcnScrollAreaThumbExposes as RootScrollAreaThumbExposes,
  ShadcnScrollAreaThumbProps as RootScrollAreaThumbProps,
  ShadcnScrollAreaViewportAsHookContract as RootScrollAreaViewportAsHookContract,
  ShadcnScrollAreaViewportExposes as RootScrollAreaViewportExposes,
  ShadcnScrollAreaViewportProps as RootScrollAreaViewportProps,
  ShadcnTooltipContentAsHookContract as RootTooltipContentAsHookContract,
  ShadcnTooltipContentExposes as RootTooltipContentExposes,
  ShadcnTooltipContentProps as RootTooltipContentProps,
  ShadcnTooltipGroupAsHookContract as RootTooltipGroupAsHookContract,
  ShadcnTooltipGroupExposes as RootTooltipGroupExposes,
  ShadcnTooltipGroupProps as RootTooltipGroupProps,
  ShadcnTooltipRootAsHookContract as RootTooltipRootAsHookContract,
  ShadcnTooltipRootExposes as RootTooltipRootExposes,
  ShadcnTooltipRootProps as RootTooltipRootProps,
  ShadcnTooltipTriggerAsHookContract as RootTooltipTriggerAsHookContract,
  ShadcnTooltipTriggerExposes as RootTooltipTriggerExposes,
  ShadcnTooltipTriggerProps as RootTooltipTriggerProps,
} from '../src/index';
import type {
  ShadcnScrollAreaRootAsHookContract,
  ShadcnScrollAreaRootExposes,
  ShadcnScrollAreaRootProps,
  ShadcnScrollAreaScrollbarAsHookContract,
  ShadcnScrollAreaScrollbarExposes,
  ShadcnScrollAreaScrollbarProps,
  ShadcnScrollAreaThumbAsHookContract,
  ShadcnScrollAreaThumbExposes,
  ShadcnScrollAreaThumbProps,
  ShadcnScrollAreaViewportAsHookContract,
  ShadcnScrollAreaViewportExposes,
  ShadcnScrollAreaViewportProps,
} from '../src/scroll-area/types';
import type {
  ShadcnTooltipContentAsHookContract,
  ShadcnTooltipContentExposes,
  ShadcnTooltipContentProps,
  ShadcnTooltipGroupAsHookContract,
  ShadcnTooltipGroupExposes,
  ShadcnTooltipGroupProps,
  ShadcnTooltipRootAsHookContract,
  ShadcnTooltipRootExposes,
  ShadcnTooltipRootProps,
  ShadcnTooltipTriggerAsHookContract,
  ShadcnTooltipTriggerExposes,
  ShadcnTooltipTriggerProps,
} from '../src/tooltip/types';

describe('shadcn package root type exports', () => {
  it('re-exports the complete Tooltip public type surface', () => {
    expectTypeOf<RootTooltipGroupProps>().toEqualTypeOf<ShadcnTooltipGroupProps>();
    expectTypeOf<RootTooltipGroupExposes>().toEqualTypeOf<ShadcnTooltipGroupExposes>();
    expectTypeOf<RootTooltipGroupAsHookContract>().toEqualTypeOf<ShadcnTooltipGroupAsHookContract>();
    expectTypeOf<RootTooltipRootProps>().toEqualTypeOf<ShadcnTooltipRootProps>();
    expectTypeOf<RootTooltipRootExposes>().toEqualTypeOf<ShadcnTooltipRootExposes>();
    expectTypeOf<RootTooltipRootAsHookContract>().toEqualTypeOf<ShadcnTooltipRootAsHookContract>();
    expectTypeOf<RootTooltipTriggerProps>().toEqualTypeOf<ShadcnTooltipTriggerProps>();
    expectTypeOf<RootTooltipTriggerExposes>().toEqualTypeOf<ShadcnTooltipTriggerExposes>();
    expectTypeOf<RootTooltipTriggerAsHookContract>().toEqualTypeOf<ShadcnTooltipTriggerAsHookContract>();
    expectTypeOf<RootTooltipContentProps>().toEqualTypeOf<ShadcnTooltipContentProps>();
    expectTypeOf<RootTooltipContentExposes>().toEqualTypeOf<ShadcnTooltipContentExposes>();
    expectTypeOf<RootTooltipContentAsHookContract>().toEqualTypeOf<ShadcnTooltipContentAsHookContract>();
  });

  it('re-exports the complete Scroll Area public type surface', () => {
    expectTypeOf<RootScrollAreaRootProps>().toEqualTypeOf<ShadcnScrollAreaRootProps>();
    expectTypeOf<RootScrollAreaRootExposes>().toEqualTypeOf<ShadcnScrollAreaRootExposes>();
    expectTypeOf<RootScrollAreaRootAsHookContract>().toEqualTypeOf<ShadcnScrollAreaRootAsHookContract>();
    expectTypeOf<RootScrollAreaViewportProps>().toEqualTypeOf<ShadcnScrollAreaViewportProps>();
    expectTypeOf<RootScrollAreaViewportExposes>().toEqualTypeOf<ShadcnScrollAreaViewportExposes>();
    expectTypeOf<RootScrollAreaViewportAsHookContract>().toEqualTypeOf<ShadcnScrollAreaViewportAsHookContract>();
    expectTypeOf<RootScrollAreaScrollbarProps>().toEqualTypeOf<ShadcnScrollAreaScrollbarProps>();
    expectTypeOf<RootScrollAreaScrollbarExposes>().toEqualTypeOf<ShadcnScrollAreaScrollbarExposes>();
    expectTypeOf<RootScrollAreaScrollbarAsHookContract>().toEqualTypeOf<ShadcnScrollAreaScrollbarAsHookContract>();
    expectTypeOf<RootScrollAreaThumbProps>().toEqualTypeOf<ShadcnScrollAreaThumbProps>();
    expectTypeOf<RootScrollAreaThumbExposes>().toEqualTypeOf<ShadcnScrollAreaThumbExposes>();
    expectTypeOf<RootScrollAreaThumbAsHookContract>().toEqualTypeOf<ShadcnScrollAreaThumbAsHookContract>();
  });
});
