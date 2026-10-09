import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

type ValueRequest = { value: string; textValue: string; reason: string };
const longLabel =
  'A translated option with enough detail to wrap safely · 選択肢の説明 · VeryLongUnbrokenOptionLabelsMustRemainReadableAtTwoHundredPercentTextSize';
function select(ref: string, props: Record<string, unknown> = {}): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'bootstrap-2-3-2-select-root',
    ref,
    props,
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-select-trigger',
        ref: `${ref}Trigger`,
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-select-value',
            props: { placeholder: 'Choose an option' },
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-select-content',
        ref: `${ref}Content`,
        props: { align: 'start', sideOffset: 8, collisionPadding: 12 },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-select-item',
            props: { value: 'alpha', textValue: 'Alpha' },
            children: ['Alpha'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-select-item',
            props: { value: 'beta', textValue: 'Beta' },
            children: ['Beta'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-select-item',
            props: { value: 'disabled', textValue: 'Unavailable option', disabled: true },
            children: ['Unavailable option'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-select-item',
            props: { value: 'long', textValue: longLabel },
            children: [longLabel],
          },
        ],
      },
    ],
  };
}
export default {
  type: 'demo',
  root: {
    kind: 'box',
    ref: 'selectLayout',
    className: 'grid grid-cols-1 min-w-0 w-full max-w-lg gap-5 p-2 wrap-anywhere',
    children: [
      { kind: 'box', children: ['Uncontrolled selection'], className: 'text-sm' },
      select('uncontrolled', { defaultValue: 'alpha' }),
      { kind: 'box', children: ['Disabled selection'], className: 'text-sm' },
      select('disabled', { defaultValue: 'beta', disabled: true }),
      {
        kind: 'box',
        children: ['Controlled value: accept the pending request below'],
        className: 'text-sm',
      },
      select('controlled', { value: 'alpha' }),
      {
        kind: 'box',
        ref: 'requestStatus',
        attrs: { 'aria-live': 'polite' },
        className: 'text-sm break-words',
        children: ['No pending request.'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-button',
        ref: 'accept',
        className: 'min-w-0 max-w-full',
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
      {
        kind: 'box',
        attrs: { dir: 'rtl' },
        ref: 'selectRtlLayout',
        className: 'grid grid-cols-1 min-w-0 gap-2',
        children: [
          { kind: 'box', children: ['RTL · long selected label'], className: 'text-sm' },
          select('rtl', { defaultValue: 'long' }),
        ],
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
    const onRequest = (event: Event) => {
      if (event instanceof CustomEvent) propose(event.detail as ValueRequest);
    };
    const onAccept = (event: Event) => {
      if (event instanceof CustomEvent) accept();
    };
    refs.controlled.addEventListener('valueChange', onRequest);
    refs.accept.addEventListener('click', onAccept);
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
      refs.controlled.removeEventListener('valueChange', onRequest);
      refs.accept.removeEventListener('click', onAccept);
      observer.disconnect();
    };
  },
} satisfies DemoSpec;
