import { createImageA11yDemo } from '../../image-demo.shared';

export default createImageA11yDemo('liquid-glass', {
  informativeProps: { radius: 'lg' },
  decorativeProps: { radius: 'lg' },
  cardClassName: 'rounded-xl bg-background/85 p-3 shadow-xs',
  containerClassName: 'flex w-full max-w-xl flex-col gap-4',
});
