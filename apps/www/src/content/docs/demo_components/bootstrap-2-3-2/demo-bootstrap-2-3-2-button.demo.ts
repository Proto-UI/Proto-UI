import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        ref: 'action',
        props: {},
        children: ['Back'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { variant: 'primary' },
        children: ['Continue'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        props: { disabled: true },
        children: ['Unavailable'],
      },
      {
        kind: 'box',
        ref: 'count',
        attrs: { role: 'status', 'aria-live': 'polite' },
        children: ['0 activations'],
      },
    ],
  },
  setup({ refs, api }) {
    let count = 0;
    const update = () => {
      refs.count.textContent = `${++count} activations`;
    };
    api.setProps('action', { onClick: update });
    const event = (event: Event) => {
      if (event instanceof CustomEvent) update();
    };
    refs.action.addEventListener('click', event);
    return () => refs.action.removeEventListener('click', event);
  },
} satisfies DemoSpec;
