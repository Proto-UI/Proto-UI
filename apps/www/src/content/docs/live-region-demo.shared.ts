import type { DemoChild, DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export type LiveRegionDemoFamily = 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';

type ButtonTone = 'primary' | 'secondary' | 'danger';

interface FamilyTheme {
  readonly stage: string;
  readonly card: string;
  readonly alertCard: string;
  readonly header: string;
  readonly label: string;
  readonly badgePolite: string;
  readonly badgeAssertive: string;
  readonly payload: string;
  readonly mutedNote: string;
  readonly actions: string;
  readonly buttonProps: (tone: ButtonTone) => Record<string, unknown> | undefined;
}

const FAMILY_THEMES: Readonly<Record<LiveRegionDemoFamily, FamilyTheme>> = {
  shadcn: {
    stage: 'grid w-full min-w-0 max-w-xl gap-4 p-4',
    card: 'grid gap-2 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xs',
    alertCard:
      'grid gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-foreground',
    header: 'flex flex-wrap items-center justify-between gap-2',
    label: 'text-xs font-medium text-muted-foreground',
    badgePolite: 'rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground',
    badgeAssertive: 'rounded bg-destructive/15 px-2 py-0.5 font-mono text-[11px] text-destructive',
    payload: 'min-w-0 text-sm leading-relaxed',
    mutedNote: 'text-xs text-muted-foreground',
    actions: 'flex flex-wrap items-center gap-2',
    buttonProps: (tone) => {
      if (tone === 'danger') return { variant: 'destructive' };
      if (tone === 'secondary') return { variant: 'outline' };
      return { variant: 'default' };
    },
  },
  brutalist: {
    stage: 'grid w-full min-w-0 max-w-xl gap-4 p-4 font-sans font-medium',
    card: 'grid gap-2 rounded-[5px] border-2 border-black bg-card p-4 text-foreground shadow-[4px_4px_0_0_#000]',
    alertCard:
      'grid gap-2 rounded-[5px] border-2 border-black bg-background p-4 text-foreground shadow-[4px_4px_0_0_#000]',
    header: 'flex flex-wrap items-center justify-between gap-2',
    label: 'font-heading text-xs font-bold tracking-wide text-foreground',
    badgePolite:
      'rounded-[5px] border-2 border-black bg-[#5294ff] px-2 py-0.5 font-mono text-[11px] font-medium text-black',
    badgeAssertive:
      'rounded-[5px] border-2 border-black bg-[#ff4d50] px-2 py-0.5 font-mono text-[11px] font-medium text-black',
    payload: 'min-w-0 text-sm font-medium leading-relaxed',
    mutedNote: 'text-xs font-medium text-muted-foreground',
    actions: 'flex flex-wrap items-center gap-3',
    buttonProps: () => undefined,
  },
  'bootstrap-2-3-2': {
    stage: 'grid w-full min-w-0 max-w-xl gap-4 p-4 font-sans text-[14px] leading-[20px]',
    card: 'grid gap-2 rounded-[4px] border border-[#e3e3e3] bg-[#f5f5f5] p-[14px] text-[#333333] shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)] dark:border-[#5a5a5a] dark:bg-[#2c2c2c] dark:text-[#eeeeee]',
    alertCard:
      'grid gap-2 rounded-[4px] border border-[#eed3d7] bg-[#f2dede] p-[14px] text-[#b94a48] dark:border-[#7f3b3a] dark:bg-[#3a1f1f] dark:text-[#f2a6a4]',
    header: 'flex flex-wrap items-center justify-between gap-2',
    label: 'text-[12px] font-bold leading-[18px]',
    badgePolite:
      'rounded-[3px] bg-[#999999] px-2 py-0.5 font-mono text-[11px] font-bold leading-[14px] text-white',
    badgeAssertive:
      'rounded-[3px] bg-[#b94a48] px-2 py-0.5 font-mono text-[11px] font-bold leading-[14px] text-white',
    payload: 'min-w-0 text-[14px] leading-[20px]',
    mutedNote: 'text-[12px] leading-[18px] text-[#666666] dark:text-[#bdbdbd]',
    actions: 'flex flex-wrap items-center gap-2',
    buttonProps: (tone) => {
      if (tone === 'danger') return { variant: 'danger' };
      if (tone === 'primary') return { variant: 'primary' };
      return { variant: 'default' };
    },
  },
  'liquid-glass': {
    // Rich backdrop showcases floating Liquid Glass triggers while the live
    // region stays in an opaque content surface (never glass-on-glass).
    stage: 'grid w-full min-w-0 max-w-xl gap-4',
    card: 'grid gap-2 rounded-xl border border-border/60 bg-background/95 p-4 text-foreground shadow-sm',
    alertCard:
      'grid gap-2 rounded-xl border border-destructive/40 bg-background/95 p-4 text-foreground shadow-sm',
    header: 'flex flex-wrap items-center justify-between gap-2',
    label: 'text-xs font-medium text-muted-foreground',
    badgePolite: 'rounded-full bg-muted px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground',
    badgeAssertive:
      'rounded-full bg-destructive/15 px-2.5 py-0.5 font-mono text-[11px] text-destructive',
    payload: 'min-w-0 text-sm leading-relaxed',
    mutedNote: 'text-xs text-muted-foreground',
    actions: 'flex flex-wrap items-center gap-3',
    buttonProps: (tone) => {
      if (tone === 'primary') return { variant: 'prominent' };
      return { variant: 'regular' };
    },
  },
};

function makeButton(
  family: LiveRegionDemoFamily,
  ref: string,
  label: string,
  tone: ButtonTone = 'secondary',
  labelRef?: string
): DemoNode {
  const props = FAMILY_THEMES[family].buttonProps(tone);
  const child: DemoChild = labelRef
    ? { kind: 'box', tag: 'span', ref: labelRef, children: [label] }
    : label;
  return {
    kind: 'proto',
    prototypeId: `${family}-button`,
    ref,
    ...(props ? { props } : {}),
    children: [child],
  };
}

function makeRegionCard(
  family: LiveRegionDemoFamily,
  options: {
    title: string;
    badge: string;
    badgeRef?: string;
    assertive?: boolean;
    regionRef: string;
    props: Record<string, unknown>;
    payload: DemoChild[];
  }
): DemoNode {
  const theme = FAMILY_THEMES[family];
  return {
    kind: 'box',
    className: options.assertive ? theme.alertCard : theme.card,
    children: [
      {
        kind: 'box',
        className: theme.header,
        children: [
          {
            kind: 'box',
            tag: 'span',
            className: theme.label,
            children: [options.title],
          },
          {
            kind: 'box',
            tag: 'span',
            ...(options.badgeRef ? { ref: options.badgeRef } : {}),
            className: options.assertive ? theme.badgeAssertive : theme.badgePolite,
            children: [options.badge],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: `${family}-live-region-root`,
        ref: options.regionRef,
        props: options.props,
        children: [
          {
            kind: 'box',
            className: theme.payload,
            children: options.payload,
          },
        ],
      },
    ],
  };
}

/**
 * Primary hero demo: polite status notifications and assertive service alerts.
 * Preserves the exact manifest prototype closure (`<family>-live-region-root`
 * and `<family>-button`).
 */
export function createLiveRegionDemo(family: LiveRegionDemoFamily): DemoSpec {
  const theme = FAMILY_THEMES[family];
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: theme.stage,
      children: [
        makeRegionCard(family, {
          title: 'Inbox status',
          badge: 'role="status" aria-live="polite" aria-atomic="true"',
          regionRef: 'politeRegion',
          props: { politeness: 'polite', atomic: true },
          payload: [
            {
              kind: 'box',
              tag: 'span',
              ref: 'politePayload',
              children: ['No unread messages'],
            },
          ],
        }),
        makeRegionCard(family, {
          title: 'Service health',
          badge: 'role="alert" aria-live="assertive" aria-atomic="true"',
          assertive: true,
          regionRef: 'assertiveRegion',
          props: { politeness: 'assertive', atomic: true },
          payload: [
            {
              kind: 'box',
              tag: 'span',
              ref: 'assertivePayload',
              children: ['All systems operational'],
            },
          ],
        }),
        {
          kind: 'box',
          className: theme.actions,
          children: [
            makeButton(family, 'checkInbox', 'Check inbox', 'primary'),
            makeButton(family, 'toggleIncident', 'Simulate outage', 'danger', 'incidentLabel'),
          ],
        },
      ],
    },
    setup({ refs, api }) {
      let unreadCount = 0;
      let degraded = false;

      api.setProps('checkInbox', {
        onClick: () => {
          unreadCount += 1;
          if (refs.politePayload) {
            refs.politePayload.textContent = `${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`;
          }
        },
      });

      api.setProps('toggleIncident', {
        onClick: () => {
          degraded = !degraded;
          if (refs.assertivePayload) {
            refs.assertivePayload.textContent = degraded
              ? 'API latency elevated — automatic retries active'
              : 'All systems operational';
          }
          if (refs.incidentLabel) {
            refs.incidentLabel.textContent = degraded ? 'Resolve outage' : 'Simulate outage';
          }
        },
      });
    },
  };
}

/**
 * Atomic vs incremental updates: compares `atomic={true}` (reads entire region)
 * against `atomic={false}` (reads only mutated descendant nodes).
 */
export function createLiveRegionAtomicDemo(family: LiveRegionDemoFamily): DemoSpec {
  const theme = FAMILY_THEMES[family];
  const steps = [
    '25% (1 of 4 files)',
    '50% (2 of 4 files)',
    '75% (3 of 4 files)',
    '100% (4 of 4 files)',
  ];
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: theme.stage,
      children: [
        makeRegionCard(family, {
          title: 'Atomic announcement (full sentence)',
          badge: 'aria-atomic="true"',
          regionRef: 'atomicTrueRegion',
          props: { politeness: 'polite', atomic: true },
          payload: [
            'Upload progress: ',
            {
              kind: 'box',
              tag: 'span',
              ref: 'atomicTrueStep',
              children: [steps[0]!],
            },
          ],
        }),
        makeRegionCard(family, {
          title: 'Incremental announcement (changed fragment only)',
          badge: 'aria-atomic="false"',
          regionRef: 'atomicFalseRegion',
          props: { politeness: 'polite', atomic: false },
          payload: [
            'Upload progress: ',
            {
              kind: 'box',
              tag: 'span',
              ref: 'atomicFalseStep',
              children: [steps[0]!],
            },
          ],
        }),
        {
          kind: 'box',
          className: theme.actions,
          children: [
            makeButton(family, 'advanceUpload', 'Advance upload', 'primary'),
            makeButton(family, 'resetUpload', 'Reset', 'secondary'),
          ],
        },
      ],
    },
    setup({ refs, api }) {
      let stepIndex = 0;

      const sync = () => {
        const text = steps[stepIndex]!;
        if (refs.atomicTrueStep) refs.atomicTrueStep.textContent = text;
        if (refs.atomicFalseStep) refs.atomicFalseStep.textContent = text;
      };

      api.setProps('advanceUpload', {
        onClick: () => {
          stepIndex = (stepIndex + 1) % steps.length;
          sync();
        },
      });

      api.setProps('resetUpload', {
        onClick: () => {
          stepIndex = 0;
          sync();
        },
      });
    },
  };
}

