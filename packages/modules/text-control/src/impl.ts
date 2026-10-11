import type {
  CapsVaultView,
  MountPhase,
  PrototypeModuleDeclaration,
  RunHandle,
  TextControlEvent,
  TextControlEventType,
  TextControlHandle,
  TextControlLineMode,
  TextControlPatch,
  TextControlSnapshot,
  TextControlValueMode,
} from '@proto.ui/core';
import { canonicalizeTextControlValue, getModuleDeclaration } from '@proto.ui/core';
import { ModuleBase } from '@proto.ui/module-base';
import type { PropsBaseType } from '@proto.ui/types';
import {
  TEXT_CONTROL_HOST_CAP,
  TEXT_CONTROL_RUN_IN_CALLBACK_CAP,
  type TextControlHost,
  type TextControlHostLease,
} from './caps';
import { TEXT_CONTROL_DECLARATION } from './declaration';
import type { TextControlDeclaration } from './declaration';

const EMPTY_PATCH: TextControlPatch = Object.freeze({});

type Listener = {
  type: TextControlEventType;
  callback: (run: RunHandle<PropsBaseType>, event: TextControlEvent) => void;
};

export class TextControlModuleImpl extends ModuleBase {
  private readonly prototypeName: string;
  private readonly supported: boolean;
  private readonly declaration: TextControlDeclaration | null;
  private declared = false;
  private initialized = false;
  private valueMode: TextControlValueMode | null = null;
  private patch: TextControlPatch = EMPTY_PATCH;
  private value = '';
  private composing = false;
  private callbackPrelude: { epoch: number } | null = null;
  private listeners: Listener[] = [];
  private host: TextControlHost | null = null;
  private lease: TextControlHostLease | null = null;
  private leaseEpoch = 0;
  private eventGeneration = 0;

  constructor(
    caps: CapsVaultView,
    prototypeName: string,
    declarations: readonly PrototypeModuleDeclaration[]
  ) {
    super(caps);
    this.prototypeName = prototypeName;
    const declaration = getModuleDeclaration({ modules: declarations }, TEXT_CONTROL_DECLARATION);
    this.declaration = declaration?.config ?? null;
    this.supported = this.declaration !== null;
    if (this.supported) this.refreshHost();
  }

