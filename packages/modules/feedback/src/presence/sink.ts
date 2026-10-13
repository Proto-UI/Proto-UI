import {
  cap,
  type StyleHandle,
  type PresenceEndpoint,
  type PresentationOwnerFrame,
  type PresentationViewBinding,
  type PresentationOutcome,
} from '@proto.ui/core';
export type ResolvedPresenceEndpoint = Omit<PresenceEndpoint, 'translate'> & {
  translate?: import('@proto.ui/core').Translation;
};
export type PresencePresentationFrame = Readonly<{
  view: number;
  revision: number;
  targetRevision: number;
  style: StyleHandle;
  owner: PresentationOwnerFrame;
  closed: ResolvedPresenceEndpoint;
  entered: ResolvedPresenceEndpoint;
  easing: readonly [number, number, number, number];
  bind(binding: PresentationViewBinding): void;
  complete(binding: PresentationViewBinding, outcome: PresentationOutcome): void;
}>;
export interface PresencePresentationSink {
  commit(frame: PresencePresentationFrame): void;
  cancel(): void;
  settle(outcome: PresentationOutcome): boolean;
  release(view: number): void;
  diagnostics?(): readonly string[];
}
export const PRESENCE_PRESENTATION_SINK_CAP = cap<PresencePresentationSink>(
  '@proto.ui/feedback/presence-presentation-v1'
);
export const PRESENCE_RUN_IN_CALLBACK_CAP = cap<(callback: () => void) => void>(
  '@proto.ui/feedback/presence-callback-v1'
);
