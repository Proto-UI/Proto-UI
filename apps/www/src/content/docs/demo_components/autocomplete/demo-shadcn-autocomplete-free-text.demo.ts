import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-3 p-4 w-full max-w-md',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-autocomplete-root',
        props: { a11yLabel: 'Issue label' },
        ref: 'root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-autocomplete-input',
            props: {
              placeholder: 'Add or create a tag (e.g. "release-blocker")…',
              a11yLabel: 'Issue label',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-autocomplete-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-item',
                props: { value: 'bug', textValue: 'bug', keywords: 'defect error crash' },
                children: ['bug'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-item',
                props: {
                  value: 'documentation',
                  textValue: 'documentation',
                  keywords: 'docs guide',
                },
                children: ['documentation'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-item',
                props: { value: 'enhancement', textValue: 'enhancement', keywords: 'feature' },
                children: ['enhancement'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-item',
                props: { value: 'performance', textValue: 'performance', keywords: 'speed perf' },
                children: ['performance'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-empty',
                children: ['No existing tag — press Enter to create it.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'status',
        className: 'text-xs text-muted-foreground',
        attrs: { 'aria-live': 'polite' },
        children: ['Type any custom tag and press Enter to submit free text.'],
      },
    ],
  },
  setup({ refs, api }) {
    api.setProps('root', {
      onValueChange: (detail: { textValue: string }) => {
        refs.status.textContent = `Submitted tag: ${detail.textValue}`;
      },
    });
  },
} satisfies DemoSpec);
