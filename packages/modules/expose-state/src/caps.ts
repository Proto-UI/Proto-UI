import { cap } from '@proto.ui/core';

export type ExposesRecordSink = (exposes: Record<string, unknown>) => void;

/**
 * Accepts the complete Adapter-facing exposes record after specialized
 * projections, including exposed State handles, have been finalized.
 */
export const EXPOSES_RECORD_SINK_CAP = cap<ExposesRecordSink>('@proto.ui/expose-state/setExposes');

/** @deprecated Use EXPOSES_RECORD_SINK_CAP. */
export const EXPOSE_STATE_SET_EXPOSES_CAP = EXPOSES_RECORD_SINK_CAP;

/** @deprecated Use ExposesRecordSink. */
export type ExposeStateHostSink = ExposesRecordSink;