  declare<
    P extends PropsBaseType,
    Mode extends TextControlLineMode = TextControlLineMode,
  >(): TextControlHandle<P, Mode> {
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
      resetValue: (value) => this.resetValue(value),
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
      this.sys.ensureSetup('textControl.off');
      this.listeners = this.listeners.filter((candidate) => candidate !== listener);
    };
  }

  private sync(next: TextControlPatch): void {
    this.sys.ensureCallback('textControl.sync');
    if (
      this.declaration?.lineMode === 'single' &&
      (typeof next.rows === 'number' || next.wrap !== undefined)
    ) {
      throw new Error('[TextControl] rows/wrap are not compatible with single-line mode');
    }

    if (!this.initialized) {
      this.valueMode = next.valueMode ?? 'uncontrolled';
      this.value =
        this.valueMode === 'controlled'
          ? this.canonicalize(next.value ?? '')
          : this.canonicalize(next.defaultValue ?? '');
      this.initialized = true;
    }
    this.patch = Object.freeze({
      ...this.patch,
      ...next,
      valueMode: this.valueMode ?? 'uncontrolled',
      value: typeof next.value === 'string' ? this.canonicalize(next.value) : this.patch.value,
      defaultValue:
        typeof next.defaultValue === 'string'
          ? this.canonicalize(next.defaultValue)
          : this.patch.defaultValue,
    });
    if (this.valueMode === 'controlled') this.value = this.canonicalize(this.patch.value ?? '');
    this.syncLease();
  }

  private resetValue(value?: string): boolean {
    this.sys.ensureCallback('textControl.resetValue');
    if (!this.declared || !this.initialized || this.mountPhase !== 'mounted') return false;
    if (value !== undefined && typeof value !== 'string') return false;
    const controlled = this.valueMode === 'controlled';
    const next = controlled
      ? this.value
      : this.canonicalize(value ?? this.patch.defaultValue ?? '');
    // Retire composition, queued restoration and reentrant old callbacks before the new value.
    this.eventGeneration += 1;
    this.callbackPrelude = null;
    this.value = next;
    this.composing = false;
    this.attachLease();
    return !controlled;
  }

  snapshot(): TextControlSnapshot | null {
    return this.declared ? Object.freeze({ value: this.value, composing: this.composing }) : null;
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
    const epoch = this.leaseEpoch;
    this.lease = this.host.attach({
      patch: this.effectivePatch(),
      onEvent: (event) => {
        if (epoch === this.leaseEpoch) this.receive(event);
      },
    });
  }

  private disposeLease(): void {
    this.leaseEpoch += 1;
    const lease = this.lease;
    this.lease = null;
    this.composing = false;
    lease?.dispose();
  }

  private effectivePatch(): TextControlPatch {
    const { value: _declaredValue, ...patchWithoutValue } = this.patch;
    const shouldProjectValue = !(
      this.valueMode === 'controlled' &&
      (this.composing || this.callbackPrelude?.epoch === this.leaseEpoch)
    );
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
    const epoch = this.leaseEpoch;
    const generation = ++this.eventGeneration;
    // Canonicalize CR/LF to LF at the module boundary before state, snapshot, and listener routing.
    const canonicalEvent: TextControlEvent = Object.freeze({
      ...event,
      value: this.canonicalize(event.value),
      data: typeof event.data === 'string' ? this.canonicalize(event.data) : event.data,
    });
    // CallbackScope may drain older props before it invokes our listener.
    // Protect both a starting composition and a finishing native candidate
    // from those stale owner values until the actual event callback begins.
    this.composing ||= canonicalEvent.composing;
    try {
      if (
        this.valueMode === 'uncontrolled' &&
        (canonicalEvent.type === 'input' || canonicalEvent.type === 'change')
      ) {
        this.value = canonicalEvent.value;
      }

      const runInCallback = this.caps.has(TEXT_CONTROL_RUN_IN_CALLBACK_CAP)
        ? this.caps.get(TEXT_CONTROL_RUN_IN_CALLBACK_CAP)
        : (callback: () => void) => callback();
      const inCurrentCallback = (callback: () => void) => {
        const previousPrelude = this.callbackPrelude;
        const prelude = { epoch };
        // Change lets queued owner patches project immediately; unlike input and
        // composition boundaries, it needs no native-candidate prelude guard.
        // Unaccepted changes still restore below; active composition stays protected.
        if (canonicalEvent.type !== 'change') this.callbackPrelude = prelude;
        const releasePrelude = () => {
          if (this.callbackPrelude === prelude) this.callbackPrelude = previousPrelude;
        };
        let callbackRan = false;
        try {
          runInCallback(() => {
            releasePrelude();
            if (epoch === this.leaseEpoch) {
              callbackRan = true;
              callback();
            }
          });
        } catch (error) {
          // An interrupted end event must not strand the provisional `||=`
          // above: settle the composing state the callback would have
          // assigned so a controlled owner regains the completed candidate.
          // A newer event owns the state now; never roll it back.
          if (
            !callbackRan &&
            epoch === this.leaseEpoch &&
            generation === this.eventGeneration &&
            this.composing !== canonicalEvent.composing
          ) {
            this.composing = canonicalEvent.composing;
          }
          throw error;
        } finally {
          releasePrelude();
        }
      };
      inCurrentCallback(() => {
        if (generation !== this.eventGeneration) return;
        this.composing = canonicalEvent.composing;
        const run = this.sys.getCallbackCtx() as RunHandle<PropsBaseType> | undefined;
        if (!run) return;
        for (const listener of this.listeners) {
          if (generation !== this.eventGeneration || epoch !== this.leaseEpoch) break;
          if (listener.type === canonicalEvent.type) listener.callback(run, canonicalEvent);
        }
      });

      const mustRestoreControlledValue =
        this.valueMode === 'controlled' &&
        (((event.type === 'input' || event.type === 'change') && !event.composing) ||
          event.type === 'compositionend');
      if (!mustRestoreControlledValue) return;
      queueMicrotask(() => {
        // Re-enter the current callback boundary so pending accepted owner props
        // reconcile before restoring value, rather than writing a stale owner
        // value and destroying the native caret before the next commit.
        if (epoch === this.leaseEpoch) inCurrentCallback(() => this.syncLease());
      });
    } finally {
      // Native composition facts survive a failed callback prelude. An older
      // event must never settle over a newer event or a replacement lease.
      if (epoch === this.leaseEpoch && generation === this.eventGeneration) {
        this.composing = canonicalEvent.composing;
      }
    }
  }

  private canonicalize(value: string): string {
    const lineMode: TextControlLineMode = this.declaration?.lineMode ?? 'multiline';
    return canonicalizeTextControlValue(value, lineMode);
  }
}
