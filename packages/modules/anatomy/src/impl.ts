import type {
  AnatomyCardinality,
  AnatomyClaimDecl,
  AnatomyFamily,
  AnatomyFamilyDecl,
  AnatomyQueryOptions,
  AnatomyPartView,
  Prototype,
  MountPhase,
  ProtoPhase,
  Unsubscribe,
  CapsVaultView,
} from '@proto.ui/core';
import { illegalPhase } from '@proto.ui/core';
import { ModuleBase } from '@proto.ui/module-base';
import type { ExposePort } from '@proto.ui/module-expose';

import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_ORDER_OBSERVER_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
  type AnatomyInstanceToken,
  type AnatomyOrderObserver,
  type AnatomyParentGetter,
  type AnatomyPrototypeGetter,
  type AnatomyRootTarget,
  type AnatomyRootTargetGetter,
} from './caps';
import { ANATOMY_ERROR, anatomyError } from './error';
import type {
  AnatomyDiagnostic,
  AnatomyOrderCallbackDispatcher,
  AnatomyOrderChangeCb,
  AnatomyOrderCallbackCtx,
} from './types';

type HookTraceEntry = { name?: string };

type RoleState = {
  cardinality: AnatomyCardinality;
  requires: readonly { kind: 'hook'; name: string }[];
};

type NormalizedProfile = {
  name: string;
  roles: Record<string, RoleState>;
  relations: Array<{ kind: 'contains'; parent: string; child: string }>;
};

type NormalizedFamily = {
  roles: Record<string, RoleState>;
  relations: Array<{ kind: 'contains'; parent: string; child: string }>;
  profiles: Record<string, NormalizedProfile>;
};

type ClaimRecord = {
  instance: AnatomyInstanceToken;
  family: AnatomyFamily;
  role: string;
  profile?: string;
  prototype: Prototype<any> | null;
  exposePort: ExposePort;
  getRootTarget: AnatomyRootTargetGetter;
  invoke: AnatomyOrderCallbackDispatcher;
};

const CLAIM_BY_PART_VIEW = new WeakMap<AnatomyPartView, ClaimRecord>();

const ORDER_FOLLOWING = typeof Node !== 'undefined' ? Node.DOCUMENT_POSITION_FOLLOWING : 4;
const ORDER_PRECEDING = typeof Node !== 'undefined' ? Node.DOCUMENT_POSITION_PRECEDING : 2;

const CENTER = (() => {
  const families = new Map<AnatomyFamily, NormalizedFamily>();
  const claimsByInstance = new Map<AnatomyInstanceToken, Map<AnatomyFamily, ClaimRecord>>();

  const getClaim = (instance: AnatomyInstanceToken, family: AnatomyFamily) =>
    claimsByInstance.get(instance)?.get(family) ?? null;

  return {
    setFamily(family: AnatomyFamily, def: NormalizedFamily) {
      families.set(family, def);
    },
    getFamily(family: AnatomyFamily) {
      return families.get(family) ?? null;
    },
    setClaim(record: ClaimRecord) {
      let byFamily = claimsByInstance.get(record.instance);
      if (!byFamily) {
        byFamily = new Map();
        claimsByInstance.set(record.instance, byFamily);
      }
      byFamily.set(record.family, record);
    },
    getClaim,
    deleteClaim(instance: AnatomyInstanceToken, family: AnatomyFamily) {
      const byFamily = claimsByInstance.get(instance);
      if (!byFamily) return;
      byFamily.delete(family);
      if (byFamily.size === 0) claimsByInstance.delete(instance);
    },
    listClaims(family: AnatomyFamily): ClaimRecord[] {
      const out: ClaimRecord[] = [];
      for (const byFamily of claimsByInstance.values()) {
        const claim = byFamily.get(family);
        if (claim) out.push(claim);
      }
      return out;
    },
  };
})();

function cloneCardinality(cardinality: AnatomyCardinality): AnatomyCardinality {
  return { min: cardinality.min, max: cardinality.max };
}

function normalizeCardinality(
  cardinality: Partial<AnatomyCardinality> | AnatomyCardinality
): AnatomyCardinality {
  const min = cardinality.min;
  const max = cardinality.max;
  if (typeof min !== 'number' || Number.isNaN(min) || min < 0) {
    throw anatomyError(ANATOMY_ERROR.FAMILY_INVALID, `[Anatomy] invalid cardinality.min`);
  }
  if (max !== '*' && (typeof max !== 'number' || Number.isNaN(max) || max < min)) {
    throw anatomyError(ANATOMY_ERROR.FAMILY_INVALID, `[Anatomy] invalid cardinality.max`);
  }
  return { min, max };
}

function compareCardinalityMax(a: number | '*', b: number | '*'): number {
  if (a === b) return 0;
  if (a === '*') return 1;
  if (b === '*') return -1;
  return a - b;
}

function exceedsCardinalityMax(count: number, max: number | '*'): boolean {
  return max !== '*' && count > max;
}

function normalizeRequires(
  requires?: readonly { kind: 'hook'; name: string }[]
): readonly { kind: 'hook'; name: string }[] {
  if (!requires) return [];
  for (const req of requires) {
    if (req?.kind !== 'hook' || typeof req.name !== 'string' || req.name.length === 0) {
      throw anatomyError(ANATOMY_ERROR.FAMILY_INVALID, `[Anatomy] invalid requirement`);
    }
  }
  return requires.slice();
}

