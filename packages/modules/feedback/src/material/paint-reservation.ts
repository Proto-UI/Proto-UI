import {
  cap,
  type MaterialPaintReservation,
  type MaterialPaintReservationDeclaration,
} from '@proto.ui/core';
import type { AnatomyPort } from '@proto.ui/module-anatomy';

/** A transport capability, not an optical support claim. */
export const MATERIAL_PAINT_RESERVATION_CAP = cap<true>(
  '@proto.ui/feedback/material-paint-reservation-draft'
);

export type MaterialPaintReservationPart = {
  /** Host-private physical identity, used only to retain an unchanged ref. */
  readonly identity?: object;
  /** Host ingress. The target is resolved from the current Anatomy domain. */
  connect(
    target: unknown,
    generation: object,
    current: () => boolean,
    inlineSizeFrom: unknown | null,
    outlineFrom: unknown | null
  ): () => void;
};

type Entry = {
  declaration: MaterialPaintReservationDeclaration;
  owner: MaterialPaintReservationRegistry;
  serial: number;
  boundSerial: number;
  binding: MaterialPaintReservationPart | null;
  target: unknown;
  inlineSizeFrom: unknown | null;
  outlineFrom: unknown | null;
  generation: object | null;
  disconnect: (() => void) | null;
  subscriptions: (() => void)[];
};
const entries = new WeakMap<MaterialPaintReservation, Entry>();

/**
 * Framework/host bridge. Capturing a future ref does not revoke the current
 * view. A stale ref attach or detach cannot supersede its later committed ref.
 */
export function prepareMaterialPaintReservationPart(target: MaterialPaintReservation) {
  const entry = entries.get(target);
  if (!entry || entry.owner.disposed)
    throw new Error('[feedback.material] unknown or disposed paint reservation');
  const serial = ++entry.serial;
  return (part: MaterialPaintReservationPart): (() => void) => {
    if (entry.owner.disposed || serial < entry.boundSerial) return () => {};
    const retained =
      part.identity && entry.binding?.identity === part.identity ? entry.binding : null;
    if (retained) {
      entry.boundSerial = serial;
      return () => {
        if (entry.boundSerial !== serial || entry.binding !== retained) return;
        const release = entry.disconnect;
        entry.disconnect = null;
        entry.binding = null;
        entry.target = null;
        entry.inlineSizeFrom = null;
        entry.outlineFrom = null;
        entry.generation = null;
        release?.();
      };
    }
    const previous = entry.disconnect;
    entry.disconnect = null;
    entry.binding = part;
    entry.target = null;
    entry.inlineSizeFrom = null;
    entry.outlineFrom = null;
    entry.generation = null;
    entry.boundSerial = serial;
    previous?.();
    // Cleanup can reenter and bind a successor. Do not publish this old ref.
    if (entry.boundSerial === serial && entry.binding === part) entry.owner.refreshEntry(entry);
    return () => {
      if (entry.boundSerial !== serial || entry.binding !== part) return;
      const release = entry.disconnect;
      entry.disconnect = null;
      entry.binding = null;
      entry.target = null;
      entry.inlineSizeFrom = null;
      entry.outlineFrom = null;
      entry.generation = null;
      release?.();
    };
  };
}

/** Instance-local declarations; no name, DOM ancestry or global family lookup. */
export class MaterialPaintReservationRegistry {
  private declarations = new Map<MaterialPaintReservation, Entry>();
  private active = false;
  private transition = 0;
  disposed = false;
  constructor(private readonly anatomy: () => AnatomyPort | null) {}

  get hasDeclarations() {
    return this.declarations.size !== 0;
  }

