import type { DemoSpec, DemoNode } from '@/components/PrototypePreviewer/demo-types';

export type AsyncRegionFamily = 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';

// ExposeState may arrive as a handle ({get}) or as { kind:'state', state }.
const exposeGet = (handle: unknown): boolean => {
  const h = handle as { get?: () => unknown; state?: { get?: () => unknown } } | undefined;
  return Boolean(h?.get ? h.get() : h?.state?.get?.());
};

interface FamilyChrome {
  readonly outerClass: string;
  readonly cardClass: string;
  readonly innerSurfaceClass: string;
  readonly headerTitleClass: string;
  readonly bodyTextClass: string;
  readonly mutedTextClass: string;
  readonly statusPillIdleClass: string;
  readonly statusPillBusyClass: string;
  readonly liveBannerIdleClass: string;
  readonly liveBannerBusyClass: string;
  readonly primaryButtonProps: Record<string, unknown>;
  readonly secondaryButtonProps: Record<string, unknown>;
  readonly inlineButtonProps: Record<string, unknown>;
}

const FAMILY_CHROME: Record<AsyncRegionFamily, FamilyChrome> = {
  shadcn: {
    outerClass: 'grid w-full min-w-0 max-w-lg gap-4 p-4',
    cardClass: 'rounded-lg border border-border bg-card text-card-foreground shadow-xs',
    innerSurfaceClass: 'rounded-md border border-border/70 bg-muted/30 p-3',
    headerTitleClass: 'text-sm font-medium text-foreground',
    bodyTextClass: 'text-sm text-foreground',
    mutedTextClass: 'text-xs text-muted-foreground',
    statusPillIdleClass:
      'inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground',
    statusPillBusyClass:
      'inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary',
    liveBannerIdleClass:
      'rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground',
    liveBannerBusyClass:
      'rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-foreground',
    primaryButtonProps: { variant: 'default', size: 'sm' },
    secondaryButtonProps: { variant: 'outline', size: 'sm' },
    inlineButtonProps: { variant: 'outline', size: 'sm' },
  },
  brutalist: {
    outerClass: 'grid w-full min-w-0 max-w-lg gap-4 p-4 font-sans',
    cardClass:
      'rounded-[5px] border-2 border-black bg-[var(--pui-secondary-background,#ffffff)] text-foreground shadow-[4px_4px_0_0_#000]',
    innerSurfaceClass:
      'rounded-[5px] border-2 border-black bg-[var(--pui-background,#dcebfe)] p-3 text-foreground',
    headerTitleClass: 'font-heading text-sm font-bold text-foreground',
    bodyTextClass: 'text-sm font-medium text-foreground',
    mutedTextClass: 'text-xs font-medium text-muted-foreground',
    statusPillIdleClass:
      'inline-flex items-center rounded-[5px] border-2 border-black bg-[var(--pui-mint,#05E17A)] px-2 py-0.5 text-xs font-bold text-black',
    statusPillBusyClass:
      'inline-flex items-center rounded-[5px] border-2 border-black bg-[var(--pui-canary,#FACC00)] px-2 py-0.5 text-xs font-bold text-black',
    liveBannerIdleClass:
      'rounded-[5px] border-2 border-black bg-[var(--pui-secondary-background,#ffffff)] px-3 py-2 text-xs font-medium text-foreground',
    liveBannerBusyClass:
      'rounded-[5px] border-2 border-black bg-[var(--pui-canary,#FACC00)] px-3 py-2 text-xs font-bold text-black',
    primaryButtonProps: {},
    secondaryButtonProps: {},
    inlineButtonProps: {},
  },
  'bootstrap-2-3-2': {
    outerClass:
      'grid w-full min-w-0 max-w-lg gap-3 rounded-[4px] border border-[#e3e3e3] bg-[#f5f5f5] p-4 text-[14px] leading-[20px] text-[#333333] shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)]',
    cardClass: 'rounded-[4px] border border-[#dddddd] bg-white text-[#333333]',
    innerSurfaceClass: 'rounded-[4px] border border-[#e5e5e5] bg-[#f9f9f9] p-3 text-[#333333]',
    headerTitleClass: 'text-[14px] font-bold leading-[20px] text-[#333333]',
    bodyTextClass: 'text-[14px] leading-[20px] text-[#333333]',
    mutedTextClass: 'text-[12px] leading-[18px] text-[#666666]',
    statusPillIdleClass:
      'inline-flex items-center rounded-[3px] bg-[#468847] px-2 py-0.5 text-[11px] font-bold leading-[14px] text-white',
    statusPillBusyClass:
      'inline-flex items-center rounded-[3px] bg-[#3a87ad] px-2 py-0.5 text-[11px] font-bold leading-[14px] text-white',
    liveBannerIdleClass:
      'rounded-[4px] border border-[#d6e9c6] bg-[#dff0d8] px-3 py-2 text-[12px] leading-[18px] text-[#468847]',
    liveBannerBusyClass:
      'rounded-[4px] border border-[#bce8f1] bg-[#d9edf7] px-3 py-2 text-[12px] leading-[18px] text-[#3a87ad]',
    primaryButtonProps: { variant: 'primary' },
    secondaryButtonProps: { variant: 'default' },
    inlineButtonProps: { variant: 'default', size: 'small' },
  },
  'liquid-glass': {
    // Colorful gradient backdrop behind the ordinary content card and floating glass controls
    // so translucency and layering are visible without stacking glass-on-glass.
    outerClass:
      'grid w-full min-w-0 max-w-lg gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    cardClass: 'rounded-2xl border border-border/60 bg-background/95 text-foreground shadow-sm',
    innerSurfaceClass: 'rounded-xl border border-border/50 bg-secondary/70 p-3 text-foreground',
    headerTitleClass: 'text-sm font-semibold text-foreground',
    bodyTextClass: 'text-sm text-foreground',
    mutedTextClass: 'text-xs text-muted-foreground',
    statusPillIdleClass:
      'inline-flex items-center rounded-full border border-border/60 bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground',
    statusPillBusyClass:
      'inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground',
    liveBannerIdleClass:
      'rounded-xl border border-border/60 bg-background/90 px-3.5 py-2 text-xs text-muted-foreground',
    liveBannerBusyClass:
      'rounded-xl border border-primary/40 bg-background/95 px-3.5 py-2 text-xs font-medium text-foreground',
    primaryButtonProps: { variant: 'prominent' },
    secondaryButtonProps: { variant: 'regular' },
    inlineButtonProps: { variant: 'regular' },
  },
};

