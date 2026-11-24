import type { DemoNode, DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

function brutalistSelect(options: {
  appearance: 'flat' | 'elevated';
  size: 'sm' | 'default';
  placeholder: string;
}): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'brutalist-select-root',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-select-trigger',
        className: 'w-44',
        props: {
          appearance: options.appearance,
          size: options.size,
          accessibleLabel: `${options.appearance} ${options.size} selector`,
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-select-value',
            props: { placeholder: options.placeholder },
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-select-content',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-select-item',
            props: { value: 'wc', textValue: 'Web Components' },
            children: ['Web Components'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-select-item',
            props: { value: 'react', textValue: 'React' },
            children: ['React'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-select-item',
            props: { value: 'vue', textValue: 'Vue' },
            children: ['Vue'],
          },
        ],
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-4',
    children: [
      brutalistSelect({ appearance: 'flat', size: 'default', placeholder: 'Flat default' }),
      brutalistSelect({ appearance: 'elevated', size: 'default', placeholder: 'Elevated default' }),
      brutalistSelect({ appearance: 'elevated', size: 'sm', placeholder: 'Elevated sm' }),
    ],
  },
} satisfies DemoSpec;
