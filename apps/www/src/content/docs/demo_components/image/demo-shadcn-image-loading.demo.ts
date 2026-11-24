import { createImageLoadingDemo } from '../../image-demo.shared';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo(
  createImageLoadingDemo('shadcn', {
    imageProps: { radius: 'none' },
    primaryButtonProps: { size: 'sm', variant: 'default' },
    secondaryButtonProps: { size: 'sm', variant: 'outline' },
    destructiveButtonProps: { size: 'sm', variant: 'destructive' },
  })
);
