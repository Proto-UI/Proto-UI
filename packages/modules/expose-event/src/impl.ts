import type { CapsVaultView } from '@proto.ui/core';
import { ModuleBase, type ModuleDeps } from '@proto.ui/module-base';
import { isExposeEventDeclaration, type ExposePort } from '@proto.ui/module-expose';
import type { ExposeEventSpec } from '@proto.ui/types';

import { EXPOSE_EVENT_SINK_CAP } from './caps';
import { exposeEventInvalidArgument } from './error';
import type { ExposeEventFacade } from './types';

export class ExposeEventModuleImpl extends ModuleBase {
  private readonly expose: ExposePort;
  private readonly prototypeName: string;

  constructor(caps: CapsVaultView, deps: ModuleDeps, prototypeName: string) {
    super(caps);
    this.expose = deps.requirePort<ExposePort>('expose');
    this.prototypeName = prototypeName;
  }

  registerExposeEvent(key: string, _spec?: ExposeEventSpec): void {
    this.sys?.ensureSetup('def.expose.event');
    this.ensureValidKey(key, 'def.expose.event');

    const declaration = this.expose.get(key);
    if (!isExposeEventDeclaration(declaration)) {
      throw exposeEventInvalidArgument(
        `[ExposeEvent] key is not registered as an expose.event declaration: ${key}`,
        { prototypeName: this.prototypeName, key }
      );
    }
  }

  emit(key: string, payload?: any, options?: Record<string, unknown>): void {
    this.sys?.ensureRuntime('rt.expose.emit');
    this.ensureValidKey(key, 'rt.expose.emit');

    const declaration = this.expose.get(key);
    if (!isExposeEventDeclaration(declaration)) {
      throw exposeEventInvalidArgument(
        `[ExposeEvent] emit for unregistered expose.event key: ${key}`,
        { prototypeName: this.prototypeName, key }
      );
    }

    if (!this.caps.has(EXPOSE_EVENT_SINK_CAP)) return;
    const sink = this.caps.get(EXPOSE_EVENT_SINK_CAP);
    if (!sink) return;

    try {
      sink(key, payload, options);
    } catch {
      // v0: host sink failures do not re-enter prototype execution.
    }
  }

  readonly facade: ExposeEventFacade = {
    registerExposeEvent: (key, spec) => this.registerExposeEvent(key, spec),
    emit: (key, payload, options) => this.emit(key, payload, options),
  };

  private ensureValidKey(key: string, op: string): void {
    if (typeof key === 'string' && key.length > 0) return;
    throw exposeEventInvalidArgument(`[ExposeEvent] ${op} requires a non-empty string key.`, {
      prototypeName: this.prototypeName,
      key,
    });
  }
}
