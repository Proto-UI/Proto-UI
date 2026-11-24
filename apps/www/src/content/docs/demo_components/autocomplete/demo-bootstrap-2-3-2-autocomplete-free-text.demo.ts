import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-3 p-4 w-full max-w-md',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-autocomplete-root',
        props: { a11yLabel: 'Issue label' },
        ref: 'root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-autocomplete-input',
            props: {
              placeholder: 'Add or create a tag…',
              a11yLabel: 'Issue label',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-autocomplete-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-autocomplete-item',
                props: { value: 'bug', textValue: 'bug' },
                children: ['bug'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-autocomplete-item',
                props: { value: 'documentation', textValue: 'documentation' },
                children: ['documentation'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-autocomplete-item',
                props: { value: 'enhancement', textValue: 'enhancement' },
                children: ['enhancement'],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-autocomplete-empty',
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
} satisfies DemoSpec;
