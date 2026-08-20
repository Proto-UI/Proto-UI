// packages/modules/context/src/impl.ts
import type { CapsVaultView, ProtoPhase } from '@proto.ui/core';
import { ModuleBase } from '@proto.ui/module-base';
import type { ContextKey, JsonObject } from '@proto.ui/types';

import {
  CONTEXT_INSTANCE_TOKEN_CAP,
  CONTEXT_PARENT_CAP,
  type ContextInstanceToken,
  type ContextParentGetter,
} from './caps';
import type { ContextCallbackDispatcher, ContextChangeCb, ContextChangeCbOptional } from './types';
import { CONTEXT_CENTER, type SubscriptionMode } from './center';

const ERR = {
  PHASE: 'CONTEXT_PHASE_VIOLATION',
  PROVIDER_MISSING: 'CONTEXT_PROVIDER_MISSING',
  SUB_REQUIRED: 'CONTEXT_SUBSCRIPTION_REQUIRED',
  DUP_PROVIDE: 'CONTEXT_DUPLICATE_PROVIDE',
  DISCONNECTED: 'CONTEXT_DISCONNECTED',
  VALUE_INVALID: 'CONTEXT_VALUE_INVALID',
};

type ContextErrorCode = (typeof ERR)[keyof typeof ERR];

function contextError(code: ContextErrorCode, message: string): Error {
  const err = new Error(message) as Error & { code?: ContextErrorCode };
  (err as any).code = code;
  return err;
}

function isPlainObject(v: any): v is Record<string, any> {
  if (!v || typeof v !== 'object') return false;
  return Object.getPrototypeOf(v) === Object.prototype;
}

function validateJsonValue(value: any, seen: WeakSet<object>): void {
  if (value === null) return;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return;
  if (t === 'undefined' || t === 'function' || t === 'symbol' || t === 'bigint') {
    throw contextError(ERR.VALUE_INVALID, `[Context] illegal value type: ${t}`);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw contextError(ERR.VALUE_INVALID, `[Context] circular reference detected`);
    }
    seen.add(value);
    for (const item of value) validateJsonValue(item, seen);
    seen.delete(value);
    return;
  }

  if (!isPlainObject(value)) {
    throw contextError(ERR.VALUE_INVALID, `[Context] value must be JSON-serializable`);
  }

  if (seen.has(value)) {
    throw contextError(ERR.VALUE_INVALID, `[Context] circular reference detected`);
  }
  seen.add(value);
  for (const k of Object.keys(value)) {
    const v = (value as any)[k];
    validateJsonValue(v, seen);
  }
  seen.delete(value);
}

function assertJsonObject(value: any, op: string): asserts value is JsonObject {
  if (value === null) {
    throw contextError(ERR.VALUE_INVALID, `[Context] ${op} does not allow null as context value`);
  }

  if (!isPlainObject(value)) {
    throw contextError(ERR.VALUE_INVALID, `[Context] ${op} requires a plain JSON object`);
  }

  validateJsonValue(value, new WeakSet());
}

export class ContextModuleImpl extends ModuleBase {
  private readonly prototypeName: string;
  private callbackDispatcher: ContextCallbackDispatcher | null = null;

  constructor(caps: CapsVaultView, prototypeName: string) {
    super(caps);
    this.prototypeName = prototypeName;
  }

  // -------------------------
  // setup-only API
  // -------------------------

  provide<T extends JsonObject>(key: ContextKey<T>, defaultValue: T): void {
    this.guardSetupOnly('def.context.provide');

    const self = this.getSelfToken();
    assertJsonObject(defaultValue, 'provide');

    try {
      CONTEXT_CENTER.provide(self, key, defaultValue);
    } catch {
      throw contextError(
        ERR.DUP_PROVIDE,
        `[Context] duplicate provide for key: ${key?.debugName ?? '(unknown)'}`
      );
    }
  }

