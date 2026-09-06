import { createModule, defineModule, ModuleBase } from '@proto.ui/module-base';
import type { ModuleFactoryArgs } from '@proto.ui/module-base';
import { createA11ySemanticObjectRef, isA11ySemanticObjectRef } from '@proto.ui/core';
import type {
  A11yActionKey,
  A11yActionSpec,
  A11yRelationKey,
  A11yRelationSpec,
  A11yRole,
  A11ySemanticObjectSnapshot,
  A11yStateKey,
  A11yTextAlternative,
  A11yTreeBehavior,
  State,
  OwnedStateHandle,
  Unsubscribe,
  MountPhase,
} from '@proto.ui/core';
import type { StatePort } from '@proto.ui/module-state';

import { A11Y_PROJECT_CAP, type A11yProjector } from './caps';
import type { A11yFacade, A11yModule, A11yPort, A11ySemanticObjectIR } from './types';

class A11yModuleImpl extends ModuleBase {
  private readonly objectRef = createA11ySemanticObjectRef();
  private projectionDisposed = false;
  private activeProjector: A11yProjector | null = null;
  private readonly projectors = new Set<A11yProjector>();
  private readonly ir: A11ySemanticObjectIR = {
    states: new Map(),
    actions: new Map(),
    relations: new Map(),
  };
  private readonly stateWatchOffs: Unsubscribe[] = [];
  private stateWatchesInstalled = false;
  private readonly relationWatchOffs = new Map<A11yRelationKey, Unsubscribe>();

  constructor(
    caps: ModuleFactoryArgs['caps'],
    private readonly statePort: StatePort
  ) {
    super(caps);
  }

  override onInstancePhase(phase: 'setup' | 'alive' | 'disposing' | 'disposed'): void {
    super.onInstancePhase(phase);
    if (phase !== 'disposing' || this.projectionDisposed) return;
    this.projectionDisposed = true;
    for (const projector of this.projectors) projector.dispose?.();
    this.projectors.clear();
    this.activeProjector = null;
  }
  readonly facade: A11yFacade = {
    id: (target) => {
      this.ensureSetup('def.a11y.id');
      this.ir.id = target;
      this.applyProjection();
    },
    role: (role) => {
      this.ensureSetup('def.a11y.role');
      this.ir.role = role;
      this.applyProjection();
    },
    name: (value) => {
      this.ensureSetup('def.a11y.name');
      this.ir.name = { kind: 'text', value };
      this.applyProjection();
    },
    nameFromContent: () => {
      this.ensureSetup('def.a11y.nameFromContent');
      this.ir.name = { kind: 'content' };
      this.applyProjection();
    },
    description: (value) => {
      this.ensureSetup('def.a11y.description');
      this.ir.description = { kind: 'text', value };
      this.applyProjection();
    },
    state: <V>(key: A11yStateKey, handle: State<V>) => {
      this.ensureSetup('def.a11y.state');
      this.ir.states.set(key, { key, handle: handle as State<unknown> });
      this.applyProjection();
    },
    action: (key: A11yActionKey, spec: A11yActionSpec = {}) => {
      this.ensureSetup('def.a11y.action');
      this.ir.actions.set(key, { ...spec });
      this.applyProjection();
    },
    relation: (key: A11yRelationKey, spec: A11yRelationSpec) => {
      this.ensureSetup('def.a11y.relation');
      this.commitRelation(key, spec);
    },
    tree: (patch: A11yTreeBehavior) => {
      this.ensureSetup('def.a11y.tree');
      this.ir.tree = { ...(this.ir.tree ?? {}), ...patch };
      this.applyProjection();
    },
  };

  readonly port: A11yPort = {
    getObjectRef: () => this.objectRef,
    getSnapshot: () => this.getSnapshot(),
    getIR: () => ({
      role: this.ir.role,
      id: this.ir.id,
      name: cloneTextAlternative(this.ir.name),
      description: cloneTextAlternative(this.ir.description),
      states: new Map(this.ir.states),
      actions: new Map(this.ir.actions),
      relations: new Map(this.ir.relations),
      tree: this.ir.tree ? { ...this.ir.tree } : undefined,
    }),
    setRelation: (key, spec) => {
      this.sys.ensureNotDisposed('a11y.port.setRelation');
      this.commitRelation(key, spec);
    },
    removeRelation: (key) => {
      this.sys.ensureNotDisposed('a11y.port.removeRelation');
      if (!this.ir.relations.delete(key)) return;
      this.clearRelationWatch(key);
      this.applyProjection();
    },
  };

