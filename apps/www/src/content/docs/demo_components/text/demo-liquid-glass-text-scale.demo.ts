import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-3 p-2 text-start',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-text-root',
        rootTag: 'span',
        props: {
          size: '4xl',
          font: 'heading',
          weight: 'bold',
          leading: 'tighter',
          tracking: 'tighter',
        },
        children: ['4xl · Compact Display (leading="tighter")'],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-text-root',
        rootTag: 'span',
        props: {
          size: '2xl',
          font: 'heading',
          weight: 'semibold',
          leading: 'tight',
          tracking: 'tight',
        },
        children: ['2xl · Window & Sheet Heading'],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-text-root',
        rootTag: 'span',
        props: { size: 'lg', font: 'heading', weight: 'semibold', leading: 'size' },
        children: ['lg · Group Title (leading="size")'],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-text-root',
        rootTag: 'span',
        props: { size: 'base', font: 'body', leading: 'normal' },
        children: ['base · System body copy for readable content canvases.'],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-text-root',
        rootTag: 'span',
        props: { size: 'sm', font: 'body', weight: 'medium', leading: 'size' },
        children: ['sm · Control label & toolbar caption'],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-text-root',
        rootTag: 'span',
        props: { size: 'xs', tone: 'muted', leading: 'size' },
        children: ['xs · Footnote & status timestamp'],
      },
    ],
  },
};

export default demo;
