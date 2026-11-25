import type {
  DemoChild,
  DemoNode,
  DemoRuntimeApi,
  DemoSetupContext,
  DemoSpec,
} from '@/components/PrototypePreviewer/demo-types';

export type TransitionDemoFamily = 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';
type TransitionPhase = 'closed' | 'preparing' | 'entering' | 'entered' | 'leaving';
type ButtonTone = 'primary' | 'secondary' | 'outline';

const PHASES: readonly TransitionPhase[] = [
  'closed',
  'preparing',
  'entering',
  'entered',
  'leaving',
];

const PHASE_REF: Record<TransitionPhase, string> = {
  closed: 'phaseClosed',
  preparing: 'phasePreparing',
  entering: 'phaseEntering',
  entered: 'phaseEntered',
  leaving: 'phaseLeaving',
};

type FamilyTheme = Readonly<{
  outerClass: string;
  stageClass: string;
  emptyHintClass: string;
  transitionClass: string;
  cardClass: string;
  eyebrowClass: string;
  titleClass: string;
  bodyClass: string;
  chipBaseClass: string;
  chipActiveClass: string;
  chipIdleClass: string;
  presenceMountedClass: string;
  presenceDetachedClass: string;
  logPanelClass: string;
  logLineClass: string;
  helperTextClass: string;
  manualOpacity: boolean;
  buttonProps: (tone: ButtonTone) => Record<string, unknown>;
  stageBackdropChildren?: () => DemoChild[];
}>;

