import type { DemoSpec, DemoNode } from '@/components/PrototypePreviewer/demo-types';
export function createRangeReadoutDemo(family: string, component: 'progress' | 'meter'): DemoSpec {
  const atom = (part: string, children: DemoNode['children'] = []): DemoNode => ({
    kind: 'proto',
    prototypeId: `${family}-${component}-${part}`,
    children,
  });
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'grid w-full min-w-0 gap-4 p-4',
      children: [
        {
          ...atom('root', [
            atom('label', ['Completion / measurement · 进度 / 测量']),
            atom('track', [atom('indicator')]),
            atom('value'),
          ]),
          ref: 'range',
          props: { value: 42, min: 0, max: 100, low: 25, high: 75, optimum: 50 },
        },
        {
          kind: 'proto',
          prototypeId: `${family}-button`,
          ref: 'advance',
          children: ['Advance · 增加'],
        },
      ],
    },
    setup({ refs, api }) {
      let value = 42;
      const advance = () => {
        value = (value + 17) % 101;
        api.setProps('range', { value, min: 0, max: 100, low: 25, high: 75, optimum: 50 });
      };
      api.setProps('advance', { onClick: advance });
      const listener = (event: Event) => {
        if (event instanceof CustomEvent && event.target === refs.advance) advance();
      };
      refs.advance.addEventListener('click', listener);
      return () => refs.advance.removeEventListener('click', listener);
    },
  };
}
