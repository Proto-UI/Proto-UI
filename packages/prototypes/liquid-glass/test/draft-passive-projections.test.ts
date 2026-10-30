// Consumer-boundary tests for the neutral draft projections: real Web Component
// adapter mounts and one host-executed Transition run. Assertions cover only
// governed semantics, slots, modules and observed rule tokens; optical paint,
// native equivalence and Apple parity are explicitly not claimed here.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { executeWithHost, type RuntimeHost } from '@proto.ui/runtime';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import { PRESENCE_HOST_BRIDGE_CAP } from '@proto.ui/module-presence';
import { RULE_META_GET_CAP } from '@proto.ui/module-rule-meta';
import type { TransitionProps } from '@proto.ui/prototypes-base/transition';
import asyncRegionRoot from '../src/async-region';
import liveRegionRoot from '../src/live-region';
import imageRoot from '../src/image';
import { tableRoot, tableCaption, tableRow, tableHeaderCell, tableCell } from '../src/table';
import transition from '../src/transition';

const AsyncRegionElement = AdaptToWebComponent(asyncRegionRoot, {
  registerAs: 'passive-test-liquid-glass-async-region',
});
const LiveRegionElement = AdaptToWebComponent(liveRegionRoot, {
  registerAs: 'passive-test-liquid-glass-live-region',
});
const ImageElement = AdaptToWebComponent(imageRoot, {
  registerAs: 'passive-test-liquid-glass-image',
});
const TableElement = AdaptToWebComponent(tableRoot, {
  registerAs: 'passive-test-liquid-glass-table',
});
const CaptionElement = AdaptToWebComponent(tableCaption, {
  registerAs: 'passive-test-liquid-glass-table-caption',
});
const RowElement = AdaptToWebComponent(tableRow, {
  registerAs: 'passive-test-liquid-glass-table-row',
});
const HeaderCellElement = AdaptToWebComponent(tableHeaderCell, {
  registerAs: 'passive-test-liquid-glass-table-header-cell',
});
const CellElement = AdaptToWebComponent(tableCell, {
  registerAs: 'passive-test-liquid-glass-table-cell',
});
const TransitionElement = AdaptToWebComponent(transition, {
  registerAs: 'passive-test-liquid-glass-transition',
});

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

const tokens = (el: Element) => (el.getAttribute('data-pui-style') ?? '').split(/\s+/);

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.restoreAllMocks();
});

describe('liquid-glass draft Async Region projection', () => {
  it('projects the governed busy state and preserved content without material styling', async () => {
    const el = new AsyncRegionElement();
    const child = document.createElement('button');
    child.textContent = 'Retry';
    el.appendChild(child);
    document.body.append(el);
    await flush();

    expect(el.getAttribute('aria-busy')).toBe('false');
    expect(Object.keys(el.getExposes()).sort()).toEqual(['busy']);
    expect(el.tabIndex).toBe(-1);
    expect(tokens(el)).toContain('text-foreground');
    expect(tokens(el).some((token) => token.startsWith('backdrop-'))).toBe(false);
    expect(el.hasAttribute('data-pui-material-carrier')).toBe(false);
    child.focus();
    expect(document.activeElement).toBe(child);

    setElementProps(el, { busy: true });
    el.update();
    await flush();
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.getExposes().busy.get()).toBe(true);
    expect(el.textContent).toBe('Retry');
    expect(el.querySelector('button')).toBe(child);
    expect(document.activeElement).toBe(child);

    setElementProps(el, {});
    el.update();
    await flush();
    expect(el.getAttribute('aria-busy')).toBe('false');
    expect(el.getExposes().busy.get()).toBe(false);
    expect(el.querySelector('button')).toBe(child);
    expect(document.activeElement).toBe(child);
  });
});

describe('liquid-glass draft Live Region projection', () => {
  it('projects politeness and atomic semantics without interaction channels', async () => {
    const el = new LiveRegionElement();
    const payload = document.createElement('span');
    payload.textContent = 'Saved';
    el.append(payload);
    document.body.append(el);
    await flush();

    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.getAttribute('aria-atomic')).toBe('true');
    expect(Object.keys(el.getExposes())).toEqual([]);
    expect(el.tabIndex).toBe(-1);
    expect(tokens(el).some((token) => token.startsWith('backdrop-'))).toBe(false);

    setElementProps(el, { politeness: 'assertive', atomic: false });
    el.update();
    await flush();
    expect(el.getAttribute('role')).toBe('alert');
    expect(el.getAttribute('aria-live')).toBe('assertive');
    expect(el.getAttribute('aria-atomic')).toBe('false');
    expect(el.textContent).toBe('Saved');
    expect(el.querySelector('span')).toBe(payload);

    setElementProps(el, {});
    await flush();
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.getAttribute('aria-atomic')).toBe('true');
    expect(el.querySelector('span')).toBe(payload);
  });
});

