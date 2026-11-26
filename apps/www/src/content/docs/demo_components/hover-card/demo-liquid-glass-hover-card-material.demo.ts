import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-6',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-hover-card-root',
        props: { openDelay: 100, closeDelay: 150 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-hover-card-trigger',
            children: ['Regular glass'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-hover-card-content',
            props: {
              side: 'bottom',
              align: 'center',
              sideOffset: 8,
              variant: 'regular',
              material: 'auto',
            },
            children: [
              {
                kind: 'box',
                className: 'flex flex-col gap-1',
                children: [
                  { kind: 'box', className: 'font-semibold', children: ['Regular Surface'] },
                  {
                    kind: 'box',
                    className: 'text-muted-foreground',
                    children: ['Default floating translucency with concentric inner corner radii.'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-hover-card-root',
        props: { openDelay: 100, closeDelay: 150 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-hover-card-trigger',
            children: ['Prominent tint'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-hover-card-content',
            props: {
              side: 'bottom',
              align: 'center',
              sideOffset: 8,
              variant: 'prominent',
              material: 'auto',
            },
            children: [
              {
                kind: 'box',
                className: 'flex flex-col gap-1',
                children: [
                  { kind: 'box', className: 'font-semibold', children: ['Prominent Surface'] },
                  {
                    kind: 'box',
                    className: 'opacity-90',
                    children: ['Selective tinted prominence for primary callout previews.'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-hover-card-root',
        props: { openDelay: 100, closeDelay: 150 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-hover-card-trigger',
            children: ['Opaque fallback'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-hover-card-content',
            props: {
              side: 'bottom',
              align: 'center',
              sideOffset: 8,
              variant: 'regular',
              material: 'opaque',
            },
            children: [
              {
                kind: 'box',
                className: 'flex flex-col gap-1',
                children: [
                  { kind: 'box', className: 'font-semibold', children: ['Opaque Surface'] },
                  {
                    kind: 'box',
                    className: 'text-muted-foreground',
                    children: ['Opts out of optical glass while keeping crisp contrast and depth.'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
