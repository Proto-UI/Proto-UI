import type {
  PopoverRootProps as BaseRootProps,
  PopoverTriggerProps as BaseTriggerProps,
  PopoverContentProps as BaseContentProps,
  PopoverCloseProps as BaseCloseProps,
  PopoverTitleProps as BaseTitleProps,
  PopoverDescriptionProps as BaseDescriptionProps,
} from '@proto.ui/prototypes-base/popover';
import type { ShadcnStyleProps } from '../style-scope';

export type PopoverRootProps = BaseRootProps & ShadcnStyleProps;
export type PopoverTriggerProps = BaseTriggerProps & ShadcnStyleProps;
export type PopoverContentProps = BaseContentProps & ShadcnStyleProps;
export type PopoverCloseProps = BaseCloseProps & ShadcnStyleProps;
export type PopoverTitleProps = BaseTitleProps & ShadcnStyleProps;
export type PopoverDescriptionProps = BaseDescriptionProps & ShadcnStyleProps;
