import type {
  FieldRootProps,
  FieldControlProps,
  FieldLabelProps,
  FieldDescriptionProps,
  FieldErrorProps,
  FieldValidityProps,
} from '@proto.ui/prototypes-base/field';
import type { ShadcnStyleProps } from '../style-scope';

export type ShadcnFieldRootProps = FieldRootProps & ShadcnStyleProps;
export type ShadcnFieldControlProps = FieldControlProps & ShadcnStyleProps;
export type ShadcnFieldLabelProps = FieldLabelProps & ShadcnStyleProps;
export type ShadcnFieldDescriptionProps = FieldDescriptionProps & ShadcnStyleProps;
export type ShadcnFieldErrorProps = FieldErrorProps & ShadcnStyleProps;
export type ShadcnFieldValidityProps = FieldValidityProps & ShadcnStyleProps;
