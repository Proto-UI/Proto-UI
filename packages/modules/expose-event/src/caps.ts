import { cap } from '@proto.ui/core';

export type ExposeEventSink = (
  key: string,
  payload?: any,
  options?: Record<string, unknown>
) => void;

/** Receives one validated Component-to-App-Maker outward signal emission. */
export const EXPOSE_EVENT_SINK_CAP = cap<ExposeEventSink>('@proto.ui/event/emit');

/** @deprecated Use EXPOSE_EVENT_SINK_CAP. */
export const EVENT_EMIT_CAP = EXPOSE_EVENT_SINK_CAP;

/** @deprecated Use ExposeEventSink. */
export type EventEmitSink = ExposeEventSink;
