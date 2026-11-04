export type NavigationScrollHeadroom = Readonly<{
  pageY: number;
  documentHeight: number;
  viewportHeight: number;
  triggerTop: number;
  triggerBottom: number;
}>;

export const MIN_NAVIGATION_DOWNWARD_ROOM = 2;

// Test preparation only. It never changes page content, styles or the wheel
// oracle. The caller must measure the real page again after the requested move.
export function planNavigationScrollHeadroom(value: NavigationScrollHeadroom) {
  for (const [key, number] of Object.entries(value)) {
    if (!Number.isFinite(number)) throw new Error(`Non-finite navigation geometry: ${key}`);
  }
  const { pageY, documentHeight, viewportHeight, triggerTop, triggerBottom } = value;
  if (
    pageY < 0 ||
    documentHeight < viewportHeight ||
    viewportHeight <= 0 ||
    triggerTop < 0 ||
    triggerBottom <= triggerTop ||
    triggerBottom > viewportHeight
  )
    throw new Error(
      'Navigation scroll observation needs a visible Trigger and valid page geometry.'
    );

  const downwardRoom = documentHeight - pageY - viewportHeight;
  if (downwardRoom > MIN_NAVIGATION_DOWNWARD_ROOM) return { pageY, upwardShift: 0, downwardRoom };

  // Moving the document upward moves the Trigger down. Keep a real 16px
  // viewport margin and never request more upward movement than the page owns.
  const upwardShift = Math.min(
    64 - downwardRoom,
    pageY,
    Math.max(0, viewportHeight - triggerBottom - 16)
  );
  if (upwardShift <= 0 || downwardRoom + upwardShift <= MIN_NAVIGATION_DOWNWARD_ROOM)
    throw new Error('No discriminating downward scroll position with the real Trigger visible.');

  return { pageY: pageY - upwardShift, upwardShift, downwardRoom: downwardRoom + upwardShift };
}

// Reopened panels may retain the previous scroll edge. Select a gesture with
// actual room and measure signed progress instead of accepting scrollTop > 0.
export function planNavigationWheel(value: {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}) {
  const { scrollTop, scrollHeight, clientHeight } = value;
  const range = scrollHeight - clientHeight;
  if (
    ![scrollTop, scrollHeight, clientHeight].every(Number.isFinite) ||
    clientHeight <= 0 ||
    range <= 0 ||
    scrollTop < 0 ||
    scrollTop > range
  )
    throw new Error('Navigation wheel observation needs a real scrollable panel.');
  return scrollTop > range / 2 ? -340 : 340;
}

export function navigationWheelProgress(before: number, after: number, deltaY: number) {
  if (![before, after, deltaY].every(Number.isFinite) || deltaY === 0)
    throw new Error('Navigation wheel progress needs finite positions and a direction.');
  return after === before ? 0 : (after - before) * Math.sign(deltaY);
}
