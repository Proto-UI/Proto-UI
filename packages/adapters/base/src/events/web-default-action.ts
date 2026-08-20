export type WebDefaultActionCancelRequest = Readonly<{
  event?: unknown;
}>;

/** Project a host-independent default-action request onto the Web event model. */
export function cancelWebEventDefaultAction({ event }: WebDefaultActionCancelRequest): void {
  if (
    !event ||
    (typeof event !== 'object' && typeof event !== 'function') ||
    typeof (event as { preventDefault?: unknown }).preventDefault !== 'function'
  ) {
    return;
  }

  (event as { preventDefault(): void }).preventDefault();
}
