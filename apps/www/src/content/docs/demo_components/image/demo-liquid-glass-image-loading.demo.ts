import { createImageLoadingDemo } from '../../image-demo.shared';

export default createImageLoadingDemo('liquid-glass', {
  imageProps: { radius: 'lg' },
  primaryButtonProps: { variant: 'prominent', material: 'auto' },
  secondaryButtonProps: { variant: 'regular', material: 'auto' },
  destructiveButtonProps: { variant: 'regular', material: 'opaque' },
  containerClassName:
    'flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
  stageClassName: 'relative overflow-hidden rounded-xl bg-background/80 p-1',
  overlayClassName:
    'hidden absolute inset-1 flex-col items-center justify-center gap-2 rounded-lg bg-background/95 p-4 text-center',
});
