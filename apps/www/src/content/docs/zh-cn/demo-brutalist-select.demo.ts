import type { DemoSetupContext, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

function setup({ host }: DemoSetupContext) {
  const trigger = host.querySelector<HTMLElement>('[role="combobox"]');
  if (!trigger) return;

  const label = 'Surface selector';
  const restoreLabel = () => {
    if (trigger.getAttribute('aria-label') !== label) trigger.setAttribute('aria-label', label);
  };
  restoreLabel();
  const observer = new MutationObserver(restoreLabel);
  observer.observe(trigger, { attributes: true, attributeFilter: ['aria-label'] });
  return () => observer.disconnect();
}

export default {
  type: 'demo',
  setup,
  root: {
    kind: 'proto',
    prototypeId: 'brutalist-select-root',
    props: { defaultValue: 'paper' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-select-trigger',
        children: [{ kind: 'proto', prototypeId: 'brutalist-select-value' }],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-select-content',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-select-item',
            props: { value: 'paper', textValue: 'Paper' },
            children: ['Paper'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-select-item',
            props: { value: 'ink', textValue: 'Ink' },
            children: ['Ink'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
