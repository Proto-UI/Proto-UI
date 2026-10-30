import type {
  ToastRootProps as BaseRootProps,
  ToastViewportProps as BaseViewportProps,
  ToastTitleProps as BaseTitleProps,
  ToastDescriptionProps as BaseDescriptionProps,
  ToastActionProps as BaseActionProps,
  ToastCloseProps as BaseCloseProps,
} from '@proto.ui/prototypes-base/toast';
import type { ShadcnStyleProps } from '../style-scope';

export type ToastRootProps = BaseRootProps & ShadcnStyleProps;
export type ToastViewportProps = BaseViewportProps & ShadcnStyleProps;
export type ToastTitleProps = BaseTitleProps & ShadcnStyleProps;
export type ToastDescriptionProps = BaseDescriptionProps & ShadcnStyleProps;
export type ToastActionProps = BaseActionProps & ShadcnStyleProps;
export type ToastCloseProps = BaseCloseProps & ShadcnStyleProps;
