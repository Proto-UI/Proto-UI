export interface GeometryRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportGeometry {
  viewportRect: GeometryRect;
  scrollOffset: { x: number; y: number };
}

// Browser focus may scroll the document without moving an element in its layout.
// Rect and scroll offset must be captured together in the same browser evaluation.
export function documentRect({ viewportRect, scrollOffset }: ViewportGeometry): GeometryRect {
  return {
    x: viewportRect.x + scrollOffset.x,
    y: viewportRect.y + scrollOffset.y,
    width: viewportRect.width,
    height: viewportRect.height,
  };
}