  override onProtoPhase(phase: 'setup' | 'mounted' | 'updated' | 'unmounted'): void {
    super.onProtoPhase(phase);
    if (phase === 'mounted' || phase === 'updated') {
      this.installStateWatches();
      this.applyProjection();
    }
    if (phase === 'unmounted') {
      this.dispose();
    }
  }

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    if (phase === 'detached') this.dispose();
  }

  afterRenderCommit(): void {
    this.installStateWatches();
    this.applyProjection();
  }

  dispose(): void {
    while (this.stateWatchOffs.length) {
      this.stateWatchOffs.pop()?.();
    }
    for (const off of this.relationWatchOffs.values()) off();
    this.relationWatchOffs.clear();
    this.stateWatchesInstalled = false;
  }

  protected override onCapsEpoch(_epoch: number): void {
    const next = this.caps.has(A11Y_PROJECT_CAP) ? this.caps.get(A11Y_PROJECT_CAP) : null;
    if (next === this.activeProjector) return;
    this.activeProjector?.detach?.();
    this.activeProjector = next;
    if (next) this.projectors.add(next);
    if (
      next &&
      !this.projectionDisposed &&
      this.mountPhase !== 'detached' &&
      this.mountPhase !== 'unmounting'
    ) {
      next(this.getSnapshot());
    }
  }

  private ensureSetup(op: string): void {
    this.sys.ensureSetup(op);
  }

  private commitRelation(key: A11yRelationKey, spec: A11yRelationSpec): void {
    this.ir.relations.set(key, { key, spec: normalizeRelationSpec(spec) });
    if (this.stateWatchesInstalled) this.watchRelation(key);
    this.applyProjection();
  }
  private installStateWatches(): void {
    if (this.stateWatchesInstalled) return;

    for (const binding of this.ir.states.values()) {
      const off = this.statePort.watch(binding.handle as any, () => {
        this.applyProjection();
      });
      this.stateWatchOffs.push(off);
    }

    if (isState(this.ir.id)) {
      const off = this.statePort.watch(this.ir.id as any, () => {
        this.applyProjection();
      });
      this.stateWatchOffs.push(off);
    }

    if (isState(this.ir.role)) {
      const off = this.statePort.watch(this.ir.role as any, () => {
        this.applyProjection();
      });
      this.stateWatchOffs.push(off);
    }

    if (this.ir.name?.kind === 'text' && isState(this.ir.name.value)) {
      const off = this.statePort.watch(this.ir.name.value as any, () => {
        this.applyProjection();
      });
      this.stateWatchOffs.push(off);
    }

    if (this.ir.description?.kind === 'text' && isState(this.ir.description.value)) {
      const off = this.statePort.watch(this.ir.description.value as any, () => {
        this.applyProjection();
      });
      this.stateWatchOffs.push(off);
    }

    for (const key of this.ir.relations.keys()) this.watchRelation(key);

    if (isState(this.ir.tree?.hidden)) {
      const off = watchState(this.statePort, this.ir.tree.hidden, () => {
        this.applyProjection();
      });
      this.stateWatchOffs.push(off);
    }
    if (isState(this.ir.tree?.mergeChildren)) {
      const off = watchState(this.statePort, this.ir.tree.mergeChildren, () => {
        this.applyProjection();
      });
      this.stateWatchOffs.push(off);
    }

    this.stateWatchesInstalled = true;
  }

  private watchRelation(key: A11yRelationKey): void {
    this.clearRelationWatch(key);
    const target = this.ir.relations.get(key)?.spec.target;
    if (!isState(target)) return;
    this.relationWatchOffs.set(
      key,
      this.statePort.watch(target as OwnedStateHandle<unknown>, () => {
        this.applyProjection();
      })
    );
  }

  private clearRelationWatch(key: A11yRelationKey): void {
    const off = this.relationWatchOffs.get(key);
    if (!off) return;
    this.relationWatchOffs.delete(key);
    off();
  }

  private getSnapshot(): A11ySemanticObjectSnapshot {
    const states: Record<string, unknown> = {};
    for (const [key, binding] of this.ir.states) {
      states[key] = binding.handle.get();
    }

    const relations: A11ySemanticObjectSnapshot['relations'] = {};
    const relationModes: NonNullable<A11ySemanticObjectSnapshot['relationModes']> = {};
    for (const [key, binding] of this.ir.relations) {
      relations[key] = resolveRelationTarget(binding.spec.target);
      if (binding.spec.mode === 'append') relationModes[key] = 'append';
    }

    const tree = this.ir.tree
      ? Object.fromEntries(
          Object.entries({
            hidden: isState(this.ir.tree.hidden)
              ? (this.ir.tree.hidden.get() as boolean)
              : this.ir.tree.hidden,
            mergeChildren: isState(this.ir.tree.mergeChildren)
              ? (this.ir.tree.mergeChildren.get() as boolean)
              : this.ir.tree.mergeChildren,
          }).filter(([, value]) => typeof value !== 'undefined')
        )
      : undefined;

    return {
      objectRef: this.objectRef,
      id: isState(this.ir.id) ? (this.ir.id.get() as string | null | undefined) : this.ir.id,
      role: isState(this.ir.role) ? (this.ir.role.get() as A11yRole) : this.ir.role,
      name: resolveTextAlternative(this.ir.name),
      description: resolveTextAlternative(this.ir.description),
      states,
      actions: Object.fromEntries(this.ir.actions),
      relations,
      ...(Object.keys(relationModes).length ? { relationModes } : {}),
      tree,
    };
  }

  private applyProjection(): void {
    if (this.projectionDisposed) return;
    if (this.mountPhase === 'detached' || this.mountPhase === 'unmounting') return;
    if (!this.caps.has(A11Y_PROJECT_CAP)) return;
    const projector = this.caps.get(A11Y_PROJECT_CAP);
    if (projector !== this.activeProjector) {
      this.activeProjector?.detach?.();
      this.activeProjector = projector;
      this.projectors.add(projector);
    }
    projector(this.getSnapshot());
  }
}

