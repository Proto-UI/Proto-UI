import type * as Base from '@proto.ui/prototypes-base/command';
import type { ShadcnStyleProps } from '../style-scope';
/** Opt-in website CommandMenu presentation; ordinary registry recipes remain default. */
export type CommandPresentationProps = { presentation?: 'default' | 'menu' };
export type CommandRootProps = Base.CommandRootProps & ShadcnStyleProps & CommandPresentationProps;
export type CommandInputProps = Base.CommandInputProps &
  ShadcnStyleProps &
  CommandPresentationProps;
export type CommandContentProps = Base.CommandContentProps &
  ShadcnStyleProps &
  CommandPresentationProps;
export type CommandItemProps = Base.CommandItemProps & ShadcnStyleProps & CommandPresentationProps;
export type CommandEmptyProps = Base.CommandEmptyProps &
  ShadcnStyleProps &
  CommandPresentationProps;
export type {
  CommandRootExposes,
  CommandInputExposes,
  CommandContentExposes,
  CommandItemExposes,
  CommandEmptyExposes,
} from '@proto.ui/prototypes-base/command';
