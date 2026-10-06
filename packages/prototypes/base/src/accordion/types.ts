import type {
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  FocusRequestOptions,
  State,
} from '@proto.ui/core';

export type AccordionMode = 'single' | 'multiple';
export type AccordionReason = 'pointer' | 'keyboard' | 'programmatic';
export interface AccordionRootProps {
  mode?: AccordionMode;
  openItems?: string[];
  defaultOpenItems?: string[];
  allowEmpty?: boolean;
  disabled?: boolean;
  orientation?: 'vertical' | 'horizontal';
  direction?: 'ltr' | 'rtl';
  loop?: boolean;
}
export type AccordionOpenRequest = {
  openItems: string[];
  value: string;
  open: boolean;
  reason: AccordionReason;
};
export type AccordionRootExposes = {
  openCount: ExposeState<number>;
  getOpenItems: ExposeMethod<() => string[]>;
  requestOpen: ExposeMethod<(value: string, open: boolean, reason?: AccordionReason) => boolean>;
  openChange: ExposeEvent<AccordionOpenRequest>;
};
export type AccordionRootAsHookContract = { state: { openCount: State<number> } };
export interface AccordionItemProps {
  value: string;
  disabled?: boolean;
}
export type AccordionItemExposes = {
  value: ExposeState<string>;
  open: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
};
export type AccordionItemAsHookContract = {
  state: { value: State<string>; open: State<boolean>; disabled: State<boolean> };
};
export interface AccordionHeadingProps {
  level?: number;
}
export type AccordionHeadingExposes = { level: ExposeState<number> };
export type AccordionHeadingAsHookContract = { state: { level: State<number> } };
export interface AccordionTriggerProps {}
export type AccordionTriggerExposes = {
  expanded: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
  collapseBlocked: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
};
export type AccordionTriggerAsHookContract = {
  state: {
    expanded: State<boolean>;
    disabled: State<boolean>;
    collapseBlocked: State<boolean>;
    hovered: State<boolean>;
    pressed: State<boolean>;
    focused: State<boolean>;
    focusVisible: State<boolean>;
  };
};
export interface AccordionContentProps {
  keepMounted?: boolean;
  region?: boolean;
}
export type AccordionContentExposes = { open: ExposeState<boolean>; hidden: ExposeState<boolean> };
export type AccordionContentAsHookContract = {
  state: { open: State<boolean>; hidden: State<boolean> };
};
