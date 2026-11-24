import { createImageLoadingDemo } from '../../image-demo.shared';

export default createImageLoadingDemo('brutalist', {
  primaryButtonProps: { variant: 'default', size: 'sm' },
  secondaryButtonProps: { variant: 'neutral', size: 'sm' },
  destructiveButtonProps: { variant: 'coral', size: 'sm' },
  stageClassName: 'relative p-1',
  overlayClassName:
    'hidden absolute inset-1 flex-col items-center justify-center gap-2 rounded-[5px] border-2 border-foreground bg-secondary-background/95 p-4 text-center',
});
