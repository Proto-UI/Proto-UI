import type { DemoSetupContext, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

function setup({ host }: DemoSetupContext) {
  const trigger = host.querySelector<HTMLElement>('[role="combobox"]');
  if (!trigger) return;

  const label = 'Framework selector';
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
    prototypeId: 'base-select-root',
    className: 'relative inline-flex flex-col gap-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'base-select-trigger',
        className:
          'inline-flex min-w-56 items-center justify-between gap-3 rounded-md border bg-white px-3 py-2 text-sm shadow-sm cursor-pointer select-none',
        children: [
          {
            kind: 'proto',
            prototypeId: 'base-select-value',
            props: { placeholder: 'Pick a framework' },
          },
          {
            kind: 'box',
            className: 'text-slate-400',
            children: ['▾'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'base-select-content',
        className: 'w-56 rounded-md border bg-white p-1 shadow-lg',
        children: [
          {
            kind: 'proto',
            prototypeId: 'base-select-item',
            className:
              'block rounded px-3 py-2 text-sm cursor-pointer data-[selected]:bg-slate-100 data-[active]:bg-slate-50',
            props: { value: 'react', textValue: 'React' },
            children: ['React'],
          },
          {
            kind: 'proto',
            prototypeId: 'base-select-item',
            className:
              'block rounded px-3 py-2 text-sm cursor-pointer data-[selected]:bg-slate-100 data-[active]:bg-slate-50',
            props: { value: 'vue', textValue: 'Vue' },
            children: ['Vue'],
          },
          {
            kind: 'proto',
            prototypeId: 'base-select-item',
            className:
              'block rounded px-3 py-2 text-sm cursor-pointer data-[selected]:bg-slate-100 data-[active]:bg-slate-50',
            props: { value: 'wc', textValue: 'Web Components' },
            children: ['Web Components'],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec;
