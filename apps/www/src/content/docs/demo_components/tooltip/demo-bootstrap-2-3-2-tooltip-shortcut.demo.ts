import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 items-center justify-center p-8',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-tooltip-root',
        ref: 'bsShortcutRoot',
        props: { openDelay: 0, closeDelay: 100 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tooltip-trigger',
            ref: 'bsShortcutTrigger',
            className:
              'inline-flex items-center justify-center rounded-[4px] border border-[#ccc] bg-[#f5f5f5] px-3 py-1 text-[14px] leading-[20px] text-[#333] shadow-xs hover:bg-[#e6e6e6]',
            children: ['Save'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tooltip-content',
            ref: 'bsShortcutContent',
            previewTheme: 'portal',
            props: { side: 'top', align: 'center' },
            children: [
              'Save Changes',
              {
                kind: 'box',
                tag: 'span',
                className:
                  'inline-flex h-4 min-w-4 items-center justify-center rounded-[2px] border border-white/30 bg-white/15 px-1 font-mono text-[10px] leading-none text-white',
                children: ['S'],
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
