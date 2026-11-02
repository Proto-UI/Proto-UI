import type { DemoSetupContext } from '../../../components/PrototypePreviewer/demo-types';

// Only the demo owns acceptance of the controlled checkbox's proposals. The
// native toggle, indeterminate lifecycle, disabled gating and focus stay with
// the actual Base Checkbox prototype. The indicator renders the root state and
// owns no checked value of its own.
export function setupBaseCheckboxDemo({ refs, api }: DemoSetupContext) {
  let active = true;
  const status = refs.status;
  let checked = true;
  let indeterminate = false;
  // WC raw-prop updates replace the record; keep the full state and both
  // callbacks on every installation/update instead of relying on a partial merge.
  const completeProps = () => ({
    checked,
    indeterminate,
    onCheckedChange,
    onIndeterminateChange,
  });
  function onCheckedChange(detail: unknown) {
    if (!active || !detail || typeof detail !== 'object') return;
    const proposed = detail as { checked?: unknown; indeterminate?: unknown };
    if (typeof proposed.checked !== 'boolean') return;
    checked = proposed.checked;
    if (typeof proposed.indeterminate === 'boolean') indeterminate = proposed.indeterminate;
    api.setProps('controlled', completeProps());
    if (status)
      status.textContent = `Owner accepted checked=${checked} indeterminate=${indeterminate}`;
  }
  function onIndeterminateChange(detail: unknown) {
    if (!active || !detail || typeof detail !== 'object') return;
    const proposed = detail as { indeterminate?: unknown };
    if (typeof proposed.indeterminate !== 'boolean') return;
    indeterminate = proposed.indeterminate;
    api.setProps('controlled', completeProps());
    if (status) status.textContent = `Owner accepted indeterminate=${indeterminate}`;
  }
  api.setProps('controlled', completeProps());
  return () => {
    active = false;
  };
}

const indicator = { kind: 'proto', prototypeId: 'base-checkbox-indicator' } as const;

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-md flex-col gap-4',
    children: [
      { kind: 'box', children: ['Uncontrolled — press to toggle the Base-owned value'] },
      {
        kind: 'proto',
        prototypeId: 'base-checkbox-root',
        className: 'flex items-center gap-2 rounded border px-3 py-2',
        children: [indicator, { kind: 'box', children: ['Unchecked'] }],
      },
      {
        kind: 'proto',
        prototypeId: 'base-checkbox-root',
        props: { defaultChecked: true },
        className: 'flex items-center gap-2 rounded border px-3 py-2',
        children: [indicator, { kind: 'box', children: ['Checked'] }],
      },
      {
        kind: 'proto',
        prototypeId: 'base-checkbox-root',
        props: { defaultIndeterminate: true },
        className: 'flex items-center gap-2 rounded border px-3 py-2',
        children: [indicator, { kind: 'box', children: ['Mixed'] }],
      },
      { kind: 'box', children: ['Disabled — press does not change state'] },
      {
        kind: 'proto',
        prototypeId: 'base-checkbox-root',
        props: { disabled: true, defaultChecked: true },
        className: 'flex items-center gap-2 rounded border px-3 py-2 opacity-50',
        children: [indicator, { kind: 'box', children: ['Disabled checked'] }],
      },
      {
        kind: 'box',
        children: ['Controlled — this demo owner accepts checked and indeterminate proposals'],
      },
      {
        kind: 'proto',
        ref: 'controlled',
        prototypeId: 'base-checkbox-root',
        props: { checked: true },
        className: 'flex items-center gap-2 rounded border px-3 py-2',
        children: [indicator, { kind: 'box', children: ['Controlled checkbox'] }],
      },
      {
        kind: 'box',
        ref: 'status',
        children: ['The demo owner has not received a proposal yet.'],
      },
    ],
  },
  setup: setupBaseCheckboxDemo,
};
