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
/** Opt-in navigation is a family presentation; Base remains the sole owner
 * of trigger activation, disabled, focus, expansion and anchoring semantics. */
export interface PopoverNavigationPresentationProps {
  presentation?: 'default' | 'navigation';
}
export type PopoverTriggerProps = BaseTriggerProps &
  ShadcnStyleProps &
  PopoverNavigationPresentationProps;
export type PopoverContentProps = BaseContentProps &
  ShadcnStyleProps &
  PopoverNavigationPresentationProps;
export type PopoverCloseProps = BaseCloseProps & ShadcnStyleProps;
export type PopoverTitleProps = BaseTitleProps & ShadcnStyleProps;
export type PopoverDescriptionProps = BaseDescriptionProps & ShadcnStyleProps;