const FAMILY_THEMES: Record<TransitionDemoFamily, FamilyTheme> = {
  shadcn: {
    outerClass: 'flex w-full min-w-0 max-w-full flex-col items-center gap-5 p-4 sm:p-6',
    stageClass:
      'relative flex min-h-40 w-full max-w-md items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 p-4',
    emptyHintClass:
      'pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground transition-opacity duration-200 motion-reduce:transition-none',
    transitionClass:
      'block w-full transition-opacity duration-300 ease-out motion-reduce:transition-none',
    cardClass:
      'w-full rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm transition-opacity duration-300 ease-out motion-reduce:transition-none',
    eyebrowClass: 'text-xs font-medium text-muted-foreground',
    titleClass: 'mt-1 text-base font-semibold tracking-tight text-card-foreground',
    bodyClass: 'mt-1.5 text-sm leading-relaxed text-muted-foreground',
    chipBaseClass:
      'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-150',
    chipActiveClass: 'border-primary bg-primary text-primary-foreground shadow-xs',
    chipIdleClass: 'border-border bg-muted/50 text-muted-foreground',
    presenceMountedClass:
      'rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300',
    presenceDetachedClass:
      'rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground',
    logPanelClass:
      'w-full max-w-md rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs text-muted-foreground',
    logLineClass: 'py-0.5 text-foreground',
    helperTextClass: 'text-xs text-muted-foreground',
    manualOpacity: false,
    buttonProps: (tone) => {
      if (tone === 'primary') return { variant: 'default', size: 'sm' };
      if (tone === 'secondary') return { variant: 'secondary', size: 'sm' };
      return { variant: 'outline', size: 'sm' };
    },
  },
  brutalist: {
    outerClass:
      'flex w-full min-w-0 max-w-full flex-col items-center gap-5 p-4 font-sans font-medium sm:p-6',
    stageClass:
      'relative flex min-h-40 w-full max-w-md items-center justify-center rounded-[5px] border-2 border-dashed border-black/50 bg-[#dcebfe]/60 p-4 dark:border-foreground/50 dark:bg-background/60',
    emptyHintClass:
      'pointer-events-none absolute inset-0 flex items-center justify-center font-sans text-xs font-medium text-foreground/70 transition-opacity duration-150 ease-linear motion-reduce:transition-none',
    transitionClass:
      'block w-full transition-opacity duration-150 ease-linear motion-reduce:transition-none',
    cardClass:
      'w-full rounded-[5px] border-2 border-black bg-[#dcebfe] p-5 font-sans font-medium text-black shadow-[4px_4px_0_0_#000] transition-opacity duration-150 ease-linear motion-reduce:transition-none dark:bg-secondary-background dark:text-foreground',
    eyebrowClass:
      'font-heading text-xs font-bold tracking-wide text-black/80 dark:text-foreground/80',
    titleClass: 'mt-1 font-heading text-base font-bold text-black dark:text-foreground',
    bodyClass: 'mt-1.5 text-sm font-medium text-black/85 dark:text-foreground/85',
    chipBaseClass: 'rounded-[5px] border-2 border-black px-2.5 py-1 font-sans text-xs font-medium',
    chipActiveClass: 'bg-[#5294ff] font-heading font-bold text-black shadow-[2px_2px_0_0_#000]',
    chipIdleClass: 'bg-white text-black dark:bg-secondary-background dark:text-foreground',
    presenceMountedClass:
      'rounded-[5px] border-2 border-black bg-[#5294ff] px-2.5 py-0.5 font-heading text-xs font-bold text-black',
    presenceDetachedClass:
      'rounded-[5px] border-2 border-black bg-white px-2.5 py-0.5 font-sans text-xs font-medium text-black dark:bg-secondary-background dark:text-foreground',
    logPanelClass:
      'w-full max-w-md rounded-[5px] border-2 border-black bg-white p-3 font-mono text-xs text-black shadow-[3px_3px_0_0_#000] dark:bg-secondary-background dark:text-foreground',
    logLineClass: 'py-0.5',
    helperTextClass: 'font-sans text-xs font-medium text-foreground/80',
    manualOpacity: false,
    buttonProps: () => ({}),
  },
  'bootstrap-2-3-2': {
    outerClass:
      'flex w-full min-w-0 max-w-full flex-col items-center gap-4 p-4 font-sans text-[14px] leading-[20px] sm:p-6',
    stageClass:
      'relative flex min-h-40 w-full max-w-md items-center justify-center rounded-[4px] border border-[#e3e3e3] bg-[#f5f5f5] p-4 shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)]',
    emptyHintClass:
      'pointer-events-none absolute inset-0 flex items-center justify-center text-[12px] text-[#666666] transition-opacity duration-150 ease-linear motion-reduce:transition-none',
    transitionClass: 'block w-full',
    cardClass:
      'w-full rounded-[4px] border border-[#bce8f1] bg-[#d9edf7] px-4 py-3.5 text-[#3a87ad] shadow-[0_1px_0_rgba(255,255,255,0.5)_inset] transition-opacity duration-150 ease-linear motion-reduce:transition-none',
    eyebrowClass: 'text-[11px] font-bold uppercase tracking-wide text-[#3a87ad]',
    titleClass: 'mt-0.5 text-[15px] font-bold leading-[20px] text-[#2d6987]',
    bodyClass: 'mt-1 text-[13px] leading-[18px] text-[#3a87ad]',
    chipBaseClass: 'rounded-[3px] border px-2 py-0.5 text-[11px] font-bold leading-[16px]',
    chipActiveClass: 'border-[#003399] bg-[#0044cc] text-white',
    chipIdleClass: 'border-[#cccccc] bg-[#ffffff] text-[#333333]',
    presenceMountedClass:
      'rounded-[3px] border border-[#356635] bg-[#468847] px-2 py-0.5 text-[11px] font-bold text-white',
    presenceDetachedClass:
      'rounded-[3px] border border-[#999999] bg-[#999999] px-2 py-0.5 text-[11px] font-bold text-white',
    logPanelClass:
      'w-full max-w-md rounded-[4px] border border-[#cccccc] bg-[#ffffff] p-3 font-mono text-[12px] text-[#333333] shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)]',
    logLineClass: 'py-0.5 text-[#333333]',
    helperTextClass: 'text-[12px] text-[#666666]',
    manualOpacity: true,
    buttonProps: (tone) => {
      if (tone === 'primary') return { variant: 'primary', size: 'small' };
      if (tone === 'secondary') return { variant: 'default', size: 'small' };
      return { variant: 'info', size: 'small' };
    },
  },
  'liquid-glass': {
    outerClass: 'flex w-full min-w-0 max-w-full flex-col items-center gap-5',
    stageClass:
      'relative flex min-h-44 w-full max-w-md items-center justify-center overflow-hidden rounded-2xl border border-white/35 bg-gradient-to-br from-sky-400/35 via-indigo-500/25 to-rose-400/35 p-4 dark:border-white/15',
    emptyHintClass:
      'pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-medium text-foreground/75 transition-opacity duration-200 motion-reduce:transition-none',
    transitionClass:
      'relative z-10 block w-full transition-opacity duration-300 ease-out motion-reduce:transition-none',
    cardClass:
      'w-full rounded-2xl border border-white/55 bg-white/70 p-4 text-foreground shadow-lg backdrop-blur-xl transition-opacity duration-300 ease-out motion-reduce:transition-none dark:border-white/20 dark:bg-zinc-900/70',
    eyebrowClass:
      'inline-flex rounded-xl border border-white/50 bg-white/45 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80 dark:border-white/15 dark:bg-white/10',
    titleClass: 'mt-2 text-base font-semibold tracking-tight text-foreground',
    bodyClass: 'mt-1 text-sm leading-relaxed text-foreground/80',
    chipBaseClass:
      'rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur-md transition-colors duration-150',
    chipActiveClass: 'border-sky-400/70 bg-sky-600 text-white shadow-sm',
    chipIdleClass:
      'border-white/45 bg-white/55 text-foreground/80 dark:border-white/15 dark:bg-zinc-900/55',
    presenceMountedClass:
      'rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-900 backdrop-blur-md dark:text-emerald-200',
    presenceDetachedClass:
      'rounded-full border border-white/45 bg-white/55 px-2.5 py-0.5 text-xs font-medium text-foreground/75 backdrop-blur-md dark:border-white/15 dark:bg-zinc-900/55',
    logPanelClass:
      'w-full max-w-md rounded-2xl border border-white/45 bg-white/65 p-3 font-mono text-xs text-foreground shadow-sm backdrop-blur-xl dark:border-white/15 dark:bg-zinc-900/65',
    logLineClass: 'py-0.5 text-foreground',
    helperTextClass: 'text-xs font-medium text-foreground/80',
    manualOpacity: false,
    buttonProps: (tone) => {
      if (tone === 'primary') return { variant: 'prominent' };
      return { variant: 'regular' };
    },
    stageBackdropChildren: () => [
      {
        kind: 'box',
        className:
          'pointer-events-none absolute -top-8 -left-6 h-28 w-28 rounded-full bg-sky-400/55 blur-xl',
      },
      {
        kind: 'box',
        className:
          'pointer-events-none absolute -right-6 -bottom-8 h-32 w-32 rounded-full bg-fuchsia-400/50 blur-xl',
      },
      {
        kind: 'box',
        className:
          'pointer-events-none absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-white/35',
      },
    ],
  },
};

