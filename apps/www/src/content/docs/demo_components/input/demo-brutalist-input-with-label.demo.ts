import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-sm items-center gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-label-root',
        associations: { controlLabel: 'brutalist-email' },
        children: ['Email'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-input-root',
        associations: { controlLabel: 'brutalist-email' },
        props: {
          placeholder: 'Email',
          inputMode: 'email',
          autoComplete: 'email',
        },
      },
    ],
  },
} satisfies DemoSpec;
