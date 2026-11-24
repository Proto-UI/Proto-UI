import type * as Base from '@proto.ui/prototypes-base/autocomplete';
import type { ShadcnStyleProps } from '../style-scope';

export type AutocompleteRootProps = Base.AutocompleteRootProps & ShadcnStyleProps;
export type AutocompleteInputProps = Base.AutocompleteInputProps &
  ShadcnStyleProps & {
    size?: 'sm' | 'default' | 'lg';
    invalid?: boolean;
  };
export type AutocompleteTriggerProps = Base.AutocompleteTriggerProps &
  ShadcnStyleProps & {
    size?: 'default' | 'icon';
  };
export type AutocompleteContentProps = Base.AutocompleteContentProps & ShadcnStyleProps;
export type AutocompleteItemProps = Base.AutocompleteItemProps & ShadcnStyleProps;
export type AutocompleteEmptyProps = Base.AutocompleteEmptyProps & ShadcnStyleProps;

export type {
  AutocompleteRootExposes,
  AutocompleteInputExposes,
  AutocompleteTriggerExposes,
  AutocompleteContentExposes,
  AutocompleteItemExposes,
  AutocompleteEmptyExposes,
} from '@proto.ui/prototypes-base/autocomplete';