const exposeGet = (handle: unknown): unknown => {
  const h = handle as { get?: () => unknown; state?: { get?: () => unknown } } | undefined;
  return h?.get ? h.get() : h?.state?.get?.();
};

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isPhase = (value: unknown): value is TransitionPhase =>
  typeof value === 'string' && PHASES.includes(value as TransitionPhase);

function readTransitionSnapshot(api: DemoRuntimeApi): {
  phase: TransitionPhase;
  isPresent: boolean;
} {
  const exposes = api.getExposes('transition');
  const rawPhase = exposeGet(exposes?.transitionState);
  const rawPresent = exposeGet(exposes?.isPresent);
  const phase: TransitionPhase = isPhase(rawPhase) ? rawPhase : 'closed';
  const isPresent = typeof rawPresent === 'boolean' ? rawPresent : phase !== 'closed';
  return { phase, isPresent };
}

function makeButton(
  family: TransitionDemoFamily,
  ref: string,
  label: string,
  tone: ButtonTone = 'secondary'
): DemoNode {
  return {
    kind: 'proto',
    prototypeId: `${family}-button`,
    ref,
    props: FAMILY_THEMES[family].buttonProps(tone),
    children: [label],
  };
}

function makePhaseStrip(family: TransitionDemoFamily): DemoNode {
  const theme = FAMILY_THEMES[family];
  return {
    kind: 'box',
    className: 'flex max-w-full flex-wrap items-center justify-center gap-2',
    children: [
      ...PHASES.map(
        (phase): DemoNode => ({
          kind: 'box',
          tag: 'span',
          ref: PHASE_REF[phase],
          className: `${theme.chipBaseClass} ${theme.chipIdleClass}`,
          children: [phase],
        })
      ),
      {
        kind: 'box',
        tag: 'span',
        ref: 'presenceBadge',
        className: theme.presenceDetachedClass,
        children: ['Detached'],
      },
    ],
  };
}