  declare(value: MaterialPaintReservationDeclaration): MaterialPaintReservation {
    if (this.disposed) throw new Error('[feedback.material] paint reservation owner disposed');
    const descriptors = value && Object.getOwnPropertyDescriptors(value);
    if (
      !descriptors ||
      Reflect.ownKeys(descriptors).some(
        (key) => !['family', 'targetRole', 'inlineSizeFrom', 'outlineFrom'].includes(key as string)
      ) ||
      !descriptors.family ||
      !('value' in descriptors.family) ||
      !descriptors.targetRole ||
      !('value' in descriptors.targetRole)
    )
      throw new Error('[feedback.material] invalid paint reservation declaration');
    const family = descriptors.family.value;
    const targetRole = descriptors.targetRole.value;
    if (
      family?.__brand !== 'AnatomyFamily' ||
      typeof targetRole !== 'string' ||
      !Object.hasOwn(family.decl.roles, targetRole)
    )
      throw new Error('[feedback.material] paint reservation requires a declared Anatomy role');
    const reference = (key: 'inlineSizeFrom' | 'outlineFrom') => {
      const descriptor = descriptors[key];
      if (!descriptor) return undefined;
      if (!('value' in descriptor)) throw new Error('[feedback.material] invalid layout reference');
      const fields = descriptor.value && Object.getOwnPropertyDescriptors(descriptor.value);
      if (
        !fields ||
        Reflect.ownKeys(fields).some((key) => key !== 'family' && key !== 'role') ||
        !fields.family ||
        !('value' in fields.family) ||
        !fields.role ||
        !('value' in fields.role) ||
        fields.family.value?.__brand !== 'AnatomyFamily' ||
        typeof fields.role.value !== 'string' ||
        !Object.hasOwn(fields.family.value.decl.roles, fields.role.value)
      )
        throw new Error('[feedback.material] invalid layout reference');
      return Object.freeze({ family: fields.family.value, role: fields.role.value });
    };
    const inlineSizeFrom = reference('inlineSizeFrom');
    const outlineFrom = reference('outlineFrom');
    // The first outline candidate is an explicitly claimed ancestor in the
    // same logical family. It does not admit arbitrary DOM ancestor discovery.
    if (outlineFrom && outlineFrom.family !== family)
      throw new Error('[feedback.material] outline must belong to the target family');
    const anatomy = this.anatomy();
    if (!anatomy) throw new Error('[feedback.material] paint reservation Anatomy unavailable');
    const target = Object.freeze({}) as MaterialPaintReservation;
    const entry: Entry = {
      owner: this,
      declaration: Object.freeze({
        family,
        targetRole,
        ...(inlineSizeFrom ? { inlineSizeFrom } : {}),
        ...(outlineFrom ? { outlineFrom } : {}),
      }),
      serial: 0,
      boundSerial: 0,
      binding: null,
      target: null,
      inlineSizeFrom: null,
      outlineFrom: null,
      generation: null,
      disconnect: null,
      subscriptions: [],
    };
    entries.set(target, entry);
    this.declarations.set(target, entry);
    entry.subscriptions.push(
      anatomy.subscribeOrder(family, () => this.refreshEntry(entry)),
      // Physical target notifications revoke even same-node bindings: a new
      // view epoch is a new lease, not proof that the former owner survived.
      anatomy.subscribeTargets(family, () => this.refreshEntry(entry, true))
    );
    if (inlineSizeFrom && inlineSizeFrom.family !== family)
      entry.subscriptions.push(
        anatomy.subscribeOrder(inlineSizeFrom.family, () => this.refreshEntry(entry)),
        anatomy.subscribeTargets(inlineSizeFrom.family, () => this.refreshEntry(entry, true))
      );
    return target;
  }

  validateTemplate(targets: readonly MaterialPaintReservation[]) {
    if (this.disposed) throw new Error('[feedback.material] paint reservation owner disposed');
    const unique = new Set(targets);
    if (unique.size !== targets.length)
      throw new Error('[feedback.material] duplicate paint reservation part');
    if (targets.some((target) => !this.declarations.has(target)))
      throw new Error('[feedback.material] foreign paint reservation part');
    if (unique.size !== this.declarations.size)
      throw new Error('[feedback.material] missing paint reservation part');
  }

  setActive(active: boolean) {
    if (this.disposed || this.active === active) return;
    const transition = ++this.transition;
    this.active = active;
    let failed = false;
    let first: unknown;
    for (const entry of this.declarations.values()) {
      if (transition !== this.transition || this.disposed) break;
      try {
        this.refreshEntry(entry, true);
      } catch (error) {
        if (!failed) first = error;
        failed = true;
      }
    }
    if (failed) throw first;
  }

  refresh() {
    for (const entry of this.declarations.values()) this.refreshEntry(entry);
  }

