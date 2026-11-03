import type {
  AnatomyPartView,
  OverlaySizeMatchBinding,
  TargetAlignmentStatus,
} from '@proto.ui/core';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import type { BoundaryPort } from '@proto.ui/module-boundary';

type SizeAnatomyPort = Pick<
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

/** Private association only. Sizing, host admission and placement remain Positioning duties. */
export class OverlaySizeMatch {
  private binding: OverlaySizeMatchBinding | null = null;
  private offTargets: (() => void) | null = null;
  private offRegion: (() => void) | null = null;
  private regionTarget: unknown = undefined;
  private resolution = 0;

  constructor(
    private readonly anatomy: SizeAnatomyPort,
    private readonly boundary: BoundaryPort,
    private readonly changed: () => void
  ) {}

  hasBinding(): boolean {
    return this.binding !== null;
  }

  set(input: OverlaySizeMatchBinding | null): void {
    this.offTargets?.();
    this.offTargets = null;
    this.clearPhysical();
    const binding = input
      ? Object.freeze({ ...input, targets: Object.freeze([...input.targets]) })
      : null;
    this.binding = binding;
    if (binding) {
      this.offTargets = this.anatomy.subscribeTargets(binding.family, () => {
        if (this.binding === binding) this.changed();
      });
    }
  }

  private ownsSurface(binding: OverlaySizeMatchBinding): boolean {
    const role = this.anatomy.resolveSelfRole(binding.family);
    return (
      role !== null &&
      this.anatomy.isCurrentPart(binding.family, binding.surface) &&
      this.anatomy.resolveAncestorInstance(binding.family, binding.surface, role) ===
        this.anatomy.resolveSelfInstance()
    );
  }

  private valid(binding: OverlaySizeMatchBinding): boolean {
    if (
      !this.ownsSurface(binding) ||
      !this.anatomy.isCurrentPart(binding.family, binding.reference)
    )
      return false;
    if (binding.targets.length === 0) return false;
    const identities = new Set<unknown>();
    for (const target of binding.targets) {
      if (!this.anatomy.isCurrentPart(binding.family, target)) return false;
      const instance = this.anatomy.resolvePartInstance(target);
      if (instance === null || identities.has(instance)) return false;
      identities.add(instance);
      const contained = this.anatomy
        .descendantsOf(binding.family, binding.surface, target.role)
        .some((part) => this.anatomy.resolvePartInstance(part) === instance);
      if (!contained) return false;
    }
    return true;
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

  resolve(anchor: unknown): {
    floating: unknown | null;
    sizeMatch: Readonly<{ reference: unknown; targets: readonly unknown[] }>;
    onSizeMatch(status: TargetAlignmentStatus): void;
  } | null {
    const binding = this.binding;
    if (!binding) return null;
    const generation = ++this.resolution;
    const current = () => this.binding === binding && generation === this.resolution;
    const associated = this.valid(binding);
    const target = (part: AnatomyPartView) =>
      associated ? this.anatomy.resolvePartTarget(part) : null;
    const reference = target(binding.reference);
    // A genuinely missing physical target is pending, not an unrelated anchor.
    const anchorMatches = anchor == null || reference == null || Object.is(anchor, reference);
    const valid = associated && anchorMatches;
    const floating = valid ? target(binding.surface) : null;
    const targets = binding.targets.map((part) => (valid ? target(part) : null));
    const sizeMatch = Object.freeze({
      reference: valid ? reference : null,
      targets: Object.freeze(targets),
    });
    return {
      floating,
      sizeMatch,
      onSizeMatch: (status) => {
        if (!current()) return;
        const stillAssociated = this.valid(binding);
        if (!current()) return;
        if (!valid || !stillAssociated) {
          binding.onSizeMatch({ status: 'unavailable', reason: 'invalid-association' });
          return;
        }
        const unchanged =
          Object.is(this.anatomy.resolvePartTarget(binding.surface), floating) &&
          Object.is(this.anatomy.resolvePartTarget(binding.reference), reference) &&
          binding.targets.every((part, index) =>
            Object.is(this.anatomy.resolvePartTarget(part), targets[index])
          );
        if (!current() || !unchanged) return;
        binding.onSizeMatch(status);
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