function makeCardNode(
  family: TransitionDemoFamily,
  eyebrow: string,
  title: string,
  body: string
): DemoNode {
  const theme = FAMILY_THEMES[family];
  return {
    kind: 'box',
    className: theme.cardClass,
    attrs: { 'data-transition-surface': '1' },
    children: [
      { kind: 'box', tag: 'span', className: theme.eyebrowClass, children: [eyebrow] },
      { kind: 'box', className: theme.titleClass, children: [title] },
      { kind: 'box', className: theme.bodyClass, children: [body] },
    ],
  };
}

function makeStageNode(
  family: TransitionDemoFamily,
  emptyLabel: string,
  transitionProps: Record<string, unknown>,
  card: DemoNode
): DemoNode {
  const theme = FAMILY_THEMES[family];
  const backdrop = theme.stageBackdropChildren ? theme.stageBackdropChildren() : [];
  return {
    kind: 'box',
    className: theme.stageClass,
    children: [
      ...backdrop,
      {
        kind: 'box',
        ref: 'emptyHint',
        className: theme.emptyHintClass,
        children: [emptyLabel],
      },
      {
        kind: 'proto',
        prototypeId: `${family}-transition`,
        ref: 'transition',
        className: theme.transitionClass,
        props: transitionProps,
        children: [card],
      },
    ],
  };
}

function bindPhaseSync(
  family: TransitionDemoFamily,
  ctx: DemoSetupContext,
  hooks?: {
    onEvent?: (eventName: 'beforeEnter' | 'afterEnter' | 'beforeLeave' | 'afterLeave') => void;
    onSync?: (phase: TransitionPhase, isPresent: boolean) => void;
  }
) {
  const { host, refs, api } = ctx;
  const theme = FAMILY_THEMES[family];
  let lastPhase: TransitionPhase | null = null;
  let lastPresent: boolean | null = null;
  let rafId = 0;

  const animateEntryIfNeeded = (phase: TransitionPhase) => {
    const surface = host.querySelector<HTMLElement>('[data-transition-surface]');
    if (!surface) return;
    if (theme.manualOpacity) {
      if (phase === 'leaving' || phase === 'closed' || phase === 'preparing') {
        if (surface.style.opacity !== '0') surface.style.opacity = '0';
        return;
      }
      if (phase === 'entering' && lastPhase !== 'entering' && !prefersReducedMotion()) {
        surface.style.opacity = '0';
        void surface.offsetHeight;
        rafId = requestAnimationFrame(() => {
          surface.style.opacity = '1';
        });
        return;
      }
      if (surface.style.opacity !== '1') surface.style.opacity = '1';
      return;
    }

    if (
      phase === 'entering' &&
      (lastPhase === 'closed' || lastPhase === 'preparing' || lastPhase === null) &&
      !prefersReducedMotion()
    ) {
      surface.style.opacity = '0';
      void surface.offsetHeight;
      rafId = requestAnimationFrame(() => {
        surface.style.opacity = '1';
      });
    } else if (phase === 'entered' || prefersReducedMotion()) {
      if (surface.style.opacity !== '') surface.style.opacity = '';
    }
  };

  const sync = () => {
    const { phase, isPresent } = readTransitionSnapshot(api);
    if (phase === lastPhase && isPresent === lastPresent) return;

    for (const p of PHASES) {
      const chip = refs[PHASE_REF[p]];
      if (!chip) continue;
      const nextClass = `${theme.chipBaseClass} ${
        p === phase ? theme.chipActiveClass : theme.chipIdleClass
      }`;
      if (chip.className !== nextClass) chip.className = nextClass;
    }

    if (refs.presenceBadge) {
      const nextText = isPresent ? 'Mounted' : 'Detached';
      if (refs.presenceBadge.textContent !== nextText) {
        refs.presenceBadge.textContent = nextText;
      }
      const nextBadgeClass = isPresent ? theme.presenceMountedClass : theme.presenceDetachedClass;
      if (refs.presenceBadge.className !== nextBadgeClass) {
        refs.presenceBadge.className = nextBadgeClass;
      }
    }

    if (refs.emptyHint) {
      const nextOpacity = isPresent ? '0' : '1';
      if (refs.emptyHint.style.opacity !== nextOpacity) {
        refs.emptyHint.style.opacity = nextOpacity;
      }
    }

    animateEntryIfNeeded(phase);
    lastPhase = phase;
    lastPresent = isPresent;
    hooks?.onSync?.(phase, isPresent);
  };

  const emitEvent = (name: 'beforeEnter' | 'afterEnter' | 'beforeLeave' | 'afterLeave') => () => {
    hooks?.onEvent?.(name);
    sync();
  };

  api.setProps('transition', {
    onBeforeEnter: emitEvent('beforeEnter'),
    onAfterEnter: emitEvent('afterEnter'),
    onBeforeLeave: emitEvent('beforeLeave'),
    onAfterLeave: emitEvent('afterLeave'),
  });

  sync();

  const observeTarget = refs.transition ?? host;
  const mo = new MutationObserver(() => sync());
  mo.observe(observeTarget, {
    subtree: observeTarget === host,
    attributes: true,
    attributeFilter: ['data-transition-state', 'data-pui-style', 'data-pui-view-detached'],
  });

  const scheduleSync = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => sync());
  };

  const dispose = () => {
    cancelAnimationFrame(rafId);
    mo.disconnect();
  };

  return { sync, scheduleSync, dispose };
}

