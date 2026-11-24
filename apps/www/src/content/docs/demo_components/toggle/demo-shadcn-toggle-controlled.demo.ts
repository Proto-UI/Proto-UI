import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-toggle',
        ref: 'controlled',
        props: { variant: 'outline', active: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-bold-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none',
            props: { size: 16 },
          },
          'Bold',
        ],
      },
      {
        kind: 'box',
        tag: 'span',
        ref: 'state',
        className: 'text-sm text-muted-foreground',
        attrs: { role: 'status', 'aria-live': 'polite' },
        children: ['Bold: On'],
      },
    ],
  },
  setup({ refs, api }) {
    let active = true;
    const sync = () => {
      api.setProps('controlled', {
        active,
        onActiveChange: (detail: { active: boolean }) => {
          active = detail.active;
          sync();
        },
      });
      if (refs.state) {
        refs.state.textContent = active ? 'Bold: On' : 'Bold: Off';
      }
    };
    sync();
  },
};

export default withShadcnRheaDemo(demo);
