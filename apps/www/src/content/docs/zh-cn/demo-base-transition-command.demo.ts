import type { DemoSetupContext } from '../../../components/PrototypePreviewer/demo-types';

export default {
  type: 'demo',
  setup({ host, refs, api }: DemoSetupContext) {
    const label = refs.stateLabel;
    if (!label) return;

    const getTransitionState = () =>
      (
        api.getExposes('transition')?.transitionState as { get?: () => string } | undefined
      )?.get?.();

    const readState = () => {
      const s = getTransitionState();
      label.textContent = typeof s === 'string' ? s : 'unknown';
    };

    readState();
    const mo = new MutationObserver(readState);
    mo.observe(host, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-transition-state'],
    });

    const onHostClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-demo-ref="enterBtn"]')) {
        api.call('transition', 'controls.enter');
      } else if (target.closest('[data-demo-ref="leaveBtn"]')) {
        api.call('transition', 'controls.leave');
      } else if (target.closest('[data-demo-ref="completeBtn"]')) {
        api.call('transition', 'controls.complete');
      }
    };

    host.addEventListener('click', onHostClick);

    return () => {
      mo.disconnect();
      host.removeEventListener('click', onHostClick);
    };
  },
  root: {
    kind: 'box',
    className: 'flex flex-col items-center gap-6 p-8',
    children: [
      {
        kind: 'proto',
        prototypeId: 'base-transition',
        ref: 'transition',
        props: {
          defaultOpen: true,
          appear: true,
        },
        className: 'transition-wrapper',
        children: [
          {
            kind: 'box',
            className:
              'w-64 h-40 rounded-xl flex flex-col items-center justify-center text-background shadow-xl transition-box',
            children: [
              {
                kind: 'box',
                className: 'text-lg font-semibold',
                children: ['Animated Box'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center justify-center gap-2',
        children: [
          {
            kind: 'box',
            ref: 'enterBtn',
            className:
              'px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md cursor-pointer select-none',
            children: ['Enter'],
          },
          {
            kind: 'box',
            ref: 'leaveBtn',
            className:
              'px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md cursor-pointer select-none',
            children: ['Leave'],
          },
          {
            kind: 'box',
            ref: 'completeBtn',
            className:
              'px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md cursor-pointer select-none',
            children: ['Complete'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'text-sm text-slate-500',
        children: [
          'State: ',
          {
            kind: 'box',
            ref: 'stateLabel',
            className: 'inline text-slate-800 font-semibold',
            children: ['—'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex gap-4 text-xs',
        children: [
          {
            kind: 'box',
            className: 'px-3 py-1 bg-muted text-muted-foreground rounded',
            children: ['closed'],
          },
          {
            kind: 'box',
            className: 'px-3 py-1 bg-muted text-muted-foreground rounded',
            children: ['entering'],
          },
          {
            kind: 'box',
            className: 'px-3 py-1 bg-muted text-muted-foreground rounded',
            children: ['entered'],
          },
          {
            kind: 'box',
            className: 'px-3 py-1 bg-muted text-muted-foreground rounded',
            children: ['leaving'],
          },
        ],
      },
    ],
  },
};
