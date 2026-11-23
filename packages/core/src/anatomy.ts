export type AnatomyFamily = {
  readonly __brand: 'AnatomyFamily';
  readonly debugName: string;
  readonly decl: AnatomyFamilyDecl;
};

export type AnatomyCardinality = {
  min: number;
  max: number | '*';
};

export type AnatomyRequirement = {
  kind: 'hook';
  name: string;
};

export type AnatomyRelation = {
  kind: 'contains';
  parent: string;
  child: string;
};

export type AnatomyRoleDecl = {
  cardinality: AnatomyCardinality;
  requires?: readonly AnatomyRequirement[];
};

export type AnatomyProfileRoleDecl = {
  cardinality?: Partial<AnatomyCardinality>;
  requires?: readonly AnatomyRequirement[];
};

export type AnatomyProfileDecl = {
  roles?: Record<string, AnatomyProfileRoleDecl>;
  relations?: readonly AnatomyRelation[];
};

export type AnatomyFamilyDecl = {
  roles: Record<string, AnatomyRoleDecl>;
  relations?: readonly AnatomyRelation[];
  profiles?: Record<string, AnatomyProfileDecl>;
};

export type AnatomyClaimDecl = {
  role: string;
  profile?: string;
};

export type AnatomyPartView = {
  readonly role: string;
  /** Retired declarations or unavailable target exposes are absent, not revived. */
  hasExpose(key: string): boolean;
  /** Re-reads the target entry; previously returned methods keep their own lifecycle guards. */
  getExpose(key: string): unknown | null;
  hasHook(name: string): boolean;
};

export type AnatomyQueryOptions = {
  missing?: 'throw' | 'null' | 'empty';
};

export type AnatomyOrderView = {
  version(family: AnatomyFamily): number;
  parts(family: AnatomyFamily): readonly AnatomyPartView[];
  partsOf(family: AnatomyFamily, role: string): readonly AnatomyPartView[];
  indexOfSelf(family: AnatomyFamily, role: string): number;
  prevOfSelf(family: AnatomyFamily, role: string): AnatomyPartView | null;
  nextOfSelf(family: AnatomyFamily, role: string): AnatomyPartView | null;
};

export type AnatomyQueryOrderView = {
  version(family: AnatomyFamily): number;
  version(family: AnatomyFamily, options: { missing: 'null' }): number | null;
  parts(family: AnatomyFamily): readonly AnatomyPartView[];
  parts(family: AnatomyFamily, options: { missing: 'null' }): readonly AnatomyPartView[] | null;
  parts(family: AnatomyFamily, options: { missing: 'empty' }): readonly AnatomyPartView[];
  partsOf(family: AnatomyFamily, role: string): readonly AnatomyPartView[];
  partsOf(
    family: AnatomyFamily,
    role: string,
    options: { missing: 'null' }
  ): readonly AnatomyPartView[] | null;
  partsOf(
    family: AnatomyFamily,
    role: string,
    options: { missing: 'empty' }
  ): readonly AnatomyPartView[];
  indexOfSelf(family: AnatomyFamily, role: string): number;
  indexOfSelf(family: AnatomyFamily, role: string, options: { missing: 'null' }): number | null;
  prevOfSelf(family: AnatomyFamily, role: string): AnatomyPartView | null;
  prevOfSelf(
    family: AnatomyFamily,
    role: string,
    options: { missing: 'null' }
  ): AnatomyPartView | null;
  nextOfSelf(family: AnatomyFamily, role: string): AnatomyPartView | null;
  nextOfSelf(
    family: AnatomyFamily,
    role: string,
    options: { missing: 'null' }
  ): AnatomyPartView | null;
};

function freezeFamilyDecl(decl: AnatomyFamilyDecl): AnatomyFamilyDecl {
  if (!decl || typeof decl !== 'object') {
    throw new Error(`[Anatomy] family declaration is required.`);
  }
  if (!decl.roles || typeof decl.roles !== 'object') {
    throw new Error(`[Anatomy] family declaration must define roles.`);
  }
  if (!decl.roles.root) {
    throw new Error(`[Anatomy] family declaration must define a root role.`);
  }

  const roles = Object.freeze(
    Object.fromEntries(
      Object.entries(decl.roles ?? {}).map(([role, roleDecl]) => [
        role,
        Object.freeze({
          ...roleDecl,
          cardinality: Object.freeze({ ...roleDecl.cardinality }),
          requires: roleDecl.requires ? Object.freeze([...roleDecl.requires]) : undefined,
        }),
      ])
    )
  );

  const profiles = decl.profiles
    ? Object.freeze(
        Object.fromEntries(
          Object.entries(decl.profiles).map(([name, profileDecl]) => [
            name,
            Object.freeze({
              ...profileDecl,
              roles: profileDecl.roles
                ? Object.freeze(
                    Object.fromEntries(
                      Object.entries(profileDecl.roles).map(([role, roleDecl]) => [
                        role,
                        Object.freeze({
                          ...roleDecl,
                          cardinality: roleDecl.cardinality
                            ? Object.freeze({ ...roleDecl.cardinality })
                            : undefined,
                          requires: roleDecl.requires
                            ? Object.freeze([...roleDecl.requires])
                            : undefined,
                        }),
                      ])
                    )
                  )
                : undefined,
              relations: profileDecl.relations
                ? Object.freeze([...profileDecl.relations])
                : undefined,
            }),
          ])
        )
      )
    : undefined;

  return Object.freeze({
    roles,
    relations: decl.relations ? Object.freeze([...decl.relations]) : undefined,
    profiles,
  });
}

export function createAnatomyFamily(debugName: string, decl: AnatomyFamilyDecl): AnatomyFamily {
  if (typeof debugName !== 'string' || debugName.length === 0) {
    throw new Error(`[Anatomy] debugName must be a non-empty string.`);
  }

  return Object.freeze({
    __brand: 'AnatomyFamily' as const,
    debugName,
    decl: freezeFamilyDecl(decl),
  });
}
