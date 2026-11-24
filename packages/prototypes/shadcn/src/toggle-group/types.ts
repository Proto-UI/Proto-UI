import type {
  ToggleGroupRootProps,
  ToggleGroupRootExposes,
  ToggleGroupItemProps,
  ToggleGroupItemExposes,
} from '@proto.ui/prototypes-base/toggle-group';
import type { ShadcnStyleProps } from '../style-scope';
import type { ShadcnToggleSize, ShadcnToggleVariant } from '../toggle/types';

export type ShadcnToggleGroupSpacing = 0 | 1 | 2;

export type ShadcnToggleGroupRootProps = ToggleGroupRootProps &
  ShadcnStyleProps & {
    variant?: ShadcnToggleVariant;
    size?: ShadcnToggleSize;
    /** Explicit gap spacing between items (`0` joins items, `2` separates them). */
    spacing?: ShadcnToggleGroupSpacing;
  };
export type ShadcnToggleGroupRootExposes = ToggleGroupRootExposes;
export type ShadcnToggleGroupItemProps = ToggleGroupItemProps &
  ShadcnStyleProps & {
    variant?: ShadcnToggleVariant;
    size?: ShadcnToggleSize;
  };
export type ShadcnToggleGroupItemExposes = ToggleGroupItemExposes;
