import type {
  ToolbarRootProps,
  ToolbarRootExposes,
  ToolbarButtonProps,
  ToolbarButtonExposes,
  ToolbarSeparatorProps,
  ToolbarSeparatorExposes,
} from '@proto.ui/prototypes-base/toolbar';
import type { ShadcnStyleProps } from '../style-scope';

export type ShadcnToolbarRootVariant = 'default' | 'ghost';
export type ShadcnToolbarButtonVariant =
  | 'ghost'
  | 'outline'
  | 'secondary'
  | 'default'
  | 'destructive';
export type ShadcnToolbarButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export type ShadcnToolbarRootProps = ToolbarRootProps &
  ShadcnStyleProps & {
    variant?: ShadcnToolbarRootVariant;
  };
export type ShadcnToolbarRootExposes = ToolbarRootExposes;
export type ShadcnToolbarButtonProps = ToolbarButtonProps &
  ShadcnStyleProps & {
    variant?: ShadcnToolbarButtonVariant;
    size?: ShadcnToolbarButtonSize;
  };
export type ShadcnToolbarButtonExposes = ToolbarButtonExposes;
export type ShadcnToolbarSeparatorProps = ToolbarSeparatorProps & ShadcnStyleProps;
export type ShadcnToolbarSeparatorExposes = ToolbarSeparatorExposes;