describe('liquid-glass draft Image projection', () => {
  it('transports the declared module and exposes through the owned image target', async () => {
    const decodes: Array<{ resolve(): void; reject(error?: unknown): void }> = [];
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(() => {
      const { promise, resolve, reject } = Promise.withResolvers<void>();
      decodes.push({ resolve, reject });
      return promise;
    });
    const el = new ImageElement();
    setElementProps(el, {
      source: 'image:hero',
      a11yMode: 'informative',
      alternativeText: 'Hero',
      fit: 'cover',
    });
    const changes: string[] = [];
    el.addEventListener('loadingStatusChange', (event) => {
      changes.push((event as CustomEvent<{ status: string }>).detail.status);
    });
    document.body.append(el);
    await flush();

    const image = el.querySelector('img');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('part')).toBe('image');
    expect(image?.getAttribute('src')).toBe('image:hero');
    expect(image?.alt).toBe('Hero');
    expect(image?.style.objectFit).toBe('cover');
    if (!image) throw new Error('Image View did not materialize its image target.');
    expect(el.querySelectorAll('img')).toHaveLength(1);
    expect(tokens(image)).toContain('block');
    expect(tokens(image)).toContain('max-w-full');
    expect(el.getExposes().source.get()).toBe('image:hero');
    expect(el.getExposes().fit.get()).toBe('cover');
    expect(el.getExposes().loadingStatus.get()).toBe('loading');

    const firstDecode = decodes[0];
    if (!firstDecode) throw new Error('Image View did not request a decode.');
    firstDecode.resolve();
    await flush();
    expect(el.getExposes().loadingStatus.get()).toBe('loaded');
    expect(changes).toEqual(['loading', 'loaded']);

    setElementProps(el, { source: 'image:second', a11yMode: 'decorative' });
    await flush();
    expect(el.querySelector('img')).toBe(image);
    expect(image.getAttribute('src')).toBe('image:second');
    expect(image.alt).toBe('');
    expect(image.style.objectFit).toBe('contain');
    expect(el.getExposes().fit.get()).toBe('contain');
    expect(el.getExposes().loadingStatus.get()).toBe('loading');

    const pendingDecode = decodes[1];
    if (!pendingDecode) throw new Error('The updated Image View did not request a decode.');
    pendingDecode.reject(new Error('Second image is unavailable.'));
    await flush();
    expect(el.getExposes().loadingStatus.get()).toBe('error');
    expect(changes).toEqual(['loading', 'loaded', 'loading', 'error']);

    setElementProps(el, { source: 'image:retired', a11yMode: 'decorative' });
    await flush();
    const retiredDecode = decodes[2];
    if (!retiredDecode) throw new Error('The final Image View did not request a decode.');
    el.remove();
    await flush();
    const countAtRetirement = changes.length;
    retiredDecode.resolve();
    await flush();
    expect(changes).toHaveLength(countAtRetirement);
  });
});

