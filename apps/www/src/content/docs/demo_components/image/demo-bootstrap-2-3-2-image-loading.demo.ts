import { createImageLoadingDemo } from '../../image-demo.shared';

export default createImageLoadingDemo('bootstrap-2-3-2', {
  imageProps: { appearance: 'polaroid' },
  primaryButtonProps: { variant: 'primary', size: 'small' },
  secondaryButtonProps: { variant: 'default', size: 'small' },
  destructiveButtonProps: { variant: 'danger', size: 'small' },
  stageClassName: 'relative overflow-hidden rounded bg-muted/40 p-1',
  overlayClassName:
    'hidden absolute inset-1 flex-col items-center justify-center gap-2 rounded border border-border bg-background/95 p-4 text-center',
});
