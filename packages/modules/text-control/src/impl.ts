import type {
  CapsVaultView,
  MountPhase,
  PrototypeModuleDeclaration,
  RunHandle,
  TextControlEvent,
  TextControlEventType,
  TextControlHandle,
  TextControlPatch,
  TextControlSnapshot,
  TextControlValueMode,
} from '@proto.ui/core';
import { canonicalizeLineEndings, getModuleDeclaration } from '@proto.ui/core';
import { ModuleBase } from '@proto.ui/module-base';
import type { PropsBaseType } from '@proto.ui/types';
import {
  TEXT_CONTROL_HOST_CAP,
  TEXT_CONTROL_RUN_IN_CALLBACK_CAP,
  type TextControlHost,
  type TextControlHostLease,
} from './caps';
import { TEXT_CONTROL_DECLARATION } from './declaration';

const EMPTY_PATCH: TextControlPatch = Object.freeze({});

type Listener = {
  type: TextControlEventType;
  callback: (run: RunHandle<PropsBaseType>, event: TextControlEvent) => void;
};

export class TextControlModuleImpl extends ModuleBase {
  private readonly prototypeName: string;
  private readonly supported: boolean;
  private declared = false;
  private initialized = false;
  private valueMode: TextControlValueMode | null = null;
  private patch: TextControlPatch = EMPTY_PATCH;
  private value = '';
  private composing = false;
  private listeners: Listener[] = [];
  private host: TextControlHost | null = null;
  private lease: TextControlHostLease | null = null;

  constructor(
    caps: CapsVaultView,
    prototypeName: string,
    declarations: readonly PrototypeModuleDeclaration[]
  ) {
    super(caps);
    this.prototypeName = prototypeName;
    this.supported = Boolean(
      getModuleDeclaration({ modules: declarations }, TEXT_CONTROL_DECLARATION)
    );
    if (this.supported) this.refreshHost();
  }

  declare<P extends PropsBaseType>(): TextControlHandle<P> {
    this.sys.ensureSetup('textControl.declare');
    if (!this.supported) {
      throw new Error(
        `[TextControl] ${this.prototypeName} requires a static text-control declaration.`
      );
    }
    if (this.declared) {
      throw new Error(`[TextControl] ${this.prototypeName} may declare one text control.`);
    }
    this.declared = true;
    return {
      on: (type, callback) => this.on(type, callback),
      sync: (patch) => this.sync(patch),
      snapshot: () => this.snapshot(),
    };
  }

  private on<P extends PropsBaseType>(
    type: TextControlEventType,
    callback: (run: RunHandle<P>, event: TextControlEvent) => void
  ): () => void {
    this.sys.ensureSetup('textControl.on');
    const listener: Listener = {
      type,
      callback: callback as (run: RunHandle<PropsBaseType>, event: TextControlEvent) => void,
    };
    this.listeners = this.listeners.concat(listener);
    return () => {
      this.listeners = this.listeners.filter((candidate) => candidate !== listener);
    };
  }

  private sync(next: TextControlPatch): void {
    this.sys.ensureCallback('textControl.sync');
    if (!this.initialized) {
      this.valueMode = next.valueMode ?? 'uncontrolled';
      this.value = this.valueMode === 'controlled' ? canonicalizeLineEndings(next.value ?? '') : canonicalizeLineEndings(next.defaultValue ?? '');
      this.initialized = true;
    }
    this.patch = Object.freeze({
      ...this.patch,
      ...next,
      valueMode: this.valueMode ?? 'uncontrolled',
    });
    if (this.valueMode === 'controlled') this.value = canonicalizeLineEndings(this.patch.value ?? '');
    this.syncLease();
  }

  snapshot(): TextControlSnapshot | null {
    return this.declared ? Object.freeze({ value: canonicalizeLineEndings(this.value), composing: this.composing }) : null;
  }

  protected override onCapsEpoch(): void {
    this.refreshHost();
    this.attachLease();
  }

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    if (phase === 'mounted') {
      this.refreshHost();
      this.attachLease();
      return;
    }
    if (phase === 'unmounting' || phase === 'detached') this.disposeLease();
  }

  dispose(): void {
    this.disposeLease();
    this.listeners = [];
    this.declared = false;
  }

  private refreshHost(): void {
    this.host = this.caps.has(TEXT_CONTROL_HOST_CAP) ? this.caps.get(TEXT_CONTROL_HOST_CAP) : null;
  }

  private attachLease(): void {
    this.disposeLease();
    if (!this.declared || !this.host || this.mountPhase !== 'mounted') return;
    this.lease = this.host.attach({
      patch: this.effectivePatch(),
      onEvent: (event) => this.receive(event),
    });
  }

  private disposeLease(): void {
    this.lease?.dispose();
    this.lease = null;
  }

  private effectivePatch(): TextControlPatch {
    const { value: _declaredValue, ...patchWithoutValue } = this.patch;
    const shouldProjectValue = !(this.valueMode === 'controlled' && this.composing);
    return Object.freeze({
      ...patchWithoutValue,
      valueMode: this.valueMode ?? 'uncontrolled',
      ...(shouldProjectValue ? { value: this.value } : {}),
    });
  }

  private syncLease(): void {
    this.lease?.update(this.effectivePatch());
  }

  private receive(event: TextControlEvent): void {
    this.composing = event.composing;
    if (this.valueMode === 'uncontrolled' && event.type === 'input') {
      this.value = canonicalizeLineEndings(event.value);
    }

    const runInCallback = this.caps.has(TEXT_CONTROL_RUN_IN_CALLBACK_CAP)
      ? this.caps.get(TEXT_CONTROL_RUN_IN_CALLBACK_CAP)
      : (callback: () => void) => callback();
    runInCallback(() => {
      const run = this.sys.getCallbackCtx() as RunHandle<PropsBaseType> | undefined;
      if (!run) return;
      for (const listener of this.listeners) {
        if (listener.type === event.type) listener.callback(run, event);
      }
    });

    const mustRestoreControlledValue =
      this.valueMode === 'controlled' &&
      ((event.type === 'input' && !event.composing) || event.type === 'compositionend');
    if (!mustRestoreControlledValue) return;
    queueMicrotask(() => this.syncLease());
  }
}