describe('liquid-glass draft Table projection', () => {
  it('keeps the passive structural domain, header ordering and neutral tokens', async () => {
    const root = new TableElement();
    const caption = new CaptionElement();
    const headerRow = new RowElement();
    const dataRow = new RowElement();
    const quarter = new HeaderCellElement();
    const owner = new HeaderCellElement();
    const value = new CellElement();
    caption.textContent = 'Quarterly earnings';
    quarter.textContent = 'Quarter';
    owner.textContent = 'Owner';
    value.textContent = '42';
    setElementProps(quarter, { headerKey: 'quarter', headerKind: 'column', columnSpan: 2 });
    setElementProps(owner, { headerKey: 'owner', headerKind: 'row' });
    setElementProps(value, { headers: ['owner', 'quarter'] });
    headerRow.append(quarter);
    dataRow.append(owner, value);
    root.append(caption, headerRow, dataRow);
    document.body.append(root);
    await flush();

    const snapshot = root.getExposes().getStructure();
    if (!snapshot) throw new Error('Table did not expose a structure snapshot.');
    expect(snapshot).toMatchObject({ valid: true, rowCount: 2, columnCount: 2 });
    expect(snapshot.rows[1].cells[1].orderedHeaders).toEqual([
      snapshot.rows[1].cells[0].ref,
      snapshot.rows[0].cells[0].ref,
    ]);
    expect(snapshot.caption).toBeDefined();
    expect(root.getAttribute('role')).toBe('table');
    expect(headerRow.getAttribute('role')).toBe('row');
    expect(quarter.getAttribute('role')).toBe('columnheader');
    expect(value.getAttribute('role')).toBe('cell');
    expect(value.getAttribute('aria-rowindex')).toBe('2');
    expect(value.getAttribute('aria-colindex')).toBe('2');
    expect(quarter.getAttribute('aria-colspan')).toBe('2');
    expect(caption.textContent).toBe('Quarterly earnings');
    expect(value.textContent).toBe('42');

    // Neutral typography/framing only: no backdrop, material or sorting channel.
    for (const part of [root, caption, headerRow, quarter, value]) {
      expect(tokens(part).some((token) => token.startsWith('backdrop-'))).toBe(false);
      expect(part.hasAttribute('data-pui-material-carrier')).toBe(false);
    }
    expect(tokens(root)).toContain('w-full');
    expect(tokens(caption)).toContain('text-muted-foreground');
    expect(tokens(headerRow)).toContain('border-b');
    expect(tokens(quarter)).toContain('font-semibold');
    expect(tokens(value)).toContain('text-foreground');

    setElementProps(value, { headers: ['quarter'] });
    value.update();
    await flush();
    expect(root.getExposes().getStructure()?.rows[1].cells[1].rowHeaders).toEqual([]);
  });

  it('retains Base diagnostics and role withdrawal for an orphan Cell', async () => {
    const root = new TableElement();
    const row = new RowElement();
    const header = new HeaderCellElement();
    const cell = new CellElement();
    const orphan = new CellElement();
    header.textContent = 'Name';
    cell.textContent = 'Ada';
    orphan.textContent = 'Unplaced';
    setElementProps(header, { headerKey: 'name', headerKind: 'column' });
    setElementProps(cell, { headers: ['name'] });
    setElementProps(orphan, { headers: ['name'] });
    row.append(header, cell);
    root.append(row);
    document.body.append(root);
    await flush();
    expect(root.getExposes().getStructure()?.valid).toBe(true);

    root.append(orphan);
    await flush();
    const rejected = root.getExposes().getStructure();
    expect(rejected?.valid).toBe(false);
    expect(rejected?.diagnostics.map(({ code }) => code)).toContain('missing-row-parent');
    for (const part of [root, row, header, cell, orphan]) {
      expect(part.hasAttribute('role')).toBe(false);
    }
    expect(cell.textContent).toBe('Ada');

    orphan.remove();
    await flush();
    expect(root.getExposes().getStructure()?.valid).toBe(true);
    expect(root.getAttribute('role')).toBe('table');
    expect(cell.getAttribute('role')).toBe('cell');
    expect(cell.textContent).toBe('Ada');
  });
});

