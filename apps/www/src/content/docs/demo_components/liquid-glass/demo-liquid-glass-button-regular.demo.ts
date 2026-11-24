import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex flex-wrap items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      { kind: 'proto', prototypeId: 'liquid-glass-button', children: ['Back'] },
      { kind: 'proto', prototypeId: 'liquid-glass-button', children: ['Details'] },
      { kind: 'proto', prototypeId: 'liquid-glass-button', children: ['Share'] },
    ],
  },
} satisfies DemoSpec;
