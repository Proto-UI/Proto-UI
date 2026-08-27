import type { PropsBaseType } from '@proto.ui/types';
import type { AnatomyPartView } from './anatomy';
import type { ObservedStateHandle } from './state';
import type {
  AnchoredCollisionBoundary,
  AnchoredPositionSnapshot,
  AnchoredPositionStrategy,
} from './positioning';

export type OverlayPlacement = 'top' | 'right' | 'bottom' | 'left';
export type OverlayAlign = 'start' | 'center' | 'end';

export type OverlayFocusEntry = 'first' | 'selected' | 'content' | 'manual';
export type OverlayFocusRestore = 'trigger' | 'previous' | 'none';
export type OverlayLayerRole = 'overlay' | 'dialog-mask' | 'dialog-content' | (string & {});

export type OverlayReason =
  | 'trigger.press'
  | 'trigger.hover'
  | 'context.menu'
  | 'escape'
  | 'outside.press'
  | 'focus.outside'
  | 'item.commit'
  | 'controlled.sync'
  | 'programmatic'
  | (string & {});

export type OverlayConfigPatch = Readonly<{
  defaultOpen?: boolean;
  closeOnEscape?: boolean;
  closeOnOutsidePress?: boolean;
  closeOnFocusOutside?: boolean;
  closeOnAnchorPress?: boolean;
  closeOnTriggerPress?: boolean;
  placement?: OverlayPlacement;
  align?: OverlayAlign;
  sideOffset?: number;
  alignOffset?: number;
  anchored?: boolean;
  strategy?: AnchoredPositionStrategy;
  avoidCollisions?: boolean;
  collisionBoundary?: AnchoredCollisionBoundary;
  collisionPadding?: number;
  excludeAnchorTranslation?: boolean;
  entry?: OverlayFocusEntry;
  restore?: OverlayFocusRestore;
  portal?: boolean;
  modal?: boolean;
  layerRole?: OverlayLayerRole;
  layerOffset?: number;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type OverlayConfig = Readonly<{
  defaultOpen: boolean;
  closeOnEscape: boolean;
  closeOnOutsidePress: boolean;
  closeOnFocusOutside: boolean;
  closeOnAnchorPress: boolean;
  closeOnTriggerPress: boolean;
  placement: OverlayPlacement;
  align: OverlayAlign;
  sideOffset: number;
  alignOffset: number;
  anchored: boolean;
  strategy: AnchoredPositionStrategy;
  avoidCollisions: boolean;
  collisionBoundary: AnchoredCollisionBoundary;
  collisionPadding: number;
  excludeAnchorTranslation: boolean;
  entry: OverlayFocusEntry;
  restore: OverlayFocusRestore;
  portal: boolean;
  modal: boolean;
  layerRole: OverlayLayerRole;
  layerOffset: number;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type OverlayPositionPatch = Readonly<
  Pick<
    OverlayConfigPatch,
    | 'placement'
    | 'align'
    | 'sideOffset'
    | 'alignOffset'
    | 'strategy'
    | 'avoidCollisions'
    | 'collisionBoundary'
    | 'collisionPadding'
    | 'excludeAnchorTranslation'
  >
>;

export type OverlayRegistration = Readonly<{
  trigger: unknown | null;
  anchor: unknown | null;
  content: unknown | null;
}>;

/**
 * Supplies perceptual presence for an overlay. Only the active binding may
 * submit structural ViewIntent; binding a transition disables Overlay's
 * immediate presence driver.
 */
export type OverlayPresenceBinding<P extends PropsBaseType = PropsBaseType> = Readonly<{
  enter(): void;
  leave(): void;
  present: ObservedStateHandle<boolean, any>;
}>;

export interface OverlayModuleHandle<P extends PropsBaseType = PropsBaseType> {
  open: ObservedStateHandle<boolean, P>;

  isOpen(): boolean;
  openOverlay(reason?: OverlayReason): void;
  close(reason?: OverlayReason): void;
  toggle(reason?: OverlayReason): void;

  configure(patch: OverlayConfigPatch): void;
  updatePosition(patch: OverlayPositionPatch): void;

  registerTrigger(target: unknown): void;
  registerAnchor(target: unknown): void;
  registerAnchorPart(part: AnatomyPartView): void;
  registerContent(target: unknown): void;
  getPositionSnapshot(): AnchoredPositionSnapshot | null;
}

export interface OverlayHandle<
  P extends PropsBaseType = PropsBaseType,
> extends OverlayModuleHandle<P> {
  /** Keeps the host view mounted while logical open still gates Overlay resources. */
  keepMounted(): void;
  bindPresence(binding: OverlayPresenceBinding<P>): void;
}
