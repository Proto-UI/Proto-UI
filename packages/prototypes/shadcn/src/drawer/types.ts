import type {
  DrawerTriggerProps as BaseDrawerTriggerProps,
  DrawerCloseProps as BaseDrawerCloseProps,
  DrawerRootProps as BaseDrawerRootProps,
  DrawerContentProps as BaseDrawerContentProps,
  DrawerMaskProps as BaseDrawerMaskProps,
  DrawerTitleProps as BaseDrawerTitleProps,
  DrawerDescriptionProps as BaseDrawerDescriptionProps,
  DrawerHandleProps as BaseDrawerHandleProps,
  DrawerHeaderProps as BaseDrawerHeaderProps,
  DrawerFooterProps as BaseDrawerFooterProps,
} from '@proto.ui/prototypes-base/drawer';
import type { ShadcnStyleProps } from '../style-scope';

/** Explicit local long-label adaptation; default false preserves New York sizing. */
export type DrawerTriggerProps = BaseDrawerTriggerProps & ShadcnStyleProps & { wrap?: boolean };
export type DrawerCloseProps = BaseDrawerCloseProps & ShadcnStyleProps & { wrap?: boolean };
export type DrawerRootProps = BaseDrawerRootProps & ShadcnStyleProps;
export type DrawerContentProps = BaseDrawerContentProps & ShadcnStyleProps;
export type DrawerMaskProps = BaseDrawerMaskProps & ShadcnStyleProps;
export type DrawerTitleProps = BaseDrawerTitleProps & ShadcnStyleProps;
export type DrawerDescriptionProps = BaseDrawerDescriptionProps & ShadcnStyleProps;
export type DrawerHandleProps = BaseDrawerHandleProps & ShadcnStyleProps;
export type DrawerHeaderProps = BaseDrawerHeaderProps & ShadcnStyleProps;
export type DrawerFooterProps = BaseDrawerFooterProps & ShadcnStyleProps;
