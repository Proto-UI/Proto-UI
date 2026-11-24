import type { DemoNode, DemoSpec } from '../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from './shadcn-demo-style';

const themes = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'high-contrast', label: 'High Contrast (Coming soon)', disabled: true },
] as const;

function item(value: string, textValue: string, disabled = false): DemoNode {
  return {
    kind: 'proto',
    prototypeId: 'shadcn-select-item',
    props: { value, textValue, disabled },
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-select-item-text',
        children: [textValue],
      },
    ],
  };
}

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-select-root',
        ref: 'controlledSelect',
        props: { value: 'system' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-select-trigger',
            className: 'w-48',
            props: { accessibleLabel: 'Theme selector' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-select-value',
                props: { placeholder: 'Select a theme' },
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-select-content',
            props: { position: 'popper', align: 'start' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-select-surface',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-select-viewport',
                    children: themes.map((entry) =>
                      item(entry.value, entry.label, Boolean('disabled' in entry && entry.disabled))
                    ),
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        ref: 'resetTheme',
        props: { variant: 'outline', size: 'sm' },
        children: ['Reset to System'],
      },
      {
        kind: 'box',
        ref: 'selectedTheme',
        className: 'text-sm text-muted-foreground',
        children: ['Selected: System'],
      },
    ],
  },
  setup({ api, refs }) {
    let alive = true;
    const labels: Record<string, string> = {
      system: 'System',
      light: 'Light',
      dark: 'Dark',
    };
    const sync = (next: string) => {
      if (!alive) return;
      api.setProps('controlledSelect', {
        value: next,
        onValueChange: (event: { value: string }) => sync(event.value),
      });
      refs.selectedTheme.textContent = `Selected: ${labels[next] ?? next}`;
    };
    sync('system');
    api.setProps('resetTheme', {
      onClick: () => sync('system'),
    });
    return () => {
      alive = false;
    };
  },
} satisfies DemoSpec);