/**
 * Primary hero demo: imperative controls (enter / leave / complete) over the
 * family-authentic Transition surface with live 5-phase and presence feedback.
 */
export function createTransitionDemo(family: TransitionDemoFamily): DemoSpec {
  const theme = FAMILY_THEMES[family];
  return {
    type: 'demo',
    setup(ctx) {
      const { api } = ctx;
      const { scheduleSync, dispose } = bindPhaseSync(family, ctx);

      const command = (path: string) => () => {
        api.call('transition', path);
        scheduleSync();
      };

      api.setProps('enterBtn', { onClick: command('controls.enter') });
      api.setProps('leaveBtn', { onClick: command('controls.leave') });
      api.setProps('completeBtn', { onClick: command('controls.complete') });

      return dispose;
    },
    root: {
      kind: 'box',
      className: theme.outerClass,
      children: [
        makeStageNode(
          family,
          'Detached — choose Enter to mount the notification card',
          { defaultOpen: true, appear: true },
          makeCardNode(
            family,
            'Release Update',
            'Workspace synced',
            'Your project tokens and preview artifacts are up to date.'
          )
        ),
        {
          kind: 'box',
          className: 'flex flex-wrap items-center justify-center gap-2',
          children: [
            makeButton(family, 'enterBtn', 'Enter', 'primary'),
            makeButton(family, 'leaveBtn', 'Leave', 'secondary'),
            makeButton(family, 'completeBtn', 'Complete', 'outline'),
          ],
        },
        makePhaseStrip(family),
      ],
    },
  };
}

/**
 * Controlled `open` mode with optional CSS `transitionend` -> `controls.complete()` synchronization.
 */
