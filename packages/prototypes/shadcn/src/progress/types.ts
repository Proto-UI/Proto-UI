import type { ProgressRootProps, ProgressPartProps } from '@proto.ui/prototypes-base/progress';
import type { ShadcnStyleProps } from '../style-scope';

export type ShadcnProgressDirection = 'ltr' | 'rtl';
export type ShadcnProgressRootProps = ProgressRootProps &
  ShadcnStyleProps & {
    dir?: ShadcnProgressDirection;
  };
export type ShadcnProgressPartProps = ProgressPartProps & ShadcnStyleProps;
