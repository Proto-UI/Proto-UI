import type {
  DemoSetupContext,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';
import { bindInputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const PRESERVATION_PRESETS = ['rhea', 'nova', 'lyra', 'luma', 'new-york-v4'] as const;
type PreservationPreset = (typeof PRESERVATION_PRESETS)[number];

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full min-w-0 max-w-xl gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap gap-1.5',
        attrs: { role: 'group', 'aria-label': 'State-preserving style profile' },
        children: PRESERVATION_PRESETS.map((preset) => ({
          kind: 'proto' as const,
          prototypeId: 'shadcn-button',
          ref: `keep-${preset}`,
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
        ref: 'stateScope',
        className: 'contents',
        props: { styleProfile: 'rhea' },
        children: [
          {
            kind: 'box',
            className: 'grid gap-4 rounded-xl border border-border bg-card p-5',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-tabs-root',
                ref: 'stateTabs',
                className: 'w-full',
                props: { defaultValue: 'general' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-tabs-list',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-tabs-trigger',
                        props: { value: 'general' },
                        children: ['General'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-tabs-trigger',
                        props: { value: 'security' },
                        children: ['Security'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-tabs-trigger',
                        props: { value: 'notifications' },
                        children: ['Notifications'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-tabs-indicator',
                    className: 'block h-0.5',
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-tabs-content',
                    props: { value: 'general' },
                    children: [
                      'General workspace configuration stays active across preset switches.',
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-tabs-content',
                    props: { value: 'security' },
                    children: ['Security policies remain selected without remounting Tabs.'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-tabs-content',
                    props: { value: 'notifications' },
                    children: ['Notification preferences stay intact when updating styleProfile.'],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'grid gap-1.5',
                children: [
                  {
                    kind: 'box',
                    tag: 'span',
                    className: 'text-xs font-medium text-muted-foreground',
                    children: ['Workspace slug (edit text or keep focus here and press Alt+1–5)'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-input-shell',
                    ref: 'stateShell',
                    props: { focusIndicator: 'ring' },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-input-shell-control',
                        ref: 'stateControl',
                        props: {
                          defaultValue: 'acme-studio',
                          placeholder: 'Workspace slug',
                          ariaLabel: 'Workspace slug',
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'preservationStatus',
        attrs: { role: 'status', 'aria-live': 'polite' },
        className: 'font-mono text-xs text-muted-foreground',
        children: ['Active preset: rhea · Shortcut: Alt+1–5'],
      },
    ],
  },
  setup({ host, refs, api }: DemoSetupContext) {
    let current = true;
    let active: PreservationPreset = 'rhea';
    const disposers = new Set<() => void>();

    const control = { getExposes: () => api.getExposes('stateControl') };
    const binding = bindInputShellControl(
      {
        isCurrent: () => current,
        onDispose(dispose) {
          disposers.add(dispose);
          return () => disposers.delete(dispose);
        },
      },
      {
        instance: refs.stateShell,
        setFacts(facts) {
          api.setProps('stateShell', facts);
        },
      },
      control
    );

    const select = (next: PreservationPreset) => {
      if (!current || next === active) return;
      active = next;
      api.setProps('stateScope', { styleProfile: next });
      for (const preset of PRESERVATION_PRESETS) {
        api.setProps(`keep-${preset}`, {
          variant: preset === next ? 'default' : 'outline',
        });
      }
      refs.preservationStatus.textContent = `Active preset: ${next} · Shortcut: Alt+1–5`;
    };

    for (const preset of PRESERVATION_PRESETS) {
      api.setProps(`keep-${preset}`, { onClick: () => select(preset) });
    }

    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing)
        return;
      const index = ['1', '2', '3', '4', '5'].indexOf(event.key);
      if (index < 0) return;
      event.preventDefault();
      select(PRESERVATION_PRESETS[index]!);
    };
    host.addEventListener('keydown', onKey);

    return () => {
      current = false;
      host.removeEventListener('keydown', onKey);
      binding.dispose();
      for (const dispose of disposers) dispose();
      disposers.clear();
    };
  },
} satisfies DemoSpec);
