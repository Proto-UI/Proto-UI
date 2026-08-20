import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';
import { SCROLL_AREA_CONTEXT, SCROLL_AREA_FAMILY } from './shared';
import type {
  ScrollAreaViewportAsHookContract,
  ScrollAreaViewportExposes,
  ScrollAreaViewportProps,
} from './types';

function setupScrollAreaViewport(
  def: DefHandle<ScrollAreaViewportProps, ScrollAreaViewportExposes>
): void {
  def.anatomy.claim(SCROLL_AREA_FAMILY, { role: 'viewport' });
  def.context.trySubscribe(SCROLL_AREA_CONTEXT);
  const scroll = asScrollSurface<ScrollAreaViewportProps>();
  scroll.configure({ axes: 'both', projection: 'auto' });
  scroll.bindComposedChrome({
    scope: SCROLL_AREA_CONTEXT,
    anatomy: SCROLL_AREA_FAMILY,
    scrollbarRole: 'scrollbar',
    thumbRole: 'thumb',
    orientationExpose: 'orientation',
  });

  def.expose.state('scrollAxes', scroll.axes);
  def.expose.state('scrolling', scroll.scrolling);
  def.expose.state('scrollProjection', scroll.projection);
  def.expose.state('scrollXPosition', scroll.horizontal.position);
  def.expose.state('scrollXVisibleRatio', scroll.horizontal.visibleRatio);
  def.expose.state('canScrollLeft', scroll.horizontal.canScrollBefore);
  def.expose.state('canScrollRight', scroll.horizontal.canScrollAfter);
  def.expose.state('scrollYPosition', scroll.vertical.position);
  def.expose.state('scrollYVisibleRatio', scroll.vertical.visibleRatio);
  def.expose.state('canScrollUp', scroll.vertical.canScrollBefore);
  def.expose.state('canScrollDown', scroll.vertical.canScrollAfter);
}

export const asScrollAreaViewport = defineAsHook<
  ScrollAreaViewportProps,
  ScrollAreaViewportExposes,
  ScrollAreaViewportAsHookContract
>({
  name: 'as-scroll-area-viewport',
  setup: setupScrollAreaViewport,
});

const scrollAreaViewport = definePrototype({
  name: 'base-scroll-area-viewport',
  setup: setupScrollAreaViewport,
});

export default scrollAreaViewport;
