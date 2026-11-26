import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

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
        props: { a11yLabel: 'Edit profile' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dialog-trigger',
            ref: 'trigger',
            children: ['Open Dialog'],
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
                    children: ['Edit profile'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dialog-description',
                    ref: 'description',
                    children: ["Make changes to your profile here. Click save when you're done."],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'grid gap-3',
                children: [
                  {
                    kind: 'box',
                    className:
                      'rounded-xl border border-border bg-background/60 px-3.5 py-2.5 grid gap-0.5',
                    children: [
                      {
                        kind: 'box',
                        tag: 'span',
                        className: 'text-xs font-medium text-muted-foreground',
                        children: ['Name'],
                      },
                      {
                        kind: 'box',
                        tag: 'span',
                        className: 'text-sm font-medium',
                        children: ['Pedro Duarte'],
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className:
                      'rounded-xl border border-border bg-background/60 px-3.5 py-2.5 grid gap-0.5',
                    children: [
                      {
                        kind: 'box',
                        tag: 'span',
                        className: 'text-xs font-medium text-muted-foreground',
                        children: ['Username'],
                      },
                      {
                        kind: 'box',
                        tag: 'span',
                        className: 'text-sm font-medium',
                        children: ['@peduarte'],
                      },
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
                    ref: 'cancel',
                    props: { prominence: 'regular' },
                    children: ['Cancel'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dialog-close',
                    ref: 'save',
                    props: { prominence: 'prominent' },
                    children: ['Save changes'],
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