/**
 * Dynamic prop transition: toggles `politeness` and `atomic` on a mounted
 * region while keeping the authored announcement payload untouched.
 */
export function createLiveRegionDynamicDemo(family: LiveRegionDemoFamily): DemoSpec {
  const theme = FAMILY_THEMES[family];
  const messages = [
    'Release v2.4.1 queued for production deploy',
    'Canary checks passed on 3 of 3 regions',
    'Rollback window open for the next 15 minutes',
  ];

  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: theme.stage,
      children: [
        makeRegionCard(family, {
          title: 'Dynamic live region',
          badge: 'role="status" aria-live="polite" aria-atomic="true"',
          badgeRef: 'ariaBadge',
          regionRef: 'dynamicRegion',
          props: { politeness: 'polite', atomic: true },
          payload: [
            {
              kind: 'box',
              tag: 'span',
              ref: 'dynamicPayload',
              children: [messages[0]!],
            },
          ],
        }),
        {
          kind: 'box',
          className: theme.actions,
          children: [
            makeButton(
              family,
              'togglePoliteness',
              'Switch to assertive',
              'primary',
              'politenessLabel'
            ),
            makeButton(family, 'toggleAtomic', 'Set atomic=false', 'secondary', 'atomicLabel'),
            makeButton(family, 'nextMessage', 'Update text', 'secondary'),
          ],
        },
      ],
    },
    setup({ refs, api }) {
      let politeness: 'polite' | 'assertive' = 'polite';
      let atomic = true;
      let messageIndex = 0;

      const syncProps = () => {
        api.setProps('dynamicRegion', { politeness, atomic });
        const role = politeness === 'assertive' ? 'alert' : 'status';
        if (refs.ariaBadge) {
          refs.ariaBadge.textContent = `role="${role}" aria-live="${politeness}" aria-atomic="${String(atomic)}"`;
        }
        if (refs.politenessLabel) {
          refs.politenessLabel.textContent =
            politeness === 'polite' ? 'Switch to assertive' : 'Switch to polite';
        }
        if (refs.atomicLabel) {
          refs.atomicLabel.textContent = atomic ? 'Set atomic=false' : 'Set atomic=true';
        }
      };

      api.setProps('togglePoliteness', {
        onClick: () => {
          politeness = politeness === 'polite' ? 'assertive' : 'polite';
          syncProps();
        },
      });

      api.setProps('toggleAtomic', {
        onClick: () => {
          atomic = !atomic;
          syncProps();
        },
      });

      api.setProps('nextMessage', {
        onClick: () => {
          messageIndex = (messageIndex + 1) % messages.length;
          if (refs.dynamicPayload) {
            refs.dynamicPayload.textContent = messages[messageIndex]!;
          }
        },
      });
    },
  };
}

