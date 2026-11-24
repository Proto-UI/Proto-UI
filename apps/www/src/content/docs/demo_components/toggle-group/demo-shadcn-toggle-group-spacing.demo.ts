import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-col items-start gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-toggle-group-root',
        props: {
          size: 'sm',
          variant: 'outline',
          spacing: 2,
          defaultValue: ['top'],
          a11yLabel: 'Spaced position selector',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-toggle-group-item',
            props: { value: 'top' },
            children: ['Top'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toggle-group-item',
            props: { value: 'bottom' },
            children: ['Bottom'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toggle-group-item',
            props: { value: 'left' },
            children: ['Left'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toggle-group-item',
            props: { value: 'right' },
            children: ['Right'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-toggle-group-root',
        props: {
          size: 'sm',
          variant: 'outline',
          spacing: 0,
          defaultValue: ['top'],
          a11yLabel: 'Joined position selector',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-toggle-group-item',
            props: { value: 'top' },
            children: ['Top'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toggle-group-item',
            props: { value: 'bottom' },
            children: ['Bottom'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toggle-group-item',
            props: { value: 'left' },
            children: ['Left'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-toggle-group-item',
            props: { value: 'right' },
            children: ['Right'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