export function createTransitionControlledDemo(family: TransitionDemoFamily): DemoSpec {
  const theme = FAMILY_THEMES[family];
  return {
    type: 'demo',
    setup(ctx) {
      const { host, refs, api } = ctx;
      let isOpen = false;
      let syncOnTransitionEnd = true;

      const updateHint = () => {
        if (!refs.modeHint) return;
        refs.modeHint.textContent = syncOnTransitionEnd
          ? 'open: ' + String(isOpen) + ' · transitionend completes phase early'
          : 'open: ' + String(isOpen) + ' · fallback timer (450ms / 350ms)';
      };

      const { scheduleSync, dispose } = bindPhaseSync(family, ctx, {
        onSync: () => updateHint(),
      });

      const onToggle = () => {
        isOpen = !isOpen;
        api.setProps('transition', { open: isOpen });
        updateHint();
        scheduleSync();
      };

      const onToggleSyncMode = () => {
        syncOnTransitionEnd = !syncOnTransitionEnd;
        updateHint();
      };

      const onTransitionEnd = (event: Event) => {
        if (!syncOnTransitionEnd) return;
        const target = event.target as HTMLElement | null;
        if (!target || !target.closest('[data-demo-ref="transition"]')) return;
        const { phase } = readTransitionSnapshot(api);
        if (phase === 'entering' || phase === 'leaving') {
          api.call('transition', 'controls.complete');
          scheduleSync();
        }
      };

      api.setProps('toggleBtn', { onClick: onToggle });
      api.setProps('syncEndBtn', { onClick: onToggleSyncMode });
      host.addEventListener('transitionend', onTransitionEnd);
      updateHint();

      return () => {
        host.removeEventListener('transitionend', onTransitionEnd);
        dispose();
      };
    },
    root: {
      kind: 'box',
      className: theme.outerClass,
      children: [
        makeStageNode(
          family,
          'Hidden (open = false) — toggle to mount',
          { open: false, appear: false, enterDuration: 450, leaveDuration: 350 },
          makeCardNode(
            family,
            'Controlled Banner',
            'Scheduled maintenance',
            'EU-West workers will restart at 02:00 UTC with zero expected downtime.'
          )
        ),
        {
          kind: 'box',
          className: 'flex flex-wrap items-center justify-center gap-2',
          children: [
            makeButton(family, 'toggleBtn', 'Toggle open', 'primary'),
            makeButton(family, 'syncEndBtn', 'Switch completion mode', 'outline'),
          ],
        },
        {
          kind: 'box',
          ref: 'modeHint',
          className: theme.helperTextClass,
          children: ['open: false · transitionend completes phase early'],
        },
        makePhaseStrip(family),
      ],
    },
  };
}

/**
 * Interruption policy comparison: `'reverse' | 'wait' | 'immediate'` during longer transitions.
 */
export function createTransitionInterruptDemo(family: TransitionDemoFamily): DemoSpec {
  const theme = FAMILY_THEMES[family];
  return {
    type: 'demo',
    setup(ctx) {
      const { refs, api } = ctx;
      let policy: 'reverse' | 'wait' | 'immediate' = 'reverse';
      let rapidTimer: ReturnType<typeof setTimeout> | null = null;

      const updatePolicyLabel = () => {
        if (refs.activePolicyBadge) {
          refs.activePolicyBadge.textContent = `interrupt: "${policy}"`;
        }
      };

      const { scheduleSync, dispose } = bindPhaseSync(family, ctx);

      const setPolicy = (next: 'reverse' | 'wait' | 'immediate') => () => {
        policy = next;
        api.setProps('transition', { interrupt: next });
        updatePolicyLabel();
        scheduleSync();
      };

      const show = () => {
        api.call('transition', 'controls.enter');
        scheduleSync();
      };

      const hide = () => {
        api.call('transition', 'controls.leave');
        scheduleSync();
      };

      const rapidInterrupt = () => {
        if (rapidTimer) clearTimeout(rapidTimer);
        const { phase } = readTransitionSnapshot(api);
        const goLeaveFirst = phase === 'entered' || phase === 'entering';
        api.call('transition', goLeaveFirst ? 'controls.leave' : 'controls.enter');
        scheduleSync();
        rapidTimer = setTimeout(() => {
          api.call('transition', goLeaveFirst ? 'controls.enter' : 'controls.leave');
          scheduleSync();
        }, 220);
      };

      api.setProps('policyReverseBtn', { onClick: setPolicy('reverse') });
      api.setProps('policyWaitBtn', { onClick: setPolicy('wait') });
      api.setProps('policyImmediateBtn', { onClick: setPolicy('immediate') });
      api.setProps('showBtn', { onClick: show });
      api.setProps('hideBtn', { onClick: hide });
      api.setProps('rapidToggleBtn', { onClick: rapidInterrupt });
      updatePolicyLabel();

      return () => {
        if (rapidTimer) clearTimeout(rapidTimer);
        dispose();
      };
    },
    root: {
      kind: 'box',
      className: theme.outerClass,
      children: [
        makeStageNode(
          family,
          'Detached — use Enter or Interrupt mid-flight to compare policies',
          {
            defaultOpen: true,
            appear: true,
            enterDuration: 900,
            leaveDuration: 900,
            interrupt: 'reverse',
          },
          makeCardNode(
            family,
            'Interruption Policy',
            '900ms phase window',
            'Trigger a mid-flight interruption to compare reverse, wait, and immediate behavior.'
          )
        ),
        {
          kind: 'box',
          className: 'flex flex-wrap items-center justify-center gap-2',
          children: [
            makeButton(family, 'policyReverseBtn', 'Reverse', 'outline'),
            makeButton(family, 'policyWaitBtn', 'Wait', 'outline'),
            makeButton(family, 'policyImmediateBtn', 'Immediate', 'outline'),
          ],
        },
        {
          kind: 'box',
          className: 'flex flex-wrap items-center justify-center gap-2',
          children: [
            makeButton(family, 'rapidToggleBtn', 'Interrupt mid-flight', 'primary'),
            makeButton(family, 'showBtn', 'Enter', 'secondary'),
            makeButton(family, 'hideBtn', 'Leave', 'secondary'),
          ],
        },
        {
          kind: 'box',
          ref: 'activePolicyBadge',
          className: theme.helperTextClass,
          children: ['interrupt: "reverse"'],
        },
        makePhaseStrip(family),
      ],
    },
  };
}

