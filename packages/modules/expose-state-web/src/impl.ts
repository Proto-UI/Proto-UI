// packages/modules/expose-state-web/src/impl.ts
import type { CapsVaultView, MountPhase, ProtoPhase } from '@proto.ui/core';
import { ModuleBase } from '@proto.ui/module-base';
import type { ModuleDeps } from '@proto.ui/module-base';
import type { StateSpec } from '@proto.ui/types';

import type { ExposeStatePort } from '@proto.ui/module-expose-state';
import type { ExposeStateExternalHandle } from '@proto.ui/module-expose-state';

import {
  EXPOSE_STATE_WEB_MAP_CAP,
  EXPOSE_STATE_WEB_MIRROR_TARGETS_CAP,
  EXPOSE_STATE_WEB_MODE_CAP,
  HOST_ELEMENT_CAP,
  type ExposeStateWebMode,
  type ExposeStateWebNameMap,
} from './caps';
import { createExposeStateWebNameMap } from './utils';

type Binding = {
  key: string;
  off?: () => void;
  attr?: string;
  cssVar?: string;
  kind?: StateSpec['kind'];
  stateId?: string;
};

function isExternalStateHandle(x: any): x is ExposeStateExternalHandle<any> {
  return (
    !!x &&
    typeof x === 'object' &&
    typeof x.get === 'function' &&
    typeof x.subscribe === 'function' &&
    typeof x.unsubscribe === 'function' &&
    !!x.spec
  );
}

export class ExposeStateWebModuleImpl extends ModuleBase {
  private readonly exposeState: ExposeStatePort;
  private disposed = false;

  private bindings: Binding[] = [];
  private active = false;
  private exposedByStateId = new Map<
    string,
    {
      stateId: string;
      key: string;
      semantic: string;
      kind: StateSpec['kind'];
      attr?: string;
      cssVar?: string;
    }
  >();

  constructor(caps: CapsVaultView, deps: ModuleDeps) {
    super(caps);
    this.exposeState = deps.requirePort<ExposeStatePort>('expose-state');
  }

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    if (phase === 'unmounted') this.dispose();
  }

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    if (phase !== 'detached') return;
    this.active = false;
    this.clearBindings();
    this.exposedByStateId.clear();
  }

  afterRenderCommit(): void {
    this.refresh();
  }

  protected override onCapsEpoch(_epoch: number): void {
    this.refresh();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearBindings();
  }

  // -------------------------
  // core
  // -------------------------

  private refresh(): void {
    if (this.disposed) return;
    if (this.mountPhase === 'detached' || this.mountPhase === 'unmounting') return;

    if (!this.caps.has(HOST_ELEMENT_CAP)) {
      this.active = false;
      this.exposedByStateId.clear();
      return;
    }
    const host = this.caps.get(HOST_ELEMENT_CAP);
    if (!host) {
      this.active = false;
      this.exposedByStateId.clear();
      return;
    }
    this.active = true;

    const nameMap = this.caps.has(EXPOSE_STATE_WEB_MAP_CAP)
      ? this.caps.get(EXPOSE_STATE_WEB_MAP_CAP)
      : createExposeStateWebNameMap;

    const mode: ExposeStateWebMode = this.caps.has(EXPOSE_STATE_WEB_MODE_CAP)
      ? this.caps.get(EXPOSE_STATE_WEB_MODE_CAP)
      : {};

    const all = this.exposeState.getAll();

    this.clearBindings();
    this.exposedByStateId.clear();

    for (const [key, value] of Object.entries(all)) {
      if (!isExternalStateHandle(value)) continue;

      const spec = value.spec as StateSpec;
      const semantic = (value as any).__stateSemantic || key;
      const stateId = String((value as any).__stateId ?? '');
      const mapping = nameMap(semantic);

      const binding: Binding = {
        key,
        stateId,
        kind: spec.kind,
        attr: this.allowAttrForKind(spec.kind, mode) ? mapping.dataAttr : undefined,
        cssVar: mapping.cssVar,
      };

      if (stateId) {
        this.exposedByStateId.set(stateId, {
          stateId,
          key,
          semantic,
          kind: spec.kind,
          attr: binding.attr,
          cssVar: binding.cssVar,
        });
      }

      this.applySnapshot(host, value, binding, mode);

      const off = value.subscribe((e) => {
        if (e.type === 'disconnect') return;
        this.applyValue(host, e.next as any, binding, mode);
      });

      binding.off = () => value.unsubscribe(off);
      this.bindings.push(binding);
    }
  }

  private applySnapshot(
    host: HTMLElement,
    h: ExposeStateExternalHandle<any>,
    binding: Binding,
    mode: ExposeStateWebMode
  ) {
    const v = h.get();
    this.applyValue(host, v, binding, mode);
  }

  private applyValue(host: HTMLElement, v: any, binding: Binding, mode: ExposeStateWebMode) {
    const kind = binding.kind;
    if (!kind) return;

    const attr = binding.attr;
    const cssVar = binding.cssVar;

    const setAttr = (val: string | null) => {
      if (!attr) return;
      for (const target of this.resolveProjectionTargets(host)) {
        if (val === null) target.removeAttribute(attr);
        else target.setAttribute(attr, val);
      }
    };

    const setVar = (val: string | null) => {
      if (!cssVar) return;
      for (const target of this.resolveProjectionTargets(host)) {
        if (val === null) target.style.removeProperty(cssVar);
        else target.style.setProperty(cssVar, val);
      }
    };

    switch (kind) {
      case 'bool': {
        if (v) setAttr('');
        else setAttr(null);
        // no css var by default
        break;
      }
      case 'enum':
      case 'string': {
        const value = v == null ? '' : String(v);
        setAttr(value);
        if (mode.allowStringVar) setVar(value);
        break;
      }
      case 'number.discrete': {
        const value = v == null ? '' : String(v);
        setAttr(value);
        setVar(value);
        break;
      }
      case 'number.range': {
        const value = v == null ? '' : String(v);
        if (mode.allowContinuousAttr) setAttr(value);
        setVar(value);
        break;
      }
      default: {
        // fallback: no-op
        break;
      }
    }
  }

  private resolveProjectionTargets(host: HTMLElement): HTMLElement[] {
    const targets = [host];
    const seen = new Set<HTMLElement>(targets);
    if (!this.caps.has(EXPOSE_STATE_WEB_MIRROR_TARGETS_CAP)) return targets;

    for (const target of this.caps.get(EXPOSE_STATE_WEB_MIRROR_TARGETS_CAP)()) {
      if (!target || seen.has(target)) continue;
      seen.add(target);
      targets.push(target);
    }
    return targets;
  }

  private clearBindings(): void {
    for (const b of this.bindings) {
      try {
        b.off?.();
      } catch {}
    }
    this.bindings = [];
    this.active = false;
    this.exposedByStateId.clear();
  }

  private allowAttrForKind(kind: StateSpec['kind'], mode: ExposeStateWebMode): boolean {
    switch (kind) {
      case 'bool':
      case 'enum':
      case 'string':
      case 'number.discrete':
        return true;
      case 'number.range':
        return !!mode.allowContinuousAttr;
      default:
        return false;
    }
  }

  readonly port = {
    isActive: () => this.active,
    getExposedStateMap: () => this.exposedByStateId,
  };
}
