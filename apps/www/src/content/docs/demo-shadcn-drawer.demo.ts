import { withShadcnRheaDemo } from './shadcn-demo-style';
import { bindDrawerCommandDisabled } from './drawer-command-disabled.shared';
import type { DemoSpec } from '../../components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-drawer-root',
        ref: 'root',
        props: {
          a11yLabel: 'Daily activity goal',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-drawer-trigger',
            ref: 'trigger',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-button',
                ref: 'trigger-action',
                props: { variant: 'outline', disabled: true },
                children: ['Open Drawer'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-drawer-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-drawer-content',
            ref: 'panel',
            props: {
              side: 'bottom',
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-drawer-handle',
                props: { a11yLabel: 'Resize drawer' },
              },
              {
                kind: 'box',
                className: 'mx-auto w-full max-w-sm',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-drawer-header',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-drawer-title',
                        children: ['Move Goal'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-drawer-description',
                        children: ['Set your daily activity goal.'],
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'flex items-center justify-center gap-4 px-4 py-3',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-button',
                        ref: 'decrease',
                        props: { variant: 'outline', size: 'icon' },
                        children: [
                          { kind: 'proto', prototypeId: 'lucide-minus-icon', props: { size: 16 } },
                        ],
                      },
                      {
                        kind: 'box',
                        className: 'flex-1 text-center',
                        children: [
                          {
                            kind: 'box',
                            ref: 'goal-value',
                            className: 'text-4xl font-bold tracking-tight tabular-nums',
                            children: ['350'],
                          },
                          {
                            kind: 'box',
                            className: 'text-xs uppercase tracking-wide text-muted-foreground',
                            children: ['Calories / day'],
                          },
                        ],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-button',
                        ref: 'increase',
                        props: { variant: 'outline', size: 'icon' },
                        children: [
                          { kind: 'proto', prototypeId: 'lucide-plus-icon', props: { size: 16 } },
                        ],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-drawer-footer',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-button',
                        ref: 'submit',
                        props: { variant: 'default' },
                        children: ['Submit'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-drawer-close',
                        ref: 'close',
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-button',
                            ref: 'close-action',
                            props: { variant: 'outline', disabled: true },
                            children: ['Cancel'],
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
    ],
  },
  setup({ refs, api }) {
    let goal = 350;
    const renderGoal = () => {
      if (refs['goal-value']) refs['goal-value'].textContent = String(goal);
    };
    api.setProps('decrease', {
      onClick: () => {
        goal = Math.max(200, goal - 10);
        renderGoal();
      },
    });
    api.setProps('increase', {
      onClick: () => {
        goal = Math.min(600, goal + 10);
        renderGoal();
      },
    });
    api.setProps('submit', {
      onClick: () => {
        const root = api.getPublicInstance?.('root');
        const close = root?.getExposes?.()?.close as ((reason?: string) => void) | undefined;
        close?.('submit');
      },
    });
    return bindDrawerCommandDisabled(api);
  },
} satisfies DemoSpec);