describe('liquid-glass draft Transition projection', () => {
  it('preserves the caller slot and phase endpoints through reversal and detachment', async () => {
    const el = new TransitionElement();
    setElementProps(el, { open: true });
    const payload = document.createElement('button');
    payload.textContent = 'Panel body';
    el.append(payload);
    document.body.append(el);
    await flush();

    const exposes = el.getExposes();
    expect(exposes.transitionState.get()).toBe('entered');
    expect(exposes.isPresent.get()).toBe(true);
    expect(el.textContent).toBe('Panel body');
    expect(tokens(el)).toContain('opacity-100');
    expect(tokens(el)).not.toContain('opacity-0');
    expect(tokens(el).some((token) => token.startsWith('animate-'))).toBe(false);

    const events: string[] = [];
    for (const key of ['beforeEnter', 'afterEnter', 'beforeLeave', 'afterLeave']) {
      el.addEventListener(key, () => events.push(key));
    }

    setElementProps(el, { open: false });
    await flush();
    expect(exposes.transitionState.get()).toBe('leaving');
    expect(tokens(el)).toContain('opacity-0');
    expect(tokens(el)).not.toContain('opacity-100');
    expect(el.querySelector('button')).toBe(payload);

    setElementProps(el, { open: true });
    await flush();
    expect(exposes.transitionState.get()).toBe('entering');
    expect(tokens(el)).toContain('opacity-100');
    expect(tokens(el)).not.toContain('opacity-0');
    expect(el.querySelector('button')).toBe(payload);
    expect(el.textContent).toBe('Panel body');

    exposes.complete();
    await flush();
    expect(exposes.transitionState.get()).toBe('entered');
    expect(events).toEqual(['beforeLeave', 'beforeEnter', 'afterEnter']);

    setElementProps(el, { open: false });
    await flush();
    exposes.complete();
    await flush();
    expect(el.getExposes().transitionState.get()).toBe('closed');
    expect(el.getExposes().isPresent.get()).toBe(false);
    expect(el.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(events).toEqual([
      'beforeLeave',
      'beforeEnter',
      'afterEnter',
      'beforeLeave',
      'afterLeave',
    ]);

    setElementProps(el, { open: true });
    await flush();
    exposes.complete();
    await flush();
    expect(exposes.transitionState.get()).toBe('entered');
    expect(el.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(el.querySelector('button')).toBe(payload);
  });

  it.each([
    { reducedMotion: 'no-preference', enterDuration: undefined, expectedDuration: 300 },
    { reducedMotion: 'no-preference', enterDuration: 240, expectedDuration: 240 },
    { reducedMotion: 'reduce', enterDuration: undefined, expectedDuration: 0 },
    { reducedMotion: 'reduce', enterDuration: 240, expectedDuration: 0 },
  ] as const)(
    'preserves Base defaults and explicit durations with reduced motion: $reducedMotion / $enterDuration',
    async ({ reducedMotion, enterDuration, expectedDuration }) => {
      const raw: TransitionProps = {
        open: true,
        appear: true,
        ...(enterDuration === undefined ? {} : { enterDuration }),
      };
      let exposedRecord: Record<string, unknown> = {};
      const delays: Array<{ durationMs: number; task: () => void; cancelled: boolean }> = [];
      const emitted: string[] = [];
      const presence: string[] = [];
      const host: RuntimeHost<TransitionProps> = {
        prototypeName: 'liquid-glass-transition-host',
        getRawProps: () => raw,
        commit(_children, signal) {
          signal?.done();
        },
        schedule(task) {
          task();
        },
        scheduleDelay(durationMs, task) {
          const record = { durationMs, task, cancelled: false };
          delays.push(record);
          return {
            cancel() {
              record.cancelled = true;
            },
          };
        },
        onRuntimeReady(wiring) {
          wiring.attach('presence', [
            [
              PRESENCE_HOST_BRIDGE_CAP,
              {
                mount() {
                  presence.push('mount');
                },
                unmount() {
                  presence.push('unmount');
                },
              },
            ],
          ]);
          wiring.attach('expose-state', [
            [
              EXPOSE_STATE_SET_EXPOSES_CAP,
              (next: Record<string, unknown>) => {
                exposedRecord = next;
              },
            ],
          ]);
          wiring.attach('expose-event', [
            [
              EXPOSE_EVENT_SINK_CAP,
              (key: string) => {
                emitted.push(key);
              },
            ],
          ]);
          wiring.attach('rule-meta', [
            [
              RULE_META_GET_CAP,
              (key: string) => (key === 'reducedMotion' ? reducedMotion : undefined),
            ],
          ]);
        },
      };
      // The executor erases the exposes parameter; the host supplies it through caps.
      const result = executeWithHost<TransitionProps>(
        transition as unknown as Prototype<TransitionProps>,
        host
      );
      try {
        // Runtime cap records are the live projection of the same declaration.
        const exposes = exposedRecord as ProtoAdapterExposes<typeof transition>;
        expect(exposes.transitionState.get()).toBe('entering');
        expect(delays.map((delay) => delay.durationMs)).toEqual([expectedDuration]);

        delays[0]?.task();
        expect(exposes.transitionState.get()).toBe('entered');
        expect(emitted).toEqual(['beforeEnter', 'afterEnter']);
        expect(result.controller.getRuleStyleTokens()).toContain('opacity-100');
        expect(result.controller.getRuleStyleTokens()).not.toContain('opacity-0');

        result.invokeInCallbackScope(() => exposes.leave());
        expect(exposes.transitionState.get()).toBe('leaving');
        expect(exposes.isPresent.get()).toBe(true);
        expect(delays.at(-1)?.durationMs).toBe(reducedMotion === 'reduce' ? 0 : 200);
        delays.at(-1)?.task();
        expect(exposes.transitionState.get()).toBe('closed');
        expect(exposes.isPresent.get()).toBe(false);
        expect(emitted).toEqual(['beforeEnter', 'afterEnter', 'beforeLeave', 'afterLeave']);
      } finally {
        await result.invokeUnmounted();
      }
    }
  );
});
