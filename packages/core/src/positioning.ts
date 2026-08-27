export type AnchoredPositionSide = 'top' | 'right' | 'bottom' | 'left';
export type AnchoredPositionAlign = 'start' | 'center' | 'end';
export type AnchoredPositionStrategy = 'absolute' | 'fixed';
export type AnchoredCollisionBoundary = 'clippingAncestors' | 'viewport';

export type AnchoredPositionConfig = Readonly<{
  side: AnchoredPositionSide;
  align: AnchoredPositionAlign;
  sideOffset: number;
  alignOffset: number;
  strategy: AnchoredPositionStrategy;
  avoidCollisions: boolean;
  collisionBoundary: AnchoredCollisionBoundary;
  collisionPadding: number;
  /**
   * When true, the host ignores the anchor element's own CSS translation
   * (matrix m41/m42) when measuring anchored geometry. Interaction
   * decorations such as hover lift or press-down are then excluded from
   * floating placement. When false or omitted, the host positions against
   * the anchor's actual rendered geometry, which is the default: legitimate
   * translations (centering, application animation) must keep placing the
   * floating element where the user sees the anchor.
   */
  excludeAnchorTranslation?: boolean;
}>;

export type AnchoredPositionSnapshot = Readonly<{
  side: AnchoredPositionSide;
  align: AnchoredPositionAlign;
  strategy: AnchoredPositionStrategy;
}>;

export type AnchoredPositionConnection = Readonly<{
  anchor: unknown;
  floating: unknown;
  config: AnchoredPositionConfig;
  onResolved?(snapshot: AnchoredPositionSnapshot): void;
}>;

export interface AnchoredPositionHandle {
  connect(connection: AnchoredPositionConnection): void;
  update(config: AnchoredPositionConfig): void;
  requestUpdate(): void;
  disconnect(): void;
  getSnapshot(): AnchoredPositionSnapshot | null;
}
