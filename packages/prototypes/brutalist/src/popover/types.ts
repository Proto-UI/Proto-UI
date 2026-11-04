import type {
  PopoverTriggerProps as BaseTriggerProps,
  PopoverContentProps as BaseContentProps,
} from '@proto.ui/prototypes-base/popover';

/** Opt-in anchored navigation composition; omitted/default paint is unchanged. */
export interface PopoverNavigationPresentationProps {
  presentation?: 'default' | 'navigation';
}
export type PopoverTriggerProps = BaseTriggerProps & PopoverNavigationPresentationProps;
export type PopoverContentProps = BaseContentProps & PopoverNavigationPresentationProps;
