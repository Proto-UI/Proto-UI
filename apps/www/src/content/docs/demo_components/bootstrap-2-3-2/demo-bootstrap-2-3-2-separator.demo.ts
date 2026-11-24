import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'flex w-full max-w-sm flex-col gap-4 rounded border border-[#e3e3e3] bg-[#f5f5f5] p-4 text-sm text-[#333333]',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-1',
        children: [
          {
            kind: 'box',
            className: 'leading-none font-bold text-[#333333]',
            children: ['Proto UI'],
          },
          {
            kind: 'box',
            className: 'text-[#666666]',
            children: ['The foundation for your design system.'],
          },
        ],
      },
      { kind: 'proto', prototypeId: 'bootstrap-2-3-2-separator-root' },
      {
        kind: 'box',
        children: [
          'A set of portable component protocols that you can customize, extend, and build on.',
        ],
      },
    ],
  },
} satisfies DemoSpec;
