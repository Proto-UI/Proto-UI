import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec, DemoNode } from '@/components/PrototypePreviewer/demo-types';

function presetRow(label: string, styleProfile: string): DemoNode {
  return {
    kind: 'box',
    className: 'grid justify-items-start gap-1.5',
    children: [
      {
        kind: 'box',
        tag: 'span',
        className: 'text-xs font-medium text-muted-foreground',
        children: [label],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-menubar-root',
        props: { styleProfile, a11yLabel: `${label} menubar` },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-menubar-trigger',
            props: { value: 'file' },
            children: ['File'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-menubar-content',
            props: { value: 'file', a11yLabel: `${label} file menu` },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'new', textValue: 'New File' },
                children: ['New File'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'save', textValue: 'Save' },
                children: ['Save'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-menubar-trigger',
            props: { value: 'edit' },
            children: ['Edit'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-menubar-content',
            props: { value: 'edit', a11yLabel: `${label} edit menu` },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'undo', textValue: 'Undo' },
                children: ['Undo'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-menubar-item',
                props: { value: 'redo', textValue: 'Redo' },
                children: ['Redo'],
              },
            ],
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
    className: 'min-w-0 grid gap-4 p-4 sm:grid-cols-2',
    children: [
      presetRow('rhea', 'rhea'),
      presetRow('new-york-v4', 'new-york-v4'),
      presetRow('nova', 'nova'),
      presetRow('maia', 'maia'),
      presetRow('lyra', 'lyra'),
      presetRow('mira', 'mira'),
    ],
  },
} satisfies DemoSpec);
