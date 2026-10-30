import type { FieldsetRootProps, FieldsetPartProps } from '@proto.ui/prototypes-base/fieldset';
import type { ShadcnStyleProps } from '../style-scope';
export type ShadcnFieldsetRootProps = FieldsetRootProps & ShadcnStyleProps;
export type ShadcnFieldsetPartProps = FieldsetPartProps & ShadcnStyleProps;
/** Paint-only upstream legend/label scale; it does not create another naming owner. */
export type ShadcnFieldsetLegendProps = ShadcnFieldsetPartProps & { variant?: 'legend' | 'label' };