  subscribe<T extends JsonObject>(key: ContextKey<T>, onChange?: ContextChangeCb<T>): () => void {
    this.guardSetupOnly('def.context.subscribe');

    const self = this.getSelfToken();
    const getParent = this.getParentGetter();

    const provider = CONTEXT_CENTER.resolveProvider(self, key, getParent);
    if (!provider) {
      throw contextError(
        ERR.PROVIDER_MISSING,
        `[Context] provider missing for key: ${key?.debugName ?? '(unknown)'}`
      );
    }

    let active = true;
    const wrapped =
      typeof onChange === 'function'
        ? (ctx: unknown, next: T | null, prev: T | null) => {
            if (!active) return;
            if (this.callbackDispatcher) {
              this.callbackDispatcher((callbackCtx) => {
                onChange(callbackCtx, next as T, prev as T);
              });
              return;
            }
            onChange(ctx, next as T, prev as T);
          }
        : undefined;

    CONTEXT_CENTER.subscribe(self, key, 'required', wrapped as any);
    return () => {
      active = false;
    };
  }

  trySubscribe<T extends JsonObject>(
    key: ContextKey<T>,
    onChange?: ContextChangeCbOptional<T>
  ): () => void {
    this.guardSetupOnly('def.context.trySubscribe');

    const self = this.getSelfToken();
    let active = true;
    const wrapped =
      typeof onChange === 'function'
        ? (ctx: unknown, next: T | null, prev: T | null) => {
            if (!active) return;
            if (this.callbackDispatcher) {
              this.callbackDispatcher((callbackCtx) => {
                onChange(callbackCtx, next, prev);
              });
              return;
            }
            onChange(ctx, next, prev);
          }
        : undefined;

    CONTEXT_CENTER.subscribe(self, key, 'optional', wrapped as any);
    return () => {
      active = false;
    };
  }

  // -------------------------
  // runtime-only API
  // -------------------------

  read<T extends JsonObject>(key: ContextKey<T>): T {
    this.guardRuntimeOnly('run.context.read');

    const self = this.getSelfToken();
    this.ensureSubscribed(self, key, 'required', 'read');

    const getParent = this.getParentGetter();
    const provider = CONTEXT_CENTER.resolveProvider(self, key, getParent);
    if (!provider) {
      throw contextError(
        ERR.DISCONNECTED,
        `[Context] provider missing for key: ${key?.debugName ?? '(unknown)'}`
      );
    }

    const value = CONTEXT_CENTER.getProviderValue(provider, key);
    if (!value) {
      throw contextError(
        ERR.DISCONNECTED,
        `[Context] provider missing for key: ${key?.debugName ?? '(unknown)'}`
      );
    }

    return value as T;
  }

  tryRead<T extends JsonObject>(key: ContextKey<T>): T | null {
    this.guardRuntimeOnly('run.context.tryRead');

    const self = this.getSelfToken();
    this.ensureSubscribed(self, key, 'optional', 'tryRead');

    const getParent = this.getParentGetter();
    const provider = CONTEXT_CENTER.resolveProvider(self, key, getParent);
    if (!provider) return null;

    return (CONTEXT_CENTER.getProviderValue(provider, key) as T) ?? null;
  }

  update<T extends JsonObject>(key: ContextKey<T>, next: T | ((prev: T) => T)): void {
    this.guardCallbackOnly('run.context.update');

    const self = this.getSelfToken();
    const selfProvidesKey = CONTEXT_CENTER.getProviderValue(self, key) !== null;
    if (!selfProvidesKey) {
      this.ensureSubscribedAny(self, key, 'update');
    }

    const getParent = this.getParentGetter();
    const provider = selfProvidesKey ? self : CONTEXT_CENTER.resolveProvider(self, key, getParent);
    if (!provider) {
      throw contextError(
        ERR.DISCONNECTED,
        `[Context] provider missing for key: ${key?.debugName ?? '(unknown)'}`
      );
    }

    const prev = CONTEXT_CENTER.getProviderValue(provider, key);
    if (!prev) {
      throw contextError(
        ERR.DISCONNECTED,
        `[Context] provider missing for key: ${key?.debugName ?? '(unknown)'}`
      );
    }

    const resolved = typeof next === 'function' ? (next as any)(prev) : next;
    assertJsonObject(resolved, 'update');

    const ctx = this.sys.getCallbackCtx();
    CONTEXT_CENTER.updateFromProvider(provider, key, resolved, ctx, getParent);
  }

  tryUpdate<T extends JsonObject>(key: ContextKey<T>, next: T | ((prev: T) => T)): boolean {
    this.guardCallbackOnly('run.context.tryUpdate');

    const self = this.getSelfToken();
    this.ensureSubscribed(self, key, 'optional', 'tryUpdate');

    const getParent = this.getParentGetter();
    const provider = CONTEXT_CENTER.resolveProvider(self, key, getParent);
    if (!provider) return false;

    const prev = CONTEXT_CENTER.getProviderValue(provider, key);
    if (!prev) return false;

    const resolved = typeof next === 'function' ? (next as any)(prev) : next;
    assertJsonObject(resolved, 'update');

    const ctx = this.sys.getCallbackCtx();
    CONTEXT_CENTER.updateFromProvider(provider, key, resolved, ctx, getParent);
    return true;
  }