function familyButton(
  family: AsyncRegionFamily,
  ref: string,
  label: string,
  props: Record<string, unknown>
): DemoNode {
  return {
    kind: 'proto',
    prototypeId: `${family}-button`,
    ref,
    ...(Object.keys(props).length > 0 ? { props } : {}),
    children: [label],
  };
}

/**
 * Primary hero demo for Async Region in each family.
 * Keeps the exact prototypeId closure required by family manifests:
 * only `${family}-async-region-root` and `${family}-button`.
 */
export function createAsyncRegionDemo(family: AsyncRegionFamily): DemoSpec {
  const chrome = FAMILY_CHROME[family];
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: chrome.outerClass,
      children: [
        {
          kind: 'box',
          className: chrome.cardClass,
          children: [
            {
              kind: 'proto',
              prototypeId: `${family}-async-region-root`,
              ref: 'region',
              props: { busy: false },
              children: [
                {
                  kind: 'box',
                  className: 'grid gap-3 p-4',
                  children: [
                    {
                      kind: 'box',
                      className: 'flex items-center justify-between gap-2',
                      children: [
                        {
                          kind: 'box',
                          className: chrome.headerTitleClass,
                          children: ['Release Activity'],
                        },
                        {
                          kind: 'box',
                          ref: 'statusBadge',
                          className: chrome.statusPillIdleClass,
                          children: ['Up to date'],
                        },
                      ],
                    },
                    {
                      kind: 'box',
                      ref: 'payload',
                      className: chrome.bodyTextClass,
                      children: [
                        'Production deployment v2.4.1 completed cleanly. Existing items stay mounted while new events load.',
                      ],
                    },
                    {
                      kind: 'box',
                      className: 'flex flex-wrap items-center justify-between gap-2 pt-1',
                      children: [
                        {
                          kind: 'box',
                          ref: 'metaNote',
                          className: chrome.mutedTextClass,
                          children: ['Last synced 2 minutes ago · aria-busy="false"'],
                        },
                        familyButton(
                          family,
                          'inspectBtn',
                          'Inspect Logs',
                          chrome.inlineButtonProps
                        ),
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
          className: 'flex flex-wrap items-center gap-2',
          children: [
            familyButton(family, 'startRefresh', 'Refresh Activity', chrome.primaryButtonProps),
            familyButton(family, 'finishRefresh', 'Finish Refresh', chrome.secondaryButtonProps),
          ],
        },
      ],
    },
    setup({ host, refs, api }) {
      let revision = 1;
      const syncUi = () => {
        const isBusy = exposeGet(api.getExposes('region')?.busy);
        if (refs.statusBadge) {
          refs.statusBadge.textContent = isBusy ? 'Syncing…' : 'Up to date';
          refs.statusBadge.className = isBusy
            ? chrome.statusPillBusyClass
            : chrome.statusPillIdleClass;
        }
        if (refs.metaNote) {
          refs.metaNote.textContent = isBusy
            ? 'Fetching latest deployment events… · aria-busy="true"'
            : `Synced revision #${revision} · aria-busy="false"`;
        }
        if (refs.payload) {
          refs.payload.style.opacity = isBusy ? '0.65' : '1';
        }
      };

      const mo = new MutationObserver(syncUi);
      mo.observe(host, { subtree: true, attributes: true, attributeFilter: ['aria-busy'] });

      api.setProps('startRefresh', {
        onClick: () => {
          api.setProps('region', { busy: true });
          requestAnimationFrame(syncUi);
        },
      });
      api.setProps('finishRefresh', {
        onClick: () => {
          revision += 1;
          api.setProps('region', { busy: false });
          requestAnimationFrame(syncUi);
        },
      });
      api.setProps('inspectBtn', {
        onClick: () => {
          if (refs.metaNote) {
            const isBusy = exposeGet(api.getExposes('region')?.busy);
            refs.metaNote.textContent = `Log viewer focused while aria-busy="${String(isBusy)}"`;
          }
        },
      });

      syncUi();
      return () => mo.disconnect();
    },
  };
}

/**
 * Focus-preserving draft refresh demo:
 * Keeps an editable input inside the Async Region mounted and focused while busy toggles.
 */
export function createAsyncRegionFocusDemo(family: AsyncRegionFamily): DemoSpec {
  const chrome = FAMILY_CHROME[family];
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: chrome.outerClass,
      children: [
        {
          kind: 'box',
          className: chrome.cardClass,
          children: [
            {
              kind: 'proto',
              prototypeId: `${family}-async-region-root`,
              ref: 'focusRegion',
              props: { busy: false },
              children: [
                {
                  kind: 'box',
                  className: 'grid gap-3 p-4',
                  children: [
                    {
                      kind: 'box',
                      className: 'flex items-center justify-between gap-2',
                      children: [
                        {
                          kind: 'box',
                          className: chrome.headerTitleClass,
                          children: ['Inbox Thread Reply'],
                        },
                        {
                          kind: 'box',
                          ref: 'focusStatus',
                          className: chrome.statusPillIdleClass,
                          children: ['Ready'],
                        },
                      ],
                    },
                    {
                      kind: 'box',
                      className: chrome.mutedTextClass,
                      children: [
                        'Focus the draft input below and click Toggle Refresh — your caret and unsaved text stay intact.',
                      ],
                    },
                    {
                      kind: 'proto',
                      prototypeId: `${family}-input-root`,
                      ref: 'draftInput',
                      props: {
                        defaultValue: 'Looks good — ready to ship after QA sign-off.',
                        placeholder: 'Write a reply while thread refreshes…',
                        ariaLabel: 'Draft reply',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          kind: 'box',
          className: 'flex flex-wrap items-center gap-2',
          children: [
            familyButton(family, 'toggleFocusBusy', 'Toggle Refresh', chrome.primaryButtonProps),
            familyButton(family, 'clearFocusBusy', 'Finish Refresh', chrome.secondaryButtonProps),
          ],
        },
      ],
    },
    setup({ host, refs, api }) {
      const syncUi = () => {
        const isBusy = exposeGet(api.getExposes('focusRegion')?.busy);
        if (refs.focusStatus) {
          refs.focusStatus.textContent = isBusy ? 'Refreshing thread…' : 'Ready';
          refs.focusStatus.className = isBusy
            ? chrome.statusPillBusyClass
            : chrome.statusPillIdleClass;
        }
      };

      const mo = new MutationObserver(syncUi);
      mo.observe(host, { subtree: true, attributes: true, attributeFilter: ['aria-busy'] });

      api.setProps('toggleFocusBusy', {
        onClick: () => {
          const next = !exposeGet(api.getExposes('focusRegion')?.busy);
          api.setProps('focusRegion', { busy: next });
          requestAnimationFrame(syncUi);
        },
      });
      api.setProps('clearFocusBusy', {
        onClick: () => {
          api.setProps('focusRegion', { busy: false });
          requestAnimationFrame(syncUi);
        },
      });

      syncUi();
      return () => mo.disconnect();
    },
  };
}

/**
 * Custom loading indicator and selective-disable demo:
 * Demonstrates consumer-owned loading feedback and disabling only the refresh trigger
 * while keeping interactive controls inside the busy region responsive.
 */
export function createAsyncRegionIndicatorDemo(family: AsyncRegionFamily): DemoSpec {
  const chrome = FAMILY_CHROME[family];
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: chrome.outerClass,
      children: [
        {
          kind: 'box',
          className: chrome.cardClass,
          children: [
            {
              kind: 'proto',
              prototypeId: `${family}-async-region-root`,
              ref: 'indicatorRegion',
              props: { busy: false },
              children: [
                {
                  kind: 'box',
                  className: 'grid gap-3 p-4',
                  children: [
                    {
                      kind: 'box',
                      className: 'flex items-center justify-between gap-2',
                      children: [
                        {
                          kind: 'box',
                          className: chrome.headerTitleClass,
                          children: ['Recent Invoices'],
                        },
                        {
                          kind: 'box',
                          ref: 'loadingIndicator',
                          className: chrome.statusPillBusyClass,
                          children: ['Refreshing…'],
                        },
                      ],
                    },
                    {
                      kind: 'box',
                      ref: 'invoiceList',
                      className: `${chrome.innerSurfaceClass} grid gap-1.5`,
                      children: [
                        {
                          kind: 'box',
                          className: chrome.bodyTextClass,
                          children: ['INV-1042 · Annual Workspace Plan · $480.00'],
                        },
                        {
                          kind: 'box',
                          className: chrome.mutedTextClass,
                          children: ['INV-1041 · Additional Seats · $120.00'],
                        },
                      ],
                    },
                    {
                      kind: 'box',
                      className: 'flex flex-wrap items-center justify-between gap-2',
                      children: [
                        {
                          kind: 'box',
                          ref: 'receiptStatus',
                          className: chrome.mutedTextClass,
                          children: ['In-region actions stay interactive during refresh.'],
                        },
                        familyButton(
                          family,
                          'downloadReceipt',
                          'Download Receipt',
                          chrome.inlineButtonProps
                        ),
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
          className: 'flex flex-wrap items-center gap-2',
          children: [
            familyButton(family, 'syncInvoices', 'Sync Invoices', chrome.primaryButtonProps),
            familyButton(family, 'cancelSync', 'Complete Sync', chrome.secondaryButtonProps),
          ],
        },
      ],
    },
    setup({ host, refs, api }) {
      let downloads = 0;
      const syncUi = () => {
        const isBusy = exposeGet(api.getExposes('indicatorRegion')?.busy);
        if (refs.loadingIndicator) {
          refs.loadingIndicator.style.display = isBusy ? 'inline-flex' : 'none';
        }
        if (refs.invoiceList) {
          refs.invoiceList.style.opacity = isBusy ? '0.6' : '1';
        }
        api.setProps('syncInvoices', { ...chrome.primaryButtonProps, disabled: isBusy });
      };

      const mo = new MutationObserver(syncUi);
      mo.observe(host, { subtree: true, attributes: true, attributeFilter: ['aria-busy'] });

      api.setProps('syncInvoices', {
        ...chrome.primaryButtonProps,
        onClick: () => {
          api.setProps('indicatorRegion', { busy: true });
          requestAnimationFrame(syncUi);
        },
      });
      api.setProps('cancelSync', {
        ...chrome.secondaryButtonProps,
        onClick: () => {
          api.setProps('indicatorRegion', { busy: false });
          requestAnimationFrame(syncUi);
        },
      });
      api.setProps('downloadReceipt', {
        ...chrome.inlineButtonProps,
        onClick: () => {
          downloads += 1;
          if (refs.receiptStatus) {
            refs.receiptStatus.textContent = `Downloaded receipt PDF (${downloads}) without interrupting refresh.`;
          }
        },
      });

      syncUi();
      return () => mo.disconnect();
    },
  };
}

/**
 * Composed Async Region + Live Region demo:
 * Pairs aria-busy on the updating content region with polite screen-reader status announcements.
 */
export function createAsyncRegionLiveRegionDemo(family: AsyncRegionFamily): DemoSpec {
  const chrome = FAMILY_CHROME[family];
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: chrome.outerClass,
      children: [
        {
          kind: 'box',
          className: chrome.cardClass,
          children: [
            {
              kind: 'proto',
              prototypeId: `${family}-async-region-root`,
              ref: 'metricsRegion',
              props: { busy: false },
              children: [
                {
                  kind: 'box',
                  className: 'grid gap-2 p-4',
                  children: [
                    {
                      kind: 'box',
                      className: 'flex items-center justify-between gap-2',
                      children: [
                        {
                          kind: 'box',
                          className: chrome.headerTitleClass,
                          children: ['Monthly Revenue'],
                        },
                        {
                          kind: 'box',
                          ref: 'metricsBadge',
                          className: chrome.statusPillIdleClass,
                          children: ['Synced'],
                        },
                      ],
                    },
                    {
                      kind: 'box',
                      ref: 'metricsValue',
                      className: chrome.bodyTextClass,
                      children: ['$124,800 · +12.4% month over month'],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          kind: 'box',
          ref: 'liveBanner',
          className: chrome.liveBannerIdleClass,
          children: [
            {
              kind: 'proto',
              prototypeId: `${family}-live-region-root`,
              ref: 'statusLive',
              props: { politeness: 'polite', atomic: true },
              children: [
                {
                  kind: 'box',
                  ref: 'liveText',
                  children: ['Status: Monthly revenue is up to date.'],
                },
              ],
            },
          ],
        },
        {
          kind: 'box',
          className: 'flex flex-wrap items-center gap-2',
          children: [
            familyButton(family, 'reloadMetrics', 'Reload Metrics', chrome.primaryButtonProps),
            familyButton(family, 'applyMetrics', 'Apply Update', chrome.secondaryButtonProps),
          ],
        },
      ],
    },
    setup({ host, refs, api }) {
      let amount = 124800;
      const syncUi = () => {
        const isBusy = exposeGet(api.getExposes('metricsRegion')?.busy);
        if (refs.metricsBadge) {
          refs.metricsBadge.textContent = isBusy ? 'Updating…' : 'Synced';
          refs.metricsBadge.className = isBusy
            ? chrome.statusPillBusyClass
            : chrome.statusPillIdleClass;
        }
        if (refs.metricsValue) {
          refs.metricsValue.style.opacity = isBusy ? '0.65' : '1';
        }
        if (refs.liveBanner) {
          refs.liveBanner.className = isBusy
            ? chrome.liveBannerBusyClass
            : chrome.liveBannerIdleClass;
        }
      };

      const mo = new MutationObserver(syncUi);
      mo.observe(host, { subtree: true, attributes: true, attributeFilter: ['aria-busy'] });

      api.setProps('reloadMetrics', {
        onClick: () => {
          api.setProps('metricsRegion', { busy: true });
          if (refs.liveText) {
            refs.liveText.textContent = 'Status: Refreshing monthly revenue metrics…';
          }
          requestAnimationFrame(syncUi);
        },
      });
      api.setProps('applyMetrics', {
        onClick: () => {
          amount += 1200;
          if (refs.metricsValue) {
            refs.metricsValue.textContent = `$${amount.toLocaleString()} · +13.1% month over month`;
          }
          api.setProps('metricsRegion', { busy: false });
          if (refs.liveText) {
            refs.liveText.textContent = `Status: Monthly revenue updated to $${amount.toLocaleString()}.`;
          }
          requestAnimationFrame(syncUi);
        },
      });

      syncUi();
      return () => mo.disconnect();
    },
  };
}