/**
 * Lifecycle events (`beforeEnter`, `afterEnter`, `beforeLeave`, `afterLeave`) and `appear` log.
 */
export function createTransitionLifecycleDemo(family: TransitionDemoFamily): DemoSpec {
  const theme = FAMILY_THEMES[family];
  return {
    type: 'demo',
    setup(ctx) {
      const { refs, api } = ctx;
      const entries: string[] = [];
      let count = 0;

      const renderLog = () => {
        const container = refs.eventLog;
        if (!container) return;
        container.textContent = '';
        if (entries.length === 0) {
          const empty = document.createElement('div');
          empty.textContent = 'No lifecycle events recorded yet.';
          container.appendChild(empty);
          return;
        }
        for (const entry of entries) {
          const line = document.createElement('div');
          line.className = theme.logLineClass;
          line.textContent = entry;
          container.appendChild(line);
        }
      };

      const { scheduleSync, dispose } = bindPhaseSync(family, ctx, {
        onEvent: (eventName) => {
          const { isPresent } = readTransitionSnapshot(api);
          count += 1;
          entries.push(`#${count} ${eventName} (isPresent: ${String(isPresent)})`);
          if (entries.length > 6) entries.shift();
          renderLog();
        },
      });

      api.setProps('enterBtn', {
        onClick: () => {
          api.call('transition', 'controls.enter');
          scheduleSync();
        },
      });
      api.setProps('leaveBtn', {
        onClick: () => {
          api.call('transition', 'controls.leave');
          scheduleSync();
        },
      });
      api.setProps('clearLogBtn', {
        onClick: () => {
          entries.length = 0;
          count = 0;
          renderLog();
        },
      });

      renderLog();
      return dispose;
    },
    root: {
      kind: 'box',
      className: theme.outerClass,
      children: [
        makeStageNode(
          family,
          'Detached — trigger Enter to record beforeEnter and afterEnter',
          { defaultOpen: true, appear: true, enterDuration: 350, leaveDuration: 250 },
          makeCardNode(
            family,
            'Lifecycle & Appear',
            'Boundary signals',
            'Each enter and leave sequence emits ordered before/after signals while keeping view resources mounted until closed.'
          )
        ),
        {
          kind: 'box',
          className: 'flex flex-wrap items-center justify-center gap-2',
          children: [
            makeButton(family, 'enterBtn', 'Enter', 'primary'),
            makeButton(family, 'leaveBtn', 'Leave', 'secondary'),
            makeButton(family, 'clearLogBtn', 'Clear Log', 'outline'),
          ],
        },
        makePhaseStrip(family),
        {
          kind: 'box',
          ref: 'eventLog',
          className: theme.logPanelClass,
          children: ['Listening for lifecycle events…'],
        },
      ],
    },
  };
}

/**
 * Liquid Glass HIG prominence hierarchy & accessibility fallback showcase:
 * Regular glass vs. Prominent tinted surface vs. High-contrast opaque fallback
 * (Reduce Transparency / Increase Contrast), with Transition remaining transparent
 * so glass layers are never stacked glass-on-glass.
 */