  // -------------------------
  // lifecycle
  // -------------------------

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    if (phase === 'unmounted') {
      this.dispose();
    }
  }

  dispose(): void {
    const self = this.tryGetSelfToken();
    if (self) {
      CONTEXT_CENTER.removeInstance(self);
    }
  }

  // -------------------------
  // port (diagnostics)
  // -------------------------

  portDumpProviders() {
    return CONTEXT_CENTER.dumpProviders();
  }

  portDumpSubscriptions() {
    return CONTEXT_CENTER.dumpSubscriptions();
  }

  portDumpCallbackQueue() {
    return CONTEXT_CENTER.dumpCallbackQueue();
  }

  setCallbackDispatcher(dispatch: ContextCallbackDispatcher): void {
    this.callbackDispatcher = dispatch;
  }

  resolveScope(key: ContextKey<any>, consumer?: ContextInstanceToken): ContextInstanceToken | null {
    const from = consumer ?? this.tryGetSelfToken();
    if (!from) return null;
    return CONTEXT_CENTER.resolveProvider(from, key, this.getParentGetter());
  }

  // -------------------------
  // helpers
  // -------------------------

  private guardSetupOnly(op: string) {
    if (this.sys.execPhase() !== 'setup') {
      throw contextError(ERR.PHASE, `[Context] illegal phase for ${op}: ${this.sys.execPhase()}`);
    }
  }

  private guardCallbackOnly(op: string) {
    if (this.sys.execPhase() !== 'callback') {
      throw contextError(ERR.PHASE, `[Context] illegal phase for ${op}: ${this.sys.execPhase()}`);
    }
  }

  private guardRuntimeOnly(op: string) {
    try {
      this.sys.ensureRuntime(op);
    } catch {
      throw contextError(ERR.PHASE, `[Context] illegal phase for ${op}: ${this.sys.execPhase()}`);
    }
  }

  private ensureSubscribed(
    instance: ContextInstanceToken,
    key: ContextKey<any>,
    mode: SubscriptionMode,
    op: string
  ) {
    if (!CONTEXT_CENTER.hasSubscription(instance, key, mode)) {
      throw contextError(
        ERR.SUB_REQUIRED,
        `[Context] ${op} requires ${mode} subscription: ${key?.debugName ?? '(unknown)'}`
      );
    }
  }

  private ensureSubscribedAny(instance: ContextInstanceToken, key: ContextKey<any>, op: string) {
    if (!CONTEXT_CENTER.hasSubscription(instance, key)) {
      throw contextError(
        ERR.SUB_REQUIRED,
        `[Context] ${op} requires prior subscription: ${key?.debugName ?? '(unknown)'}`
      );
    }
  }

  private getParentGetter(): ContextParentGetter {
    if (!this.caps.has(CONTEXT_PARENT_CAP)) {
      throw contextError(
        ERR.PROVIDER_MISSING,
        `[Context] host caps missing: parent getter (${this.prototypeName})`
      );
    }

    const fn = this.caps.get(CONTEXT_PARENT_CAP) as ContextParentGetter;
    if (typeof fn !== 'function') {
      throw contextError(
        ERR.PROVIDER_MISSING,
        `[Context] host caps invalid: parent getter (${this.prototypeName})`
      );
    }
    return fn;
  }

  private getSelfToken(): ContextInstanceToken {
    if (!this.caps.has(CONTEXT_INSTANCE_TOKEN_CAP)) {
      throw contextError(
        ERR.PROVIDER_MISSING,
        `[Context] host caps missing: instance token (${this.prototypeName})`
      );
    }

    return this.caps.get(CONTEXT_INSTANCE_TOKEN_CAP) as ContextInstanceToken;
  }

  private tryGetSelfToken(): ContextInstanceToken | null {
    if (!this.caps.has(CONTEXT_INSTANCE_TOKEN_CAP)) return null;
    return this.caps.get(CONTEXT_INSTANCE_TOKEN_CAP) as ContextInstanceToken;
  }
}
