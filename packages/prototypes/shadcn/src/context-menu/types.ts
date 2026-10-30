import type * as Base from '@proto.ui/prototypes-base/context-menu';
import type { ShadcnStyleProps } from '../style-scope';
export type ContextMenuRootProps = Base.ContextMenuRootProps & ShadcnStyleProps;
export type ContextMenuTriggerProps = Base.ContextMenuTriggerProps & ShadcnStyleProps;
export type ContextMenuContentProps = Base.ContextMenuContentProps & ShadcnStyleProps;
export type ContextMenuItemProps = Base.ContextMenuItemProps &
  ShadcnStyleProps & {
    inset?: boolean;
    variant?: 'default' | 'destructive';
  };
export type {
  ContextMenuRootExposes,
  ContextMenuTriggerExposes,
  ContextMenuContentExposes,
  ContextMenuItemExposes,
} from '@proto.ui/prototypes-base/context-menu';
