import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  size,
  type Middleware,
  type Placement,
} from '@floating-ui/dom';
import type {
  AnchoredPositionAlign,
  AnchoredPositionConfig,
  AnchoredPositionConnection,
  AnchoredPositionSide,
} from '@proto.ui/core';
import type { AnchoredPositionHost, AnchoredPositionHostLease } from '../caps';

function toPlacement(config: AnchoredPositionConfig): Placement {
  return config.align === 'center' ? config.side : `${config.side}-${config.align}`;
}

function fromPlacement(placement: Placement): {
  side: AnchoredPositionSide;
  align: AnchoredPositionAlign;
} {
  const [side, align] = placement.split('-') as [AnchoredPositionSide, AnchoredPositionAlign?];
  return { side, align: align ?? 'center' };
}

function isElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

/**
 * Anchored geometry may exclude the anchor's own CSS translation. Interaction
 * transforms (hover lift, press-down) are decoration of the anchor surface;
 * when the consumer opts in via `excludeAnchorTranslation`, anchored surfaces
 * track layout position instead of the rendered surface. By default the host
 * measures the anchor's actual rendered geometry, so legitimate translations
 * (centering, application animation) keep floating placement where the user
 * sees the anchor.
 */
function virtualReferenceFor(anchor: HTMLElement) {
  return {
    getBoundingClientRect(): DOMRect {
      const rect = anchor.getBoundingClientRect();
      let dx = 0;
      let dy = 0;
      const transform =
        typeof getComputedStyle === 'function' ? getComputedStyle(anchor).transform : 'none';
      if (transform && transform !== 'none' && typeof DOMMatrixReadOnly !== 'undefined') {
        const matrix = new DOMMatrixReadOnly(transform);
        dx = matrix.m41;
        dy = matrix.m42;
      }
      return {
        x: rect.x - dx,
        y: rect.y - dy,
        left: rect.left - dx,
        top: rect.top - dy,
        right: rect.right - dx,
        bottom: rect.bottom - dy,
        width: rect.width,
        height: rect.height,
        toJSON: () => ({}),
      } as DOMRect;
    },
  };
}

function positionReference(anchor: HTMLElement, config: AnchoredPositionConfig) {
  return config.excludeAnchorTranslation === true ? virtualReferenceFor(anchor) : anchor;
}

function middlewareFor(config: AnchoredPositionConfig): Middleware[] {
  const middleware: Middleware[] = [
    offset({ mainAxis: config.sideOffset, crossAxis: config.alignOffset }),
  ];
  const boundary = config.collisionBoundary === 'viewport' ? [] : 'clippingAncestors';
  if (config.avoidCollisions) {
    middleware.push(
      flip({ boundary, rootBoundary: 'viewport', padding: config.collisionPadding }),
      shift({ boundary, rootBoundary: 'viewport', padding: config.collisionPadding })
    );
  }
  middleware.push(
    size({
      boundary,
      rootBoundary: 'viewport',
      padding: config.collisionPadding,
      apply({ availableWidth, availableHeight, rects, elements }) {
        const style = elements.floating.style;
        style.setProperty('--proto-ui-anchor-width', `${rects.reference.width}px`);
        style.setProperty('--proto-ui-anchor-height', `${rects.reference.height}px`);
        style.setProperty('--proto-ui-available-width', `${availableWidth}px`);
        style.setProperty('--proto-ui-available-height', `${availableHeight}px`);
      },
    })
  );
  return middleware;
}

export function createFloatingUiAnchoredPositionHost(): AnchoredPositionHost {
  return {
    attach(initial): AnchoredPositionHostLease {
      let connection = initial;
      let disposed = false;
      let cleanup: (() => void) | null = null;

      const position = async () => {
        const { anchor, floating, config } = connection;
        if (disposed || !isElement(anchor) || !isElement(floating)) return;
        const result = await computePosition(positionReference(anchor, config), floating, {
          placement: toPlacement(config),
          strategy: config.strategy,
          middleware: middlewareFor(config),
        });
        if (disposed) return;
        Object.assign(floating.style, {
          position: result.strategy,
          left: `${result.x}px`,
          top: `${result.y}px`,
        });
        const resolved = fromPlacement(result.placement);
        floating.dataset.side = resolved.side;
        floating.dataset.align = resolved.align;
        connection.onResolved?.({ ...resolved, strategy: result.strategy });
      };

      const restart = () => {
        cleanup?.();
        cleanup = null;
        const { anchor, floating } = connection;
        if (!isElement(anchor) || !isElement(floating)) return;
        cleanup = autoUpdate(anchor, floating, position, { animationFrame: false });
      };

      restart();

      return {
        update(next) {
          const targetsChanged =
            !Object.is(connection.anchor, next.anchor) ||
            !Object.is(connection.floating, next.floating);
          connection = next;
          if (targetsChanged) restart();
          else void position();
        },
        requestUpdate() {
          void position();
        },
        dispose() {
          disposed = true;
          cleanup?.();
          cleanup = null;
        },
      };
    },
  };
}
