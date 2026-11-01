import { ownStyles, hasOwnedStyle } from './owned-style-lease';

export type BorderBoxSizeResult =
  | Readonly<{ kind: 'matched'; width: number; height: number }>
  | Readonly<{
      kind: 'unavailable';
      reason: 'detached-target' | 'invalid-geometry' | 'ownership-lost' | 'size-conflict';
    }>;

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
  const unavailable = (reason: Reason): BorderBoxSizeResult => {
    terminal = reason;
    // Partial writes must not outlive failed admission. Restore only fields
    // still owned by this identity; newer author writes remain untouched.
    for (const { styles } of owners) styles.restore();
    return { kind: 'unavailable', reason };
  };
  return {
    apply(): BorderBoxSizeResult {
      if (terminal) return { kind: 'unavailable', reason: terminal };
      if (
        !current() ||
        !reference.isConnected ||
        owners.some(
          ({ target }) => !target.isConnected || target.ownerDocument !== reference.ownerDocument
        )
      )
        return unavailable('detached-target');
      // Both sides use the same used-layout CSSOM border-box coordinate space.
      // Trigger hover/press or ancestor paint transforms never resize rows.
      const width = reference.offsetWidth,
        height = reference.offsetHeight;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
        return unavailable('invalid-geometry');
      // Do not erase author min/max constraints. Conflicting used dimensions
      // are diagnosed below; an explicit intrinsic policy opts out upstream.
      for (const { styles } of owners) {
        if (!current()) return unavailable('detached-target');
        if (
          !styles.write('box-sizing', 'border-box') ||
          !styles.write('width', `${width}px`) ||
          !styles.write('height', `${height}px`)
        )
          return unavailable('ownership-lost');
      }
      for (const { target } of owners) {
        if (!current()) return unavailable('detached-target');
        // Used dimensions and un-clipped content are verified independently
        // of successful writes. Multi-line callers must choose intrinsic.
        if (
          Math.abs(target.offsetWidth - width) > 1 ||
          Math.abs(target.offsetHeight - height) > 1 ||
          target.scrollHeight > target.clientHeight + 1 ||
          target.scrollWidth > target.clientWidth + 1
        )
          return unavailable('size-conflict');
      }
      return { kind: 'matched', width, height };
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
