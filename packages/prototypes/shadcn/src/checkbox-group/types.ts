import type {
  CheckboxGroupRootProps,
  CheckboxGroupItemProps,
} from '@proto.ui/prototypes-base/checkbox-group';
import type { ShadcnStyleProps } from '../style-scope';

export type ShadcnCheckboxGroupOrientation = 'vertical' | 'horizontal';
export type ShadcnCheckboxGroupRootProps = CheckboxGroupRootProps &
  ShadcnStyleProps & {
    orientation?: ShadcnCheckboxGroupOrientation;
  };
export type ShadcnCheckboxGroupItemProps = CheckboxGroupItemProps & ShadcnStyleProps;
