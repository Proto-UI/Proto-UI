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

    const toggleOpen = () => {
      const state = getTransitionState();
      const isOpen = state === 'entered' || state === 'entering';
      api.setProps('transition', { open: !isOpen });
    };

    const onHostClick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-demo-ref="toggleBtn"]') || target.closest('.transition-box')) {
        toggleOpen();
      }
    };

    // 使用 host 级别事件委托，覆盖 presence 真实卸载后的 remount 节点。
    const onTransitionEnd = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('[data-demo-ref="transition"]')) return;
      if (!target.classList.contains('transition-box')) return;
      const state = getTransitionState();
      if (state === 'entering' || state === 'leaving') {
        api.call('transition', 'controls.complete');
      }
    };
    host.addEventListener('click', onHostClick);
    host.addEventListener('transitionend', onTransitionEnd);

    return () => {
      mo.disconnect();
      host.removeEventListener('click', onHostClick);
      host.removeEventListener('transitionend', onTransitionEnd);
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
          open: false,
          appear: false,
        },
        className: 'transition-wrapper',
        children: [
          {
            kind: 'box',
            ref: 'box',
            className:
              'w-64 h-40 rounded-xl flex flex-col items-center justify-center text-background shadow-xl transition-box cursor-pointer select-none',
            children: [
              {
                kind: 'box',
                className: 'text-lg font-semibold',
                children: ['Click Me'],
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
            ref: 'toggleBtn',
            className:
              'px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md cursor-pointer select-none',
            children: ['Toggle Open'],
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