function normalizeFamily(decl: AnatomyFamilyDecl): NormalizedFamily {
  const roles: Record<string, RoleState> = {};
  for (const [role, roleDecl] of Object.entries(decl.roles ?? {})) {
    roles[role] = {
      cardinality: normalizeCardinality(roleDecl.cardinality),
      requires: normalizeRequires(roleDecl.requires),
    };
  }

  const relations = (decl.relations ?? []).map((it) => ({
    kind: 'contains' as const,
    parent: it.parent,
    child: it.child,
  }));

  const profiles: Record<string, NormalizedProfile> = {};
  for (const [name, profileDecl] of Object.entries(decl.profiles ?? {})) {
    const nextRoles: Record<string, RoleState> = {};
    for (const [role, baseRole] of Object.entries(roles)) {
      const patch = profileDecl.roles?.[role];
      const nextCardinality = cloneCardinality(baseRole.cardinality);
      if (patch?.cardinality) {
        if (typeof patch.cardinality.min === 'number') nextCardinality.min = patch.cardinality.min;
        if (typeof patch.cardinality.max === 'number' || patch.cardinality.max === '*') {
          nextCardinality.max = patch.cardinality.max;
        }
      }
      if (
        nextCardinality.min < baseRole.cardinality.min ||
        compareCardinalityMax(nextCardinality.max, baseRole.cardinality.max) > 0
      ) {
        throw anatomyError(
          ANATOMY_ERROR.FAMILY_INVALID,
          `[Anatomy] profile '${name}' cannot relax family cardinality for role '${role}'`
        );
      }
      nextRoles[role] = {
        cardinality: normalizeCardinality(nextCardinality),
        requires: [...baseRole.requires, ...normalizeRequires(patch?.requires)],
      };
    }
    profiles[name] = {
      name,
      roles: nextRoles,
      relations: [...relations, ...((profileDecl.relations ?? []) as any)],
    };
  }

  return { roles, relations, profiles };
}

function getHookNames(proto: Prototype<any> | null): Set<string> {
  const trace = (proto as any)?.__asHooks as HookTraceEntry[] | undefined;
  const names = new Set<string>();
  if (!Array.isArray(trace)) return names;
  for (const entry of trace) {
    if (typeof entry?.name === 'string' && entry.name) names.add(entry.name);
  }
  return names;
}

export class AnatomyModuleImpl extends ModuleBase {
  private static readonly liveInstances = new Set<AnatomyModuleImpl>();
  private static readonly sharedOrderObservers = new Map<
    AnatomyFamily,
    Map<AnatomyInstanceToken, { off: Unsubscribe; listeners: Set<AnatomyModuleImpl> }>
  >();

  private readonly prototypeName: string;
  private readonly exposePort: ExposePort;
  private disposed = false;
  private claimFamilies = new Set<AnatomyFamily>();
  private orderDispatch: AnatomyOrderCallbackDispatcher = (fn) => fn(undefined);
  private orderListeners = new Map<AnatomyFamily, Set<AnatomyOrderChangeCb>>();
  private targetListeners = new Map<AnatomyFamily, Set<AnatomyOrderChangeCb>>();
  private observedOrderRoots = new Map<AnatomyFamily, AnatomyInstanceToken>();
  private orderVersionByFamily = new Map<AnatomyFamily, number>();
  private orderSignatureByFamily = new Map<AnatomyFamily, string>();
  private objectIds = new WeakMap<object, number>();
  private primitiveIds = new Map<unknown, number>();
  private nextIdentityId = 1;

  constructor(caps: CapsVaultView, prototypeName: string, exposePort: ExposePort) {
    super(caps);
    this.prototypeName = prototypeName;
    this.exposePort = exposePort;
    AnatomyModuleImpl.liveInstances.add(this);
  }

  private ensureFamilyRegistered(family: AnatomyFamily): NormalizedFamily {
    const existing = CENTER.getFamily(family);
    if (existing) return existing;
    const normalized = normalizeFamily(family.decl);
    CENTER.setFamily(family, normalized);
    return normalized;
  }

  claim(family: AnatomyFamily, decl: AnatomyClaimDecl): void {
    this.ensureSetup('def.anatomy.claim');

    const familyDef = this.ensureFamilyRegistered(family);
    if (!familyDef.roles[decl.role]) {
      throw anatomyError(
        ANATOMY_ERROR.CLAIM_INVALID,
        `[Anatomy] unknown role '${decl.role}' in family '${family.debugName}'`
      );
    }
    if (decl.profile && decl.role !== 'root') {
      throw anatomyError(
        ANATOMY_ERROR.CLAIM_INVALID,
        `[Anatomy] only root claim may specify profile`
      );
    }
    if (decl.profile && !familyDef.profiles[decl.profile]) {
      throw anatomyError(
        ANATOMY_ERROR.CLAIM_INVALID,
        `[Anatomy] unknown profile '${decl.profile}' in family '${family.debugName}'`
      );
    }

    const instance = this.getSelfToken();
    if (CENTER.getClaim(instance, family)) {
      throw anatomyError(
        ANATOMY_ERROR.CLAIM_INVALID,
        `[Anatomy] duplicate claim for family '${family.debugName}'`
      );
    }

    CENTER.setClaim({
      instance,
      family,
      role: decl.role,
      profile: decl.profile,
      prototype: this.getPrototypeGetter()(instance),
      exposePort: this.exposePort,
      getRootTarget: this.getRootTargetGetter(),
      invoke: (fn) => this.orderDispatch(fn),
    });
    this.claimFamilies.add(family);
  }

