// packages/modules/event/src/types.ts
import type { ModuleInstance } from '@proto.ui/core';
import type { ModulePort } from '@proto.ui/core';
import type {
  EventListenerToken,
  EventTypeV0,
  ExtensionEventType,
  HostEventListenerOptions,
  ProtoEventPayload,
  SemanticEventType,
} from '@proto.ui/types';

/** @deprecated Import ExposeEventFacade from @proto.ui/module-expose-event. */
export type { ExposeEventFacade } from '@proto.ui/module-expose-event';

export type EventDispatch = (id: string, ev: unknown, type?: EventTypeV0) => void;
export type SemanticEventInternalCallback = (ev: ProtoEventPayload) => void;
export type HostEventInternalCallback = (ev: unknown) => void;
export type EventInternalCallback = (ev: unknown) => void;

export type EventChannelFacade = {
  // --- setup-only registration (opaque to module) ---
  on(type: SemanticEventType): EventListenerToken;
  on(type: ExtensionEventType, options?: HostEventListenerOptions): EventListenerToken;
  onGlobal(type: SemanticEventType): EventListenerToken;
  onGlobal(type: ExtensionEventType, options?: HostEventListenerOptions): EventListenerToken;

  /** precise removal */
  off(token: EventListenerToken): void;
};

export type EventFacade = EventChannelFacade;

export type EventModule = ModuleInstance<EventFacade> & {
  name: 'event';
  scope: 'instance';
};

export type EventPort = ModulePort & {
  /**
   * Setup-only module-facing listener registration.
   *
   * These callbacks are dispatched by runtime before prototype-author callbacks
   * for the same event dispatch pass.
   */
  on(type: SemanticEventType, cb: SemanticEventInternalCallback): EventListenerToken;
  on(
    type: ExtensionEventType,
    cb: HostEventInternalCallback,
    options?: HostEventListenerOptions
  ): EventListenerToken;
  onGlobal(type: SemanticEventType, cb: SemanticEventInternalCallback): EventListenerToken;
  onGlobal(
    type: ExtensionEventType,
    cb: HostEventInternalCallback,
    options?: HostEventListenerOptions
  ): EventListenerToken;

  /**
   * Bind all registered listeners using current targets.
   * Runtime supplies a dispatcher to handle invocation semantics.
   */
  bind(dispatch: EventDispatch): void;

  /** Unbind all currently bound listeners (registrations kept) */
  unbind(): void;

  /** Optional diagnostics hook */
  getDiagnostics?(): readonly EventDiag[];

  /**
   * Request cancellation of the host default action associated with the current
   * interaction event. This is module-facing and host-mediated; prototype
   * authors should not depend on Web `preventDefault()` directly.
   */
  requestDefaultActionPrevented(ev: any, options?: { reason?: string; source?: string }): void;

  /**
   * Setup-only: redirect all "root" bindings to a specified target-like.
   * Does NOT affect global registrations.
   */
  redirectRoot(target: EventTarget): void;

  /**
   * Setup-only: redirect semantic root events while keeping `host:*` bindings
   * attached to the instance's own host target.
   */
  redirectSemanticRoot(target: EventTarget): void;

  /**
   * Runtime-owned dispatch entry for module-facing callbacks.
   * Runtime calls this inside callback scope before prototype-author dispatch.
   */
  dispatchInternal(id: string, ev: any): void;
};

export type EventDiag = {
  id: string;
  kind: 'root' | 'global';
  type: string;
  bound: boolean;
  label?: string;
};
