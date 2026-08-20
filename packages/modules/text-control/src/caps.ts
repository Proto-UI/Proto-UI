import {
  cap,
  type TextControlEvent,
  type TextControlPatch,
  type TextControlSnapshot,
} from '@proto.ui/core';

export type TextControlHostConnection = Readonly<{
  patch: TextControlPatch;
  onEvent(event: TextControlEvent): void;
}>;

export type TextControlHostLease = Readonly<{
  update(patch: TextControlPatch): void;
  snapshot(): TextControlSnapshot;
  dispose(): void;
}>;

export type TextControlHost = Readonly<{
  attach(connection: TextControlHostConnection): TextControlHostLease;
}>;

export const TEXT_CONTROL_HOST_CAP = cap<TextControlHost>('@proto.ui/text-control/host');

export const TEXT_CONTROL_RUN_IN_CALLBACK_CAP = cap<(callback: () => void) => void>(
  '@proto.ui/text-control/run-in-callback'
);
