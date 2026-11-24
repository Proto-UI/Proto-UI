import type {
  FormRootProps,
  FormFieldProps,
  FormActionProps,
} from '@proto.ui/prototypes-base/form';
import type { ShadcnStyleProps } from '../style-scope';

export type ShadcnFormActionVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost';
export type ShadcnFormActionSize = 'default' | 'sm' | 'lg';

export type ShadcnFormRootProps = FormRootProps & ShadcnStyleProps;
export type ShadcnFormFieldProps = FormFieldProps & ShadcnStyleProps;
export type ShadcnFormActionProps = FormActionProps &
  ShadcnStyleProps & {
    variant?: ShadcnFormActionVariant;
    size?: ShadcnFormActionSize;
  };
