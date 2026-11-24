import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
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
    ],
  },
} satisfies DemoSpec;
