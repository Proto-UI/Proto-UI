import type {
  DemoSetupContext,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';
import { bindInputShellControl } from '@proto.ui/prototypes-shadcn/input-shell';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const COMPOSITE_CHOICES = ['rhea', 'new-york', 'new-york-v4', 'inherit'] as const;
type CompositeChoice = (typeof COMPOSITE_CHOICES)[number];

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full min-w-0 max-w-xl gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap gap-1.5',
        attrs: { role: 'group', 'aria-label': 'Composite scope choice' },
        children: COMPOSITE_CHOICES.map((choice) => ({
          kind: 'proto' as const,
          prototypeId: 'shadcn-button',
          ref: `choice-${choice}`,
          props: {
            variant: choice === 'rhea' ? 'default' : 'outline',
            size: 'sm',
          },
          children: [choice],
        })),
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-style-scope',
        ref: 'compositeScope',
        className: 'contents',
        props: { styleProfile: 'rhea' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-card-root',
            className: 'w-full',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-card-header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-text-root',
                    props: { weight: 'semibold', tone: 'inherit' },
                    children: ['Release notes'],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-text-root',
                    props: { size: 'sm', tone: 'muted' },
                    children: [
                      'Card, Input Shell, and Button resolve one preset from the shared StyleScope.',
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-card-content',
                children: [
                  {
                    kind: 'box',
                    className: 'grid gap-3',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-input-shell',
                        ref: 'compositeShell',
                        props: { focusIndicator: 'ring' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-input-shell-control',
                            ref: 'compositeControl',
                            props: {
                              placeholder: 'Tag version (e.g. v1.4.0)',
                              ariaLabel: 'Tag version',
                            },
                          },
                        ],
                      },
                      {
                        kind: 'box',
                        className: 'flex flex-wrap gap-2',
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-button',
                            props: { variant: 'default', size: 'sm' },
                            children: ['Publish'],
                          },
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-button',
                            props: { variant: 'outline', size: 'sm' },
                            children: ['Save draft'],
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
      {
        kind: 'box',
        ref: 'compositeStatus',
        attrs: { role: 'status', 'aria-live': 'polite' },
        className: 'font-mono text-xs text-muted-foreground',
        children: ['scope="rhea" → { style: "rhea" } (Card, Input Shell & Button unified)'],
      },
    ],
  },
  setup({ refs, api }: DemoSetupContext) {
    let current = true;
    let active: CompositeChoice = 'rhea';
    const disposers = new Set<() => void>();

    const control = { getExposes: () => api.getExposes('compositeControl') };
    const binding = bindInputShellControl(
      {
        isCurrent: () => current,
        onDispose(dispose) {
          disposers.add(dispose);
          return () => disposers.delete(dispose);
        },
      },
      {
        instance: refs.compositeShell,
        setFacts(facts) {
          api.setProps('compositeShell', facts);
        },
      },
      control
    );

    const statusFor = (choice: CompositeChoice): string => {
      if (choice === 'new-york') {
        return 'scope="new-york" → normalized to { style: "new-york-v4" }';
      }
      if (choice === 'inherit') {
        return 'scope="inherit" → resumes outer scope ("rhea"; without an ancestor it publishes { style: null })';
      }
      return `scope="${choice}" → { style: "${choice}" } (Card, Input Shell & Button unified)`;
    };

    const select = (next: CompositeChoice) => {
      if (!current || next === active) return;
      active = next;
      api.setProps('compositeScope', { styleProfile: next });
      for (const choice of COMPOSITE_CHOICES) {
        api.setProps(`choice-${choice}`, {
          variant: choice === next ? 'default' : 'outline',
        });
      }
      refs.compositeStatus.textContent = statusFor(next);
    };

    for (const choice of COMPOSITE_CHOICES) {
      api.setProps(`choice-${choice}`, { onClick: () => select(choice) });
    }

    return () => {
      current = false;
      binding.dispose();
      for (const dispose of disposers) dispose();
      disposers.clear();
    };
  },
} satisfies DemoSpec);
