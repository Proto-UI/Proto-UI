import type * as Base from '@proto.ui/prototypes-base/command';
import type { ShadcnStyleProps } from '../style-scope';
export type CommandRootProps = Base.CommandRootProps & ShadcnStyleProps;
export type CommandInputProps = Base.CommandInputProps & ShadcnStyleProps;
export type CommandContentProps = Base.CommandContentProps & ShadcnStyleProps;
export type CommandItemProps = Base.CommandItemProps & ShadcnStyleProps;
export type CommandEmptyProps = Base.CommandEmptyProps & ShadcnStyleProps;
export type {
  CommandRootExposes,
  CommandInputExposes,
  CommandContentExposes,
  CommandItemExposes,
  CommandEmptyExposes,
} from '@proto.ui/prototypes-base/command';