  has(family: AnatomyFamily, role: string): boolean {
    this.ensureRuntime('run.anatomy.has');
    return (this.partsOf(family, role) ?? []).length > 0;
  }

  subscribeParts(
    family: AnatomyFamily,
    role: string,
    cb: (ctx: AnatomyOrderCallbackCtx, parts: readonly AnatomyPartView[]) => void
  ): Unsubscribe {
    this.ensureSetup('def.anatomy.subscribeParts');
    let previousSignature = this.computeRoleOrderSignature(family, role);
    return this.subscribeOrder(family, (ctx) => {
      const nextSignature = this.computeRoleOrderSignature(family, role);
      if (nextSignature === previousSignature) return;
      previousSignature = nextSignature;
      const parts = this.tryOrderedPartsOf(family, role) ?? [];
      cb(ctx, parts);
    });
  }

  parts(family: AnatomyFamily, options?: AnatomyQueryOptions): readonly AnatomyPartView[] | null {
    this.ensureRuntime('run.anatomy.parts');
    if (options?.missing === 'null') return this.tryParts(family);
    if (options?.missing === 'empty') return this.tryParts(family) ?? [];
    const domain = this.resolveCurrentDomain(family);
    return domain.claims.map((claim) => this.toPartView(claim));
  }

  tryParts(family: AnatomyFamily): readonly AnatomyPartView[] | null {
    const domain = this.resolveCurrentDomain(family, false);
    if (!domain.rootInstance) return null;
    return domain.claims.map((claim) => this.toPartView(claim));
  }

  partsOf(
    family: AnatomyFamily,
    role: string,
    options?: AnatomyQueryOptions
  ): readonly AnatomyPartView[] | null {
    this.ensureRuntime('run.anatomy.partsOf');
    if (options?.missing === 'null') return this.tryOrderedPartsOf(family, role);
    if (options?.missing === 'empty') return this.tryOrderedPartsOf(family, role) ?? [];
    const domain = this.resolveCurrentDomain(family);
    return domain.claims
      .filter((claim) => claim.role === role)
      .map((claim) => this.toPartView(claim));
  }

  orderedParts(
    family: AnatomyFamily,
    options?: AnatomyQueryOptions
  ): readonly AnatomyPartView[] | null {
    this.ensureRuntime('run.anatomy.order.parts');
    if (options?.missing === 'null') return this.tryOrderedParts(family);
    if (options?.missing === 'empty') return this.tryOrderedParts(family) ?? [];
    return this.orderedPartsInternal(family);
  }

  tryOrderedParts(family: AnatomyFamily): readonly AnatomyPartView[] | null {
    const domain = this.resolveCurrentDomain(family, false);
    if (!domain.rootInstance) return null;
    return this.sortClaims(domain.claims).map((claim) => this.toPartView(claim));
  }

  orderVersion(family: AnatomyFamily, options?: AnatomyQueryOptions): number | null {
    this.ensureRuntime('run.anatomy.order.version');
    if (options?.missing === 'null') return this.tryOrderVersion(family);
    return this.getOrderVersion(family);
  }

  tryOrderVersion(family: AnatomyFamily): number | null {
    const domain = this.resolveCurrentDomain(family, false);
    if (!domain.rootInstance) return null;
    this.primeOrderSignature(family);
    return this.orderVersionByFamily.get(family) ?? 0;
  }

  orderedPartsOf(
    family: AnatomyFamily,
    role: string,
    options?: AnatomyQueryOptions
  ): readonly AnatomyPartView[] | null {
    this.ensureRuntime('run.anatomy.order.partsOf');
    if (options?.missing === 'null') return this.tryOrderedPartsOf(family, role);
    if (options?.missing === 'empty') return this.tryOrderedPartsOf(family, role) ?? [];
    return this.orderedPartsOfInternal(family, role);
  }

  tryOrderedPartsOf(family: AnatomyFamily, role: string): readonly AnatomyPartView[] | null {
    const domain = this.resolveCurrentDomain(family, false);
    if (!domain.rootInstance) return null;
    return this.sortClaims(domain.claims.filter((claim) => claim.role === role)).map((claim) =>
      this.toPartView(claim)
    );
  }

  indexOfSelf(family: AnatomyFamily, role: string, options?: AnatomyQueryOptions): number | null {
    this.ensureRuntime('run.anatomy.order.indexOfSelf');
    if (options?.missing === 'null') return this.tryIndexOfSelf(family, role);
    return this.indexOfSelfInternal(family, role);
  }

  tryIndexOfSelf(family: AnatomyFamily, role: string): number | null {
    const domain = this.resolveCurrentDomain(family, false);
    if (!domain.rootInstance) return null;
    const self = this.getSelfToken();
    const claims = this.sortClaims(domain.claims.filter((claim) => claim.role === role));
    return claims.findIndex((claim) => claim.instance === self);
  }

  prevOfSelf(
    family: AnatomyFamily,
    role: string,
    options?: AnatomyQueryOptions
  ): AnatomyPartView | null {
    this.ensureRuntime('run.anatomy.order.prevOfSelf');
    if (options?.missing === 'null') return this.tryPrevOfSelf(family, role);
    return this.prevOfSelfInternal(family, role);
  }

  tryPrevOfSelf(family: AnatomyFamily, role: string): AnatomyPartView | null {
    const domain = this.resolveCurrentDomain(family, false);
    if (!domain.rootInstance) return null;
    const self = this.getSelfToken();
    const claims = this.sortClaims(domain.claims.filter((claim) => claim.role === role));
    const index = claims.findIndex((claim) => claim.instance === self);
    if (index <= 0) return null;
    return this.toPartView(claims[index - 1]!);
  }

