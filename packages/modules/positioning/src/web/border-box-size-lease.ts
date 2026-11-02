import { ownStyles, hasOwnedStyle } from './owned-style-lease';

let nextSizeLeaseGeneration = 0;
const admittedSizeGenerations = new WeakMap<HTMLElement, number>();

export type BorderBoxSizeResult =
  | Readonly<{ kind: 'matched'; width: number; height: number }>
  | Readonly<{ kind: 'pending'; reason: 'missing-layout' }>
  | Readonly<{
      kind: 'unavailable';
      reason: 'detached-target' | 'invalid-geometry' | 'ownership-lost' | 'size-conflict';
    }>;

type BorderBoxSizePreparation =
  | Readonly<{ kind: 'prepared'; width: number; height: number }>
  | Exclude<BorderBoxSizeResult, { kind: 'matched' }>;

/**
 * Neutral layout-only lease. Semantic target selection and safe associations
 * belong to the consumer/Overlay. No component identity is inspected here.
 * Surface paint transforms remain decoration; readback is its used layout
 * border box, matching the existing target-alignment coordinate contract.
 */
export function createBorderBoxSizeLease(
  reference: HTMLElement,
  targets: readonly HTMLElement[],
  current: () => boolean
) {
  const generation = ++nextSizeLeaseGeneration;
  const ownerDocument = reference.ownerDocument;
  const sizeFields = ['width', 'height', 'inline-size', 'block-size'];
  const authoredConflict = targets.some(
    (target) =>
      sizeFields.some(
        (name) => !!target.style.getPropertyValue(name) && !hasOwnedStyle(target, name)
      ) || !!target.style.getPropertyPriority('box-sizing')
  );
  const owners = targets.map((target) => ({ target, styles: ownStyles(target) }));
  type Reason = Extract<BorderBoxSizeResult, { kind: 'unavailable' }>['reason'];
  let terminal: Reason | null = authoredConflict ? 'size-conflict' : null;
  const unavailable = (reason: Reason): Extract<BorderBoxSizeResult, { kind: 'unavailable' }> => {
    terminal = reason;
    // Partial writes must not outlive failed admission. Restore only fields
    // still owned by this identity; newer author writes remain untouched.
    for (const { styles } of owners) styles.restore();
    return { kind: 'unavailable', reason };
  };
  let preparedSize: Readonly<{ width: number; height: number }> | null = null;
  const pending = (): Extract<BorderBoxSizeResult, { kind: 'pending' }> => {
    preparedSize = null;
    // A missing used box is not a terminal conflict or a certified match.
    // Retain claim identities while pending, so a same-valued successor cannot
    // be stolen back on resume. Disposal/terminal failure still restores ours.
    return { kind: 'pending', reason: 'missing-layout' };
  };
  const ownsCurrentFields = () =>
    owners.every(
      ({ target, styles }) =>
        (admittedSizeGenerations.get(target) ?? 0) <= generation && styles.isCurrent()
    );
  const hasNewAuthoredSizing = () =>
    owners.some(
      ({ target }) =>
        sizeFields.some(
          (name) => !!target.style.getPropertyValue(name) && !hasOwnedStyle(target, name)
        ) || !!target.style.getPropertyPriority('box-sizing')
    );
  const connectedToOwner = () =>
    current() &&
    reference.isConnected &&
    reference.ownerDocument === ownerDocument &&
    owners.every(({ target }) => target.isConnected && target.ownerDocument === ownerDocument);
  const prepare = (): BorderBoxSizePreparation => {
    if (terminal) return { kind: 'unavailable', reason: terminal };
    if (!connectedToOwner()) return unavailable('detached-target');
    if (!ownsCurrentFields() || hasNewAuthoredSizing()) return unavailable('ownership-lost');
    // Both sides use the same used-layout CSSOM border-box coordinate space.
    // Trigger hover/press or ancestor paint transforms never resize rows.
    const width = reference.offsetWidth,
      height = reference.offsetHeight;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0)
      return unavailable('invalid-geometry');
    if (width === 0 || height === 0) return pending();
    // Initial pending has no style fields to protect. A later admitted lease
    // still supersedes it, even after that successor restores its own fields.
    // Missing layout or an initial author conflict never claims this generation.
    if (!connectedToOwner()) return unavailable('detached-target');
    if (!ownsCurrentFields() || hasNewAuthoredSizing()) return unavailable('ownership-lost');
    for (const { target } of owners) admittedSizeGenerations.set(target, generation);
    // Do not erase author min/max constraints. Conflicting used dimensions
    // are diagnosed below; an explicit intrinsic policy opts out upstream.
    for (const { styles } of owners) {
      if (!current()) return unavailable('detached-target');
      if (!ownsCurrentFields() || hasNewAuthoredSizing()) return unavailable('ownership-lost');
      if (
        !styles.write('box-sizing', 'border-box') ||
        !styles.write('width', `${width}px`) ||
        !styles.write('height', `${height}px`)
      )
        return unavailable('ownership-lost');
    }
    // Preparation owns the requested dimensions, but cannot certify the used
    // box until the caller has installed the containing layout constraints.
    preparedSize = { width, height };
    return { kind: 'prepared', width, height };
  };
  const verify = (): BorderBoxSizeResult | Readonly<{ kind: 'reference-changed' }> => {
    if (terminal) return { kind: 'unavailable', reason: terminal };
    if (!connectedToOwner()) return unavailable('detached-target');
    if (!preparedSize) return unavailable('invalid-geometry');
    if (!ownsCurrentFields() || hasNewAuthoredSizing()) return unavailable('ownership-lost');
    const prepared = preparedSize;
    const { width, height } = prepared;
    // Verification never rewrites dimensions after the caller solved layout.
    // A changed reference requires another bounded solve, not certification
    // of fresh row dimensions against a plan computed for the earlier ones.
    const currentWidth = reference.offsetWidth,
      currentHeight = reference.offsetHeight;
    if (
      !Number.isFinite(currentWidth) ||
      !Number.isFinite(currentHeight) ||
      currentWidth < 0 ||
      currentHeight < 0
    )
      return unavailable('invalid-geometry');
    if (currentWidth === 0 || currentHeight === 0) return pending();
    if (currentWidth !== width || currentHeight !== height) return { kind: 'reference-changed' };
    for (const { target } of owners) {
      if (!current()) return unavailable('detached-target');
      // Used dimensions and un-clipped content are verified independently
      // of successful writes. Multi-line callers must choose intrinsic.
      const targetWidth = target.offsetWidth,
        targetHeight = target.offsetHeight;
      if (
        !Number.isFinite(targetWidth) ||
        !Number.isFinite(targetHeight) ||
        targetWidth < 0 ||
        targetHeight < 0
      )
        return unavailable('invalid-geometry');
      if (targetWidth === 0 || targetHeight === 0) return pending();
      if (
        Math.abs(targetWidth - width) > 1 ||
        Math.abs(targetHeight - height) > 1 ||
        target.scrollHeight > target.clientHeight + 1 ||
        target.scrollWidth > target.clientWidth + 1
      )
        return unavailable('size-conflict');
    }
    const finalWidth = reference.offsetWidth,
      finalHeight = reference.offsetHeight;
    // Layout reads can synchronously reenter an owner/DOM boundary. Never
    // certify a disconnected/adopted target or an equal-valued successor claim.
    if (!connectedToOwner()) return unavailable('detached-target');
    if (!ownsCurrentFields() || hasNewAuthoredSizing()) return unavailable('ownership-lost');
    if (
      !Number.isFinite(finalWidth) ||
      !Number.isFinite(finalHeight) ||
      finalWidth < 0 ||
      finalHeight < 0
    )
      return unavailable('invalid-geometry');
    if (finalWidth === 0 || finalHeight === 0) return pending();
    if (finalWidth !== width || finalHeight !== height || preparedSize !== prepared)
      return { kind: 'reference-changed' };
    return { kind: 'matched', width, height };
  };
  return {
    prepare,
    verify,
    abort: unavailable,
    apply(): BorderBoxSizeResult {
      const prepared = prepare();
      if (prepared.kind !== 'prepared') return prepared;
      const result = verify();
      return result.kind === 'reference-changed' ? unavailable('invalid-geometry') : result;
    },
    restore() {
      terminal = 'detached-target';
      for (const { styles } of owners) styles.restore();
    },
  };
}

/** Layout chrome outside one row's border box, including reserved scrollbars. */
export function measureBorderBoxInlineGutter(
  target: HTMLElement,
  surface: HTMLElement
): number | null {
  const view = surface.ownerDocument.defaultView;
  if (!view || !surface.contains(target)) return null;
  const number = (value: string) => (value === 'auto' ? 0 : Number.parseFloat(value));
  let gutter = 0;
  let child: HTMLElement = target;
  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    const childStyle = view.getComputedStyle(child);
    const style = view.getComputedStyle(parent);
    const margin = number(childStyle.marginLeft) + number(childStyle.marginRight);
    const border = number(style.borderLeftWidth) + number(style.borderRightWidth);
    const padding = number(style.paddingLeft) + number(style.paddingRight);
    const scrollbar = Math.max(0, parent.offsetWidth - parent.clientWidth - border);
    if (![margin, border, padding, scrollbar].every(Number.isFinite) || border < 0 || padding < 0)
      return null;
    gutter += margin + border + padding + scrollbar;
    if (parent === surface) return Math.max(0, gutter);
    child = parent;
  }
  return null;
}
