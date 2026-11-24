import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-3 p-2 text-start',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-text-root',
        rootTag: 'span',
        props: {
          size: '5xl',
          font: 'heading',
          weight: 'bold',
          leading: 'tighter',
          tracking: 'tighter',
        },
        children: ['5xl · Poster Headline'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-text-root',
        rootTag: 'span',
        props: {
          size: '3xl',
          font: 'heading',
          weight: 'bold',
          leading: 'tight',
          tracking: 'tight',
        },
        children: ['3xl · Section Title (DM Sans 700)'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-text-root',
        rootTag: 'span',
        props: { size: 'xl', font: 'heading', weight: 'bold', leading: 'snug' },
        children: ['xl · Card Header'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-text-root',
        rootTag: 'span',
        props: { size: 'base', font: 'body', weight: 'medium', leading: 'normal' },
        children: ['base · Body & control text (DM Sans 500)'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-text-root',
        rootTag: 'span',
        props: { size: 'sm', font: 'body', weight: 'medium', leading: 'size' },
        children: ['sm · 14px / 20px standard control label'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-text-root',
        rootTag: 'span',
        props: { size: 'xs', font: 'body', tone: 'muted', weight: 'medium', leading: 'size' },
        children: ['xs · 12px / 16px compact badge & caption'],
      },
    ],
  },
};

export default demo;
