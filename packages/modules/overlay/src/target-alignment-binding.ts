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
    return (
      parts.every((part) => this.anatomy.isCurrentPart(binding.family, part)) &&
      this.ownsSurface(binding) &&
      this.isDescendant(binding, binding.surface, binding.scrollport) &&
      this.isDescendant(binding, binding.scrollport, binding.blockTarget) &&
      this.isDescendant(binding, binding.blockTarget, binding.inlineTarget) &&
      this.isDescendant(binding, binding.blockReference, binding.inlineReference)
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
        if (!current() || !unchanged) return;
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
