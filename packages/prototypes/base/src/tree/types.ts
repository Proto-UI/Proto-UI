import type {
  CollectionExposes,
  CollectionItemExposes,
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  FocusRequestOptions,
  State,
} from '@proto.ui/core';
import type { asButton, ButtonExposes, ButtonProps } from '../button';
import type { TreeEntry, TreeNode } from './model';
export interface TreeRootProps {
  value?: string;
  defaultValue?: string;
  expandedKeys?: readonly string[];
  defaultExpandedKeys?: readonly string[];
  disabled?: boolean;
  readOnly?: boolean;
  a11yLabel?: string;
}
export interface TreeItemProps {
  nodeKey?: string;
  parentKey?: string;
  textValue?: string;
  disabled?: boolean;
}
export interface TreeGroupProps {
  nodeKey?: string;
}
export type TreeToggleProps = TreeGroupProps & ButtonProps;
export type TreeRootExposes = CollectionExposes & {
  value: ExposeState<string>;
  invalid: ExposeState<boolean>;
  valueChange: ExposeEvent<{ value: string }>;
  expandedChange: ExposeEvent<{ expandedKeys: string[] }>;
  getTree: ExposeMethod<() => TreeEntry[]>;
  getExpandedKeys: ExposeMethod<() => string[]>;
  refresh: ExposeMethod<() => void>;
  requestValue: ExposeMethod<(key: string) => boolean>;
  requestExpanded: ExposeMethod<(key: string, open: boolean) => boolean>;
};
export type TreeItemExposes = CollectionItemExposes & {
  selected: ExposeState<boolean>;
  expanded: ExposeState<boolean>;
  hidden: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
  level: ExposeState<number>;
  position: ExposeState<number>;
  setSize: ExposeState<number>;
  branch: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  getNode: ExposeMethod<() => TreeNode>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
};
export type TreeGroupExposes = Record<string, never>;
export type TreeToggleExposes = ButtonExposes;
export type TreeRootAsHookContract = {
  state: {
    collectionCount: State<number>;
    value: State<string>;
    invalid: State<boolean>;
    a11yLabel: State<string>;
  };
  event: { valueChange: { value: string }; expandedChange: { expandedKeys: string[] } };
};
export type TreeItemContract = {
  state: {
    collectionIndex: State<number>;
    collectionTotal: State<number>;
    collectionFirst: State<boolean>;
    collectionLast: State<boolean>;
    selected: State<boolean>;
    expanded: State<boolean>;
    hidden: State<boolean>;
    disabled: State<boolean>;
    level: State<number>;
    position: State<number>;
    setSize: State<number>;
    branch: State<boolean>;
    expandedText: State<string>;
    focused: State<boolean>;
    focusVisible: State<boolean>;
  };
};
export type TreeGroupAsHookContract = {};
/** Button is an authored child; its state is not flattened into this frame. */
export type TreeToggleAsHookContract = { asHooks: { 'as-button': ReturnType<typeof asButton> } };
