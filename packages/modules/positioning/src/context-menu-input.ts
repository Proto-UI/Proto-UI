import {
  delay,
  type ContextMenuInputBinding,
  type ContextMenuInputHandle,
  type ContextMenuInputIntent,
  type DelayTask,
  type MountPhase,
  type RunHandle,
} from '@proto.ui/core';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import { ModuleBase, type ModuleFactoryArgs } from '@proto.ui/module-base';
import {
  CONTEXT_MENU_INPUT_HOST_CAP,
  CONTEXT_MENU_INPUT_RUN_IN_CALLBACK_CAP,
  type ContextMenuInputHost,
  type ContextMenuInputHostLease,
} from './caps';

type Listener = (run: RunHandle<any>, intent: ContextMenuInputIntent) => boolean;

/** Only semantic intent crosses this module; contact recognition and geometry are host-owned. */
export class ContextMenuInputModuleImpl extends ModuleBase {
  private declared = false;
  private binding: ContextMenuInputBinding | null = null;
  private disabled = true;
  private listener: Listener | null = null;
  private subscriptions: (() => void)[] = [];
  private lease: ContextMenuInputHostLease | null = null;
  private host: ContextMenuInputHost | null = null;
  private target: unknown = null;
  private epoch = 0;
  private disposed = false;
  constructor(
    caps: ModuleFactoryArgs['caps'],
    private anatomy: AnatomyPort
  ) {
    super(caps);
  }

  declare(): ContextMenuInputHandle {
    this.sys.ensureSetup('contextMenuInput.declare');
    if (this.declared)
      throw new Error('[ContextMenuInput] One input may be declared per instance.');
    this.declared = true;
    return Object.freeze({
      configure: (binding: ContextMenuInputBinding) => {
        this.sys.ensureSetup('contextMenuInput.configure');
        if (this.binding)
          throw new Error('[ContextMenuInput] Input anatomy is already configured.');
        if (!binding.anatomy.decl.roles[binding.inputRole])
          throw new Error('[ContextMenuInput] Input role must belong to the anatomy family.');
        this.binding = Object.freeze({ ...binding });
        this.subscriptions.push(this.anatomy.subscribeOrder(binding.anatomy, () => this.refresh()));
        this.subscriptions.push(
          this.anatomy.subscribeTargets(binding.anatomy, () => this.refresh())
        );
      },
      on: (listener: Listener) => {
        this.sys.ensureSetup('contextMenuInput.on');
        if (this.listener)
          throw new Error('[ContextMenuInput] Input listener is already configured.');
        this.listener = listener;
      },
      sync: ({ disabled }: { disabled: boolean }) => {
        this.sys.ensureCallback('contextMenuInput.sync');
        if (this.disabled === disabled) return;
        this.disabled = disabled;
        this.refresh();
      },
    });
  }
  private resolveTarget(): unknown {
    const binding = this.binding;
    if (!binding || this.anatomy.resolveSelfRole(binding.anatomy) !== binding.inputRole)
      return null;
    const self = this.anatomy.resolveSelfInstance();
    const part = this.anatomy.order
      .partsOf(binding.anatomy, binding.inputRole, { missing: 'empty' })
      .find((part) => this.anatomy.resolvePartInstance(part) === self);
    return part ? this.anatomy.resolvePartTarget(part) : null;
  }
  protected override onCapsEpoch(): void {
    this.refresh();
  }
  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    this.refresh();
  }
  private inCallback(callback: () => void): void {
    if (this.sys.getCallbackCtx()) callback();
    else this.caps.get(CONTEXT_MENU_INPUT_RUN_IN_CALLBACK_CAP)(callback);
  }
  private refresh(): void {
    if (this.disposed) return;
    const host = this.caps.has(CONTEXT_MENU_INPUT_HOST_CAP)
      ? this.caps.get(CONTEXT_MENU_INPUT_HOST_CAP)
      : null;
    const target = host && this.mountPhase === 'mounted' ? this.resolveTarget() : null;
    if (this.lease && host === this.host && target === this.target) {
      this.lease.update({ disabled: this.disabled });
      return;
    }
    const epoch = this.disconnect();
    if (epoch !== this.epoch || this.disposed || !host || !target || this.mountPhase !== 'mounted')
      return;
    this.host = host;
    this.target = target;
    const current = () => epoch === this.epoch && !this.disposed && this.mountPhase === 'mounted';
    const lease = host.attach({
      target,
      disabled: this.disabled,
      onIntent: (intent) => {
        if (!current() || this.disabled || !this.listener || this.sys.isDisposed()) return false;
        let accepted = false;
        this.inCallback(() => {
          if (!current() || this.disabled) return;
          const run = this.sys.getCallbackCtx() as RunHandle<any> | undefined;
          if (!run) throw new Error('[ContextMenuInput] Intent requires callback scope.');
          accepted = this.listener!(run, intent) === true;
        });
        return current() && !this.disabled && accepted;
      },
      scheduleDelay: (durationMs, callback) => {
        let task: DelayTask = { cancel() {} };
        if (current())
          this.inCallback(() => {
            task = delay(durationMs, () => {
              if (current()) callback();
            });
          });
        return task;
      },
    });
    if (!current()) lease.dispose();
    else this.lease = lease;
  }
  private disconnect(): number {
    const epoch = ++this.epoch;
    const lease = this.lease;
    this.lease = null;
    this.host = null;
    this.target = null;
    lease?.dispose();
    return epoch;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disconnect();
    this.subscriptions.splice(0).forEach((off) => off());
    this.listener = null;
  }
}
