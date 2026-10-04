import type { DemoSetupContext } from '../../../components/PrototypePreviewer/demo-types';

// Only the demo owns acceptance of controlled proposals. The native editor,
// normalized events and focus stay with the actual Base Input prototype.
export function setupBaseInputDemo({ host, refs, api }: DemoSetupContext) {
  let active = true;
  const status = refs.status;
  let value = 'Owner-controlled value';
  const completeProps = () => ({ value, ariaLabel: 'Controlled Base Input', onValueChange });
  function onValueChange(detail: unknown) {
    if (!active || !detail || typeof detail !== 'object') return;
    const proposed = (detail as { value?: unknown }).value;
    if (typeof proposed !== 'string' || proposed === value) return;
    value = proposed;
    api.setProps('controlled', completeProps());
    if (status) status.textContent = 'Owner accepted: ' + value;
  }
  // WC raw-prop updates replace the record; keep value and naming on every
  // callback installation/update instead of relying on a partial merge.
  api.setProps('controlled', completeProps());
  // WC exposes normalized proposals as DOM CustomEvents; React/Vue use
  // callbacks. Accept only this controlled Root's normalized event, never
  // a native input/change bubble or a sibling field.
  const onDomProposal = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-demo-ref]')?.getAttribute('data-demo-ref') !== 'controlled') return;
    onValueChange(event.detail);
  };
  host.addEventListener('valueChange', onDomProposal);
  return () => {
    active = false;
    host.removeEventListener('valueChange', onDomProposal);
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-md flex-col gap-4',
    children: [
      { kind: 'box', children: ['Uncontrolled — type to update the Base-owned value'] },
      {
        kind: 'proto',
        ref: 'editable',
        prototypeId: 'base-input-root',
        props: {
          defaultValue: 'Edit this Base Input',
          placeholder: 'Type a protocol note',
          ariaLabel: 'Editable Base Input',
          name: 'protocol-note',
          autoComplete: 'off',
          inputMode: 'text',
          enterKeyHint: 'done',
          minLength: 1,
          maxLength: 120,
        },
      },
      { kind: 'box', children: ['Controlled — this demo owner accepts value proposals'] },
      {
        kind: 'proto',
        ref: 'controlled',
        prototypeId: 'base-input-root',
        props: {
          value: 'Owner-controlled value',
          ariaLabel: 'Controlled Base Input',
        },
      },
      { kind: 'box', ref: 'status', children: ['The demo owner has not received a proposal yet.'] },
      { kind: 'box', children: ['Disabled'] },
      {
        kind: 'proto',
        ref: 'disabled',
        prototypeId: 'base-input-root',
        props: {
          defaultValue: 'Unavailable',
          disabled: true,
          ariaLabel: 'Disabled Base Input',
        },
      },
      { kind: 'box', children: ['Read only — still focusable'] },
      {
        kind: 'proto',
        ref: 'readonly',
        prototypeId: 'base-input-root',
        props: {
          defaultValue: 'Read-only value',
          readOnly: true,
          ariaLabel: 'Read-only Base Input',
        },
      },
    ],
  },
  setup: setupBaseInputDemo,
};
