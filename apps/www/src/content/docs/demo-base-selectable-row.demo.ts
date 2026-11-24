import type { DemoSetupContext, DemoSpec } from '../../components/PrototypePreviewer/demo-types';

const entries = [
  {
    ref: 'notes',
    itemKey: 'notes',
    name: 'Project notes',
    kind: 'Text file',
    activatable: false,
    disabled: false,
  },
  {
    ref: 'assets',
    itemKey: 'assets',
    name: 'Assets',
    kind: 'Folder',
    activatable: true,
    disabled: false,
  },
  {
    ref: 'locked',
    itemKey: 'locked',
    name: 'Archived export',
    kind: 'Unavailable',
    activatable: false,
    disabled: true,
  },
] as const;

// The demo accepts selection and reports an activation request. It installs no
// pointer, keyboard, focus or double-click handler on the actual row controls.
function setup({ refs, api }: DemoSetupContext) {
  let active = true;
  let selected = 'notes';
  const readKey = (detail: unknown) =>
    detail &&
    typeof detail === 'object' &&
    typeof (detail as { value?: unknown }).value === 'string'
      ? (detail as { value: string }).value
      : null;
  function publish() {
    for (const entry of entries)
      api.setProps(entry.ref, {
        itemKey: entry.itemKey,
        selected: selected === entry.itemKey,
        disabled: entry.disabled,
        activatable: entry.activatable,
        onSelectionChange,
        onActivate,
      });
  }
  function onSelectionChange(detail: unknown) {
    if (!active) return;
    const entry = entries.find((entry) => entry.itemKey === readKey(detail));
    if (!entry || entry.disabled) return;
    selected = entry.itemKey;
    publish();
    if (refs.status) refs.status.textContent = 'Selected: ' + entry.name;
  }
  function onActivate(detail: unknown) {
    if (!active) return;
    const entry = entries.find((entry) => entry.itemKey === readKey(detail));
    if (entry?.activatable && refs.status)
      refs.status.textContent =
        'Open requested: ' + entry.name + '. This preview has no filesystem route.';
  }
  publish();
  return () => {
    active = false;
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-md flex-col gap-3',
    children: [
      {
        kind: 'box',
        attrs: { role: 'grid', 'aria-label': 'Example project entries' },
        className: 'flex flex-col gap-2',
        children: entries.map((entry) => ({
          kind: 'proto' as const,
          prototypeId: 'base-selectable-row',
          ref: entry.ref,
          props: {
            itemKey: entry.itemKey,
            selected: entry.itemKey === 'notes',
            disabled: entry.disabled,
            activatable: entry.activatable,
          },
          className:
            'flex items-center justify-between gap-4 rounded border px-3 py-2 aria-selected:bg-accent aria-selected:text-accent-foreground aria-disabled:opacity-50',
          children: [
            {
              kind: 'box' as const,
              tag: 'span' as const,
              attrs: { role: 'gridcell' },
              children: [entry.name],
            },
            {
              kind: 'box' as const,
              tag: 'span' as const,
              attrs: { role: 'gridcell' },
              className: 'text-sm',
              children: [entry.kind],
            },
          ],
        })),
      },
      {
        kind: 'box',
        ref: 'status',
        attrs: { role: 'status' },
        children: ['Selected: Project notes'],
      },
    ],
  },
  setup,
} satisfies DemoSpec;
