import type {
  A11yPartRelationshipSnapshot,
  A11ySemanticObjectRef,
  AnatomyFamily,
} from '@proto.ui/core';

export type A11yPartRegistration = {
  family: AnatomyFamily;
  scope: unknown;
  role: string | null;
  key: string | null;
};

export type A11yPartRelationship = A11yPartRegistration & {
  relation: string;
  targetRole: string;
};

export type A11yPartOwnerSnapshot = {
  epoch: number;
  available: boolean;
  parts: readonly A11yPartRegistration[];
  relationships: readonly A11yPartRelationship[];
};

export type A11yPartDiagnostic = {
  relation: string;
  code: 'missing-source' | 'missing-key' | 'missing-target' | 'ambiguous-target';
};

type Resolution = {
  relationships: readonly A11yPartRelationshipSnapshot[];
  diagnostics: readonly A11yPartDiagnostic[];
};

type Owner = {
  ref: A11ySemanticObjectRef;
  input: A11yPartOwnerSnapshot;
  resolution: Resolution;
  notify: () => void;
};

export type A11yPartOwner = {
  update(snapshot: A11yPartOwnerSnapshot): void;
  getRelationships(): readonly A11yPartRelationshipSnapshot[];
  getDiagnostics(): readonly A11yPartDiagnostic[];
  dispose(): void;
};

const EMPTY_INPUT: A11yPartOwnerSnapshot = {
  epoch: 0,
  available: false,
  parts: [],
  relationships: [],
};
const EMPTY_RESOLUTION: Resolution = { relationships: [], diagnostics: [] };

function sameFields<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[];
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

function sameList<T extends object>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((entry, index) => sameFields(entry, b[index]!));
}

/** Instance-owned records. Anatomy supplies facts but never owns this relationship table. */
export function createA11yPartRelationshipRegistry() {
  const owners = new Map<A11ySemanticObjectRef, Owner>();
  let publishing = false;
  let changed = false;

  const resolve = (owner: Owner): Resolution => {
    const diagnostics: A11yPartDiagnostic[] = [];
    const relationships = owner.input.relationships.map((declaration) => {
      const { family, scope, role, key, relation, targetRole } = declaration;
      const matches: Owner[] = [];
      if (scope !== null && scope !== undefined && role && key !== null && key !== '') {
        for (const target of owners.values()) {
          for (const part of target.input.parts) {
            if (
              part.family === family &&
              part.scope === scope &&
              part.role === targetRole &&
              part.key === key
            )
              matches.push(target);
          }
        }
      }
      if (scope === null || scope === undefined || !role) {
        diagnostics.push({ relation, code: 'missing-source' });
      } else if (key === null || key === '') {
        diagnostics.push({ relation, code: 'missing-key' });
      } else if (matches.length !== 1) {
        diagnostics.push({
          relation,
          code: matches.length ? 'ambiguous-target' : 'missing-target',
        });
      }
      const target = matches.length === 1 ? matches[0]! : null;
      return Object.freeze({
        family,
        scope,
        source: owner.ref,
        sourceRole: role,
        targetRole,
        relation,
        key,
        sourceEpoch: owner.input.epoch,
        targetEpoch: target?.input.epoch ?? null,
        target: owner.input.available && target?.input.available ? target.ref : null,
      });
    });
    return {
      relationships: Object.freeze(relationships),
      diagnostics: Object.freeze(diagnostics.map((diagnostic) => Object.freeze(diagnostic))),
    };
  };

  const publish = () => {
    changed = true;
    if (publishing) return;
    publishing = true;
    const pending = new Set<Owner>();
    try {
      while (changed) {
        changed = false;
        // Publish every new resolution before invoking a projection callback.
        for (const owner of owners.values()) {
          const next = resolve(owner);
          if (
            sameList(next.relationships, owner.resolution.relationships) &&
            sameList(next.diagnostics, owner.resolution.diagnostics)
          )
            continue;
          owner.resolution = next;
          pending.add(owner);
        }
        for (const owner of pending) {
          pending.delete(owner);
          if (owners.get(owner.ref) === owner) owner.notify();
          if (changed) break;
        }
      }
    } finally {
      publishing = false;
    }
  };

  return {
    createOwner(ref: A11ySemanticObjectRef, notify: () => void): A11yPartOwner {
      const owner: Owner = {
        ref,
        notify,
        input: EMPTY_INPUT,
        resolution: EMPTY_RESOLUTION,
      };
      owners.set(ref, owner);
      return {
        update(snapshot) {
          if (owners.get(ref) !== owner) return;
          const previous = owner.input;
          if (snapshot.epoch < previous.epoch) return;
          if (
            previous.epoch === snapshot.epoch &&
            previous.available === snapshot.available &&
            sameList(previous.parts, snapshot.parts) &&
            sameList(previous.relationships, snapshot.relationships)
          )
            return;
          // Replacing the complete record atomically removes the old tuple and
          // installs the new one; observers cannot see membership in both.
          owner.input = {
            epoch: snapshot.epoch,
            available: snapshot.available,
            parts: snapshot.parts.map((part) => ({ ...part })),
            relationships: snapshot.relationships.map((relation) => ({ ...relation })),
          };
          publish();
        },
        getRelationships: () => owner.resolution.relationships,
        getDiagnostics: () => owner.resolution.diagnostics,
        dispose() {
          if (owners.get(ref) !== owner) return;
          owners.delete(ref);
          owner.input = EMPTY_INPUT;
          owner.resolution = EMPTY_RESOLUTION;
          publish();
        },
      };
    },
  };
}

export const A11Y_PART_RELATIONSHIPS = createA11yPartRelationshipRegistry();
