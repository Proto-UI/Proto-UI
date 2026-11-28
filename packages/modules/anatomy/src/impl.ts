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

type CurrentDomain = {
  rootInstance: AnatomyInstanceToken | null;
  claims: ClaimRecord[];
};

type ClaimRecord = {
  instance: AnatomyInstanceToken;
  orderIdentity: OrderIdentity;
  family: AnatomyFamily;
  role: string;
  profile?: string;
  prototype: Prototype<any> | null;
  exposePort: ExposePort;
  exposesAvailable: () => boolean;
  getRootTarget: AnatomyRootTargetGetter;
  getParent: AnatomyParentGetter | null;
  invoke: AnatomyOrderCallbackDispatcher;
};

type OrderIdentity = string | number | bigint | boolean | symbol | null | undefined;
type OrderSignature = readonly OrderIdentity[] | null;

const hostOrderIdentities = new WeakMap<object, symbol>();

function getOrderIdentity(instance: AnatomyInstanceToken): OrderIdentity {
  if ((typeof instance === 'object' && instance !== null) || typeof instance === 'function') {
    let identity = hostOrderIdentities.get(instance);
    if (identity === undefined) hostOrderIdentities.set(instance, (identity = Symbol()));
    return identity;
  }
  // Retain primitive identity by value. Normalize signed zero to match Map keys.
  return instance === 0 ? 0 : (instance as OrderIdentity);
}

// Share reads only within one synchronous notification. A parent-getter identity
// identifies one logical host tree; independent bridges must not share domains.
// Each recipient still reads current host targets. Logical ancestry can be
// shared until an author callback or host observer registration runs.
type OrderComparisons = Map<
  AnatomyRootTarget,
  {
    compare: NonNullable<AnatomyRootTarget['compareDocumentPosition']>;
    positions: Map<AnatomyRootTarget, number>;
  }
>;
type NotificationDomains = {
  domainsByRoot?: Map<AnatomyInstanceToken, CurrentDomain>;
  rootsByInstance: Map<AnatomyInstanceToken, AnatomyInstanceToken | null>;
};
type OrderComparisonStep = {
  left: AnatomyRootTarget;
  right: AnatomyRootTarget;
  compare: NonNullable<AnatomyRootTarget['compareDocumentPosition']>;
  result: number;
  epoch: number;
};
type OrderNotificationReads = {
  comparisons: OrderComparisons;
  domains: Map<AnatomyParentGetter, NotificationDomains>;
  compare: (left: ClaimRecord, right: ClaimRecord) => number;
  traces: Map<readonly ClaimRecord[], (OrderComparisonStep | undefined)[]>;
  comparisonEpoch: number;
  activeTrace?: (OrderComparisonStep | undefined)[];
  traceIndex: number;
};

// Diagnostic-branch-only protocol. No public API, host reads or ordering inputs.
type MatrixNotificationDiagnostic = {
  enabled: true;
  begin(family: AnatomyFamily, indexedSubscribers: number): unknown;
  finish(ticket: unknown, visitedSubscribers: number, completed: boolean): void;
};

function clearOrderNotificationReads(reads?: OrderNotificationReads): void {
  reads?.comparisons.clear();
  reads?.domains.clear();
  reads?.traces.clear();
  if (reads) reads.comparisonEpoch++;
}

const CLAIM_BY_PART_VIEW = new WeakMap<AnatomyPartView, ClaimRecord>();

const ORDER_FOLLOWING = typeof Node !== 'undefined' ? Node.DOCUMENT_POSITION_FOLLOWING : 4;
const ORDER_PRECEDING = typeof Node !== 'undefined' ? Node.DOCUMENT_POSITION_PRECEDING : 2;

