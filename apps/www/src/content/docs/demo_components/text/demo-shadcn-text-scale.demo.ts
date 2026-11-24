import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-3 p-2 text-start',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-text-root',
        rootTag: 'span',
        props: {
          size: '5xl',
          font: 'heading',
          weight: 'bold',
          leading: 'tighter',
          tracking: 'tighter',
        },
        children: ['5xl · Display Title'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-text-root',
        rootTag: 'span',
        props: {
          size: '4xl',
          font: 'heading',
          weight: 'bold',
          leading: 'tight',
          tracking: 'tight',
        },
        children: ['4xl · Page Heading'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-text-root',
        rootTag: 'span',
        props: {
          size: '3xl',
          font: 'heading',
          weight: 'semibold',
          leading: 'tight',
          tracking: 'tight',
        },
        children: ['3xl · Section Heading'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-text-root',
        rootTag: 'span',
        props: {
          size: '2xl',
          font: 'heading',
          weight: 'semibold',
          leading: 'snug',
          tracking: 'tight',
        },
        children: ['2xl · Subsection Heading'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-text-root',
        rootTag: 'span',
        props: { size: 'xl', font: 'heading', weight: 'semibold', leading: 'size' },
        children: ['xl · Card Title'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-text-root',
        rootTag: 'span',
        props: { size: 'lg', weight: 'semibold', leading: 'size' },
        children: ['lg · Large Callout'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-text-root',
        rootTag: 'span',
        props: { size: 'base', weight: 'normal', leading: 'normal' },
        children: ['base · Default body copy for paragraphs and descriptions.'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-text-root',
        rootTag: 'span',
        props: { size: 'sm', weight: 'medium', leading: 'size' },
        children: ['sm · Compact control label & metadata'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-text-root',
        rootTag: 'span',
        props: { size: 'xs', tone: 'muted', leading: 'size' },
        children: ['xs · Caption, badge, and keyboard hint'],
      },
    ],
  },
};

export default withShadcnRheaDemo(demo);
