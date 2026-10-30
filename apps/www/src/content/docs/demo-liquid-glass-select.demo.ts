import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

type ValueRequest = { value: string; textValue: string; reason: string };
const longLabel =
  'A translated option with enough detail to wrap safely · 選択肢の説明 · VeryLongUnbrokenOptionLabelsMustRemainReadableAtTwoHundredPercentTextSize';
function select(ref: string, props: Record<string, unknown> = {}): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'liquid-glass-select-root',
    ref,
    props,
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-select-trigger',
        ref: `${ref}Trigger`,
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-select-value',
            props: { placeholder: 'Choose an option' },
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-select-content',
        ref: `${ref}Content`,
        props: { align: 'start', sideOffset: 8, collisionPadding: 12 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-select-item',
            props: { value: 'alpha', textValue: 'Alpha' },
            children: ['Alpha'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-select-item',
            props: { value: 'beta', textValue: 'Beta' },
            children: ['Beta'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-select-item',
            props: { value: 'disabled', textValue: 'Unavailable option', disabled: true },
            children: ['Unavailable option'],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-select-item',
            props: { value: 'long', textValue: longLabel },
            children: [longLabel],
          },
        ],
      },
    ],
  };
}
function materialStage(ref: string, children: DemoNode[]): Extract<DemoNode, { kind: 'box' }> {
  return {
    kind: 'box',
    ref,
    className: 'min-w-0 w-full',
    materialStage: { mountRef: `${ref}Flow`, overlayRef: `${ref}Overlay` },
    children: [
      { kind: 'box', ref: `${ref}Flow`, children },
      { kind: 'box', ref: `${ref}Overlay`, children: [] },
    ],
  };
}
export default {
  type: 'demo',
  root: {
    kind: 'box',
    ref: 'selectLayout',
    className: 'grid grid-cols-1 min-w-0 w-full max-w-lg gap-5 p-0 sm:p-2 wrap-anywhere',
    children: [
      materialStage('uncontrolledStage', [
        { kind: 'box', children: ['Uncontrolled selection'], className: 'text-sm mb-2' },
        select('uncontrolled', { defaultValue: 'alpha' }),
      ]),
      materialStage('disabledStage', [
        { kind: 'box', children: ['Disabled selection'], className: 'text-sm mb-2' },
        select('disabled', { defaultValue: 'beta', disabled: true }),
      ]),
      materialStage('controlledStage', [
        {
          kind: 'box',
          children: ['Controlled value: accept the pending request above the selection'],
          className: 'text-sm',
        },
        {
          kind: 'box',
          ref: 'requestStatus',
          attrs: { 'aria-live': 'polite' },
          className: 'text-sm break-words mb-2',
          children: ['No pending request.'],
        },
        {
          kind: 'proto',
          prototypeId: 'liquid-glass-button',
          ref: 'accept',
          className: 'min-w-0 max-w-full mb-2',
          children: [
            {
              kind: 'box',
              tag: 'span',
              ref: 'acceptLabel',
              className: 'min-w-0 whitespace-normal wrap-anywhere',
              children: ['Accept selection'],
            },
          ],
        },
        select('controlled', { value: 'alpha' }),
      ]),
      {
        ...materialStage('selectRtlLayout', [
          { kind: 'box', children: ['RTL · long selected label'], className: 'text-sm' },
          select('rtl', { defaultValue: 'long' }),
        ]),
        kind: 'box',
        attrs: { dir: 'rtl' },
        className: 'grid grid-cols-1 min-w-0 gap-2',
      },
    ],
  },
  setup({ refs, api }) {
    let value = 'alpha';
    let pending: ValueRequest | null = null;
    const propose = (request: ValueRequest) => {
      pending = request;
      refs.requestStatus.textContent = `Requested ${request.textValue} (${request.reason}); committed selection remains ${value}.`;
    };
    const update = () => api.setProps('controlled', { value, onValueChange: propose });
    const accept = () => {
      if (!pending) return;
      value = pending.value;
      pending = null;
      update();
      refs.requestStatus.textContent = `Owner accepted: ${value}.`;
    };
    update();
    api.setProps('accept', { onClick: accept });
    const labels = ['uncontrolled', 'disabled', 'controlled', 'rtl'];
    const labelTriggers = () => {
      for (const id of labels) refs[`${id}Trigger`].setAttribute('aria-label', `${id} selection`);
    };
    labelTriggers();
    const observer = new MutationObserver(() => {
      for (const id of labels)
        if (refs[`${id}Trigger`].getAttribute('aria-label') !== `${id} selection`)
          refs[`${id}Trigger`].setAttribute('aria-label', `${id} selection`);
    });
    for (const id of labels)
      observer.observe(refs[`${id}Trigger`], { attributes: true, attributeFilter: ['aria-label'] });
    return () => {
      observer.disconnect();
    };
  },
} satisfies DemoSpec;
