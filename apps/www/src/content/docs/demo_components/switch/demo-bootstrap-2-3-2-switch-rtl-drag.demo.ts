import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-sm gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-field-root',
        className: 'flex flex-row items-center justify-between gap-4',
        children: [
          {
            kind: 'box',
            className: 'flex min-w-0 flex-1 flex-col gap-1',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-field-label',
                children: ['Draggable switch'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-field-description',
                children: ['Hold and drag the thumb across the track, then release to toggle.'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-field-switch',
            props: { draggable: true, defaultChecked: false },
            children: [{ kind: 'proto', prototypeId: 'bootstrap-2-3-2-switch-thumb' }],
          },
        ],
      },
      {
        kind: 'box',
        attrs: { dir: 'rtl' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-field-root',
            className: 'flex flex-row items-center justify-between gap-4',
            children: [
              {
                kind: 'box',
                className: 'flex min-w-0 flex-1 flex-col gap-1',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-field-label',
                    children: ['المشاركة عبر الأجهزة'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-field-description',
                    children: [
                      'يتم مشاركة التركيز عبر الأجهزة، ويتم إيقاف تشغيله عند مغادرة التطبيق.',
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-field-switch',
                props: { direction: 'rtl', draggable: true, defaultChecked: true },
                children: [{ kind: 'proto', prototypeId: 'bootstrap-2-3-2-switch-thumb' }],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
