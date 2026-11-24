import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-xl grid-cols-1 gap-3 p-2 sm:grid-cols-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-surface-root',
        props: { variant: 'outline', radius: 'lg' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1 p-4 text-start',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'sm', weight: 'semibold', tone: 'default' },
                children: ['Default Ink'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'sm', tone: 'muted' },
                children: ['Muted secondary copy on a neutral surface.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-surface-root',
        props: { variant: 'solid', radius: 'lg', border: 'none' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1 p-4 text-start',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'sm', weight: 'semibold', tone: 'inherit' },
                children: ['Solid Surface · tone="inherit"'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'sm', tone: 'inherit' },
                children: ['Inherits primary-foreground ink automatically.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-surface-root',
        props: { variant: 'accent', radius: 'lg', border: 'none' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1 p-4 text-start',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'sm', weight: 'semibold', tone: 'inherit' },
                children: ['Accent Surface · tone="inherit"'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'sm', tone: 'inherit' },
                children: ['Stays paired with accent-foreground in light and dark mode.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-surface-root',
        props: { variant: 'muted', radius: 'lg', border: 'none' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1 p-4 text-start',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'sm', weight: 'semibold', tone: 'default' },
                children: ['Muted Surface'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'sm', tone: 'muted' },
                children: ['Supports default and muted hierarchy cleanly.'],
              },
            ],
          },
        ],
      },
    ],
  },
};

export default withShadcnRheaDemo(demo);
