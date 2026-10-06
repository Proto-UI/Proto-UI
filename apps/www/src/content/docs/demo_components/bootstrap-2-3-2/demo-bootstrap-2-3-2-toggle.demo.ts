import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

// A Base Toggle in the Bootstrap 2.3.2 design language, not the legacy plugin.
export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        props: { defaultActive: false },
        children: ['Bold'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        props: { defaultActive: true },
        children: ['Italic'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-toggle',
        props: { disabled: true, defaultActive: true },
        children: ['Unavailable'],
      },
    ],
  },
} satisfies DemoSpec;
