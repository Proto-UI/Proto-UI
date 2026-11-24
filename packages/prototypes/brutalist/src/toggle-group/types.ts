import type {
  ToggleGroupRootProps,
  ToggleGroupRootExposes,
  ToggleGroupItemProps,
  ToggleGroupItemExposes,
} from '@proto.ui/prototypes-base/toggle-group';

export type BrutalistToggleGroupVariant = 'default' | 'outline';
export type BrutalistToggleGroupSize = 'default' | 'sm' | 'lg';
export type BrutalistToggleGroupSpacing = 0 | 1 | 2;

export type BrutalistToggleGroupRootProps = ToggleGroupRootProps & {
  variant?: BrutalistToggleGroupVariant;
  size?: BrutalistToggleGroupSize;
  /** Gap spacing between items (`0` joins items into a segmented bar, `1` default, `2` wide). */
  spacing?: BrutalistToggleGroupSpacing;
};

export type BrutalistToggleGroupRootExposes = ToggleGroupRootExposes;

export type BrutalistToggleGroupItemProps = ToggleGroupItemProps & {
  variant?: BrutalistToggleGroupVariant;
  size?: BrutalistToggleGroupSize;
};

export type BrutalistToggleGroupItemExposes = ToggleGroupItemExposes;
