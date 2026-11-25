import { createImageFitDemo } from '../../image-demo.shared';

export default createImageFitDemo('liquid-glass', {
  imageProps: { radius: 'lg' },
  frameClassName: 'overflow-hidden rounded-xl bg-background/70 p-1',
  containerClassName: 'grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3',
});
