// packages/modules/expose-state-web/src/impl.ts
import type { CapsVaultView, MountPhase } from '@proto.ui/core';
import { ModuleBase } from '@proto.ui/module-base';
import type { ModuleDeps } from '@proto.ui/module-base';
import type { StateSpec } from '@proto.ui/types';

import type { ExposeStatePort } from '@proto.ui/module-expose-state';
import {
  isExposeStateExternalHandle,
  type ExposeStateExternalHandle,
} from '@proto.ui/module-expose-state';

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

type ProjectionValue = { value: string | null; priority: string };
type ProjectionLease = {
  kind: 'attribute' | 'style';
  name: string;
  baseline: ProjectionValue;
  last: ProjectionValue;
};

export class ExposeStateWebModuleImpl extends ModuleBase {
  private readonly exposeState: ExposeStatePort;
  private disposed = false;

  private bindings: Binding[] = [];
  private active = false;
  private bindingGeneration = 0;
  // View suspension retains snapshots and their original baselines. Only terminal
  // disposal releases artifacts still equal to this module's most recent write.
  private projections = new Map<HTMLElement, Map<string, ProjectionLease>>();
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

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    if (phase !== 'detached' && phase !== 'unmounting') return;
    this.active = false;
    this.clearBindings();
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
    this.releaseProjections();
  }

  // -------------------------
  // core
  // -------------------------

  private refresh(): void {
    if (this.disposed) return;
    if (this.mountPhase === 'detached' || this.mountPhase === 'unmounting') return;

    if (!this.caps.has(HOST_ELEMENT_CAP)) {
      this.clearBindings();
      return;
    }
    const host = this.caps.get(HOST_ELEMENT_CAP);
    if (!host) {
      this.clearBindings();
      return;
    }
    const nameMap = this.caps.has(EXPOSE_STATE_WEB_MAP_CAP)
      ? this.caps.get(EXPOSE_STATE_WEB_MAP_CAP)
      : createExposeStateWebNameMap;

    const mode: ExposeStateWebMode = this.caps.has(EXPOSE_STATE_WEB_MODE_CAP)
      ? this.caps.get(EXPOSE_STATE_WEB_MODE_CAP)
      : {};

    const all = this.exposeState.getAll();

    const generation = this.clearBindings();
    if (!this.isCurrent(generation)) return;
    this.active = true;

    for (const [key, value] of Object.entries(all)) {
      if (!this.isCurrent(generation)) return;
      if (!isExposeStateExternalHandle(value)) continue;

      const spec = value.spec as StateSpec;
      const semantic = (value as any).__stateSemantic || key;
      const stateId = String((value as any).__stateId ?? '');
      const mapping = nameMap(semantic);
      if (!this.isCurrent(generation)) return;

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

      this.applySnapshot(host, value, binding, mode, generation);
      if (!this.isCurrent(generation)) return;
      this.bindings.push(binding);

      const off = value.subscribe((e) => {
        // Unsubscription cannot retract a callback already queued by its source.
        if (!this.isCurrent(generation)) return;
        if (e.type === 'disconnect') return;
        this.applyValue(host, e.next as any, binding, mode, generation);
      });

      binding.off = () => value.unsubscribe(off);
      // subscribe may synchronously invoke a callback that disposes or rebinds.
      if (!this.isCurrent(generation)) {
        binding.off();
        return;
      }
    }
  }

  private applySnapshot(
    host: HTMLElement,
    h: ExposeStateExternalHandle<any>,
    binding: Binding,
    mode: ExposeStateWebMode,
    generation: number
  ) {
    const v = h.get();
    this.applyValue(host, v, binding, mode, generation);
  }

  private applyValue(
    host: HTMLElement,
    v: any,
    binding: Binding,
    mode: ExposeStateWebMode,
    generation: number
  ) {
    const kind = binding.kind;
    if (!kind) return;

    const attr = binding.attr;
    const cssVar = binding.cssVar;

    const setAttr = (val: string | null) => {
      if (!attr) return;
      for (const target of this.resolveProjectionTargets(host)) {
        this.writeProjection(target, 'attribute', attr, val, generation);
      }
    };

    const setVar = (val: string | null) => {
      if (!cssVar) return;
      for (const target of this.resolveProjectionTargets(host)) {
        this.writeProjection(target, 'style', cssVar, val, generation);
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

  private isCurrent(generation: number): boolean {
    return (
      !this.disposed &&
      generation === this.bindingGeneration &&
      this.mountPhase !== 'detached' &&
      this.mountPhase !== 'unmounting'
    );
  }

  private readProjection(
    target: HTMLElement,
    kind: ProjectionLease['kind'],
    name: string
  ): ProjectionValue {
    return kind === 'attribute'
      ? { value: target.getAttribute(name), priority: '' }
      : {
          value: target.style.getPropertyValue(name),
          priority: target.style.getPropertyPriority(name),
        };
  }

  private sameProjection(a: ProjectionValue, b: ProjectionValue): boolean {
    return a.value === b.value && a.priority === b.priority;
  }

  private writeProjection(
    target: HTMLElement,
    kind: ProjectionLease['kind'],
    name: string,
    value: string | null,
    generation: number
  ): void {
    if (!this.isCurrent(generation)) return;
    const current = this.readProjection(target, kind, name);
    let leases = this.projections.get(target);
    if (!leases) this.projections.set(target, (leases = new Map()));
    const key = `${kind}:${name}`;
    const next = { value: kind === 'style' ? (value ?? '') : value, priority: '' };
    let lease = leases.get(key);
    if (!lease) {
      lease = { kind, name, baseline: current, last: next };
      leases.set(key, lease);
    } else {
      // A consumer write between projections becomes the next restoration
      // baseline instead of being silently replaced by the original baseline.
      if (!this.sameProjection(current, lease.last)) lease.baseline = current;
      lease.last = next;
    }
    if (this.sameProjection(current, next)) return;
    // Publish ownership before the DOM write: custom-element reactions may
    // synchronously dispose this module while setAttribute is still on stack.
    if (kind === 'attribute') {
      if (value === null) target.removeAttribute(name);
      else target.setAttribute(name, value);
    } else {
      if (value === null) target.style.removeProperty(name);
      else target.style.setProperty(name, value);
    }
  }

  private releaseProjections(): void {
    const projections = this.projections;
    this.projections = new Map();
    for (const [target, leases] of projections) {
      for (const lease of leases.values()) {
        try {
          const current = this.readProjection(target, lease.kind, lease.name);
          if (!this.sameProjection(current, lease.last)) continue;
          if (lease.kind === 'attribute') {
            if (lease.baseline.value === null) target.removeAttribute(lease.name);
            else target.setAttribute(lease.name, lease.baseline.value);
          } else if (!lease.baseline.value) target.style.removeProperty(lease.name);
          else target.style.setProperty(lease.name, lease.baseline.value, lease.baseline.priority);
        } catch {
          // One unavailable target must not prevent release of the remaining targets.
        }
      }
    }
  }

  private clearBindings(): number {
    const generation = ++this.bindingGeneration;
    const bindings = this.bindings;
    // Clear before callbacks so a reentrant refresh owns its new subscriptions.
    this.bindings = [];
    this.active = false;
    this.exposedByStateId.clear();
    for (const b of bindings) {
      try {
        b.off?.();
      } catch {}
    }
    return generation;
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
