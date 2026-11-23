import type { DemoSetupContext } from '../../../components/PrototypePreviewer/demo-types';

// Only the demo owns acceptance of controlled proposals. The native editor,
// normalized events and focus stay with the actual Base Input prototype.
export function setupBaseInputDemo({ refs, api }: DemoSetupContext) {
  let active = true;
  const status = refs.status;
  const resetStatus = refs.resetStatus;
  let value = 'Owner-controlled value';
  let editingEvents = 0;
  const recordEditingEvent = () => {
    if (active) editingEvents += 1;
  };
  const eventCallbacks = {
    onChange: recordEditingEvent,
    onCompositionStart: recordEditingEvent,
    onCompositionUpdate: recordEditingEvent,
    onCompositionEnd: recordEditingEvent,
  };
  const completeProps = () => ({
    value,
    ariaLabel: 'Controlled Base Input',
    ...eventCallbacks,
    onValueChange,
  });
  function onValueChange(detail: unknown) {
    if (!active) return;
    recordEditingEvent();
    if (!detail || typeof detail !== 'object') return;
    const proposed = (detail as { value?: unknown }).value;
    if (typeof proposed !== 'string' || proposed === value) return;
    value = proposed;
    api.setProps('controlled', completeProps());
    if (status) status.textContent = 'Owner accepted: ' + value;
  }
  const publicValue = (ref: string) => {
    const state = api.getExposes(ref)?.value as { get?: () => unknown } | undefined;
    return state?.get?.();
  };
  const reset = (ref: string, next?: string) => {
    if (!active) return;
    // Clicking a button can first blur the editor. Count only events during the
    // public method call, so ordinary focus changes are not attributed to reset.
    const before = editingEvents;
    const accepted =
      next === undefined ? api.call(ref, 'resetValue') : api.call(ref, 'resetValue', next);
    if (resetStatus) {
      resetStatus.textContent =
        'Reset accepted: ' +
        String(accepted) +
        '; value: ' +
        JSON.stringify(publicValue(ref)) +
        '; editing events: ' +
        String(editingEvents - before);
    }
  };
  api.setProps('editable', { ...eventCallbacks, onValueChange: recordEditingEvent });
  // Keep the controlled value, naming and callbacks together on every owner update.
  api.setProps('controlled', completeProps());
  api.setProps('setDefault', {
    onClick() {
      if (!active) return;
      api.setProps('editable', { defaultValue: 'Latest default' });
      if (resetStatus) {
        resetStatus.textContent =
          'Default changed to "Latest default"; current value: ' +
          JSON.stringify(publicValue('editable'));
      }
    },
  });
  api.setProps('resetDefault', { onClick: () => reset('editable') });
  api.setProps('resetSample', { onClick: () => reset('editable', 'New\r\nvalue') });
  api.setProps('resetControlled', { onClick: () => reset('controlled', 'Replacement attempt') });
  return () => {
    active = false;
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
      {
        kind: 'box',
        className: 'flex flex-wrap gap-2',
        children: [
          {
            kind: 'proto',
            ref: 'setDefault',
            prototypeId: 'base-button',
            children: ['Set latest default'],
          },
          {
            kind: 'proto',
            ref: 'resetDefault',
            prototypeId: 'base-button',
            children: ['Reset to default'],
          },
          {
            kind: 'proto',
            ref: 'resetSample',
            prototypeId: 'base-button',
            children: ['Reset to sample'],
          },
          {
            kind: 'proto',
            ref: 'resetControlled',
            prototypeId: 'base-button',
            children: ['Try controlled reset'],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'resetStatus',
        attrs: { role: 'status', 'aria-live': 'polite' },
        children: ['No reset requested.'],
      },
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
