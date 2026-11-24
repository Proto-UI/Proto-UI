import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const PARAGRAPHS = [
  'Bootstrap 2.3.2 modals slide downward from -25% to 10% of the viewport height with a 300ms ease-out transition.',
  'The modal backdrop fades in over 150ms to 80% black opacity while keeping keyboard focus inside the active dialog.',
  'A 15px padded body region lets long release notes or configuration summaries scroll without shifting the modal header.',
  'Header titles keep crisp 1px bottom dividers and right-side clearance for the classic close icon.',
  'Press Escape or click the backdrop at any time to dismiss the modal and restore focus to the opener.',
  'All interactive semantics remain owned by Base Dialog across Web Components, React, and Vue runtimes.',
];

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 items-start p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-dialog-root',
        ref: 'root',
        props: { a11yLabel: 'Scrollable content' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-dialog-trigger',
            ref: 'trigger',
            children: ['Scrollable Content'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-dialog-mask',
            ref: 'mask',
            previewTheme: 'portal',
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-dialog-content',
            ref: 'content',
            previewTheme: 'portal',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dialog-header',
                ref: 'header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-dialog-title',
                    ref: 'title',
                    children: ['Scrollable Content'],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'max-h-[45vh] overflow-y-auto px-[15px] py-[15px] grid gap-3 text-sm leading-relaxed',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-dialog-description',
                    ref: 'description',
                    children: ['Long body text scrolls cleanly inside the 560px classic modal frame.'],
                  },
                  ...PARAGRAPHS.map((text) => ({ kind: 'box' as const, children: [text] })),
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dialog-close-icon',
                ref: 'closeIcon',
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