/**
 * Real-world composition: pairs polite async save feedback with assertive
 * validation error announcements without stealing keyboard focus.
 */
export function createLiveRegionFeedbackDemo(family: LiveRegionDemoFamily): DemoSpec {
  const theme = FAMILY_THEMES[family];

  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: theme.stage,
      children: [
        makeRegionCard(family, {
          title: 'Save status',
          badge: 'role="status" aria-live="polite"',
          regionRef: 'saveRegion',
          props: { politeness: 'polite', atomic: true },
          payload: [
            {
              kind: 'box',
              tag: 'span',
              ref: 'savePayload',
              children: ['All changes saved'],
            },
          ],
        }),
        makeRegionCard(family, {
          title: 'Form validation',
          badge: 'role="alert" aria-live="assertive"',
          assertive: true,
          regionRef: 'errorRegion',
          props: { politeness: 'assertive', atomic: true },
          payload: [
            {
              kind: 'box',
              tag: 'span',
              ref: 'errorPayload',
              children: ['No validation errors'],
            },
          ],
        }),
        {
          kind: 'box',
          className: theme.actions,
          children: [
            makeButton(family, 'saveDraft', 'Save draft', 'primary'),
            makeButton(family, 'validateForm', 'Trigger validation error', 'danger'),
            makeButton(family, 'clearStatus', 'Reset', 'secondary'),
          ],
        },
      ],
    },
    setup({ refs, api }) {
      let revision = 1;

      api.setProps('saveDraft', {
        onClick: () => {
          revision += 1;
          if (refs.savePayload) {
            refs.savePayload.textContent = `Draft saved (revision #${revision})`;
          }
          if (refs.errorPayload) {
            refs.errorPayload.textContent = 'No validation errors';
          }
        },
      });

      api.setProps('validateForm', {
        onClick: () => {
          if (refs.errorPayload) {
            refs.errorPayload.textContent = 'Billing email is required before publishing changes.';
          }
        },
      });

      api.setProps('clearStatus', {
        onClick: () => {
          revision = 1;
          if (refs.savePayload) refs.savePayload.textContent = 'All changes saved';
          if (refs.errorPayload) refs.errorPayload.textContent = 'No validation errors';
        },
      });
    },
  };
}

