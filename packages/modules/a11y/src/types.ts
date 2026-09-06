import type {
  A11yActionKey,
  A11yActionSpec,
  A11yDefAPI,
  A11yIdentityTarget,
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

export type A11yFacade = A11yDefAPI;

export type A11yStateBinding = {
  key: A11yStateKey;
  handle: State<unknown>;
};

export type A11yRelationBinding = {
  key: A11yRelationKey;
  spec: A11yRelationSpec;
};

export type A11ySemanticObjectIR = {
  id?: A11yIdentityTarget;
  role?: A11yRoleTarget;
  name?: A11yTextAlternative;
  description?: A11yTextAlternative;
  states: Map<A11yStateKey, A11yStateBinding>;
  actions: Map<A11yActionKey, A11yActionSpec>;
  relations: Map<A11yRelationKey, A11yRelationBinding>;
  tree?: A11yTreeBehavior;
};

export type A11yPort = ModulePort & {
  getObjectRef(): A11ySemanticObjectRef;
  getSnapshot(): A11ySemanticObjectSnapshot;
  getIR(): A11ySemanticObjectIR;
  setRelation(key: A11yRelationKey, spec: A11yRelationSpec): void;
  removeRelation(key: A11yRelationKey): void;
};

export type A11yModule = ModuleInstance<A11yFacade> & {
  name: 'a11y';
  scope: 'instance';
  port: A11yPort;
};
