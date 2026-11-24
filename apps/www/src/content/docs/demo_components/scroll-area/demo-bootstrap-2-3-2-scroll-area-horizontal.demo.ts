import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const THUMBNAILS = [
  { title: 'Grid Layout', subtitle: '12-column classic', tone: 'bg-[#d9edf7] text-[#3a87ad]' },
  { title: 'Hero Unit', subtitle: 'Lead callout', tone: 'bg-[#f5f5f5] text-[#333]' },
  { title: 'Alert States', subtitle: 'Warning & info', tone: 'bg-[#fcf8e3] text-[#c09853]' },
  { title: 'Form Controls', subtitle: 'Prepended inputs', tone: 'bg-[#dff0d8] text-[#468847]' },
] as const;

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-96',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-scroll-area-root',
        className: 'w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-scroll-area-viewport',
            ref: 'scrollViewport',
            children: [
              {
                kind: 'box',
                className: 'flex w-max gap-3 p-3 pb-5',
                children: THUMBNAILS.map((item) => ({
                  kind: 'box' as const,
                  className:
                    'w-36 shrink-0 rounded-[4px] border border-[#ddd] bg-[#fff] p-1.5 shadow-xs',
                  children: [
                    {
                      kind: 'box' as const,
                      className: `flex h-24 items-center justify-center rounded-[3px] ${item.tone} text-xs font-bold`,
                      children: [item.title],
                    },
                    {
                      kind: 'box' as const,
                      className: 'px-1 pt-2 text-xs text-[#555]',
                      children: [item.subtitle],
                    },
                  ],
                })),
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-scroll-area-scrollbar',
            ref: 'horizontalScrollbar',
            props: { orientation: 'horizontal' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-scroll-area-thumb',
                ref: 'horizontalThumb',
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
