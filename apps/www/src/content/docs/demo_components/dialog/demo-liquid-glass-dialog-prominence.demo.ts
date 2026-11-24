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
        props: { a11yLabel: 'Delete workspace' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-dialog-trigger',
            ref: 'trigger',
            props: { prominence: 'prominent' },
            children: ['Delete Workspace'],
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
                    children: ['Delete workspace?'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dialog-description',
                    ref: 'description',
                    children: [
                      'This removes local previews and archived builds from this device. Keep primary and destructive actions clearly differentiated inside the glass sheet.',
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
                    children: ['Keep Workspace'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'liquid-glass-dialog-close',
                    ref: 'delete',
                    props: { prominence: 'destructive' },
                    children: ['Delete'],
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
