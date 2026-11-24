import type {
  DemoSetupContext,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';
import { bindInputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const STYLE_PRESETS = [
  'rhea',
  'vega',
  'nova',
  'maia',
  'lyra',
  'mira',
  'luma',
  'sera',
  'new-york-v4',
] as const;

type StylePreset = (typeof STYLE_PRESETS)[number];

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full min-w-0 max-w-2xl gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap gap-1.5',
        attrs: { role: 'group', 'aria-label': 'Shadcn style profile' },
        children: STYLE_PRESETS.map((preset) => ({
          kind: 'proto' as const,
          prototypeId: 'shadcn-button',
          ref: `preset-${preset}`,
          props: {
            variant: preset === 'rhea' ? 'default' : 'outline',
            size: 'sm',
          },
          children: [preset],
        })),
      },
      {
        kind: 'box',
        className: 'grid gap-4 rounded-xl border border-border bg-card p-5',
        children: [
          {
            kind: 'box',
            className: 'flex flex-wrap items-center justify-between gap-2',
            children: [
              {
                kind: 'box',
                tag: 'span',
                className: 'text-sm font-semibold text-foreground',
                children: ['Deployment controls'],
              },
              {
                kind: 'box',
                tag: 'span',
                ref: 'activePreset',
                attrs: { role: 'status', 'aria-live': 'polite' },
                className: 'font-mono text-xs text-muted-foreground',
                children: ['styleProfile="rhea"'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-style-scope',
            ref: 'liveScope',
            className: 'contents',
            props: { styleProfile: 'rhea' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-4',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-input-shell',
                    ref: 'heroShell',
                    props: { focusIndicator: 'ring' },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-input-shell-control',
                        ref: 'heroControl',
                        props: {
                          placeholder: 'Filter deployments...',
                          ariaLabel: 'Filter deployments',
                        },
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'flex flex-wrap items-center gap-2',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-button',
                        props: { variant: 'default' },
                        children: ['Deploy'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-button',
                        props: { variant: 'outline' },
                        children: ['Preview'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-button',
                        props: { variant: 'secondary' },
                        children: ['Duplicate'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-button',
                        props: { variant: 'destructive' },
                        children: ['Archive'],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  setup({ refs, api }: DemoSetupContext) {
    let current = true;
    let active: StylePreset = 'rhea';
    const disposers = new Set<() => void>();

    const control = { getExposes: () => api.getExposes('heroControl') };
    const binding = bindInputShellControl(
      {
        isCurrent: () => current,
        onDispose(dispose) {
          disposers.add(dispose);
          return () => disposers.delete(dispose);
        },
      },
      {
        instance: refs.heroShell,
        setFacts(facts) {
          api.setProps('heroShell', facts);
        },
      },
      control
    );

    const select = (next: StylePreset) => {
      if (!current || next === active) return;
      active = next;
      api.setProps('liveScope', { styleProfile: next });
      for (const preset of STYLE_PRESETS) {
        api.setProps(`preset-${preset}`, {
          variant: preset === next ? 'default' : 'outline',
        });
      }
      refs.activePreset.textContent = `styleProfile="${next}"`;
    };

    for (const preset of STYLE_PRESETS) {
      api.setProps(`preset-${preset}`, { onClick: () => select(preset) });
    }

    return () => {
      current = false;
      binding.dispose();
      for (const dispose of disposers) dispose();
      disposers.clear();
    };
  },
} satisfies DemoSpec);