/**
 * Visually hidden announcement pattern (`sr-only`): delivers screen-reader
 * feedback without altering visual layout, paired with a visible preview log
 * so sighted readers can observe the announced string.
 */
export function createLiveRegionSrOnlyDemo(family: LiveRegionDemoFamily): DemoSpec {
  const theme = FAMILY_THEMES[family];

  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: theme.stage,
      children: [
        {
          kind: 'box',
          className: theme.actions,
          children: [
            makeButton(family, 'copyToken', 'Copy API key', 'primary'),
            makeButton(family, 'applyFilter', 'Filter active items', 'secondary'),
            makeButton(family, 'clearAnnouncement', 'Clear', 'secondary'),
          ],
        },
        {
          kind: 'box',
          className: 'sr-only',
          children: [
            {
              kind: 'proto',
              prototypeId: `${family}-live-region-root`,
              ref: 'hiddenRegion',
              props: { politeness: 'polite', atomic: true },
              children: [
                {
                  kind: 'box',
                  tag: 'span',
                  ref: 'hiddenPayload',
                  children: [''],
                },
              ],
            },
          ],
        },
        {
          kind: 'box',
          className: theme.card,
          children: [
            {
              kind: 'box',
              className: theme.header,
              children: [
                {
                  kind: 'box',
                  tag: 'span',
                  className: theme.label,
                  children: ['Screen reader announcement (rendered inside .sr-only)'],
                },
                {
                  kind: 'box',
                  tag: 'span',
                  className: theme.badgePolite,
                  children: ['class="sr-only"'],
                },
              ],
            },
            {
              kind: 'box',
              tag: 'span',
              ref: 'visualLog',
              className: theme.mutedNote,
              children: ['Idle — trigger an action above to announce silently.'],
            },
          ],
        },
      ],
    },
    setup({ refs, api }) {
      let filterCount = 0;

      const announce = (text: string) => {
        if (refs.hiddenPayload) refs.hiddenPayload.textContent = text;
        if (refs.visualLog) {
          refs.visualLog.textContent = text
            ? `Announced: "${text}"`
            : 'Idle — trigger an action above to announce silently.';
        }
      };

      api.setProps('copyToken', {
        onClick: () => announce('API key copied to clipboard'),
      });

      api.setProps('applyFilter', {
        onClick: () => {
          filterCount = filterCount === 12 ? 4 : 12;
          announce(`Showing ${filterCount} active items`);
        },
      });

      api.setProps('clearAnnouncement', {
        onClick: () => announce(''),
      });
    },
  };
}
