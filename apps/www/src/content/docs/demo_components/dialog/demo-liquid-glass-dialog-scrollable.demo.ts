import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const NOTES = [
  '1. A translucent glass sheet floats above the dimmed backdrop without nesting additional glass surfaces on inner action pills.',
  '2. Concentric rounded-full pills align smoothly inside the rounded-2xl sheet padding.',
  '3. Long reading regions scroll inside a bounded container so title hierarchy and bottom controls stay anchored.',
  '4. Motion respects prefers-reduced-motion while keeping focus trapping and Escape dismissal intact.',
  '5. Reduced transparency and high-contrast environments automatically fall back to the crisp secondary surface pair.',
  '6. Keyboard focus rings remain legible in both light and dark color schemes.',
];

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 items-start',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-dialog-root',
        ref: 'root',
        props: { a11yLabel: 'Scrollable sheet' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dialog-trigger',
            ref: 'trigger',
            children: ['Scrollable Content'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dialog-mask',
            ref: 'mask',
            previewTheme: 'portal',
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dialog-content',
            ref: 'content',
            previewTheme: 'portal',
            children: [
              {
                kind: 'box',
                className: 'grid gap-1.5',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dialog-title',
                    ref: 'title',
                    children: ['Material guidelines'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dialog-description',
                    ref: 'description',
                    children: [
                      'Scrollable content stays readable while footer controls remain fixed below.',
                    ],
                  },
                ],
              },
              {
                kind: 'box',
                className:
                  'max-h-[42vh] overflow-y-auto pr-2 grid gap-2.5 text-sm leading-relaxed text-muted-foreground',
                children: NOTES.map((item) => ({ kind: 'box' as const, children: [item] })),
              },
              {
                kind: 'box',
                className: 'flex flex-wrap items-center justify-end gap-2 pt-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dialog-close',
                    ref: 'done',
                    props: { prominence: 'prominent' },
                    children: ['Done'],
                  },
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
