import { createImageFitDemo } from '../../image-demo.shared';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo(
  createImageFitDemo('shadcn', {
    imageProps: { radius: 'lg' },
  })
);
