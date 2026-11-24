import type {
  DemoSetupContext,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';
import {
  bindInputShellControl,
  type InputShellProps,
} from '@proto.ui/prototypes-shadcn/input-shell';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const PRESETS = ['rhea', 'new-york-v4', 'nova', 'maia', 'lyra', 'sera'] as const;

/** Switches Style Scope presets live without recreating the editor or losing selection. */
export default withShadcnRheaDemo({
  type: 'demo',
  setup({ refs, api }: DemoSetupContext) {
    let current = true;
    let activePreset: (typeof PRESETS)[number] = 'rhea';
    const disposers = new Set<() => void>();
    const shellProps: InputShellProps = { focusIndicator: 'ring' };
    const control = { getExposes: () => api.getExposes('control') };
    const binding = bindInputShellControl(
      {
        isCurrent: () => current,
        onDispose(dispose) {
          disposers.add(dispose);
          return () => disposers.delete(dispose);
        },
      },
      {
        instance: refs.shell,
        setFacts(facts) {
          api.setProps('shell', { ...shellProps, ...facts });
        },
      },
      control
    );

    const selectPreset = (preset: (typeof PRESETS)[number]) => {
      if (!current || preset === activePreset) return;
      activePreset = preset;
      api.setProps('profileScope', { styleProfile: preset });
      refs.profileStatus.textContent = `Active preset: ${preset}`;
      for (const item of PRESETS) {
        api.setProps(`preset-${item}`, {
          variant: item === preset ? 'default' : 'outline',
          size: 'sm',
          onClick: () => selectPreset(item),
        });
      }
    };

    for (const item of PRESETS) {
      api.setProps(`preset-${item}`, {
        variant: item === activePreset ? 'default' : 'outline',
        size: 'sm',
        onClick: () => selectPreset(item),
      });
    }

    return () => {
      current = false;
      binding.dispose();
      for (const dispose of [...disposers]) dispose();
      disposers.clear();
    };
  },
  root: {
    kind: 'box',
    className: 'grid w-full min-w-0 max-w-md gap-4 p-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap gap-2',
        attrs: { role: 'group', 'aria-label': 'Input Shell style presets' },
        children: PRESETS.map((preset) => ({
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
        kind: 'proto',
        prototypeId: 'shadcn-style-scope',
        ref: 'profileScope',
        className: 'contents',
        props: { styleProfile: 'rhea' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-input-shell',
            ref: 'shell',
            props: { focusIndicator: 'ring' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-input-shell-control',
                ref: 'control',
                props: {
                  defaultValue: 'Q4 Launch Plan',
                  placeholder: 'Document title…',
                  ariaLabel: 'Document title',
                },
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'profileStatus',
        attrs: { role: 'status', 'aria-live': 'polite' },
        className: 'text-xs text-muted-foreground',
        children: ['Active preset: rhea'],
      },
    ],
  },
} satisfies DemoSpec);
