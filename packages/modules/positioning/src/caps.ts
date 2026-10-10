import { cap, type AnchoredPositionConnection } from '@proto.ui/core';

export interface AnchoredPositionHostLease {
  update(connection: AnchoredPositionConnection): void;
  requestUpdate(): void;
  dispose(): void;
}

export interface AnchoredPositionHost {
  attach(connection: AnchoredPositionConnection): AnchoredPositionHostLease;
}

export const ANCHORED_POSITION_HOST_CAP = cap<AnchoredPositionHost>(
  '@proto.ui/positioning/anchoredHost'
);

export type AvailableSpaceHostConnection = import('@proto.ui/core').AvailableSpaceConnection & {
  readonly viewEpoch: number;
};
export interface AvailableSpaceHostLease {
  /** Host diagnostics, never a Proto state surface. null means no active/known frame. */
  getFrame?(): import('@proto.ui/core').AvailableSpaceFrame | null;
  requestUpdate(): void;
  dispose(): void;
}
export interface AvailableSpaceHost {
  attach(connection: AvailableSpaceHostConnection): AvailableSpaceHostLease;
}
export const AVAILABLE_SPACE_HOST_CAP = cap<AvailableSpaceHost>(
  '@proto.ui/positioning/availableSpaceHost'
);

export type ContextMenuInputHostBinding = Readonly<{
  target: unknown;
  disabled: boolean;
  onIntent(intent: import('@proto.ui/core').ContextMenuInputIntent): boolean;
  /** Runtime-owned cancellable delay; the host must cancel on every terminal path. */
  scheduleDelay(durationMs: number, callback: () => void): import('@proto.ui/core').DelayTask;
}>;
export interface ContextMenuInputHostLease {
  update(config: Readonly<{ disabled: boolean }>): void;
  dispose(): void;
}
export interface ContextMenuInputHost {
  attach(binding: ContextMenuInputHostBinding): ContextMenuInputHostLease;
}
export const CONTEXT_MENU_INPUT_HOST_CAP = cap<ContextMenuInputHost>(
  '@proto.ui/positioning/contextMenuInputHost'
);
export const CONTEXT_MENU_INPUT_RUN_IN_CALLBACK_CAP = cap<(callback: () => void) => void>(
  '@proto.ui/positioning/contextMenuInputCallback'
);
