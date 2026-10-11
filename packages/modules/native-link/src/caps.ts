import { cap, type NativeLinkNavigate, type NativeLinkSnapshot } from '@proto.ui/core';

export type NativeLinkHostConnection = Readonly<{
  config: NativeLinkSnapshot;
  onNavigate(event: NativeLinkNavigate): void;
}>;
export type NativeLinkHostLease = Readonly<{
  update(config: NativeLinkSnapshot): void;
  dispose(): void;
}>;
export type NativeLinkHost = Readonly<{
  attach(connection: NativeLinkHostConnection): NativeLinkHostLease;
}>;
export const NATIVE_LINK_HOST_CAP = cap<NativeLinkHost>('@proto.ui/native-link/host');
export const NATIVE_LINK_RUN_IN_CALLBACK_CAP = cap<(callback: () => void) => void>(
  '@proto.ui/native-link/run-in-callback'
);
