// packages/types/src/event.ts
export const CORE_EVENT_TYPES = [
  'press.start',
  'press.end',
  'press.cancel',
  'press.commit',
  'key.down',
  'key.up',
] as const;

export type CoreEventType = (typeof CORE_EVENT_TYPES)[number];

export const OPTIONAL_EVENT_TYPES = [
  'pointer.down',
  'pointer.move',
  'pointer.up',
  'pointer.cancel',
  'pointer.enter',
  'pointer.leave',
  'nav.focus',
  'nav.blur',
  'text.focus',
  'text.blur',
  'input',
  'change',
  'context.menu',
] as const;

export type OptionalEventType = (typeof OPTIONAL_EVENT_TYPES)[number];
export type SemanticEventType = CoreEventType | OptionalEventType;

export type ExtensionEventType = `host:${string}`;

export type EventTypeV0 = SemanticEventType | ExtensionEventType;

/**
 * Listener options for `host:*` extension events only. This is deliberately
 * host-shaped: portable semantic registrations (the CORE/OPTIONAL types) do
 * not accept DOM capture/passive/once options — see C-EVENT-0002.
 */
export type HostEventListenerOptions = Readonly<{
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
}>;

export type DefaultActionRequestOptions = Readonly<{
  /** Machine-readable cause, e.g. `button.space-activation`. */
  reason?: string;
  /** Owning prototype or module, e.g. `base-button`. */
  source?: string;
}>;

/**
 * Portable default-action control handed to prototype event callbacks.
 * Requests are tied to the current interaction sample; the adapter projects
 * them through HC-DEFAULT-ACTION-0001 instead of a raw native function.
 * Portable payloads never carry native preventDefault/stopPropagation methods;
 * raw native methods are available only to explicit `host:*` extension callbacks.
 */
export type ProtoEventControl = Readonly<{
  requestDefaultActionPrevention(options?: DefaultActionRequestOptions): void;
}>;

/**
 * Immutable, data-only view constructed for one portable Event callback.
 * It never aliases or mutates a native event/detail object. `control` is live
 * only during the synchronous callback invocation that receives this view.
 */
export type ProtoEventPayload = Readonly<{
  type: EventTypeV0;
  key?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
  control: ProtoEventControl;
}>;

export type ExposeEventSpec = {
  payload?: 'void' | 'any' | 'json';
  options?: Record<string, unknown>;
};

declare const __eventTokenBrand: unique symbol;

export type EventTokenMeta = {
  kind: 'root' | 'global';
  type: string;
  options?: unknown;
  label?: string; // dev-only, set by desc()
};

export type EventListenerToken = {
  readonly [__eventTokenBrand]: 'EventListenerToken';
  readonly id: string;
  readonly meta: Readonly<EventTokenMeta>;
  desc(text: string): EventListenerToken;
};
