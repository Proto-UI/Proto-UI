import type * as Base from '@proto.ui/prototypes-base/menubar';
import type { ShadcnStyleProps } from '../style-scope';
export type MenubarRootProps = Base.MenubarRootProps & ShadcnStyleProps;
export type MenubarTriggerProps = Base.MenubarTriggerProps & ShadcnStyleProps;
export type MenubarContentProps = Base.MenubarContentProps & ShadcnStyleProps;
export type MenubarItemProps = Base.MenubarItemProps &
  ShadcnStyleProps & {
    inset?: boolean;
    variant?: 'default' | 'destructive';
  };
export type {
  MenubarRootExposes,
  MenubarTriggerExposes,
  MenubarContentExposes,
  MenubarItemExposes,
} from '@proto.ui/prototypes-base/menubar';
