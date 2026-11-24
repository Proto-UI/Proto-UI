import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const VERSIONS = [
  'v2.3.2 — Final 2.x maintenance release',
  'v2.3.1 — Dropdown & modal focus polish',
  'v2.3.0 — Fluid grid & button states',
  'v2.2.2 — Form validation border fixes',
  'v2.2.1 — Navbar collapse transitions',
  'v2.2.0 — Media object & well styles',
  'v2.1.1 — Popover placement adjustments',
  'v2.1.0 — Submenu & affix utilities',
  'v2.0.4 — Tooltip arrow contrast update',
  'v2.0.3 — Responsive table wrapping',
  'v2.0.2 — Alert banner typography',
  'v2.0.1 — Breadcrumb separator spacing',
] as const;

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex justify-center',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-scroll-area-root',
        className: 'h-60 w-64',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-scroll-area-viewport',
            ref: 'scrollViewport',
            children: [
              {
                kind: 'box',
                className: 'p-3 pr-5 text-xs leading-5',
                children: [
                  {
                    kind: 'box',
                    className: 'mb-2 border-b border-[#ddd] pb-1.5 text-sm font-bold text-[#333]',
                    children: ['Release Archive'],
                  },
                  ...VERSIONS.map((entry) => ({
                    kind: 'box' as const,
                    className: 'border-b border-[#eee] py-1.5 text-[#333]',
                    children: [entry],
                  })),
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-scroll-area-scrollbar',
            ref: 'verticalScrollbar',
            props: { orientation: 'vertical' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-scroll-area-thumb',
                ref: 'verticalThumb',
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
