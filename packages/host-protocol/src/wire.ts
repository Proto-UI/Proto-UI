/**
 * Version 0 wire vocabulary for the GPUI host protocol fixture.
 *
 * Every value that crosses the boundary is bounded data. No JavaScript
 * function, live Prototype, EventTarget, HTMLElement, arbitrary object
 * identity, GPUI Entity, AnyElement, or Rust closure is representable here.
 */

export const HOST_PROTOCOL_VERSION = 0 as const;

export type WireScalar = string | number | boolean | null;
export type WireValue = WireScalar | readonly WireValue[] | { readonly [key: string]: WireValue };

export type SessionId = string;
export type InstanceId = string;
export type ViewEpoch = number;
export type CommitId = number;
export type LeaseId = string;
export type SampleId = string;
export type SlotRef = string;
export type SemanticObjectId = string;
export type FocusTargetRef = string;

export type EventScope = 'root' | 'global';

export type EventRegistration = {
  readonly leaseId: LeaseId;
  readonly scope: EventScope;
  readonly type: string;
};

/** The trigger group an instance belongs to. */
export type TriggerPlan = {
  /**
   * The session of the group's outermost trigger, which identifies the
   * group. A lone trigger anchors its own group.
   */
  readonly anchor: SessionId;
};

export type EventBindingPlan = {
  readonly registrations: readonly EventRegistration[];
  /** Present when the instance is a trigger. */
  readonly trigger?: TriggerPlan;
};

export type FocusTargetPlan = {
  readonly ref: FocusTargetRef;
  /** Participates in host sequential (Tab) navigation. */
  readonly sequential: boolean;
  /** May receive programmatic focus even when not sequential. */
  readonly programmatic: boolean;
};

export type FocusPlan = {
  readonly targets: readonly FocusTargetPlan[];
};

export type SlotPlan = {
  readonly slots: readonly SlotRef[];
};

export type A11yNameWire =
  | { readonly kind: 'content' }
  | { readonly kind: 'text'; readonly value: string };

export type A11ySnapshotWire = {
  readonly semanticObjectId: SemanticObjectId;
  /**
   * The id the Prototype gives the object, which another object's relation
   * can name as its target. Absent when the Prototype gives none.
   */
  readonly id?: string;
  readonly role?: string;
  readonly name?: A11yNameWire;
  readonly states: { readonly [key: string]: WireValue };
  readonly actions: { readonly [key: string]: { readonly event?: string } };
  readonly relations: { readonly [key: string]: string | null | readonly SemanticObjectId[] };
  readonly level?: number;
};

export type ProjectionTransaction = {
  readonly protocolVersion: number;
  readonly sessionId: SessionId;
  readonly instanceId: InstanceId;
  readonly viewEpoch: ViewEpoch;
  readonly commitId: CommitId;
  readonly template: WireValue;
  readonly slots: SlotPlan;
  readonly events: EventBindingPlan;
  readonly focus: FocusPlan;
  /**
   * The instance root's feedback style: the merged token list the Prototype
   * applies now, which may be empty. Every view carries it whole, so a view
   * that replaces another shows its own style from its first frame.
   */
  readonly style: readonly string[];
  readonly a11y: A11ySnapshotWire | null;
};

export type ProjectionAckStatus = 'applied' | 'superseded' | 'unsupported' | 'failed';

export type HostDiagnostic = {
  readonly code: string;
  readonly message: string;
  readonly data?: WireValue;
};

export type ProjectionAck = {
  readonly sessionId: SessionId;
  readonly viewEpoch: ViewEpoch;
  readonly commitId: CommitId;
  readonly status: ProjectionAckStatus;
  readonly readySurfaces: readonly string[];
  readonly diagnostics: readonly HostDiagnostic[];
};

export type InputSample = {
  readonly sampleId: SampleId;
  readonly viewEpoch: ViewEpoch;
  readonly type: string;
  readonly leaseIds: readonly LeaseId[];
  readonly key?: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  readonly shiftKey?: boolean;
  readonly repeat?: boolean;
};

export type DefaultActionRequest = {
  readonly sessionId: SessionId;
  readonly sampleId: SampleId;
  readonly reason?: string;
  readonly source?: string;
};

export class WireBoundaryError extends Error {
  readonly path: string;

  constructor(path: string, reason: string) {
    super(`[host-protocol] ${path || '<root>'}: ${reason}`);
    this.name = 'WireBoundaryError';
    this.path = path;
  }
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Rejects every value the boundary forbids. Returns the input unchanged so
 * callers can assert at the point where a message is produced.
 */
export function assertWireValue<T>(value: T, path = ''): T {
  const seen = new Set<object>();

  const visit = (current: unknown, currentPath: string): void => {
    switch (typeof current) {
      case 'string':
      case 'boolean':
        return;
      case 'number':
        if (!Number.isFinite(current)) {
          throw new WireBoundaryError(currentPath, 'non-finite numbers cannot cross the boundary');
        }
        return;
      case 'undefined':
        throw new WireBoundaryError(currentPath, 'undefined cannot cross the boundary');
      case 'function':
        throw new WireBoundaryError(currentPath, 'functions cannot cross the boundary');
      case 'symbol':
        throw new WireBoundaryError(currentPath, 'symbols cannot cross the boundary');
      case 'bigint':
        throw new WireBoundaryError(currentPath, 'bigint cannot cross the boundary');
      case 'object':
        break;
      default:
        throw new WireBoundaryError(currentPath, `unsupported value type ${typeof current}`);
    }

    if (current === null) return;
    const object = current as object;
    if (seen.has(object)) {
      throw new WireBoundaryError(currentPath, 'cyclic structures cannot cross the boundary');
    }
    seen.add(object);

    if (Array.isArray(object)) {
      // Index-based iteration on purpose: forEach skips sparse holes, which
      // would let a hole reach a consumer that iterates with for...of and
      // dereferences undefined. JSON has no hole, so a hole is never a
      // faithful wire value.
      for (let index = 0; index < object.length; index += 1) {
        const entryPath = `${currentPath}[${index}]`;
        if (!Object.prototype.hasOwnProperty.call(object, index)) {
          throw new WireBoundaryError(entryPath, 'sparse array holes cannot cross the boundary');
        }
        visit(object[index], entryPath);
      }
    } else {
      if (!isPlainObject(object)) {
        throw new WireBoundaryError(
          currentPath,
          'only plain records cross the boundary; object identity is not transferable'
        );
      }
      if (Object.getOwnPropertySymbols(object).length > 0) {
        throw new WireBoundaryError(currentPath, 'symbol keys cannot cross the boundary');
      }
      for (const [key, entry] of Object.entries(object)) {
        visit(entry, currentPath ? `${currentPath}.${key}` : key);
      }
    }

    seen.delete(object);
  };

  visit(value, path);
  return value;
}
