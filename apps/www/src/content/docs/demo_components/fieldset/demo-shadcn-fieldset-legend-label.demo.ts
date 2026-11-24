import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import { createFieldsetCheckboxGroupDemo } from './fieldset-demo.shared';

export default withShadcnRheaDemo(
  createFieldsetCheckboxGroupDemo('shadcn', { legendVariant: 'label' })
);
