import type {
  AnatomyPartView,
  OverlayTargetAlignmentBinding,
  TargetAlignmentConnection,
  TargetAlignmentStatus,
} from '@proto.ui/core';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import type { BoundaryPort } from '@proto.ui/module-boundary';

type TargetAlignmentAnatomyPort = Pick<
  AnatomyPort,
  | 'subscribeTargets'
  | 'isCurrentPart'
  | 'resolvePartInstance'
  | 'descendantsOf'
  | 'resolveSelfRole'
  | 'resolveAncestorInstance'
  | 'resolveSelfInstance'
  | 'resolvePartTarget'
>;

/** Private structural binding. Semantic target selection remains with the prototype. */
export class OverlayTargetAlignment {
  private binding: OverlayTargetAlignmentBinding | null = null;
  private offTargets: (() => void) | null = null;
  private offRegion: (() => void) | null = null;
  private regionTarget: unknown = undefined;
  private resolution = 0;

  constructor(
    private readonly anatomy: TargetAlignmentAnatomyPort,
    private readonly boundary: BoundaryPort,
    private readonly changed: () => void
  ) {}

  hasBinding(): boolean {
    return this.binding !== null;
  }

  set(binding: OverlayTargetAlignmentBinding | null): void {
    this.offTargets?.();
    this.offTargets = null;
    this.clearPhysical();
    this.binding = binding;
    if (binding) {
      this.offTargets = this.anatomy.subscribeTargets(binding.family, () => {
        if (this.binding === binding) this.changed();
      });
    }
  }

  private isDescendant(
    binding: OverlayTargetAlignmentBinding,
    parent: AnatomyPartView,
    child: AnatomyPartView
  ): boolean {
    if (
      !this.anatomy.isCurrentPart(binding.family, parent) ||
      !this.anatomy.isCurrentPart(binding.family, child)
    )
      return false;
    const instance = this.anatomy.resolvePartInstance(child);
    return this.anatomy
      .descendantsOf(binding.family, parent, child.role)
      .some((part) => this.anatomy.resolvePartInstance(part) === instance);
  }

  private ownsSurface(binding: OverlayTargetAlignmentBinding): boolean {
    const role = this.anatomy.resolveSelfRole(binding.family);
    return (
      role !== null &&
      this.anatomy.isCurrentPart(binding.family, binding.surface) &&
      this.anatomy.resolveAncestorInstance(binding.family, binding.surface, role) ===
        this.anatomy.resolveSelfInstance()
    );
  }

  private valid(binding: OverlayTargetAlignmentBinding): boolean {
    const parts = [
      binding.surface,
      binding.scrollport,
      binding.blockReference,
      binding.inlineReference,
      binding.blockTarget,
      binding.inlineTarget,
    ];
    if (!parts.every((part) => this.anatomy.isCurrentPart(binding.family, part))) return false;
    const sizing = binding.sizeMatch;
    const sizeValid =
      !sizing ||
      (this.anatomy.isCurrentPart(binding.family, sizing.reference) &&
        this.anatomy.resolvePartInstance(sizing.reference) ===
          this.anatomy.resolvePartInstance(binding.blockReference) &&
        sizing.targets.length > 0 &&
        sizing.targets.every((part) => this.anatomy.isCurrentPart(binding.family, part)) &&
        new Set(sizing.targets.map((part) => this.anatomy.resolvePartInstance(part))).size ===
          sizing.targets.length &&
        sizing.targets.every((part) => this.isDescendant(binding, binding.scrollport, part)));
    const sameOrDescendant = (parent: AnatomyPartView, child: AnatomyPartView) =>
      this.anatomy.resolvePartInstance(parent) === this.anatomy.resolvePartInstance(child) ||
      this.isDescendant(binding, parent, child);
    return (
      sizeValid &&
      this.ownsSurface(binding) &&
      this.isDescendant(binding, binding.surface, binding.scrollport) &&
      this.isDescendant(binding, binding.scrollport, binding.blockTarget) &&
      sameOrDescendant(binding.blockTarget, binding.inlineTarget) &&
      sameOrDescendant(binding.blockReference, binding.inlineReference)
    );
  }

  syncSurface(): void {
    const binding = this.binding;
    if (!binding) {
      this.clearPhysical();
      return;
    }
    const target = this.ownsSurface(binding)
      ? this.anatomy.resolvePartTarget(binding.surface)
      : null;
    if (this.binding !== binding) return;
    if (this.offRegion && Object.is(this.regionTarget, target)) return;
    this.clearPhysical();
    this.regionTarget = target;
    this.offRegion = this.boundary.replaceImplicitRoot(target);
  }

  resolve(): {
    targetAlignment: TargetAlignmentConnection;
    onAlignment(status: TargetAlignmentStatus): void;
  } | null {
    const binding = this.binding;
    if (!binding) return null;
    const generation = ++this.resolution;
    const current = () => this.binding === binding && generation === this.resolution;
    const valid = this.valid(binding);
    const target = (part: AnatomyPartView) => (valid ? this.anatomy.resolvePartTarget(part) : null);
    const targetAlignment: TargetAlignmentConnection = {
      surface: target(binding.surface),
      scrollport: target(binding.scrollport),
      blockReference: target(binding.blockReference),
      inlineReference: target(binding.inlineReference),
      blockTarget: target(binding.blockTarget),
      inlineTarget: target(binding.inlineTarget),
      atStart: binding.atStart,
      atEnd: binding.atEnd,
      constraints: binding.constraints,
      ...(binding.sizeMatch
        ? {
            sizeMatch: {
              reference: target(binding.sizeMatch.reference),
              targets: binding.sizeMatch.targets.map(target),
            },
          }
        : {}),
    };
    return {
      targetAlignment,
      onAlignment: (status) => {
        if (!current()) return;
        const associated = this.valid(binding);
        if (!current()) return;
        if (!associated || !valid) {
          binding.onAlignment({ status: 'unavailable', reason: 'invalid-association' });
          return;
        }
        const keys = [
          'surface',
          'scrollport',
          'blockReference',
          'inlineReference',
          'blockTarget',
          'inlineTarget',
        ] as const;
        const unchanged = keys.every((key) =>
          Object.is(this.anatomy.resolvePartTarget(binding[key]), targetAlignment[key])
        );
        const sizeUnchanged =
          !binding.sizeMatch ||
          (Object.is(
            this.anatomy.resolvePartTarget(binding.sizeMatch.reference),
            targetAlignment.sizeMatch?.reference
          ) &&
            binding.sizeMatch.targets.every((part, index) =>
              Object.is(
                this.anatomy.resolvePartTarget(part),
                targetAlignment.sizeMatch?.targets[index]
              )
            ));
        if (!current() || !unchanged || !sizeUnchanged) return;
        binding.onAlignment(status);
      },
    };
  }

  clearPhysical(): void {
    this.resolution++;
    const previous = this.offRegion;
    this.offRegion = null;
    this.regionTarget = undefined;
    previous?.();
  }

  dispose(): void {
    this.set(null);
  }
}