export function createLiquidGlassTransitionAccessibilityDemo(): DemoSpec {
  const family: TransitionDemoFamily = 'liquid-glass';
  const theme = FAMILY_THEMES[family];

  type SurfaceMode = 'regular' | 'prominent' | 'opaque';

  const modeClasses: Record<SurfaceMode, string> = {
    regular:
      'w-full rounded-2xl border border-white/55 bg-white/70 p-4 text-foreground shadow-lg backdrop-blur-xl transition-opacity duration-300 ease-out motion-reduce:transition-none dark:border-white/20 dark:bg-zinc-900/70',
    prominent:
      'w-full rounded-2xl border border-white/50 bg-sky-600/85 p-4 text-white shadow-lg backdrop-blur-xl transition-opacity duration-300 ease-out motion-reduce:transition-none dark:bg-sky-500/80',
    opaque:
      'w-full rounded-2xl border-2 border-zinc-900/40 bg-white p-4 text-zinc-950 shadow-md transition-opacity duration-300 ease-out motion-reduce:transition-none dark:border-white/50 dark:bg-zinc-950 dark:text-zinc-50',
  };

  const modeDescriptions: Record<SurfaceMode, string> = {
    regular:
      'Regular translucent glass over backdrop; Transition stays transparent (no glass-on-glass).',
    prominent:
      'Prominent tinted glass highlights one primary floating panel over the same backdrop.',
    opaque:
      'Opaque high-contrast fallback mirrors Reduce Transparency / Increase Contrast preferences.',
  };

  return {
    type: 'demo',
    setup(ctx) {
      const { host, refs, api } = ctx;
      let isOpen = true;
      let mode: SurfaceMode = 'regular';

      const applySurfaceMode = () => {
        const surface = host.querySelector<HTMLElement>('[data-transition-surface]');
        if (surface) {
          surface.className = modeClasses[mode];
        }
        if (refs.modeDescription) {
          refs.modeDescription.textContent = modeDescriptions[mode];
        }
        api.setProps('toggleBtn', {
          variant: mode === 'regular' ? 'regular' : 'prominent',
          material: mode === 'opaque' ? 'opaque' : 'auto',
        });
      };

      const { scheduleSync, dispose } = bindPhaseSync(family, ctx, {
        onSync: () => applySurfaceMode(),
      });

      const selectMode = (next: SurfaceMode) => () => {
        mode = next;
        applySurfaceMode();
      };

      api.setProps('modeRegularBtn', { onClick: selectMode('regular') });
      api.setProps('modeProminentBtn', { onClick: selectMode('prominent') });
      api.setProps('modeOpaqueBtn', { onClick: selectMode('opaque') });
      api.setProps('toggleBtn', {
        onClick: () => {
          isOpen = !isOpen;
          api.setProps('transition', { open: isOpen });
          scheduleSync();
        },
      });

      applySurfaceMode();
      return dispose;
    },
    root: {
      kind: 'box',
      className: theme.outerClass,
      children: [
        makeStageNode(
          family,
          'Floating overlay detached — toggle to present over backdrop',
          { open: true, appear: true, enterDuration: 300, leaveDuration: 200 },
          makeCardNode(
            family,
            'Liquid Glass Surface',
            'Now Playing Controls',
            'Concentric outer/inner radii float cleanly above colorful artwork without stacking glass on glass.'
          )
        ),
        {
          kind: 'box',
          className: 'flex flex-wrap items-center justify-center gap-2',
          children: [
            makeButton(family, 'modeRegularBtn', 'Regular Glass', 'secondary'),
            makeButton(family, 'modeProminentBtn', 'Prominent Tint', 'primary'),
            {
              kind: 'proto',
              prototypeId: 'liquid-glass-button',
              ref: 'modeOpaqueBtn',
              props: { variant: 'regular', material: 'opaque' },
              children: ['Opaque Fallback'],
            },
            makeButton(family, 'toggleBtn', 'Toggle Panel', 'secondary'),
          ],
        },
        {
          kind: 'box',
          ref: 'modeDescription',
          className: theme.helperTextClass,
          children: [modeDescriptions.regular],
        },
        makePhaseStrip(family),
      ],
    },
  };
}
