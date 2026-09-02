import { createModule, defineModule, ModuleBase } from '@proto.ui/module-base';
import type { ModuleFactoryArgs } from '@proto.ui/module-base';
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
  InstancePhase,
} from '@proto.ui/core';
import type { StatePort } from '@proto.ui/module-state';

import { A11Y_PROJECT_CAP } from './caps';
import type { A11yFacade, A11yModule, A11yPort, A11ySemanticObjectIR } from './types';

class A11yModuleImpl extends ModuleBase {
  private readonly ir: A11ySemanticObjectIR = {
    states: new Map(),
    actions: new Map(),
    relations: new Map(),
  };
  private readonly stateWatchOffs: Unsubscribe[] = [];
  private stateWatchesInstalled = false;
  private levelWatchOff: Unsubscribe | null = null;
  private levelWatchInstalled = false;
  private levelWatchHandle: State<number> | null = null;

  constructor(
    caps: ModuleFactoryArgs['caps'],
    private readonly statePort: StatePort
  ) {
    super(caps);
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
      this.ir.relations.set(key, { key, spec: { ...spec } });
      this.applyProjection();
    },
    tree: (patch: A11yTreeBehavior) => {
      this.ensureSetup('def.a11y.tree');
      this.ir.tree = { ...(this.ir.tree ?? {}), ...patch };
      this.applyProjection();
    },
    level: (value: number | State<number>) => {
      this.ensureSetup('def.a11y.level');
      resolveA11yLevel(value);
      this.ir.level = value;
      this.installLevelWatch();
      this.applyProjection();
    },
  };

  readonly port: A11yPort = {
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
      level: this.ir.level,
    }),
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
    if (phase === 'detached') this.disposeViews();
  }

  afterRenderCommit(): void {
    this.installStateWatches();
    this.applyProjection();
  }

  override onInstancePhase(phase: InstancePhase): void {
    super.onInstancePhase(phase);
    if (phase === 'alive' && isState(this.ir.level)) resolveA11yLevel(this.ir.level);
  }

  /** Remove view-scoped projection subscriptions; keep instance-scoped level validation. */
  private disposeViews(): void {
    while (this.stateWatchOffs.length) {
      this.stateWatchOffs.pop()?.();
    }
    this.stateWatchesInstalled = false;
  }
  dispose(): void {
    this.disposeViews();
    this.levelWatchOff?.();
    this.levelWatchOff = null;
    this.levelWatchHandle = null;
    this.levelWatchInstalled = false;
  }

  private ensureSetup(op: string): void {
    this.sys.ensureSetup(op);
  }

  private installStateWatches(): void {
    if (this.stateWatchesInstalled) return;

    // setDefault() is setup-only and intentionally does not emit. Revalidate
    // the retained value before installing any watches so a pre-watch mutation
    // cannot leave invalid semantic IR on a host without a native projector.
    if (isState(this.ir.level)) resolveA11yLevel(this.ir.level);

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

    for (const binding of this.ir.relations.values()) {
      if (!isState(binding.spec.target)) continue;
      const off = this.statePort.watch(binding.spec.target as any, () => {
        this.applyProjection();
      });
      this.stateWatchOffs.push(off);
    }

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

    this.installLevelWatch();
    this.stateWatchesInstalled = true;
  }

  private installLevelWatch(): void {
    const nextHandle = isState(this.ir.level) ? (this.ir.level as State<number>) : null;
    if (this.levelWatchInstalled && this.levelWatchHandle === nextHandle) return;

    this.levelWatchOff?.();
    this.levelWatchOff = null;
    this.levelWatchHandle = nextHandle;
    this.levelWatchInstalled = true;
    if (!nextHandle) return;

    // Runtime State retains its existing mutation semantics. A11y omits an
    // invalid level from its snapshot and therefore removes aria-level.
    this.levelWatchOff = this.statePort.watch(nextHandle as OwnedStateHandle<number>, () => {
      this.applyProjection();
    });
  }

  private getSnapshot(): A11ySemanticObjectSnapshot {
    const states: Record<string, unknown> = {};
    for (const [key, binding] of this.ir.states) {
      states[key] = binding.handle.get();
    }

    const relations: Record<string, string | null | undefined> = {};
    const relationModes: NonNullable<A11ySemanticObjectSnapshot['relationModes']> = {};
    for (const [key, binding] of this.ir.relations) {
      const target = binding.spec.target;
      relations[key] = isState(target) ? target.get() : target;
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

    const role = isState(this.ir.role) ? (this.ir.role.get() as A11yRole) : this.ir.role;
    const level =
      role === 'heading' && typeof this.ir.level !== 'undefined'
        ? tryResolveA11yLevel(this.ir.level)
        : undefined;

    return {
      id: isState(this.ir.id) ? (this.ir.id.get() as string | null | undefined) : this.ir.id,
      role,
      name: resolveTextAlternative(this.ir.name),
      description: resolveTextAlternative(this.ir.description),
      states,
      actions: Object.fromEntries(this.ir.actions),
      relations,
      ...(Object.keys(relationModes).length ? { relationModes } : {}),
      tree,
      level,
    };
  }

  private applyProjection(): void {
    if (this.mountPhase === 'detached' || this.mountPhase === 'unmounting') return;
    if (!this.caps.has(A11Y_PROJECT_CAP)) return;
    this.caps.get(A11Y_PROJECT_CAP)(this.getSnapshot());
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

function resolveA11yLevel(value: number | State<number>): number {
  const level = isState(value) ? value.get() : value;
  if (!Number.isInteger(level) || level < 1 || level > 6) {
    throw new Error('[A11y] level must be an integer in range 1-6');
  }
  return level;
}

function tryResolveA11yLevel(value: number | State<number>): number | undefined {
  try {
    return resolveA11yLevel(value);
  } catch {
    return undefined;
  }
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
