import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: '',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-8 liquid-functional-demo',
        children: [
          { kind: 'proto', prototypeId: 'liquid-glass-toggle', ref: 'bold', children: ['Bold'] },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle',
            ref: 'italic',
            props: { defaultActive: true },
            children: ['Italic'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle',
            ref: 'opaque',
            props: { material: 'opaque' },
            children: ['Opaque'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-toggle',
            ref: 'disabled',
            props: { defaultActive: true, disabled: true },
            children: ['Disabled'],
          },
          {
            kind: 'box',
            ref: 'count',
            attrs: { role: 'status', 'aria-live': 'polite' },
            children: ['0 activeChange requests'],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    let requests = 0;
    api.setProps('bold', {
      onActiveChange: () => {
        refs.count.textContent = `${++requests} activeChange requests`;
      },
    });
  },
} satisfies DemoSpec;
