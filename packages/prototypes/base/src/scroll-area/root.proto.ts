import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { SCROLL_AREA_CONTEXT, SCROLL_AREA_FAMILY } from './shared';
import type {
  ScrollAreaRootAsHookContract,
  ScrollAreaRootExposes,
  ScrollAreaRootProps,
} from './types';

function setupScrollAreaRoot(def: DefHandle<ScrollAreaRootProps, ScrollAreaRootExposes>): void {
  def.context.provide(SCROLL_AREA_CONTEXT, { family: 'base-scroll-area' });
  def.anatomy.claim(SCROLL_AREA_FAMILY, { role: 'root' });
}

/*
 * P-BASE-SCROLL-AREA-ROOT-NO-BEHAVIOR: absence of event, state, and focus syntax is the implementation.
 */

export const asScrollAreaRoot = defineAsHook<
  ScrollAreaRootProps,
  ScrollAreaRootExposes,
  ScrollAreaRootAsHookContract
>({
  name: 'as-scroll-area-root',
  setup: setupScrollAreaRoot,
});

const scrollAreaRoot = definePrototype({
  name: 'base-scroll-area-root',
  setup: setupScrollAreaRoot,
});

export default scrollAreaRoot;
