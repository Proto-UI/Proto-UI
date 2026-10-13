import type { DemoSetupContext, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

function setup({ host }: DemoSetupContext) {
  const trigger = host.querySelector<HTMLElement>('[role="combobox"]');
  if (!trigger) return;

  const label = 'Adapter selector';
  const restoreLabel = () => {
    if (trigger.getAttribute('aria-label') !== label) trigger.setAttribute('aria-label', label);
  };
  restoreLabel();

  // Select's protocol intentionally derives its name from content. A native
  // combobox needs an explicit label, so keep this demo-only label in place
  // when the protocol refreshes aria-expanded or other state attributes.
  const observer = new MutationObserver(restoreLabel);
  observer.observe(trigger, { attributes: true, attributeFilter: ['aria-label'] });
  return () => observer.disconnect();
}

export default {
  type: 'demo',
  setup,
  root: {
    kind: 'proto',
    prototypeId: 'shadcn-select-root',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-select-trigger',
        className: 'w-56',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-select-value',
            props: { placeholder: 'Select an adapter' },
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-select-content',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-select-surface',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-select-viewport',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-select-group',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-select-label',
                        children: ['Framework adapters'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-select-item',
                        props: { value: 'react', textValue: 'React' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-select-item-text',
                            children: ['React'],
                          },
                        ],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-select-item',
                        props: { value: 'vue', textValue: 'Vue' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-select-item-text',
                            children: ['Vue'],
                          },
                        ],
                      },
                    ],
                  },
                  { kind: 'proto', prototypeId: 'shadcn-select-separator' },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-select-group',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-select-label',
                        children: ['Web platform'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-select-item',
                        props: { value: 'wc', textValue: 'Web Components' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-select-item-text',
                            children: ['Web Components'],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-select-item',
                    props: { value: 'solid', textValue: 'Solid', disabled: true },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-select-item-text',
                        children: ['Solid (Soon)'],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
