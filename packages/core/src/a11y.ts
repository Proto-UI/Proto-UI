import type { State } from './state';

declare const A11Y_SEMANTIC_OBJECT_REF: unique symbol;

export type A11ySemanticObjectRef = {
  readonly [A11Y_SEMANTIC_OBJECT_REF]: true;
};

const semanticObjectRefs = new WeakSet<object>();

export function createA11ySemanticObjectRef(): A11ySemanticObjectRef {
  const value = Object.freeze({});
  // This factory is the only constructor for the otherwise unforgeable type-only brand.
  const ref = value as unknown as A11ySemanticObjectRef;
  semanticObjectRefs.add(ref);
  return ref;
}

export function isA11ySemanticObjectRef(value: unknown): value is A11ySemanticObjectRef {
  return typeof value === 'object' && value !== null && semanticObjectRefs.has(value);
}

export type A11yRole = string;
export type A11yRoleTarget = A11yRole | State<A11yRole>;

export type A11yTextTarget = string | State<string | null | undefined>;
export type A11yTextAlternative = { kind: 'content' } | { kind: 'text'; value: A11yTextTarget };

export type A11yStateKey = string;
export type A11yActionKey = string;
export type A11yRelationKey = string;

export type A11yStateBinding<V = unknown> = {
  key: A11yStateKey;
  state: State<V>;
};

export type A11yActionSpec = {
  event?: string;
};

export type A11yRelationTarget =
  | string
  | State<string | null | undefined>
  | A11ySemanticObjectRef
  | readonly A11ySemanticObjectRef[];
export type A11yRelationSnapshotTarget =
  | string
  | null
  | undefined
  | readonly A11ySemanticObjectRef[];
export type A11yIdentityTarget = string | State<string | null | undefined>;
export type A11yRelationMode = 'replace' | 'append';

export type A11yRelationSpec = {
  target: A11yRelationTarget;
  mode?: A11yRelationMode;
};

// C-A11Y-0001-L — tree behavior may follow governed state; snapshots resolve it to booleans.
export type A11yTreeBehavior = {
  hidden?: boolean | State<boolean>;
  mergeChildren?: boolean | State<boolean>;
};

export type A11yTreeSnapshot = {
  hidden?: boolean;
  mergeChildren?: boolean;
};

export type A11ySemanticObjectSnapshot = {
  objectRef: A11ySemanticObjectRef;
  id?: string | null;
  role?: A11yRole;
  name?: A11yTextAlternative;
  description?: A11yTextAlternative;
  states: Record<A11yStateKey, unknown>;
  actions: Record<A11yActionKey, A11yActionSpec>;
  relations: Record<A11yRelationKey, A11yRelationSnapshotTarget>;
  relationModes?: Record<A11yRelationKey, A11yRelationMode>;
  tree?: A11yTreeSnapshot;
};

export type A11yDefAPI = {
  id(target: A11yIdentityTarget): void;
  role(role: A11yRoleTarget): void;
  name(value: A11yTextTarget): void;
  nameFromContent(): void;
  description(value: A11yTextTarget): void;
  state<V>(key: A11yStateKey, handle: State<V>): void;
  action(key: A11yActionKey, spec?: A11yActionSpec): void;
  relation(key: A11yRelationKey, spec: A11yRelationSpec): void;
  tree(patch: A11yTreeBehavior): void;
};
