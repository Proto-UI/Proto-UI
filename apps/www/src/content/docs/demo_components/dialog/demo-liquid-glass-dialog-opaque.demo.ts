import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 flex min-w-0 items-start',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-dialog-root',
        ref: 'root',
        props: { a11yLabel: 'Opaque surface dialog' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dialog-trigger',
            ref: 'trigger',
            children: ['Opaque Material'],
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
            props: { material: 'opaque' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-1.5',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dialog-title',
                    ref: 'title',
                    children: ['Opaque surface opt-out'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dialog-description',
                    ref: 'description',
                    children: [
                      'Set material="opaque" on the content surface when dense text or data requires a solid background over busy backdrops.',
                    ],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'flex flex-wrap items-center justify-end gap-2 pt-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dialog-close',
                    ref: 'close',
                    props: { prominence: 'regular' },
                    children: ['Close'],
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
