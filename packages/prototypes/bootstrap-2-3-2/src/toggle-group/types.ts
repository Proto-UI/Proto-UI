import type {
  ToggleGroupRootProps,
  ToggleGroupRootExposes,
  ToggleGroupItemProps,
  ToggleGroupItemExposes,
} from '@proto.ui/prototypes-base/toggle-group';

export type BootstrapToggleGroupVariant =
  | 'default'
  | 'primary'
  | 'warning'
  | 'danger'
  | 'success'
  | 'info'
  | 'inverse';

export type BootstrapToggleGroupSize = 'default' | 'large' | 'small' | 'mini';

export type BootstrapToggleGroupRootProps = ToggleGroupRootProps & {
  variant?: BootstrapToggleGroupVariant;
  size?: BootstrapToggleGroupSize;
};

export type BootstrapToggleGroupRootExposes = ToggleGroupRootExposes;

export type BootstrapToggleGroupItemProps = ToggleGroupItemProps & {
  variant?: BootstrapToggleGroupVariant;
  size?: BootstrapToggleGroupSize;
};

export type BootstrapToggleGroupItemExposes = ToggleGroupItemExposes;
