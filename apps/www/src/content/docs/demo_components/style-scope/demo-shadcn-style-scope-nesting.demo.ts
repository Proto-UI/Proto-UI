import type {
  DemoSetupContext,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full min-w-0 max-w-3xl gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        attrs: { role: 'group', 'aria-label': 'Style scope precedence controls' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'toggleOuter',
            props: { variant: 'outline', size: 'sm' },
            children: ['Switch outer scope'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'toggleInner',
            props: { variant: 'default', size: 'sm' },
            children: ['Toggle nested inherit'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'toggleOverride',
            props: { variant: 'default', size: 'sm' },
            children: ['Toggle Card 3 inherit'],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-style-scope',
        ref: 'outerScope',
        className: 'contents',
        props: { styleProfile: 'rhea' },
        children: [
          {
            kind: 'box',
            className: 'grid w-full gap-4 md:grid-cols-3',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-card-root',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-card-header',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-text-root',
                        props: { weight: 'semibold', tone: 'inherit' },
                        children: ['Outer scope'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-text-root',
                        props: { size: 'sm', tone: 'muted' },
                        children: ['Inherits the outer StyleScope preset.'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-card-content',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-button',
                        props: { variant: 'outline', size: 'sm' },
                        children: ['Inherited action'],
                      },
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-style-scope',
                ref: 'innerScope',
                className: 'contents',
                props: { styleProfile: 'new-york' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-card-root',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-card-header',
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-text-root',
                            props: { weight: 'semibold', tone: 'inherit' },
                            children: ['Nested scope'],
                          },
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-text-root',
                            props: { size: 'sm', tone: 'muted' },
                            children: ['Overrides outer scope until reset to inherit.'],
                          },
                        ],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-card-content',
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-button',
                            props: { variant: 'outline', size: 'sm' },
                            children: ['Scoped action'],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-card-root',
                ref: 'overrideCard',
                props: { styleProfile: 'new-york-v4' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-card-header',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-text-root',
                        props: { weight: 'semibold', tone: 'inherit' },
                        children: ['Explicit prop'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-text-root',
                        props: { size: 'sm', tone: 'muted' },
                        children: ['Direct styleProfile wins over ancestor scopes.'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-card-content',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-button',
                        props: { variant: 'outline', size: 'sm' },
                        children: ['Override action'],
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
        ref: 'nestingStatus',
        attrs: { role: 'status', 'aria-live': 'polite' },
        className: 'font-mono text-xs text-muted-foreground',
        children: ['outer="rhea" · nested="new-york" (→ new-york-v4) · card3="new-york-v4"'],
      },
    ],
  },
  setup({ refs, api }: DemoSetupContext) {
    let disposed = false;
    let outer: 'rhea' | 'new-york-v4' = 'rhea';
    let inner: 'new-york' | 'inherit' = 'new-york';
    let card3: 'new-york-v4' | 'inherit' = 'new-york-v4';

    const syncStatus = () => {
      const innerResolved =
        inner === 'new-york' ? 'new-york" (→ new-york-v4)' : `inherit" (→ ${outer})`;
      const card3Resolved = card3 === 'new-york-v4' ? 'new-york-v4"' : `inherit" (→ ${outer})`;
      refs.nestingStatus.textContent = `outer="${outer}" · nested="${innerResolved} · card3="${card3Resolved}`;
    };

    api.setProps('toggleOuter', {
      onClick: () => {
        if (disposed) return;
        outer = outer === 'rhea' ? 'new-york-v4' : 'rhea';
        api.setProps('outerScope', { styleProfile: outer });
        syncStatus();
      },
    });

    api.setProps('toggleInner', {
      onClick: () => {
        if (disposed) return;
        inner = inner === 'new-york' ? 'inherit' : 'new-york';
        api.setProps('innerScope', { styleProfile: inner });
        api.setProps('toggleInner', { variant: inner === 'new-york' ? 'default' : 'outline' });
        syncStatus();
      },
    });

    api.setProps('toggleOverride', {
      onClick: () => {
        if (disposed) return;
        card3 = card3 === 'new-york-v4' ? 'inherit' : 'new-york-v4';
        api.setProps('overrideCard', { styleProfile: card3 });
        api.setProps('toggleOverride', {
          variant: card3 === 'new-york-v4' ? 'default' : 'outline',
        });
        syncStatus();
      },
    });

    return () => {
      disposed = true;
    };
  },
} satisfies DemoSpec);
