import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asFocusable, asScrollSurface } from '@proto.ui/hooks';
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

  // P-BASE-SCROLL-AREA-VIEWPORT-KEYBOARD-FOCUS
  const focusable = asFocusable<ScrollAreaViewportProps>();
  // Sequential navigation starts off. Geometry has not arrived yet, and a
  // surface with nothing to scroll is an empty tab stop.
  focusable.configure({ disabled: false, navParticipation: 'none' });

  const scrollableDirections = [
    scroll.horizontal.canScrollBefore,
    scroll.horizontal.canScrollAfter,
    scroll.vertical.canScrollBefore,
    scroll.vertical.canScrollAfter,
  ];

  // P-BASE-SCROLL-AREA-VIEWPORT-NAV-PARTICIPATION
  let navParticipation: 'auto' | 'none' = 'none';
  const syncNavParticipation = () => {
    const next = scrollableDirections.some((direction) => direction.get()) ? 'auto' : 'none';
    if (next === navParticipation) return;
    navParticipation = next;
    // Only sequential navigation changes here. Losing the last scrollable
    // direction must not take focus away from whoever currently holds it.
    focusable.setNavParticipation(next);
  };

  for (const direction of scrollableDirections) {
    direction.watch((_run, event) => {
      if (event.type !== 'next') return;
      syncNavParticipation();
    });
  }

  def.expose.state('focused', focusable.focused);
  def.expose.state('focusVisible', focusable.focusVisible);
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
