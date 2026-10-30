export { default as toolbarRoot, default as shadcnToolbarRoot } from './root.proto';
export { default as toolbarButton, default as shadcnToolbarButton } from './button.proto';
export { default as toolbarSeparator, default as shadcnToolbarSeparator } from './separator.proto';
export { default } from './root.proto';
export type * from './types';
export type {
  ShadcnToolbarRootProps as ToolbarRootProps,
  ShadcnToolbarButtonProps as ToolbarButtonProps,
  ShadcnToolbarSeparatorProps as ToolbarSeparatorProps,
} from './types';
export type {
  ToolbarRootExposes,
  ToolbarButtonExposes,
  ToolbarSeparatorExposes,
} from '@proto.ui/prototypes-base/toolbar';
