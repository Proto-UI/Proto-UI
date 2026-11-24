import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-lg mx-auto min-w-0 p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-accordion-root',
        props: { defaultOpenItems: ['item-1'] },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-accordion-item',
            props: { value: 'item-1' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-accordion-trigger',
                    children: ['Collapsible Group Item #1'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-content',
                children: [
                  'Classic Bootstrap 2.3.2 collapsible panel with smooth 350ms height transitions and single-open selection.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-accordion-item',
            props: { value: 'item-2' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-accordion-trigger',
                    children: ['Collapsible Group Item #2'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-content',
                children: [
                  'Opening this group automatically collapses the previous section in single mode.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-accordion-item',
            props: { value: 'item-3' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-accordion-trigger',
                    children: ['Collapsible Group Item #3'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-content',
                children: [
                  'Supports full WAI-ARIA keyboard navigation with ArrowUp, ArrowDown, Home, and End.',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
