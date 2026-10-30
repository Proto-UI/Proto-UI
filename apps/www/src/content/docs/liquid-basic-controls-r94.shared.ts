import type { DemoChild, DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

type ProtoNode = Extract<DemoNode, { kind: 'proto' }>;

function part(
  component: string,
  name: string,
  ref: string,
  props: Record<string, unknown> = {},
  children: DemoChild[] = []
): ProtoNode {
  return { kind: 'proto', prototypeId: `liquid-glass-${component}-${name}`, ref, props, children };
}

function label(ref: string, text: string, key: string): ProtoNode {
  return {
    ...part('label', 'root', `${ref}Label`, { naming: true, activation: true }, [text]),
    associations: { controlLabel: key },
  };
}

function checkedControlRow(
  component: 'checkbox' | 'switch',
  ref: string,
  text: string,
  props: Record<string, unknown>
): DemoNode {
  const key = `${component}-${ref}`;
  return {
    kind: 'box',
    className: 'flex min-w-0 items-center gap-3',
    children: [
      {
        ...part(component, 'root', ref, props, [
          part(component, component === 'checkbox' ? 'indicator' : 'thumb', `${ref}Part`),
        ]),
        associations: { controlLabel: key },
      },
      label(ref, text, key),
    ],
  };
}

export function createLiquidCheckboxDemo(): DemoSpec {
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'grid w-full min-w-0 gap-4 p-4',
      children: [
        checkedControlRow('checkbox', 'unchecked', 'Community updates', { defaultChecked: false }),
        checkedControlRow('checkbox', 'checked', 'Release notes', { defaultChecked: true }),
        checkedControlRow('checkbox', 'mixed', 'Some notification channels selected', {
          defaultIndeterminate: true,
        }),
        checkedControlRow('checkbox', 'disabled', 'Archived notifications (disabled)', {
          defaultChecked: true,
          disabled: true,
        }),
        checkedControlRow('checkbox', 'opaque', 'Opaque material preference', {
          defaultChecked: true,
          material: 'opaque',
        }),
        checkedControlRow('checkbox', 'controlled', 'Controlled choice: owner keeps it off', {
          checked: false,
        }),
      ],
    },
  };
}

export function createLiquidSwitchDemo(): DemoSpec {
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'grid w-full min-w-0 gap-4 p-4',
      children: [
        checkedControlRow('switch', 'unchecked', 'Enable email alerts', { defaultChecked: false }),
        checkedControlRow('switch', 'checked', 'Enable release alerts', { defaultChecked: true }),
        checkedControlRow('switch', 'disabled', 'Archived alerts (disabled)', {
          defaultChecked: true,
          disabled: true,
        }),
        checkedControlRow('switch', 'draggable', 'Drag or activate this setting', {
          defaultChecked: false,
          draggable: true,
        }),
        checkedControlRow('switch', 'opaque', 'Opaque material preference', {
          defaultChecked: true,
          material: 'opaque',
        }),
        checkedControlRow('switch', 'controlled', 'Controlled setting: owner keeps it off', {
          checked: false,
        }),
      ],
    },
  };
}

export function createLiquidEditorDemo(component: 'input' | 'textarea'): DemoSpec {
  const multiline = component === 'textarea';
  const editor = (ref: string, text: string, props: Record<string, unknown>): DemoNode => {
    const key = `${component}-${ref}`;
    return {
      kind: 'box',
      className: 'grid min-w-0 gap-2',
      children: [
        label(ref, text, key),
        {
          ...part(component, 'root', ref, { ...(multiline ? { rows: 3 } : {}), ...props }),
          associations: { controlLabel: key },
        },
      ],
    };
  };

  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'grid w-full max-w-xl min-w-0 gap-4 p-4',
      children: [
        editor('editable', multiline ? 'Project notes' : 'Project name', {
          defaultValue: multiline
            ? 'A project note.\nEdit this text to exercise the real multiline editor.'
            : 'Proto UI project',
          placeholder: multiline ? 'Write a project note' : 'Name the project',
        }),
        editor('controlled', 'Controlled editor: owner keeps this value', {
          value: multiline ? 'Owner-provided note.\nProposals do not replace this value.' : 'Owner-provided name',
        }),
        editor('disabled', 'Disabled editor', {
          defaultValue: 'This editor is unavailable.',
          disabled: true,
        }),
        editor('readonly', 'Read-only editor', {
          defaultValue: 'This value remains selectable and focusable.',
          readOnly: true,
        }),
      ],
    },
  };
}

export function createLiquidSeparatorDemo(): DemoSpec {
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'grid w-full max-w-lg min-w-0 gap-4 p-4',
      children: [
        'Project overview',
        part('separator', 'root', 'horizontalDecorative', {
          orientation: 'horizontal',
          decorative: true,
        }),
        'Related project activity',
        part('separator', 'root', 'horizontalSemantic', {
          orientation: 'horizontal',
          decorative: false,
        }),
        {
          kind: 'box',
          className: 'flex h-12 items-center gap-4',
          children: [
            'Overview',
            part('separator', 'root', 'verticalDecorative', {
              orientation: 'vertical',
              decorative: true,
            }),
            'Activity',
            part('separator', 'root', 'verticalSemantic', {
              orientation: 'vertical',
              decorative: false,
            }),
            'Settings',
          ],
        },
      ],
    },
  };
}