function watchState<V>(statePort: StatePort, handle: State<V>, callback: () => void): Unsubscribe {
  if ('watch' in handle && typeof handle.watch === 'function') {
    return handle.watch(() => callback());
  }
  return statePort.watch(handle as OwnedStateHandle<V>, () => callback());
}

function isState(value: unknown): value is State<unknown> {
  return (
    !!value && typeof value === 'object' && typeof (value as State<unknown>).get === 'function'
  );
}

function cloneTextAlternative(
  value: A11yTextAlternative | undefined
): A11yTextAlternative | undefined {
  if (!value) return undefined;
  return value.kind === 'text' ? { kind: 'text', value: value.value } : { kind: 'content' };
}

function resolveTextAlternative(
  value: A11yTextAlternative | undefined
): A11yTextAlternative | undefined {
  if (!value) return undefined;
  if (value.kind === 'content') return { kind: 'content' };
  return {
    kind: 'text',
    value: isState(value.value)
      ? (value.value.get() as string | null | undefined) || ''
      : value.value,
  };
}

function normalizeRelationSpec(spec: A11yRelationSpec): A11yRelationSpec {
  const { target } = spec;
  if (Array.isArray(target)) {
    const refs = [];
    const seen = new Set();
    for (const candidate of target) {
      if (!isA11ySemanticObjectRef(candidate)) {
        throw new TypeError('[A11y] relation reference lists accept semantic-object refs only');
      }
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      refs.push(candidate);
    }
    return { ...spec, target: Object.freeze(refs) };
  }
  if (typeof target !== 'string' && !isState(target) && !isA11ySemanticObjectRef(target)) {
    throw new TypeError('[A11y] relation target must be a string, State, or semantic-object ref');
  }
  return { ...spec };
}

function resolveRelationTarget(
  target: A11yRelationSpec['target']
): A11ySemanticObjectSnapshot['relations'][string] {
  if (isState(target)) return target.get() as string | null | undefined;
  if (isA11ySemanticObjectRef(target)) return Object.freeze([target]);
  if (Array.isArray(target)) return Object.freeze([...target]);
  return target;
}
export function createA11yModule(ctx: ModuleFactoryArgs): A11yModule {
  const { init, caps, deps } = ctx;

  return createModule<'a11y', 'instance', A11yFacade, A11yPort>({
    name: 'a11y',
    scope: 'instance',
    init,
    caps,
    deps,
    build: ({ caps, deps }) => {
      const impl = new A11yModuleImpl(caps, deps.requirePort<StatePort>('state'));

      return {
        facade: impl.facade,
        port: impl.port,
        hooks: {
          onInstancePhase: (p) => impl.onInstancePhase(p),
          onMountPhase: (p, epoch) => impl.onMountPhase(p, epoch),
          onProtoPhase: (p) => impl.onProtoPhase(p),
          afterRenderCommit: () => impl.afterRenderCommit(),
          dispose: () => impl.dispose(),
        },
      };
    },
  }) as A11yModule;
}

export const A11yModuleDef = defineModule({
  name: 'a11y',
  resourceOwnership: 'mixed',
  deps: ['state'],
  create: createA11yModule,
});
