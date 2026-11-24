import type { ProgressRootProps } from '@proto.ui/prototypes-base/progress';

export type BrutalistProgressDirection = 'ltr' | 'rtl';
export type BrutalistProgressRootProps = ProgressRootProps & {
  dir?: BrutalistProgressDirection;
};
