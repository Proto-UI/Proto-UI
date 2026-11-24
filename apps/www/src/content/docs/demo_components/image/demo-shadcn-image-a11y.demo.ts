import { createImageA11yDemo } from '../../image-demo.shared';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo(
  createImageA11yDemo('shadcn', {
    informativeProps: { radius: 'lg' },
    decorativeProps: { radius: 'md' },
  })
);
