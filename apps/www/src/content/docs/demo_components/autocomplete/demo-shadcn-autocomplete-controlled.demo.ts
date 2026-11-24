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
        props: {
          defaultValue: 'Astro',
          defaultInputValue: 'Astro',
          loop: false,
          a11yLabel: 'Timezone',
        },
        ref: 'root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-autocomplete-input',
            props: {
              placeholder: 'Filter regions…',
              a11yLabel: 'Region',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-autocomplete-trigger',
            children: ['Regions'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-autocomplete-content',
            props: { side: 'bottom', align: 'start', sideOffset: 6 },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-item',
                props: { value: 'us-east', textValue: 'US East (Virginia)', keywords: 'iad aws' },
                children: ['US East (Virginia)'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-item',
                props: {
                  value: 'eu-west',
                  textValue: 'EU West (Frankfurt)',
                  keywords: 'fra germany',
                },
                children: ['EU West (Frankfurt)'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-item',
                props: {
                  value: 'ap-east',
                  textValue: 'Asia Pacific (Tokyo)',
                  keywords: 'hnd japan',
                },
                children: ['Asia Pacific (Tokyo)'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-autocomplete-empty',
                children: ['No regions matched.'],
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
        children: ['value: "Astro" · inputValue: "Astro" · open: false'],
      },
    ],
  },
  setup({ refs, api }) {
    let committed = 'Astro';
    let query = 'Astro';
    let isOpen = false;
    const render = () => {
      refs.status.textContent = `value: "${committed}" · inputValue: "${query}" · open: ${isOpen}`;
    };
    api.setProps('root', {
      onValueChange: (detail: { textValue: string }) => {
        committed = detail.textValue;
        render();
      },
      onInputValueChange: (detail: { value: string }) => {
        query = detail.value;
        render();
      },
      onOpenChange: (detail: { open: boolean }) => {
        isOpen = detail.open;
        render();
      },
    });
  },
} satisfies DemoSpec);
