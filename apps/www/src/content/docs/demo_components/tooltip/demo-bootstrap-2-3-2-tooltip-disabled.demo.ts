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
        ref: 'bsDisabledRoot',
        props: { openDelay: 0, closeDelay: 100 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tooltip-trigger',
            ref: 'bsDisabledTrigger',
            className: 'inline-block w-fit',
            children: [
              {
                kind: 'box',
                tag: 'span',
                attrs: { 'aria-disabled': 'true' },
                className:
                  'inline-flex items-center justify-center rounded-[4px] border border-[#ccc] bg-[#e6e6e6] px-3 py-1 text-[14px] leading-[20px] text-[#333] opacity-65 cursor-not-allowed',
                children: ['Disabled'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-tooltip-content',
            ref: 'bsDisabledContent',
            previewTheme: 'portal',
            props: { side: 'top', align: 'center' },
            children: ['This feature is currently unavailable'],
          },
        ],
      },
    ],
  },
};

export default demo;
