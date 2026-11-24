import type { DemoSetupContext, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

function setupSeparatorDemo({ host, api }: DemoSetupContext) {
  const onOrientationChange = (event: Event) => {
    const orientation = (event as CustomEvent<{ orientation?: 'horizontal' | 'vertical' }>).detail
      ?.orientation;
    if (orientation === 'horizontal' || orientation === 'vertical') {
      api.setProps('dynamic-separator', { orientation });
    }
  };
  host.addEventListener('proto-ui-test:separator-orientation', onOrientationChange);
  host.setAttribute('data-separator-demo-ready', 'true');
  return () => {
    host.removeEventListener('proto-ui-test:separator-orientation', onOrientationChange);
    host.removeAttribute('data-separator-demo-ready');
  };
}

export default {
  type: 'demo',
  setup: setupSeparatorDemo,
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm flex-col gap-4 text-sm',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-1.5',
        children: [
          {
            kind: 'box',
            className: 'leading-none font-bold',
            children: ['Proto UI'],
          },
          {
            kind: 'box',
            className: 'text-muted-foreground',
            children: ['The foundation for your design system.'],
          },
        ],
      },
      { kind: 'proto', prototypeId: 'brutalist-separator-root' },
      {
        kind: 'box',
        children: [
          'A set of portable component protocols that you can customize, extend, and build on.',
        ],
      },
      {
        kind: 'box',
        className: 'flex items-stretch gap-3 h-12',
        children: [
          'Vertical',
          {
            kind: 'proto',
            prototypeId: 'brutalist-separator-root',
            ref: 'dynamic-separator',
            props: { orientation: 'vertical' },
          },
          'Rule',
        ],
      },
    ],
  },
} satisfies DemoSpec;