  refreshEntry(entry: Entry, force = false) {
    // Anatomy host reads may synchronously bind/dispose another physical view.
    // An older read must not revoke that newer binding when it returns.
    const reading = {
      generation: entry.generation,
      binding: entry.binding,
      serial: entry.boundSerial,
      active: this.active,
      transition: this.transition,
    };
    const anatomy = this.anatomy();
    let target: unknown = null;
    let inlineSizeFrom: unknown = null;
    let outlineFrom: unknown = null;
    if (this.active && !this.disposed && entry.binding && anatomy) {
      const { family, targetRole } = entry.declaration;
      const self = anatomy.resolveSelfInstance();
      const role = anatomy.resolveSelfRole(family);
      const parts = role
        ? anatomy
            .parts(family, { missing: 'empty' })
            .filter(
              (part) =>
                part.role === targetRole &&
                anatomy.isCurrentPart(family, part) &&
                anatomy.resolveAncestorInstance(family, part, role) === self
            )
        : [];
      if (parts.length === 1) target = anatomy.resolvePartTarget(parts[0]!);
      const reference = entry.declaration.inlineSizeFrom;
      if (target && reference) {
        const references = anatomy
          .parts(reference.family, { missing: 'empty' })
          .filter(
            (part) => part.role === reference.role && anatomy.isCurrentPart(reference.family, part)
          );
        if (references.length === 1) inlineSizeFrom = anatomy.resolvePartTarget(references[0]!);
        if (!inlineSizeFrom || inlineSizeFrom === target) target = null;
      }
      const outline = entry.declaration.outlineFrom;
      if (target && outline) {
        const familyParts = anatomy.parts(family, { missing: 'empty' });
        const owners = familyParts.filter(
          (part) =>
            anatomy.isCurrentPart(family, part) && anatomy.resolvePartInstance(part) === self
        );
        const outlines = familyParts.filter(
          (part) => part.role === outline.role && anatomy.isCurrentPart(family, part)
        );
        if (
          owners.length === 1 &&
          outlines.length === 1 &&
          anatomy.resolveAncestorInstance(family, owners[0]!, outline.role) ===
            anatomy.resolvePartInstance(outlines[0]!)
        )
          outlineFrom = anatomy.resolvePartTarget(outlines[0]!);
        if (!outlineFrom || outlineFrom === target) target = null;
      }
    }
    if (
      this.disposed ||
      entry.generation !== reading.generation ||
      entry.binding !== reading.binding ||
      entry.boundSerial !== reading.serial ||
      this.active !== reading.active ||
      this.transition !== reading.transition
    )
      return;
    if (
      !force &&
      target === entry.target &&
      inlineSizeFrom === entry.inlineSizeFrom &&
      outlineFrom === entry.outlineFrom &&
      !!target === !!entry.disconnect
    )
      return;
    const old = entry.disconnect;
    const generation = Object.freeze({});
    entry.disconnect = null;
    entry.generation = generation;
    entry.target = target;
    entry.inlineSizeFrom = inlineSizeFrom;
    entry.outlineFrom = outlineFrom;
    old?.();
    if (
      !target ||
      !entry.binding ||
      entry.generation !== generation ||
      this.disposed ||
      !this.active
    )
      return;
    const binding = entry.binding;
    const transition = this.transition;
    const disconnect = binding.connect(
      target,
      generation,
      () =>
        this.active &&
        !this.disposed &&
        this.transition === transition &&
        entry.generation === generation &&
        entry.binding === binding &&
        entry.target === target &&
        entry.inlineSizeFrom === inlineSizeFrom &&
        entry.outlineFrom === outlineFrom,
      inlineSizeFrom,
      outlineFrom
    );
    if (
      entry.generation === generation &&
      entry.binding === binding &&
      !this.disposed &&
      this.active
    )
      entry.disconnect = disconnect;
    else disconnect();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.transition++;
    this.active = false;
    // Revoke all entries before calling any user/host cleanup.
    const cleanup: (() => void)[] = [];
    for (const [target, entry] of this.declarations) {
      entries.delete(target);
      entry.target = null;
      entry.inlineSizeFrom = null;
      entry.outlineFrom = null;
      entry.generation = null;
      entry.binding = null;
      if (entry.disconnect) cleanup.push(entry.disconnect);
      entry.disconnect = null;
      cleanup.push(...entry.subscriptions);
      entry.subscriptions = [];
    }
    this.declarations.clear();
    let failure: unknown;
    let failed = false;
    for (const release of cleanup) {
      try {
        release();
      } catch (error) {
        if (!failed) failure = error;
        failed = true;
      }
    }
    if (failed) throw failure;
  }
}
