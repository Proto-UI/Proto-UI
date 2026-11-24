import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-3 p-2 text-start',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-text-root',
        rootTag: 'span',
        props: {
          size: '4xl',
          font: 'heading',
          weight: 'bold',
          leading: 'tighter',
          tracking: 'tighter',
        },
        children: ['4xl · Display Heading (leading="tighter")'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-text-root',
        rootTag: 'span',
        props: { size: '3xl', font: 'heading', weight: 'bold', leading: 'tight' },
        children: ['3xl · Page Title'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-text-root',
        rootTag: 'span',
        props: { size: '2xl', font: 'heading', weight: 'bold', leading: 'relaxed' },
        children: ['2xl · Archived 24.5px Scale with 40px Relaxed Line Box'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-text-root',
        rootTag: 'span',
        props: { size: 'xl', font: 'heading', weight: 'semibold', leading: 'size' },
        children: ['xl · Section Subheading (leading="size")'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-text-root',
        rootTag: 'span',
        props: { size: 'base', font: 'body', leading: 'normal' },
        children: ['base · Body copy with classic 20/14 (1.4286) normal leading'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-text-root',
        rootTag: 'span',
        props: { size: 'sm', font: 'body', weight: 'medium', leading: 'size' },
        children: ['sm · Compact form help & table cell copy'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-text-root',
        rootTag: 'span',
        props: { size: 'xs', tone: 'muted', leading: 'size' },
        children: ['xs · Footnote & badge label'],
      },
    ],
  },
};

export default demo;
