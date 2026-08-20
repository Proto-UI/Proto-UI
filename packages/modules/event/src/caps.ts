// packages/modules/event/src/caps.ts
import { cap } from '@proto.ui/core';

/** @deprecated Import from @proto.ui/module-expose-event. */
export { EVENT_EMIT_CAP, EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
/** @deprecated Import from @proto.ui/module-expose-event. */
export type { EventEmitSink, ExposeEventSink } from '@proto.ui/module-expose-event';

export type EventTargetGetter = () => EventTarget | null;

export const EVENT_ROOT_TARGET_CAP = cap<EventTargetGetter>('@proto.ui/event/getRootTarget');

export const EVENT_GLOBAL_TARGET_CAP = cap<EventTargetGetter>('@proto.ui/event/getGlobalTarget');

export type EventDefaultActionCancelRequest = Readonly<{
  event?: unknown;
  reason?: string;
  source?: string;
}>;

export type EventDefaultActionCancel = (request: EventDefaultActionCancelRequest) => void;

export const EVENT_CANCEL_DEFAULT_ACTION_CAP = cap<EventDefaultActionCancel>(
  '@proto.ui/event/cancelDefaultAction'
);
