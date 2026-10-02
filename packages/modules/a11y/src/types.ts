import type {
  A11yActionKey,
  A11yActionSpec,
  AccessibleHandle,
  A11yIdentityTarget,
  A11yPartDeclaration,
  AnatomyFamily,
  A11yRelationKey,
  A11yRelationSpec,
  A11yRole,
  A11yRoleTarget,
  A11ySemanticObjectRef,
  A11ySemanticObjectSnapshot,
  A11yStateKey,
  A11yTextAlternative,
  A11yTreeBehavior,
  ModuleInstance,
  ModulePort,
  State,
} from '@proto.ui/core';
import type { A11yPartDiagnostic } from './part-relationships';

export type A11yFacade = AccessibleHandle;

export type A11yStateBinding = {
  key: A11yStateKey;
  handle: State<unknown>;
};

export type A11yRelationBinding = {
  key: A11yRelationKey;
  spec: A11yRelationSpec;
};

export type A11ySemanticObjectIR = {
  parts: Map<AnatomyFamily, A11yPartDeclaration>;
  id?: A11yIdentityTarget;
  role?: A11yRoleTarget;
  name?: A11yTextAlternative;
  description?: A11yTextAlternative;
  states: Map<A11yStateKey, A11yStateBinding>;
  actions: Map<A11yActionKey, A11yActionSpec>;
  relations: Map<A11yRelationKey, A11yRelationBinding>;
  tree?: A11yTreeBehavior;
  level?: number | State<number>;
};

export type A11yPort = ModulePort & {
  getObjectRef(): A11ySemanticObjectRef;
  getSnapshot(): A11ySemanticObjectSnapshot;
  getIR(): A11ySemanticObjectIR;
  getPartDiagnostics(): readonly A11yPartDiagnostic[];
  /** Withdraw view leases before a host consumes the corresponding ViewIntent. */
  prepareViewPresence(present: boolean): void;
  setRelation(key: A11yRelationKey, spec: A11yRelationSpec): void;
  removeRelation(key: A11yRelationKey): void;
};

export type A11yModule = ModuleInstance<A11yFacade> & {
  name: 'a11y';
  scope: 'instance';
  port: A11yPort;
};