const CENTER = (() => {
  const families = new Map<AnatomyFamily, NormalizedFamily>();
  type InstanceClaims = { order: number; claims: Map<AnatomyFamily, ClaimRecord> };
  let nextInstanceOrder = 0;
  const claimsByInstance = new Map<AnatomyInstanceToken, InstanceClaims>();
  type FamilyClaims = ClaimRecord[] & { published?: true };
  const claimsByFamily = new Map<AnatomyFamily, FamilyClaims>();
  // A terminal owner can be disposed before its framework descendants. Keep
  // only its logical boundary (not its claim/exposes) while live claims still
  // traverse it, so those descendants cannot briefly join an outer domain.
  const retiredBoundaries = new Map<AnatomyFamily, Set<AnatomyInstanceToken>>();
  const pruneRetiredBoundaries = (family: AnatomyFamily) => {
    const retired = retiredBoundaries.get(family);
    if (!retired) return;
    const needed = new Set<AnatomyInstanceToken>();
    for (const [instance, registration] of claimsByInstance) {
      const claim = registration.claims.get(family);
      if (!claim) continue;
      // Different renderer connections may carry independent logical trees.
      // A foreign disposer cannot interpret or retire this claim's ancestry.
      const getParent = claim.getParent;
      // No known logical bridge is uncertainty, not evidence that a retired
      // boundary is unused. Keep boundaries until this claim acquires caps.
      if (!getParent) return;
      let current = getParent(instance);
      const visited = new Set<AnatomyInstanceToken>();
      while (current && !visited.has(current)) {
        visited.add(current);
        if (retired.has(current)) needed.add(current);
        current = getParent(current);
      }
    }
    for (const instance of retired) if (!needed.has(instance)) retired.delete(instance);
    if (!retired.size) retiredBoundaries.delete(family);
  };

  const getClaim = (instance: AnatomyInstanceToken, family: AnatomyFamily) =>
    claimsByInstance.get(instance)?.claims.get(family) ?? null;

  return {
    setFamily(family: AnatomyFamily, def: NormalizedFamily) {
      families.set(family, def);
    },
    getFamily(family: AnatomyFamily) {
      return families.get(family) ?? null;
    },
    setClaim(record: ClaimRecord) {
      const retired = retiredBoundaries.get(record.family);
      retired?.delete(record.instance);
      if (retired?.size === 0) retiredBoundaries.delete(record.family);
      let registration = claimsByInstance.get(record.instance);
      if (!registration) {
        registration = { order: nextInstanceOrder++, claims: new Map() };
        claimsByInstance.set(record.instance, registration);
      }
      registration.claims.set(record.family, record);
      let claims: FamilyClaims = claimsByFamily.get(record.family) ?? [];
      if (claims.published) claims = claims.slice();
      // A later family claim inherits the instance's original fallback order.
      let index = claims.length;
      while (
        index > 0 &&
        claimsByInstance.get(claims[index - 1]!.instance)!.order > registration.order
      ) {
        index--;
      }
      claims.splice(index, 0, record);
      claimsByFamily.set(record.family, claims);
    },
    getClaim,
    isRetiredBoundary: (instance: AnatomyInstanceToken, family: AnatomyFamily) =>
      retiredBoundaries.get(family)?.has(instance) ?? false,
    pruneRetiredBoundaries,
    retireClaims(instance: AnatomyInstanceToken, families: readonly AnatomyFamily[]) {
      const registration = claimsByInstance.get(instance);
      if (!registration) return;
      for (const family of families) {
        const claim = registration.claims.get(family);
        if (!claim) continue;
        let retired = retiredBoundaries.get(family);
        if (!retired) retiredBoundaries.set(family, (retired = new Set()));
        retired.add(instance);
        registration.claims.delete(family);
        const membership = claimsByFamily.get(family)!.filter((member) => member !== claim);
        if (membership.length) claimsByFamily.set(family, membership);
        else claimsByFamily.delete(family);
      }
      if (registration.claims.size === 0) claimsByInstance.delete(instance);
      for (const family of families) pruneRetiredBoundaries(family);
    },
    listClaims(family: AnatomyFamily): readonly ClaimRecord[] {
      const claims = claimsByFamily.get(family);
      if (!claims) return [];
      // A host read can register a claim before this enumeration completes.
      claims.published = true;
      return claims;
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
  private static nextInstanceOrder = 0;
  private static readonly orderSubscribers = new Map<AnatomyFamily, AnatomyModuleImpl[]>();
  private static readonly targetSubscribers = new Map<AnatomyFamily, AnatomyModuleImpl[]>();
  private static readonly sharedOrderObservers = new Map<
    AnatomyFamily,
    Map<AnatomyInstanceToken, { off: Unsubscribe; listeners: Set<AnatomyModuleImpl> }>
  >();

  private readonly prototypeName: string;
  private readonly exposePort: ExposePort;
  private readonly instanceOrder = AnatomyModuleImpl.nextInstanceOrder++;
  private disposed = false;
  private claimFamilies = new Set<AnatomyFamily>();
  private orderDispatch: AnatomyOrderCallbackDispatcher = (fn) => fn(undefined);
  private orderListeners = new Map<AnatomyFamily, Map<AnatomyOrderChangeCb, string | undefined>>();
  private targetListeners = new Map<AnatomyFamily, Set<AnatomyOrderChangeCb>>();
  private observedOrderRoots = new Map<AnatomyFamily, AnatomyInstanceToken>();
  private orderVersionByFamily = new Map<AnatomyFamily, number>();
  private orderSignatures = new Map<AnatomyFamily, Map<string | undefined, OrderSignature>>();

  constructor(caps: CapsVaultView, prototypeName: string, exposePort: ExposePort) {
    super(caps);
    this.prototypeName = prototypeName;
    this.exposePort = exposePort;
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
      orderIdentity: getOrderIdentity(instance),
      family,
      role: decl.role,
      profile: decl.profile,
      prototype: this.getPrototypeGetter()(instance),
      exposePort: this.exposePort,
      exposesAvailable: () => {
        if (this.disposed) return false;
        const sys = this.sys;
        if (sys?.isDisposed()) return false;
        const phase = sys?.instancePhase?.() ?? this.instancePhase;
        return phase !== 'disposing' && phase !== 'disposed';
      },
      getRootTarget: this.getRootTargetGetter(),
      getParent: this.caps.has(ANATOMY_PARENT_CAP) ? this.getParentGetter() : null,
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
    const readOrderedRole = () => {
      const domain = this.resolveCurrentDomain(family, false);
      return domain.rootInstance ? this.sortClaims(domain.claims, role) : null;
    };
    let previousSignature = this.signatureOf(readOrderedRole());
    const unsubscribe = this.subscribeOrder(family, (ctx) => {
      const claims = readOrderedRole();
      const nextSignature = this.signatureOf(claims, previousSignature);
      if (nextSignature === previousSignature) return;
      previousSignature = nextSignature;
      cb(ctx, claims?.map((claim) => this.toPartView(claim)) ?? []);
    });
    return () => {
      this.ensureSetup('def.anatomy.subscribeParts.unsubscribe');
      unsubscribe();
    };
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
    return this.sortClaims(domain.claims, role).map((claim) => this.toPartView(claim));
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
    const claims = this.sortClaims(domain.claims, role);
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
    const claims = this.sortClaims(domain.claims, role);
    return this.adjacentPart(claims, self, -1);
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
    const claims = this.sortClaims(domain.claims, role);
    return this.adjacentPart(claims, self, 1);
  }

  descendantsOf(
    family: AnatomyFamily,
    ancestor: AnatomyPartView,
    role: string
  ): readonly AnatomyPartView[] {
    this.ensureRuntime('run.anatomy.descendantsOf');
    return this.port.descendantsOf(family, ancestor, role);
  }

  readonly port = {
    syncStructure: (): void => {
      for (const family of this.claimFamilies) {
        CENTER.pruneRetiredBoundaries(family);
        AnatomyModuleImpl.notifyStructuralChange(family);
        AnatomyModuleImpl.notifyTargetChange(family);
      }
    },
    getDiagnostics: (): readonly AnatomyDiagnostic[] => {
      const out: AnatomyDiagnostic[] = [];
      for (const family of this.claimFamilies) {
        out.push(...this.computeDiagnostics(family));
      }
      return out;
    },
    isCurrentPart: (family: AnatomyFamily, part: AnatomyPartView): boolean => {
      const claim = CLAIM_BY_PART_VIEW.get(part);
      if (!claim || claim.family !== family) return false;
      return this.findCurrentPartRoot(family, claim) !== null;
    },
    resolvePartTarget: (part: AnatomyPartView): unknown | null => {
      const claim = CLAIM_BY_PART_VIEW.get(part);
      return claim?.getRootTarget(claim.instance) ?? null;
    },
    resolvePartInstance: (part: AnatomyPartView): unknown | null =>
      CLAIM_BY_PART_VIEW.get(part)?.instance ?? null,
    resolveSelfInstance: (): unknown => this.getSelfToken(),
    resolveSelfRole: (family: AnatomyFamily): string | null =>
      this.caps.has(ANATOMY_INSTANCE_TOKEN_CAP)
        ? (CENTER.getClaim(this.getSelfToken(), family)?.role ?? null)
        : null,
    resolveAncestorInstance: (
      family: AnatomyFamily,
      part: AnatomyPartView,
      role: string
    ): unknown | null => {
      const claim = CLAIM_BY_PART_VIEW.get(part);
      if (!claim || claim.family !== family) return null;
      const root = this.findCurrentPartRoot(family, claim);
      if (!root) return null;
      const getParent = this.getParentGetter();
      let current = getParent(claim.instance);
      while (current) {
        const ancestor = CENTER.getClaim(current, family);
        if (ancestor?.role === role) return current;
        if (current === root) return null;
        current = getParent(current);
      }
      return null;
    },
    resolveDomainScope: (family: AnatomyFamily): unknown | null =>
      this.caps.has(ANATOMY_INSTANCE_TOKEN_CAP)
        ? this.findDomainRoot(this.getSelfToken(), family)
        : null,
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
      tryVersion: (family: AnatomyFamily) => this.tryOrderVersion(family),
      tryParts: (family: AnatomyFamily) => this.tryOrderedParts(family),
      tryPartsOf: (family: AnatomyFamily, role: string) => this.tryOrderedPartsOf(family, role),
      tryIndexOfSelf: (family: AnatomyFamily, role: string) => this.tryIndexOfSelf(family, role),
      tryPrevOfSelf: (family: AnatomyFamily, role: string) => this.tryPrevOfSelf(family, role),
      tryNextOfSelf: (family: AnatomyFamily, role: string) => this.tryNextOfSelf(family, role),
    },
    setOrderCallbackDispatcher: (dispatch: AnatomyOrderCallbackDispatcher) => {
      this.orderDispatch = dispatch;
    },
    subscribeOrder: (family: AnatomyFamily, cb: AnatomyOrderChangeCb, role?: string) =>
      this.subscribeOrder(family, cb, role),
    subscribeTargets: (family: AnatomyFamily, cb: AnatomyOrderChangeCb) =>
      this.subscribeTargets(family, cb),
  };

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    if (phase === 'mounted') {
      this.port.syncStructure();
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
    if (this.disposed) return;
    // A retained owner may temporarily lose its view capabilities. Keep its
    // last valid logical getter (not a cached parent result) through that gap;
    // replace it only when the new host supplies a valid bridge.
    if (this.caps.has(ANATOMY_INSTANCE_TOKEN_CAP) && this.caps.has(ANATOMY_PARENT_CAP)) {
      const instance = this.getSelfToken();
      const getParent = this.getParentGetter();
      for (const family of this.claimFamilies) {
        const claim = CENTER.getClaim(instance, family);
        if (claim) claim.getParent = getParent;
      }
    }
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
    for (const family of this.orderListeners.keys())
      this.removeSubscriber(AnatomyModuleImpl.orderSubscribers, family);
    for (const family of this.targetListeners.keys())
      this.removeSubscriber(AnatomyModuleImpl.targetSubscribers, family);
    for (const family of this.observedOrderRoots.keys()) {
      this.teardownOrderObserver(family);
    }
    this.observedOrderRoots.clear();
    this.orderListeners.clear();
    this.orderSignatures.clear();
    this.targetListeners.clear();
    if (this.claimFamilies.size === 0) return;
    if (!this.caps.has(ANATOMY_INSTANCE_TOKEN_CAP)) return;

    const instance = this.caps.get(ANATOMY_INSTANCE_TOKEN_CAP) as AnatomyInstanceToken;
    const families = [...this.claimFamilies];
    this.claimFamilies.clear();
    // Revoke every family before the first callback can inspect another one.
    // Descendant modules retain their own claims until their own terminal path.
    CENTER.retireClaims(instance, families);
    for (const family of families) AnatomyModuleImpl.notifyStructuralChange(family);
  }

  private getOrderedClaimsOf(family: AnatomyFamily, role: string): ClaimRecord[] {
    const domain = this.resolveCurrentDomain(family);
    return this.sortClaims(domain.claims, role);
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
    return this.adjacentPart(claims, self, -1);
  }

  private nextOfSelfInternal(family: AnatomyFamily, role: string): AnatomyPartView | null {
    const self = this.getSelfToken();
    const claims = this.getOrderedClaimsOf(family, role);
    return this.adjacentPart(claims, self, 1);
  }

  private adjacentPart(
    claims: readonly ClaimRecord[],
    self: AnatomyInstanceToken,
    step: -1 | 1
  ): AnatomyPartView | null {
    const index = claims.findIndex((claim) => claim.instance === self);
    if (index < 0) return null;
    const adjacent = claims[index + step];
    return adjacent ? this.toPartView(adjacent) : null;
  }

  private subscribeOrder(
    family: AnatomyFamily,
    cb: AnatomyOrderChangeCb,
    role?: string
  ): Unsubscribe {
    let listeners = this.orderListeners.get(family);
    if (!listeners) {
      listeners = new Map();
      this.orderListeners.set(family, listeners);
      this.addSubscriber(AnatomyModuleImpl.orderSubscribers, family);
    }
    if (!listeners.has(cb)) {
      listeners.set(cb, role);
      this.primeOrderSignature(family, role);
    }
    this.ensureOrderObserver(family);
    return () => {
      const current = this.orderListeners.get(family);
      if (!current?.has(cb)) return;
      const removedRole = current.get(cb);
      current.delete(cb);
      if (removedRole !== undefined && !Array.from(current.values()).includes(removedRole)) {
        const signatures = this.orderSignatures.get(family);
        signatures?.delete(removedRole);
        if (signatures?.size === 0) this.orderSignatures.delete(family);
      }
      if (current.size > 0) return;
      this.orderListeners.delete(family);
      this.removeSubscriber(AnatomyModuleImpl.orderSubscribers, family);
      this.teardownOrderObserver(family);
    };
  }

  private subscribeTargets(family: AnatomyFamily, cb: AnatomyOrderChangeCb): Unsubscribe {
    let set = this.targetListeners.get(family);
    if (!set) {
      set = new Set();
      this.targetListeners.set(family, set);
      this.addSubscriber(AnatomyModuleImpl.targetSubscribers, family);
    }
    set.add(cb);
    return () => {
      const current = this.targetListeners.get(family);
      current?.delete(cb);
      if (current?.size === 0) {
        this.targetListeners.delete(family);
        this.removeSubscriber(AnatomyModuleImpl.targetSubscribers, family);
      }
    };
  }

  // Family publication must not inspect every unrelated Runtime owner. Keep
  // only subscribed owners, ordered by creation rather than subscription time.
  // Resume by owner order if a callback moves or removes the current cursor.
  private static subscriberAfter(owners: readonly AnatomyModuleImpl[], order: number): number {
    let start = 0;
    let end = owners.length;
    while (start < end) {
      const middle = start + Math.floor((end - start) / 2);
      if (owners[middle]!.instanceOrder <= order) start = middle + 1;
      else end = middle;
    }
    return start;
  }

  private addSubscriber(
    index: Map<AnatomyFamily, AnatomyModuleImpl[]>,
    family: AnatomyFamily
  ): void {
    if (this.disposed) return;
    let owners = index.get(family);
    if (!owners) index.set(family, (owners = []));
    owners.splice(AnatomyModuleImpl.subscriberAfter(owners, this.instanceOrder), 0, this);
  }

  private removeSubscriber(
    index: Map<AnatomyFamily, AnatomyModuleImpl[]>,
    family: AnatomyFamily
  ): void {
    const owners = index.get(family);
    if (!owners) return;
    const position = AnatomyModuleImpl.subscriberAfter(owners, this.instanceOrder) - 1;
    if (owners[position] === this) owners.splice(position, 1);
    if (owners.length === 0) index.delete(family);
  }

  private static *subscribers(
    index: Map<AnatomyFamily, AnatomyModuleImpl[]>,
    family: AnatomyFamily
  ): Iterable<AnatomyModuleImpl> {
    let previous: AnatomyModuleImpl | undefined;
    let position = 0;
    let owners = index.get(family);
    while (owners) {
      if (previous && owners[position - 1] !== previous)
        position = this.subscriberAfter(owners, previous.instanceOrder);
      const next = owners[position];
      if (!next) return;
      previous = next;
      position++;
      yield next;
      // Subscriber mutations are in place until the list is emptied. A
      // callback can then create a new list for the same family.
      if (!owners.length) owners = index.get(family);
    }
  }

  private static createOrderNotificationReads(): OrderNotificationReads {
    const reads: OrderNotificationReads = {
      comparisons: new Map(),
      domains: new Map(),
      traces: new Map(),
      comparisonEpoch: 0,
      traceIndex: 0,
      compare: (left, right) =>
        AnatomyModuleImpl.compareClaims(left, right, reads, reads.activeTrace, reads.traceIndex++),
    };
    return reads;
  }

  private static notifyStructuralChange(family: AnatomyFamily): void {
    let diagnostic: MatrixNotificationDiagnostic | undefined;
    let ticket: unknown;
    try {
      const value = Object.getOwnPropertyDescriptor(
        globalThis,
        '__puiMatrixAnatomyNotificationDiagnostic'
      )?.value;
      if (
        value?.enabled === true &&
        typeof value.begin === 'function' &&
        typeof value.finish === 'function'
      ) {
        diagnostic = value;
        ticket = diagnostic!.begin(family, this.orderSubscribers.get(family)?.length ?? 0);
      }
    } catch {
      // Observation failure never changes the original notification.
    }
    let visited = 0;
    let completed = false;
    try {
      let reads: OrderNotificationReads | undefined;
      for (const impl of this.subscribers(this.orderSubscribers, family)) {
        visited++;
        reads ??= this.createOrderNotificationReads();
        impl.emitOrderChangeIfNeeded(family, reads);
      }
      completed = true;
    } finally {
      try {
        if (ticket !== undefined) diagnostic?.finish(ticket, visited, completed);
      } catch {
        // In particular, preserve an original throw of undefined during reentry.
      }
    }
  }

  private static notifyTargetChange(family: AnatomyFamily): void {
    for (const impl of this.subscribers(this.targetSubscribers, family)) {
      const listeners = impl.targetListeners.get(family);
      if (!listeners?.size) continue;
      impl.orderDispatch((ctx) => {
        for (const listener of listeners) listener(ctx);
      });
    }
  }

  private ensureOrderObserver(
    family: AnatomyFamily,
    currentRoot?: AnatomyInstanceToken,
    reads?: OrderNotificationReads
  ): void {
    if (this.disposed || this.mountPhase !== 'mounted' || !this.orderListeners.has(family)) return;
    const observedRoot = this.observedOrderRoots.get(family);
    if (currentRoot === undefined && observedRoot !== undefined) return;
    if (!this.caps.has(ANATOMY_ORDER_OBSERVER_CAP)) return;

    const rootInstance =
      currentRoot === undefined ? this.findDomainRoot(this.getSelfToken(), family) : currentRoot;
    if (observedRoot === rootInstance) return;
    if (observedRoot !== undefined) this.teardownOrderObserver(family, reads);
    if (!rootInstance) return;
    const target = CENTER.getClaim(rootInstance, family)?.getRootTarget(rootInstance);
    if (!target) return;

    let byRoot = AnatomyModuleImpl.sharedOrderObservers.get(family);
    if (!byRoot) {
      byRoot = new Map();
      AnatomyModuleImpl.sharedOrderObservers.set(family, byRoot);
    }

    let entry = byRoot.get(rootInstance);
    if (!entry) {
      const observer = this.caps.get(ANATOMY_ORDER_OBSERVER_CAP) as AnatomyOrderObserver;
      const listeners = new Set<AnatomyModuleImpl>();
      // Host registration can move a later recipient even without changing
      // the current recipient's signature.
      clearOrderNotificationReads(reads);
      const off = observer(target, () => {
        const reads = AnatomyModuleImpl.createOrderNotificationReads();
        for (const impl of listeners) {
          impl.emitOrderChangeIfNeeded(family, reads);
        }
      });
      entry = { off, listeners };
      byRoot.set(rootInstance, entry);
    }

    entry.listeners.add(this);
    this.observedOrderRoots.set(family, rootInstance);
  }

  private teardownOrderObserver(family: AnatomyFamily, reads?: OrderNotificationReads): void {
    const rootInstance = this.observedOrderRoots.get(family);
    if (!rootInstance) return;
    this.observedOrderRoots.delete(family);

    const byRoot = AnatomyModuleImpl.sharedOrderObservers.get(family);
    const entry = byRoot?.get(rootInstance);
    if (!entry) return;

    entry.listeners.delete(this);
    if (entry.listeners.size > 0) return;

    clearOrderNotificationReads(reads);
    entry.off();
    byRoot?.delete(rootInstance);
    if (byRoot && byRoot.size === 0) {
      AnatomyModuleImpl.sharedOrderObservers.delete(family);
    }
  }

  private primeOrderSignature(family: AnatomyFamily, role?: string): void {
    let signatures = this.orderSignatures.get(family);
    if (!signatures) this.orderSignatures.set(family, (signatures = new Map()));
    if (!signatures.has(role))
      signatures.set(
        role,
        this.computeOrderSignature(this.resolveCurrentDomain(family, false), undefined, role)
      );
  }

  private getOrderVersion(family: AnatomyFamily): number {
    this.primeOrderSignature(family);
    return this.orderVersionByFamily.get(family) ?? 0;
  }

  private emitOrderChangeIfNeeded(family: AnatomyFamily, reads?: OrderNotificationReads): void {
    const domain = this.resolveCurrentDomain(family, false, reads?.domains);
    const signatures = this.orderSignatures.get(family);
    let changed: Array<string | undefined> | undefined;
    let wholeSignature: OrderSignature | undefined;
    if (signatures) {
      for (const [role, previous] of signatures) {
        const next = this.computeOrderSignature(domain, reads, role, previous);
        if (next === previous) continue;
        if (role === undefined) wholeSignature = next;
        else signatures.set(role, next);
        (changed ??= []).push(role);
      }
    }
    // Follow the current host root before the next native order mutation.
    if ((this.observedOrderRoots.get(family) ?? null) !== domain.rootInstance)
      this.ensureOrderObserver(family, domain.rootInstance, reads);
    if (!changed) return;
    const changedScopes = changed;
    if (wholeSignature !== undefined) {
      signatures!.set(undefined, wholeSignature);
      this.orderVersionByFamily.set(family, (this.orderVersionByFamily.get(family) ?? 0) + 1);
    }

    const listeners = this.orderListeners.get(family);
    if (!listeners || listeners.size === 0) return;
    // Callback scopes may synchronously reparent, mount or retire claims and
    // move or replace host targets, including through a nested notification.
    // Later recipients must read the resulting structure and order afresh.
    clearOrderNotificationReads(reads);
    try {
      this.orderDispatch((ctx) => {
        for (const [listener, role] of listeners) {
          if (changedScopes.includes(role)) listener(ctx);
        }
      });
    } finally {
      clearOrderNotificationReads(reads);
    }
  }

  private computeOrderSignature(
    domain: CurrentDomain,
    reads?: OrderNotificationReads,
    role?: string,
    previous?: OrderSignature
  ): OrderSignature {
    if (!domain.rootInstance) return null;
    return this.signatureOf(this.sortClaims(domain.claims, role, reads), previous);
  }

  private signatureOf(claims: ClaimRecord[] | null, previous?: OrderSignature): OrderSignature {
    if (!claims) return null;
    if (
      previous?.length === claims.length * 2 &&
      claims.every(
        (claim, index) =>
          claim.role === previous[index * 2] &&
          Object.is(claim.orderIdentity, previous[index * 2 + 1])
      )
    )
      return previous;

    const next: OrderIdentity[] = [];
    for (const claim of claims) next.push(claim.role, claim.orderIdentity);
    return next;
  }

  private sortClaims(
    claims: ClaimRecord[],
    role?: string,
    reads?: OrderNotificationReads
  ): ClaimRecord[] {
    // The role filter already creates a private array. Equal or unavailable
    // targets still keep registration order.
    const ordered =
      role === undefined ? claims.slice() : claims.filter((claim) => claim.role === role);
    if (!reads) return ordered.sort(AnatomyModuleImpl.compareClaims);

    // Reuse the notification's comparator while binding each sort to its
    // own trace cursor. Scoped sorts have a different comparison path.
    let trace: OrderNotificationReads['activeTrace'];
    if (role === undefined) {
      trace = reads.traces.get(claims);
      if (!trace) reads.traces.set(claims, (trace = []));
    }
    const previousTrace = reads.activeTrace;
    const previousIndex = reads.traceIndex;
    reads.activeTrace = trace;
    reads.traceIndex = 0;
    try {
      return ordered.sort(reads.compare);
    } finally {
      if (trace) trace.length = reads.traceIndex;
      reads.activeTrace = previousTrace;
      reads.traceIndex = previousIndex;
    }
  }

  private static compareClaims(
    a: ClaimRecord,
    b: ClaimRecord,
    reads?: OrderNotificationReads,
    trace?: (OrderComparisonStep | undefined)[],
    index = 0
  ): number {
    const aTarget = a.getRootTarget(a.instance);
    const bTarget = b.getRootTarget(b.instance);
    if (!aTarget || !bTarget || aTarget === bTarget) return 0;
    const compare = aTarget.compareDocumentPosition;
    if (typeof compare !== 'function') return 0;

    // Array.sort still performs every comparison and reacquires both targets
    // and the current method each time. Only the pair-cache lookup is reused
    // when this comparison follows an already observed path in this delivery.
    const step = trace?.[index];
    if (
      step &&
      step.epoch === reads?.comparisonEpoch &&
      step.left === aTarget &&
      step.right === bTarget &&
      step.compare === compare
    )
      return step.result;

    const comparisons = reads?.comparisons;
    let entry = comparisons?.get(aTarget);
    if (entry?.compare !== compare) {
      // A different bridge may replace a comparator and later restore it.
      // Its former trace cannot outlive the pair cache's method invalidation.
      if (entry && reads) reads.comparisonEpoch++;
      entry = undefined;
    }
    let result = entry?.positions.get(bTarget);

    if (result === undefined) {
      const pos = compare.call(aTarget, bTarget);
      result = pos & ORDER_FOLLOWING ? -1 : pos & ORDER_PRECEDING ? 1 : 0;
      if (comparisons) {
        if (!entry) comparisons.set(aTarget, (entry = { compare, positions: new Map() }));
        entry.positions.set(bTarget, result);
      }
    }
    if (trace && reads)
      trace[index] = {
        left: aTarget,
        right: bTarget,
        compare,
        result,
        epoch: reads.comparisonEpoch,
      };
    return result;
  }

  private computeDiagnostics(family: AnatomyFamily): AnatomyDiagnostic[] {
    const familyDef = CENTER.getFamily(family);
    if (!familyDef) return [];

    const domain = this.resolveCurrentDomain(family, false);
    const claims = domain.claims;
    const diagnostics: AnatomyDiagnostic[] = [];
    const counts = new Map<string, number>();
    for (const claim of claims) counts.set(claim.role, (counts.get(claim.role) ?? 0) + 1);

    // Family errors and profile warnings share traversal, but retain their
    // distinct wording, codes and output shape. Profile requirements inherited
    // from the family have already been reported by the first pass.
    const collect = (
      definition: Pick<NormalizedFamily, 'roles' | 'relations'>,
      profileName?: string
    ) => {
      const scope = profileName ? 'profile' : 'family';
      const prefix = profileName ? 'ANATOMY_PROFILE_' : 'ANATOMY_FAMILY_';
      const push = (kind: string, role: string, message: string) => {
        diagnostics.push({
          level: profileName ? 'warning' : 'error',
          scope,
          code: prefix + kind,
          message,
          family,
          role,
          ...(profileName ? { profile: profileName } : {}),
        });
      };
      for (const [role, roleState] of Object.entries(definition.roles)) {
        const count = counts.get(role) ?? 0;
        if (count < roleState.cardinality.min) {
          push(
            'MIN',
            role,
            `[Anatomy] role '${role}' is below ${scope} min in '${family.debugName}${profileName ? '/' + profileName : ''}'`
          );
        }
        if (exceedsCardinalityMax(count, roleState.cardinality.max)) {
          push(
            'MAX',
            role,
            `[Anatomy] role '${role}' exceeds ${scope} max in '${family.debugName}${profileName ? '/' + profileName : ''}'`
          );
        }
      }
      for (const claim of claims) {
        const role = definition.roles[claim.role];
        const inherited = profileName
          ? new Set((familyDef.roles[claim.role]?.requires ?? []).map((it) => it.name))
          : null;
        for (const req of role?.requires ?? []) {
          if (inherited?.has(req.name)) continue;
          if (!getHookNames(claim.prototype).has(req.name)) {
            push(
              'HOOK_REQUIRED',
              claim.role,
              `[Anatomy] role '${claim.role}' ${profileName ? 'is missing profile' : 'requires'} hook '${req.name}'`
            );
          }
        }
      }
      const relations = profileName
        ? definition.relations.slice(familyDef.relations.length)
        : definition.relations;
      for (const relation of relations) {
        for (const claim of claims.filter((it) => it.role === relation.child)) {
          if (!this.hasAncestorRole(claim.instance, family, relation.parent, domain.rootInstance)) {
            push(
              'RELATION',
              relation.child,
              `[Anatomy] role '${relation.child}' ${profileName ? 'should' : 'must'} be contained by '${relation.parent}'`
            );
          }
        }
      }
    };

    collect(familyDef);
    const profileName = claims.find(
      (claim) => claim.role === 'root' && claim.instance === domain.rootInstance
    )?.profile;
    if (profileName) {
      const profile = familyDef.profiles[profileName];
      if (profile) collect(profile, profileName);
    }

    return diagnostics;
  }

  private resolveCurrentDomain(
    family: AnatomyFamily,
    strict = true,
    domains?: Map<AnatomyParentGetter, NotificationDomains>
  ): CurrentDomain {
    const instance = this.getSelfToken();
    const getParent = this.getParentGetter();
    let cached = domains?.get(getParent);
    if (domains && !cached) {
      cached = { rootsByInstance: new Map() };
      domains.set(getParent, cached);
    }
    const rootInstance = this.findDomainRoot(instance, family, getParent, cached?.rootsByInstance);
    if (!rootInstance) {
      if (!strict) return { rootInstance: null, claims: [] };
      throw anatomyError(
        ANATOMY_ERROR.CLAIM_INVALID,
        `[Anatomy] current instance is not part of a valid domain for '${family.debugName}'`
      );
    }

    if (cached) {
      let byRoot = cached.domainsByRoot;
      if (!byRoot) {
        byRoot = new Map();
        // This cache belongs to this family notification only. Preserve the
        // registration order inside each root, including stable host fallback.
        for (const claim of CENTER.listClaims(family)) {
          const root = this.findDomainRoot(
            claim.instance,
            family,
            getParent,
            cached.rootsByInstance
          );
          if (!root) continue;
          let members = byRoot.get(root);
          if (!members) byRoot.set(root, (members = { rootInstance: root, claims: [] }));
          members.claims.push(claim);
        }
        cached.domainsByRoot = byRoot;
      }
      return byRoot.get(rootInstance) ?? { rootInstance, claims: [] };
    }
    // Public queries must observe mutations immediately, even inside callbacks.
    return {
      rootInstance,
      claims: CENTER.listClaims(family).filter(
        (claim) => this.findDomainRoot(claim.instance, family, getParent) === rootInstance
      ),
    };
  }

  private findCurrentPartRoot(
    family: AnatomyFamily,
    claim: ClaimRecord
  ): AnatomyInstanceToken | null {
    const instance = this.getSelfToken();
    const getParent = this.getParentGetter();
    const root = this.findDomainRoot(instance, family, getParent);
    return root &&
      CENTER.getClaim(claim.instance, family) === claim &&
      this.findDomainRoot(claim.instance, family, getParent) === root
      ? root
      : null;
  }

  private findDomainRoot(
    instance: AnatomyInstanceToken,
    family: AnatomyFamily,
    getParent = this.getParentGetter(),
    roots?: Map<AnatomyInstanceToken, AnatomyInstanceToken | null>
  ): AnatomyInstanceToken | null {
    const cached = roots?.get(instance);
    if (cached !== undefined) return cached;
    const visited: AnatomyInstanceToken[] | undefined = roots ? [] : undefined;
    let root: AnatomyInstanceToken | null = null;
    let cur: AnatomyInstanceToken | null = instance;
    while (cur) {
      visited?.push(cur);
      const claim = CENTER.getClaim(cur, family);
      if (claim?.role === 'root') {
        root = cur;
        break;
      }
      // A live claim and a retired boundary cannot coexist for this family.
      if (!claim && CENTER.isRetiredBoundary(cur, family)) break;
      cur = getParent(cur);
      const parentRoot = roots?.get(cur);
      if (parentRoot !== undefined) {
        root = parentRoot;
        break;
      }
    }
    if (roots && visited) {
      for (const token of visited) roots.set(token, root);
    }
    return root;
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
    const exposesAvailable = () =>
      CENTER.getClaim(claim.instance, claim.family) === claim && claim.exposesAvailable();
    const part: AnatomyPartView = {
      role: claim.role,
      hasExpose: (key: string) => exposesAvailable() && claim.exposePort.has(key),
      getExpose: (key: string) => {
        if (!exposesAvailable() || !claim.exposePort.has(key)) return null;
        const exposed = claim.exposePort.get(key) ?? null;
        if (typeof exposed !== 'function') return exposed;
        return (...args: unknown[]) => {
          let result: unknown;
          let failed = false;
          let thrown: unknown;
          claim.invoke(() => {
            try {
              result = exposed(...args);
            } catch (error) {
              failed = true;
              thrown = error;
            }
          });
          if (failed) throw thrown;
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
