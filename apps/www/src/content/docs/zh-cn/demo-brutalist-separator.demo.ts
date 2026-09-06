import type { DemoSetupContext } from '../../../components/PrototypePreviewer/demo-types';

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
    className: 'flex flex-col gap-3',
    children: [
      'Today',
      { kind: 'proto', prototypeId: 'brutalist-separator-root' },
      'Yesterday',
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
};
