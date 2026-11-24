import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

function densityCard(
  size: 'default' | 'sm',
  title: string,
  description: string,
  body: string
): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'shadcn-card-root',
    props: { size },
    className: 'w-full',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-header',
        props: { divider: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            props: { size: 'base', weight: 'medium', tone: 'inherit' },
            children: [title],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            props: { size: 'sm', tone: 'muted' },
            children: [description],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-content',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            props: { size: 'sm', tone: 'inherit' },
            children: [body],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-card-footer',
        props: { divider: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            props: { variant: 'outline', size: 'sm' },
            children: ['Open details'],
          },
        ],
      },
    ],
  };
}

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-2xl items-start gap-5 md:grid-cols-2',
    children: [
      densityCard(
        'default',
        'Default density',
        'size="default" · 20px section inset & gap',
        'Balanced rhythm for primary feature cards, forms, and editorial summaries.'
      ),
      densityCard(
        'sm',
        'Compact density',
        'size="sm" · 16px section inset & gap',
        'Tighter spacing for sidebar widgets, checklists, and high-density dashboards.'
      ),
    ],
  },
} satisfies DemoSpec);