  nextOfSelf(
    family: AnatomyFamily,
    role: string,
    options?: AnatomyQueryOptions
  ): AnatomyPartView | null {
    this.ensureRuntime('run.anatomy.order.nextOfSelf');
    if (options?.missing === 'null') return this.tryNextOfSelf(family, role);
    return this.nextOfSelfInternal(family, role);
  }

  tryNextOfSelf(family: AnatomyFamily, role: string): AnatomyPartView | null {
    const domain = this.resolveCurrentDomain(family, false);
    if (!domain.rootInstance) return null;
    const self = this.getSelfToken();
    const claims = this.sortClaims(domain.claims.filter((claim) => claim.role === role));
    const index = claims.findIndex((claim) => claim.instance === self);
    if (index < 0 || index >= claims.length - 1) return null;
    return this.toPartView(claims[index + 1]!);
  }

  readonly port = {
    getDiagnostics: (): readonly AnatomyDiagnostic[] => {
      const out: AnatomyDiagnostic[] = [];
      for (const family of this.claimFamilies) {
        out.push(...this.computeDiagnostics(family));
      }
      return out;
    },
    resolvePartTarget: (part: AnatomyPartView): unknown | null => {
      const claim = CLAIM_BY_PART_VIEW.get(part);
      return claim?.getRootTarget(claim.instance) ?? null;
    },
    resolveDomainScope: (family: AnatomyFamily): unknown | null =>
      this.resolveCurrentDomain(family, false).rootInstance,
    descendantsOf: (
      family: AnatomyFamily,
      ancestor: AnatomyPartView,
      role: string
    ): readonly AnatomyPartView[] => {
      const ancestorClaim = CLAIM_BY_PART_VIEW.get(ancestor);
      if (!ancestorClaim || ancestorClaim.family !== family) return [];
      const domain = this.resolveCurrentDomain(family, false);
      if (!domain.rootInstance || !domain.claims.includes(ancestorClaim)) return [];
      const getParent = this.getParentGetter();
      return this.sortClaims(
        domain.claims.filter((claim) => {
          if (claim.role !== role) return false;
          let current = getParent(claim.instance);
          while (current) {
            if (current === ancestorClaim.instance) return true;
            if (current === domain.rootInstance) return false;
            current = getParent(current);
          }
          return false;
        })
      ).map((claim) => this.toPartView(claim));
    },
    parts: (family: AnatomyFamily, options?: AnatomyQueryOptions) => {
      if (options?.missing === 'null') return this.tryParts(family);
      if (options?.missing === 'empty') return this.tryParts(family) ?? [];
      const domain = this.resolveCurrentDomain(family);
      return domain.claims.map((claim) => this.toPartView(claim));
    },
    order: {
      version: (family: AnatomyFamily, options?: AnatomyQueryOptions) => {
        if (options?.missing === 'null') return this.tryOrderVersion(family);
        return this.getOrderVersion(family);
      },
      parts: (family: AnatomyFamily, options?: AnatomyQueryOptions) => {
        if (options?.missing === 'null') return this.tryOrderedParts(family);
        if (options?.missing === 'empty') return this.tryOrderedParts(family) ?? [];
        return this.orderedPartsInternal(family);
      },
      partsOf: (family: AnatomyFamily, role: string, options?: AnatomyQueryOptions) => {
        if (options?.missing === 'null') return this.tryOrderedPartsOf(family, role);
        if (options?.missing === 'empty') return this.tryOrderedPartsOf(family, role) ?? [];
        return this.orderedPartsOfInternal(family, role);
      },
      indexOfSelf: (family: AnatomyFamily, role: string, options?: AnatomyQueryOptions) => {
        if (options?.missing === 'null') return this.tryIndexOfSelf(family, role);
        return this.indexOfSelfInternal(family, role);
      },
      prevOfSelf: (family: AnatomyFamily, role: string, options?: AnatomyQueryOptions) => {
        if (options?.missing === 'null') return this.tryPrevOfSelf(family, role);
        return this.prevOfSelfInternal(family, role);
      },
      nextOfSelf: (family: AnatomyFamily, role: string, options?: AnatomyQueryOptions) => {
        if (options?.missing === 'null') return this.tryNextOfSelf(family, role);
        return this.nextOfSelfInternal(family, role);
      },
      tryVersion: (family: AnatomyFamily) => {
        const domain = this.resolveCurrentDomain(family, false);
        if (!domain.rootInstance) return null;
        this.primeOrderSignature(family);
        return this.orderVersionByFamily.get(family) ?? 0;
      },
      tryParts: (family: AnatomyFamily) => {
        const domain = this.resolveCurrentDomain(family, false);
        if (!domain.rootInstance) return null;
        return this.sortClaims(domain.claims).map((claim) => this.toPartView(claim));
      },
      tryPartsOf: (family: AnatomyFamily, role: string) => {
        const domain = this.resolveCurrentDomain(family, false);
        if (!domain.rootInstance) return null;
        return this.sortClaims(domain.claims.filter((claim) => claim.role === role)).map((claim) =>
          this.toPartView(claim)
        );
      },
      tryIndexOfSelf: (family: AnatomyFamily, role: string) => {
        const domain = this.resolveCurrentDomain(family, false);
        if (!domain.rootInstance) return null;
        const self = this.getSelfToken();
        const claims = this.sortClaims(domain.claims.filter((claim) => claim.role === role));
        return claims.findIndex((claim) => claim.instance === self);
      },
      tryPrevOfSelf: (family: AnatomyFamily, role: string) => {
        const domain = this.resolveCurrentDomain(family, false);
        if (!domain.rootInstance) return null;
        const self = this.getSelfToken();
        const claims = this.sortClaims(domain.claims.filter((claim) => claim.role === role));
        const index = claims.findIndex((claim) => claim.instance === self);
        if (index <= 0) return null;
        return this.toPartView(claims[index - 1]!);
      },
      tryNextOfSelf: (family: AnatomyFamily, role: string) => {
        const domain = this.resolveCurrentDomain(family, false);
        if (!domain.rootInstance) return null;
        const self = this.getSelfToken();
        const claims = this.sortClaims(domain.claims.filter((claim) => claim.role === role));
        const index = claims.findIndex((claim) => claim.instance === self);
        if (index < 0 || index >= claims.length - 1) return null;
        return this.toPartView(claims[index + 1]!);
      },
    },
    setOrderCallbackDispatcher: (dispatch: AnatomyOrderCallbackDispatcher) => {
      this.orderDispatch = dispatch;
    },
    subscribeOrder: (family: AnatomyFamily, cb: AnatomyOrderChangeCb) =>
      this.subscribeOrder(family, cb),
    subscribeTargets: (family: AnatomyFamily, cb: AnatomyOrderChangeCb) =>
      this.subscribeTargets(family, cb),
  };

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    if (phase === 'mounted') {
      for (const family of this.claimFamilies) {
        AnatomyModuleImpl.notifyStructuralChange(family);
        AnatomyModuleImpl.notifyTargetChange(family);
      }
    }
    if (phase === 'unmounted') {
      for (const family of this.claimFamilies) AnatomyModuleImpl.notifyTargetChange(family);
      this.dispose();
    }
  }

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    if (phase === 'unmounting' || phase === 'detached') {
      for (const family of this.claimFamilies) AnatomyModuleImpl.notifyTargetChange(family);
      for (const family of Array.from(this.observedOrderRoots.keys())) {
        this.teardownOrderObserver(family);
      }
      return;
    }
    if (phase === 'mounted') {
      for (const family of this.orderListeners.keys()) this.ensureOrderObserver(family);
      for (const family of this.claimFamilies) AnatomyModuleImpl.notifyTargetChange(family);
    }
  }

  protected override onCapsEpoch(_epoch: number): void {
    for (const family of this.claimFamilies) AnatomyModuleImpl.notifyTargetChange(family);
    if (this.mountPhase !== 'mounted') return;
    for (const family of Array.from(this.observedOrderRoots.keys())) {
      this.teardownOrderObserver(family);
    }
    for (const family of this.orderListeners.keys()) this.ensureOrderObserver(family);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    AnatomyModuleImpl.liveInstances.delete(this);
    for (const family of this.observedOrderRoots.keys()) {
      this.teardownOrderObserver(family);
    }
    this.observedOrderRoots.clear();
    this.orderListeners.clear();
    this.targetListeners.clear();
    if (this.claimFamilies.size === 0) return;
    if (!this.caps.has(ANATOMY_INSTANCE_TOKEN_CAP)) return;

    const instance = this.caps.get(ANATOMY_INSTANCE_TOKEN_CAP) as AnatomyInstanceToken;
    for (const family of this.claimFamilies) {
      CENTER.deleteClaim(instance, family);
      AnatomyModuleImpl.notifyStructuralChange(family);
    }
    this.claimFamilies.clear();
  }

  private getOrderedClaimsOf(family: AnatomyFamily, role: string): ClaimRecord[] {
    const domain = this.resolveCurrentDomain(family);
    return this.sortClaims(domain.claims.filter((claim) => claim.role === role));
  }

  private orderedPartsInternal(family: AnatomyFamily): readonly AnatomyPartView[] {
    const domain = this.resolveCurrentDomain(family);
    return this.sortClaims(domain.claims).map((claim) => this.toPartView(claim));
  }

  private orderedPartsOfInternal(family: AnatomyFamily, role: string): readonly AnatomyPartView[] {
    return this.getOrderedClaimsOf(family, role).map((claim) => this.toPartView(claim));
  }

  private indexOfSelfInternal(family: AnatomyFamily, role: string): number {
    const self = this.getSelfToken();
    const claims = this.getOrderedClaimsOf(family, role);
    return claims.findIndex((claim) => claim.instance === self);
  }

  private prevOfSelfInternal(family: AnatomyFamily, role: string): AnatomyPartView | null {
    const self = this.getSelfToken();
    const claims = this.getOrderedClaimsOf(family, role);
    const index = claims.findIndex((claim) => claim.instance === self);
    if (index <= 0) return null;
    return this.toPartView(claims[index - 1]!);
  }

  private nextOfSelfInternal(family: AnatomyFamily, role: string): AnatomyPartView | null {
    const self = this.getSelfToken();
    const claims = this.getOrderedClaimsOf(family, role);
    const index = claims.findIndex((claim) => claim.instance === self);
    if (index < 0 || index >= claims.length - 1) return null;
    return this.toPartView(claims[index + 1]!);
  }

  private subscribeOrder(family: AnatomyFamily, cb: AnatomyOrderChangeCb): Unsubscribe {
    let set = this.orderListeners.get(family);
    if (!set) {
      set = new Set();
      this.orderListeners.set(family, set);
    }
    set.add(cb);
    this.primeOrderSignature(family);
    this.ensureOrderObserver(family);
    return () => {
      const current = this.orderListeners.get(family);
      current?.delete(cb);
      if (!current || current.size > 0) return;
      this.orderListeners.delete(family);
      this.teardownOrderObserver(family);
    };
  }

  private subscribeTargets(family: AnatomyFamily, cb: AnatomyOrderChangeCb): Unsubscribe {
    let set = this.targetListeners.get(family);
    if (!set) {
      set = new Set();
      this.targetListeners.set(family, set);
    }
    set.add(cb);
    return () => {
      const current = this.targetListeners.get(family);
      current?.delete(cb);
      if (current?.size === 0) this.targetListeners.delete(family);
    };
  }

  private static notifyStructuralChange(family: AnatomyFamily): void {
    for (const impl of AnatomyModuleImpl.liveInstances) {
      if (!impl.orderListeners.has(family)) continue;
      impl.emitOrderChangeIfNeeded(family);
    }
  }

  private static notifyTargetChange(family: AnatomyFamily): void {
    for (const impl of AnatomyModuleImpl.liveInstances) {
      const listeners = impl.targetListeners.get(family);
      if (!listeners?.size) continue;
      impl.orderDispatch((ctx) => {
        for (const listener of listeners) listener(ctx);
      });
    }
  }

  private ensureOrderObserver(family: AnatomyFamily): void {
    if (this.mountPhase !== 'mounted') return;
    if (this.observedOrderRoots.has(family)) return;
    if (!this.caps.has(ANATOMY_ORDER_OBSERVER_CAP)) return;

    const domain = this.resolveCurrentDomain(family, false);
    if (!domain.rootInstance) return;
    const target = this.getObservedRootTarget(family);
    if (!target) return;

    let byRoot = AnatomyModuleImpl.sharedOrderObservers.get(family);
    if (!byRoot) {
      byRoot = new Map();
      AnatomyModuleImpl.sharedOrderObservers.set(family, byRoot);
    }

    let entry = byRoot.get(domain.rootInstance);
    if (!entry) {
      const observer = this.caps.get(ANATOMY_ORDER_OBSERVER_CAP) as AnatomyOrderObserver;
      const listeners = new Set<AnatomyModuleImpl>();
      const off = observer(target, () => {
        for (const impl of listeners) {
          impl.emitOrderChangeIfNeeded(family);
        }
      });
      entry = { off, listeners };
      byRoot.set(domain.rootInstance, entry);
    }

    entry.listeners.add(this);
    this.observedOrderRoots.set(family, domain.rootInstance);
  }

  private teardownOrderObserver(family: AnatomyFamily): void {
    const rootInstance = this.observedOrderRoots.get(family);
    if (!rootInstance) return;
    this.observedOrderRoots.delete(family);

    const byRoot = AnatomyModuleImpl.sharedOrderObservers.get(family);
    const entry = byRoot?.get(rootInstance);
    if (!entry) return;

    entry.listeners.delete(this);
    if (entry.listeners.size > 0) return;

    entry.off();
    byRoot?.delete(rootInstance);
    if (byRoot && byRoot.size === 0) {
      AnatomyModuleImpl.sharedOrderObservers.delete(family);
    }
  }

  private primeOrderSignature(family: AnatomyFamily): void {
    if (this.orderSignatureByFamily.has(family)) return;
    const signature = this.computeOrderSignature(family);
    this.orderSignatureByFamily.set(family, signature);
    this.orderVersionByFamily.set(family, 0);
  }

  private getOrderVersion(family: AnatomyFamily): number {
    this.primeOrderSignature(family);
    return this.orderVersionByFamily.get(family) ?? 0;
  }

  private emitOrderChangeIfNeeded(family: AnatomyFamily): void {
    const prev = this.orderSignatureByFamily.get(family);
    const next = this.computeOrderSignature(family);
    if (typeof prev !== 'undefined' && prev === next) return;

    this.orderSignatureByFamily.set(family, next);
    const nextVersion = (this.orderVersionByFamily.get(family) ?? 0) + 1;
    this.orderVersionByFamily.set(family, nextVersion);

    const listeners = this.orderListeners.get(family);
    if (!listeners || listeners.size === 0) return;
    this.orderDispatch((ctx) => {
      for (const listener of listeners) listener(ctx);
    });
  }

  private computeOrderSignature(family: AnatomyFamily): string {
    const domain = this.resolveCurrentDomain(family, false);
    if (!domain.rootInstance) return 'missing-domain';
    const ordered = this.sortClaims(domain.claims);
    return ordered.map((claim) => `${claim.role}:${this.getIdentityId(claim.instance)}`).join('|');
  }

  private computeRoleOrderSignature(family: AnatomyFamily, role: string): string {
    const domain = this.resolveCurrentDomain(family, false);
    if (!domain.rootInstance) return 'missing-domain';
    const ordered = this.sortClaims(domain.claims.filter((claim) => claim.role === role));
    return ordered.map((claim) => this.getIdentityId(claim.instance)).join('|');
  }

  private getIdentityId(value: unknown): number {
    if (value && typeof value === 'object') {
      const obj = value as object;
      const existing = this.objectIds.get(obj);
      if (existing) return existing;
      const next = this.nextIdentityId++;
      this.objectIds.set(obj, next);
      return next;
    }

    if (this.primitiveIds.has(value)) {
      return this.primitiveIds.get(value)!;
    }
    const next = this.nextIdentityId++;
    this.primitiveIds.set(value, next);
    return next;
  }

  private getObservedRootTarget(family: AnatomyFamily): AnatomyRootTarget | null {
    const domain = this.resolveCurrentDomain(family, false);
    if (!domain.rootInstance) return null;
    const rootClaim = CENTER.getClaim(domain.rootInstance, family);
    if (!rootClaim) return null;
    return rootClaim.getRootTarget(rootClaim.instance);
  }

  private sortClaims(claims: ClaimRecord[]): ClaimRecord[] {
    return claims
      .map((claim, index) => ({ claim, index }))
      .sort((left, right) => {
        const cmp = this.compareClaims(left.claim, right.claim);
        if (cmp !== 0) return cmp;
        return left.index - right.index;
      })
      .map((entry) => entry.claim);
  }

  private compareClaims(a: ClaimRecord, b: ClaimRecord): number {
    const aTarget = a.getRootTarget(a.instance);
    const bTarget = b.getRootTarget(b.instance);
    if (!aTarget || !bTarget || aTarget === bTarget) return 0;
    if (typeof aTarget.compareDocumentPosition !== 'function') return 0;

    const pos = aTarget.compareDocumentPosition(bTarget as AnatomyRootTarget);
    if (pos & ORDER_FOLLOWING) return -1;
    if (pos & ORDER_PRECEDING) return 1;
    return 0;
  }

  private computeDiagnostics(family: AnatomyFamily): AnatomyDiagnostic[] {
    const familyDef = CENTER.getFamily(family);
    if (!familyDef) return [];

    const domain = this.resolveCurrentDomain(family, false);
    const claims = domain.claims;
    const diagnostics: AnatomyDiagnostic[] = [];
    const counts = new Map<string, number>();
    for (const claim of claims) counts.set(claim.role, (counts.get(claim.role) ?? 0) + 1);

    for (const [role, roleState] of Object.entries(familyDef.roles)) {
      const count = counts.get(role) ?? 0;
      if (count < roleState.cardinality.min) {
        diagnostics.push({
          level: 'error',
          scope: 'family',
          code: 'ANATOMY_FAMILY_MIN',
          message: `[Anatomy] role '${role}' is below family min in '${family.debugName}'`,
          family,
          role,
        });
      }
      if (exceedsCardinalityMax(count, roleState.cardinality.max)) {
        diagnostics.push({
          level: 'error',
          scope: 'family',
          code: 'ANATOMY_FAMILY_MAX',
          message: `[Anatomy] role '${role}' exceeds family max in '${family.debugName}'`,
          family,
          role,
        });
      }
    }

    for (const claim of claims) {
      const familyRole = familyDef.roles[claim.role];
      for (const req of familyRole?.requires ?? []) {
        if (!getHookNames(claim.prototype).has(req.name)) {
          diagnostics.push({
            level: 'error',
            scope: 'family',
            code: 'ANATOMY_FAMILY_HOOK_REQUIRED',
            message: `[Anatomy] role '${claim.role}' requires hook '${req.name}'`,
            family,
            role: claim.role,
          });
        }
      }
    }

    for (const relation of familyDef.relations) {
      for (const claim of claims.filter((it) => it.role === relation.child)) {
        if (!this.hasAncestorRole(claim.instance, family, relation.parent, domain.rootInstance)) {
          diagnostics.push({
            level: 'error',
            scope: 'family',
            code: 'ANATOMY_FAMILY_RELATION',
            message: `[Anatomy] role '${relation.child}' must be contained by '${relation.parent}'`,
            family,
            role: relation.child,
          });
        }
      }
    }

    const profileName = domain.profile;
    if (!profileName) return diagnostics;
    const profile = familyDef.profiles[profileName];
    if (!profile) return diagnostics;

    for (const [role, roleState] of Object.entries(profile.roles)) {
      const count = counts.get(role) ?? 0;
      if (count < roleState.cardinality.min) {
        diagnostics.push({
          level: 'warning',
          scope: 'profile',
          code: 'ANATOMY_PROFILE_MIN',
          message: `[Anatomy] role '${role}' is below profile min in '${family.debugName}/${profileName}'`,
          family,
          role,
          profile: profileName,
        });
      }
      if (exceedsCardinalityMax(count, roleState.cardinality.max)) {
        diagnostics.push({
          level: 'warning',
          scope: 'profile',
          code: 'ANATOMY_PROFILE_MAX',
          message: `[Anatomy] role '${role}' exceeds profile max in '${family.debugName}/${profileName}'`,
          family,
          role,
          profile: profileName,
        });
      }
    }

    for (const claim of claims) {
      const profileRole = profile.roles[claim.role];
      const familyReqNames = new Set(
        (familyDef.roles[claim.role]?.requires ?? []).map((it) => it.name)
      );
      for (const req of profileRole?.requires ?? []) {
        if (familyReqNames.has(req.name)) continue;
        if (!getHookNames(claim.prototype).has(req.name)) {
          diagnostics.push({
            level: 'warning',
            scope: 'profile',
            code: 'ANATOMY_PROFILE_HOOK_REQUIRED',
            message: `[Anatomy] role '${claim.role}' is missing profile hook '${req.name}'`,
            family,
            role: claim.role,
            profile: profileName,
          });
        }
      }
    }

    for (const relation of profile.relations.slice(familyDef.relations.length)) {
      for (const claim of claims.filter((it) => it.role === relation.child)) {
        if (!this.hasAncestorRole(claim.instance, family, relation.parent, domain.rootInstance)) {
          diagnostics.push({
            level: 'warning',
            scope: 'profile',
            code: 'ANATOMY_PROFILE_RELATION',
            message: `[Anatomy] role '${relation.child}' should be contained by '${relation.parent}'`,
            family,
            role: relation.child,
            profile: profileName,
          });
        }
      }
    }

    return diagnostics;
  }

  private resolveCurrentDomain(
    family: AnatomyFamily,
    strict = true
  ): {
    rootInstance: AnatomyInstanceToken | null;
    claims: ClaimRecord[];
    profile: string | null;
  } {
    const instance = this.getSelfToken();
    const rootInstance = this.findDomainRoot(instance, family);
    if (!rootInstance) {
      if (!strict) return { rootInstance: null, claims: [], profile: null };
      throw anatomyError(
        ANATOMY_ERROR.CLAIM_INVALID,
        `[Anatomy] current instance is not part of a valid domain for '${family.debugName}'`
      );
    }

    const claims = CENTER.listClaims(family).filter(
      (claim) => this.findDomainRoot(claim.instance, family) === rootInstance
    );
    const rootClaim =
      claims.find((claim) => claim.role === 'root' && claim.instance === rootInstance) ?? null;
    return {
      rootInstance,
      claims,
      profile: rootClaim?.profile ?? null,
    };
  }

  private findDomainRoot(
    instance: AnatomyInstanceToken,
    family: AnatomyFamily
  ): AnatomyInstanceToken | null {
    const getParent = this.getParentGetter();
    let cur: AnatomyInstanceToken | null = instance;
    while (cur) {
      const claim = CENTER.getClaim(cur, family);
      if (claim?.role === 'root') return cur;
      cur = getParent(cur);
    }
    return null;
  }

  private hasAncestorRole(
    instance: AnatomyInstanceToken,
    family: AnatomyFamily,
    role: string,
    domainRoot: AnatomyInstanceToken | null
  ): boolean {
    const getParent = this.getParentGetter();
    let cur = getParent(instance);
    while (cur) {
      const claim = CENTER.getClaim(cur, family);
      if (claim?.role === role) return true;
      if (domainRoot && cur === domainRoot) break;
      cur = getParent(cur);
    }
    return false;
  }

  private toPartView(claim: ClaimRecord): AnatomyPartView {
    const part: AnatomyPartView = {
      role: claim.role,
      hasExpose: (key: string) => claim.exposePort.has(key),
      getExpose: (key: string) => {
        if (!claim.exposePort.has(key)) return null;
        const exposed = claim.exposePort.get(key) ?? null;
        if (typeof exposed !== 'function') return exposed;
        return (...args: unknown[]) => {
          let result: unknown;
          let thrown: unknown;
          claim.invoke(() => {
            try {
              result = exposed(...args);
            } catch (error) {
              thrown = error;
            }
          });
          if (thrown) throw thrown;
          return result;
        };
      },
      hasHook: (name: string) => getHookNames(claim.prototype).has(name),
    };
    CLAIM_BY_PART_VIEW.set(part, claim);
    return part;
  }

  private ensureSetup(op: string) {
    if (this.sys) {
      try {
        this.sys.ensureSetup(op);
        return;
      } catch (error) {
        throw anatomyError(ANATOMY_ERROR.PHASE, `[Anatomy] setup-only: ${op}`);
      }
    }
    if (this.protoPhase !== 'setup') {
      throw illegalPhase(op, this.protoPhase, { prototypeName: this.prototypeName });
    }
  }

  private ensureRuntime(op: string) {
    if (this.sys) {
      try {
        this.sys.ensureRuntime(op);
        return;
      } catch {
        throw anatomyError(ANATOMY_ERROR.PHASE, `[Anatomy] runtime-only: ${op}`);
      }
    }
    if (this.protoPhase === 'setup') {
      throw illegalPhase(op, this.protoPhase, { prototypeName: this.prototypeName });
    }
  }

  private ensureCallback(op: string) {
    if (this.sys) {
      try {
        this.sys.ensureCallback(op);
        return;
      } catch {
        throw anatomyError(ANATOMY_ERROR.PHASE, `[Anatomy] callback-only: ${op}`);
      }
    }
    if (this.protoPhase === 'setup') {
      throw illegalPhase(op, this.protoPhase, { prototypeName: this.prototypeName });
    }
  }

  private getSelfToken(): AnatomyInstanceToken {
    if (!this.caps.has(ANATOMY_INSTANCE_TOKEN_CAP)) {
      throw anatomyError(ANATOMY_ERROR.CAP, `[Anatomy] host caps missing: instance token`);
    }
    return this.caps.get(ANATOMY_INSTANCE_TOKEN_CAP) as AnatomyInstanceToken;
  }

  private getParentGetter(): AnatomyParentGetter {
    if (!this.caps.has(ANATOMY_PARENT_CAP)) {
      throw anatomyError(ANATOMY_ERROR.CAP, `[Anatomy] host caps missing: parent getter`);
    }
    return this.caps.get(ANATOMY_PARENT_CAP) as AnatomyParentGetter;
  }

  private getPrototypeGetter(): AnatomyPrototypeGetter {
    if (!this.caps.has(ANATOMY_GET_PROTO_CAP)) {
      throw anatomyError(ANATOMY_ERROR.CAP, `[Anatomy] host caps missing: prototype getter`);
    }
    return this.caps.get(ANATOMY_GET_PROTO_CAP) as AnatomyPrototypeGetter;
  }

  private getRootTargetGetter(): AnatomyRootTargetGetter {
    if (!this.caps.has(ANATOMY_ROOT_TARGET_CAP)) {
      return () => null;
    }
    return this.caps.get(ANATOMY_ROOT_TARGET_CAP) as AnatomyRootTargetGetter;
  }
}
