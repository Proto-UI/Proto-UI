import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import { shadcnCheckboxDemoChildren } from '../../../../components/PrototypePreviewer/shadcn-checkbox-composition';
import type {
  DemoSetupContext,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';

function setupControlledCheckbox({ refs, api }: DemoSetupContext) {
  let active = true;
  let checked = false;
  let indeterminate = true;

  const updateStatus = () => {
    if (!refs.statusText) return;
    refs.statusText.textContent = indeterminate
      ? 'Current state: indeterminate (mixed)'
      : checked
        ? 'Current state: checked'
        : 'Current state: unchecked';
  };

  const sync = () => {
    api.setProps('controlledCheckbox', {
      checked,
      indeterminate,
      onCheckedChange,
      onIndeterminateChange,
    });
    updateStatus();
  };

  function onCheckedChange(detail: unknown) {
    if (!active || !detail || typeof detail !== 'object') return;
    const next = detail as { checked?: unknown; indeterminate?: unknown };
    if (typeof next.checked === 'boolean') checked = next.checked;
    if (typeof next.indeterminate === 'boolean') indeterminate = next.indeterminate;
    sync();
  }

  function onIndeterminateChange(detail: unknown) {
    if (!active || !detail || typeof detail !== 'object') return;
    const next = detail as { indeterminate?: unknown };
    if (typeof next.indeterminate === 'boolean') indeterminate = next.indeterminate;
    sync();
  }

  const onResetMixed = () => {
    if (!active) return;
    checked = false;
    indeterminate = true;
    sync();
  };

  sync();
  refs.mixedButton?.addEventListener('click', onResetMixed);

  return () => {
    active = false;
    refs.mixedButton?.removeEventListener('click', onResetMixed);
  };
}

const [control, label] = shadcnCheckboxDemoChildren({
  associationKey: 'shadcn-checkbox-controlled-pair',
  label: ['Sync workspace preferences'],
  controlProps: { checked: false, indeterminate: true },
  controlRef: 'controlledCheckbox',
  labelRef: 'controlledLabel',
});

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-sm flex-col gap-3',
    children: [
      {
        kind: 'box',
        className: 'flex items-center gap-3',
        children: [control, label],
      },
      {
        kind: 'box',
        className:
          'flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2',
        children: [
          {
            kind: 'box',
            ref: 'statusText',
            className: 'text-xs text-muted-foreground',
            children: ['Current state: indeterminate (mixed)'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'mixedButton',
            props: { variant: 'outline', size: 'sm' },
            children: ['Set Mixed'],
          },
        ],
      },
    ],
  },
  setup: setupControlledCheckbox,
} satisfies DemoSpec);
