import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { executeWithHost, type RuntimeHost } from '@proto.ui/runtime';
import type { ImageViewPatch } from '@proto.ui/core';
import {
  IMAGE_VIEW_HOST_CAP,
  IMAGE_VIEW_RUN_IN_CALLBACK_CAP,
  type ImageViewHost,
  type ImageViewHostConnection,
  type ImageViewHostUpdate,
} from '@proto.ui/module-image-view';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import { RULE_META_GET_CAP } from '@proto.ui/module-rule-meta';
import type { TableStructureSnapshot } from '@proto.ui/module-table-structure';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import asyncRegionRoot from '../src/async-region';
import liveRegionRoot from '../src/live-region';
import imageRoot from '../src/image';
import transition from '../src/transition';
import { tableRoot, tableCaption, tableRow, tableHeaderCell, tableCell } from '../src/table';

type HostElement = HTMLElement & { getExposes(): Record<string, any> };

for (const prototype of [
  asyncRegionRoot,
  liveRegionRoot,
  imageRoot,
  transition,
  tableRoot,
  tableCaption,
  tableRow,
  tableHeaderCell,
  tableCell,
]) {
  AdaptToWebComponent(prototype);
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function element(prototype: { name: string }, props: Record<string, unknown> = {}) {
  const result = document.createElement(prototype.name) as HostElement;
  setElementProps(result, props);
  return result;
}

function tokens(host: HTMLElement): string[] {
  return (host.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
}

function structure(root: HostElement): TableStructureSnapshot {
  return root.getExposes().getStructure();
}

function createTable() {
  const root = element(tableRoot);
  const caption = element(tableCaption);
  caption.append(document.createTextNode('Quarterly revenue'));
  const heading = element(tableRow);
  const body = element(tableRow);
  const quarter = element(tableHeaderCell, {
    headerKey: 'quarter',
    headerKind: 'column',
    columnSpan: 2,
  });
  const owner = element(tableHeaderCell, { headerKey: 'owner', headerKind: 'row' });
  const value = element(tableCell, { headers: ['owner', 'quarter'] });
  quarter.append(document.createTextNode('Q4'));
  owner.append(document.createTextNode('North'));
  const link = document.createElement('a');
  link.href = '#revenue';
  link.textContent = '$42';
  value.append(link);
  heading.append(quarter);
  body.append(owner, value);
  root.append(caption, heading, body);
  return { root, caption, heading, body, quarter, owner, value, link };
}

function imageRuntime(initialProps: Record<string, unknown>) {
  let exposes: Record<string, any> = {};
  let invokeInCallbackScope: ((callback: () => void) => void) | undefined;
  const events: Array<{ key: string; payload: unknown }> = [];
  const records: Array<{
    connection: ImageViewHostConnection;
    updates: ImageViewHostUpdate[];
    disposed: number;
  }> = [];
  const imageHost: ImageViewHost = {
    attach(connection) {
      let patch: ImageViewPatch = connection.patch;
      const record = { connection, updates: [] as ImageViewHostUpdate[], disposed: 0 };
      records.push(record);
      return {
        update(update) {
          patch = { ...patch, ...update.patch };
          record.updates.push(update);
        },
        snapshot: () => ({
          source: patch.source ?? '',
          loadingStatus: patch.loadingStatus ?? 'idle',
          fit: patch.fit ?? 'contain',
        }),
        dispose() {
          record.disposed++;
        },
      };
    },
  };
  const host: RuntimeHost<any> = {
    prototypeName: imageRoot.name,
    getRawProps: () => initialProps,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('image-view', [
        [IMAGE_VIEW_HOST_CAP, imageHost],
        [
          IMAGE_VIEW_RUN_IN_CALLBACK_CAP,
          (callback: () => void) => {
            if (invokeInCallbackScope) invokeInCallbackScope(callback);
            else callback();
          },
        ],
      ]);
      wiring.attach('expose-state', [
        [
          EXPOSE_STATE_SET_EXPOSES_CAP,
          (next: Record<string, any>) => {
            exposes = next;
          },
        ],
      ]);
      wiring.attach('expose-event', [
        [EXPOSE_EVENT_SINK_CAP, (key: string, payload: unknown) => events.push({ key, payload })],
      ]);
    },
  };
  const runtime = executeWithHost(imageRoot, host);
  invokeInCallbackScope = runtime.invokeInCallbackScope;
  return { runtime, records, events, getExposes: () => exposes };
}

function transitionRuntime(initialProps: Record<string, unknown>, reducedMotion = false) {
  let exposes: Record<string, any> = {};
  let readPresence: (() => boolean) | undefined;
  const events: Array<{ key: string; present: boolean | undefined }> = [];
  const delays: Array<{ durationMs: number; task: () => void; cancelled: boolean }> = [];
  const host: RuntimeHost<any> = {
    prototypeName: transition.name,
    getRawProps: () => initialProps,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    scheduleDelay(durationMs, task) {
      const delay = { durationMs, task, cancelled: false };
      delays.push(delay);
      return {
        cancel() {
          delay.cancelled = true;
        },
      };
    },
    onRuntimeReady(wiring) {
      wiring.attach('expose-state', [
        [
          EXPOSE_STATE_SET_EXPOSES_CAP,
          (next: Record<string, any>) => {
            exposes = next;
          },
        ],
      ]);
      wiring.attach('expose-event', [
        [EXPOSE_EVENT_SINK_CAP, (key: string) => events.push({ key, present: readPresence?.() })],
      ]);
      wiring.attach('rule-meta', [
        [
          RULE_META_GET_CAP,
          (key: string) =>
            key === 'reducedMotion' ? (reducedMotion ? 'reduce' : 'no-preference') : undefined,
        ],
      ]);
    },
  };
  const runtime = executeWithHost(transition, host);
  readPresence = () => runtime.session.viewIntent.getSnapshot().present;
  return { runtime, events, delays, getExposes: () => exposes };
}

afterEach(async () => {
  document.body.replaceChildren();
  await settle();
});

describe('Bootstrap 2.3.2 draft passive projections', () => {
  it('retains Async Region descendants and focus while only busy semantics change', async () => {
    const root = element(asyncRegionRoot);
    const retry = document.createElement('button');
    retry.textContent = 'Retry';
    root.append(retry);
    document.body.append(root);
    await settle();
    retry.focus();
    const busy = root.getExposes().busy;
    expect(busy.get()).toBe(false);
    for (const value of [true, false, true]) {
      setElementProps(root, { busy: value });
      expect(root.getExposes().busy).toBe(busy);
      expect(busy.get()).toBe(value);
      expect(root.getAttribute('aria-busy')).toBe(String(value));
      expect(root.querySelector('button')).toBe(retry);
      expect(document.activeElement).toBe(retry);
    }
    expect(root.getAttribute('role')).toBeNull();
    expect(root.hasAttribute('tabindex')).toBe(false);
    expect(tokens(root)).toEqual([]);
  });

  it('updates Live Region politeness and atomicity without replacing its payload or adding paint', async () => {
    const root = element(liveRegionRoot);
    const payload = document.createTextNode('3 new messages');
    root.append(payload);
    document.body.append(root);
    await settle();
    expect(root.getAttribute('role')).toBe('status');
    expect(root.getAttribute('aria-live')).toBe('polite');
    expect(root.getAttribute('aria-atomic')).toBe('true');
    setElementProps(root, { politeness: 'assertive', atomic: false });
    expect(root.getAttribute('role')).toBe('alert');
    expect(root.getAttribute('aria-live')).toBe('assertive');
    expect(root.getAttribute('aria-atomic')).toBe('false');
    expect(root.firstChild).toBe(payload);
    setElementProps(root, { politeness: 'polite', atomic: true });
    expect(root.getAttribute('role')).toBe('status');
    expect(root.getAttribute('aria-live')).toBe('polite');
    expect(root.getAttribute('aria-atomic')).toBe('true');
    expect(root.firstChild).toBe(payload);
    expect(root.textContent).toBe('3 new messages');
    expect(root.hasAttribute('tabindex')).toBe(false);
    expect(tokens(root)).toEqual([]);
  });

  it('keeps all five Table slots and Base spans/ordered header relationships without data operations', async () => {
    const table = createTable();
    document.body.append(table.root);
    await settle();
    const before = structure(table.root);
    expect(before).toMatchObject({ valid: true, rowCount: 2, columnCount: 2 });
    expect(before.caption).toBeDefined();
    expect(before.rows[0].cells[0]).toMatchObject({ kind: 'column-header', columnSpan: 2 });
    expect(before.rows[1].cells[0]).toMatchObject({ kind: 'row-header', row: 1, column: 0 });
    expect(before.rows[1].cells[1].orderedHeaders).toEqual([
      before.rows[1].cells[0].ref,
      before.rows[0].cells[0].ref,
    ]);
    expect(table.root.getAttribute('role')).toBe('table');
    expect(table.caption.getAttribute('role')).toBe('caption');
    expect(table.heading.getAttribute('role')).toBe('row');
    expect(table.quarter.getAttribute('role')).toBe('columnheader');
    expect(table.owner.getAttribute('role')).toBe('rowheader');
    expect(table.value.getAttribute('role')).toBe('cell');
    table.link.focus();
    table.quarter.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    table.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    expect(structure(table.root)).toEqual(before);
    expect(document.activeElement).toBe(table.link);
    expect(table.quarter.hasAttribute('aria-sort')).toBe(false);
    expect(table.body.hasAttribute('aria-selected')).toBe(false);
    expect(table.value.querySelector('a')).toBe(table.link);
    expect(table.root.querySelector('thead,tbody,tfoot,[role="rowgroup"]')).toBeNull();
    setElementProps(table.value, { headers: ['quarter', 'owner'] });
    await settle();
    const after = structure(table.root);
    expect(after.rows[1].cells[1].orderedHeaders).toEqual([
      after.rows[0].cells[0].ref,
      after.rows[1].cells[0].ref,
    ]);
    expect(table.value.querySelector('a')).toBe(table.link);
    expect(table.caption.textContent).toBe('Quarterly revenue');
    expect(table.quarter.textContent).toBe('Q4');
    expect(table.owner.textContent).toBe('North');
  });

  it('withdraws invalid Table relationships, restores them, and isolates nested owner domains', async () => {
    const outer = createTable();
    const inner = createTable();
    outer.value.append(inner.root);
    document.body.append(outer.root);
    await settle();
    expect(structure(outer.root).valid).toBe(true);
    expect(structure(inner.root).valid).toBe(true);
    expect(structure(outer.root).rowCount).toBe(2);
    expect(structure(inner.root).rows[0].cells[0].ref).not.toBe(
      structure(outer.root).rows[0].cells[0].ref
    );
    inner.quarter.remove();
    await settle();
    expect(structure(inner.root).valid).toBe(false);
    expect(inner.root.getAttribute('role')).toBeNull();
    expect(inner.value.getAttribute('role')).toBeNull();
    expect(structure(outer.root).valid).toBe(true);
    expect(outer.root.getAttribute('role')).toBe('table');
    inner.heading.append(inner.quarter);
    await settle();
    expect(structure(inner.root).valid).toBe(true);
    expect(inner.value.getAttribute('role')).toBe('cell');
    expect(inner.value.querySelector('a')).toBe(inner.link);
  });

  it('follows computed header row changes without replacing caller content', async () => {
    const table = createTable();
    document.body.append(table.root);
    await settle();
    expect(tokens(table.quarter)).not.toContain('border-t');
    expect(tokens(table.owner)).toContain('border-t');
    const earlierRow = element(tableRow);
    const earlierHeader = element(tableHeaderCell, { headerKey: 'earlier', headerKind: 'column' });
    earlierRow.append(earlierHeader);
    table.root.insertBefore(earlierRow, table.heading);
    await settle();
    expect(structure(table.root).valid).toBe(true);
    expect(tokens(table.quarter)).toContain('border-t');
    earlierRow.remove();
    await settle();
    expect(tokens(table.quarter)).not.toContain('border-t');
    expect(table.value.querySelector('a')).toBe(table.link);
  });

  it('lets the Adapter select one Image target before setup and updates trim on that same target', async () => {
    const root = element(imageRoot, {
      source: '',
      a11yMode: 'decorative',
      fit: 'cover',
      appearance: 'rounded',
    });
    document.body.append(root);
    await settle();
    const target = root.querySelector('img');
    expect(target).not.toBeNull();
    expect(root.querySelectorAll('img')).toHaveLength(1);
    expect(target!.getAttribute('part')).toBe('image');
    expect(target!.hasAttribute('src')).toBe(false);
    expect(target!.alt).toBe('');
    expect(target!.style.objectFit).toBe('cover');
    expect(tokens(target!)).toContain('rounded-[6px]');
    setElementProps(root, {
      source: '',
      a11yMode: 'informative',
      alternativeText: 'Awaiting a chart',
      fit: 'contain',
      appearance: 'polaroid',
    });
    await settle();
    expect(root.querySelectorAll('img')).toHaveLength(1);
    expect(root.querySelector('img')).toBe(target);
    expect(target!.alt).toBe('Awaiting a chart');
    expect(target!.style.objectFit).toBe('contain');
    expect(tokens(target!)).toContain('p-[4px]');
    expect(tokens(target!)).not.toContain('rounded-[6px]');
    expect(root.getExposes().loadingStatus.get()).toBe('idle');
  });

  it('transports one Image View declaration and retains loading ownership across image trim changes', async () => {
    const ctx = imageRuntime({
      source: 'image:revenue',
      a11yMode: 'informative',
      alternativeText: 'Revenue chart',
      fit: 'cover',
      appearance: 'polaroid',
    });
    try {
      expect(ctx.records).toHaveLength(1);
      expect(ctx.runtime.children).toBeNull();
      const record = ctx.records[0];
      expect(record.connection.patch).toMatchObject({
        source: 'image:revenue',
        a11yMode: 'informative',
        alternativeText: 'Revenue chart',
        fit: 'cover',
        loadingStatus: 'loading',
      });
      expect(ctx.getExposes().loadingStatus.get()).toBe('loading');
      record.connection.onStatusChange({
        generation: record.connection.generation,
        status: 'loaded',
      });
      expect(ctx.getExposes().loadingStatus.get()).toBe('loaded');
      expect(ctx.events.at(-1)).toEqual({
        key: 'loadingStatusChange',
        payload: { source: 'image:revenue', previousStatus: 'loading', status: 'loaded' },
      });
      ctx.runtime.controller.applyRawProps({
        source: 'image:revenue',
        a11yMode: 'informative',
        alternativeText: 'Revenue chart',
        fit: 'cover',
        appearance: 'rounded',
      });
      expect(ctx.records).toHaveLength(1);
      expect(ctx.getExposes().loadingStatus.get()).toBe('loaded');
      expect(record.updates.at(-1)?.generation).toBe(record.connection.generation);
      const rounded = ctx.runtime.controller.getRuleStyleTokens();
      expect(renderProtoStyleTokenCss(rounded)).toContain('border-radius: 6px;');
      expect(rounded).not.toContain('p-[4px]');
      ctx.runtime.controller.applyRawProps({
        source: 'image:logo',
        a11yMode: 'decorative',
        alternativeText: '',
        fit: 'contain',
        appearance: 'circle',
      });
      const update = record.updates.at(-1)!;
      expect(update.patch).toMatchObject({
        source: 'image:logo',
        a11yMode: 'decorative',
        alternativeText: '',
        fit: 'contain',
        loadingStatus: 'loading',
      });
      expect(update.generation).not.toBe(record.connection.generation);
      const eventCount = ctx.events.length;
      record.connection.onStatusChange({
        generation: record.connection.generation,
        status: 'loaded',
      });
      expect(ctx.getExposes().loadingStatus.get()).toBe('loading');
      expect(ctx.events).toHaveLength(eventCount);
      record.connection.onStatusChange({ generation: update.generation, status: 'error' });
      expect(ctx.getExposes().loadingStatus.get()).toBe('error');
      expect(ctx.events).toHaveLength(eventCount + 1);
      record.connection.onStatusChange({ generation: update.generation, status: 'loaded' });
      expect(ctx.getExposes().loadingStatus.get()).toBe('error');
      expect(ctx.events).toHaveLength(eventCount + 1);
      expect(ctx.getExposes().source.get()).toBe('image:logo');
      expect(renderProtoStyleTokenCss(ctx.runtime.controller.getRuleStyleTokens())).toContain(
        'border-radius: 500px;'
      );
      ctx.runtime.controller.applyRawProps({ source: '', a11yMode: 'decorative' });
      expect(ctx.getExposes().loadingStatus.get()).toBe('idle');
      expect(ctx.runtime.controller.getRuleStyleTokens()).not.toContain('rounded-[500px]');
    } finally {
      await ctx.runtime.session.unmount();
    }
    expect(ctx.records[0].disposed).toBe(1);
  });

  it('retains Transition content through leaving and a reversal without inventing an animation', async () => {
    const root = element(transition, {
      defaultOpen: true,
      enterDuration: 1000,
      leaveDuration: 1000,
    });
    const action = document.createElement('button');
    action.textContent = 'Keep working';
    root.append(action);
    document.body.append(root);
    await settle();
    action.focus();
    root.getExposes().leave();
    expect(root.getExposes().transitionState.get()).toBe('leaving');
    expect(root.getExposes().isPresent.get()).toBe(true);
    expect(root.querySelector('button')).toBe(action);
    expect(document.activeElement).toBe(action);
    root.getExposes().enter();
    root.getExposes().complete();
    expect(root.getExposes().transitionState.get()).toBe('entered');
    expect(root.querySelector('button')).toBe(action);
    expect(root.hasAttribute('role')).toBe(false);
    expect(tokens(root)).toEqual([]);
  });

  it('preserves Transition interruption, stale-delay rejection and afterLeave-before-detach ordering', async () => {
    const ctx = transitionRuntime({
      defaultOpen: true,
      appear: true,
      enterDuration: 120,
      leaveDuration: 60,
      interrupt: 'reverse',
    });
    try {
      const exposes = ctx.getExposes();
      expect(exposes.transitionState.get()).toBe('entering');
      expect(ctx.delays.map((delay) => delay.durationMs)).toEqual([120]);
      ctx.runtime.invokeInCallbackScope(() => exposes.controls.leave());
      expect(exposes.transitionState.get()).toBe('leaving');
      expect(ctx.runtime.session.viewIntent.getSnapshot().present).toBe(true);
      expect(ctx.delays[0].cancelled).toBe(true);
      ctx.delays[0].task();
      expect(exposes.transitionState.get()).toBe('leaving');
      ctx.runtime.invokeInCallbackScope(() => exposes.controls.enter());
      expect(exposes.transitionState.get()).toBe('entering');
      ctx.delays[1].task();
      expect(exposes.transitionState.get()).toBe('entering');
      ctx.delays[2].task();
      expect(exposes.transitionState.get()).toBe('entered');
      expect(ctx.events.map((event) => event.key)).toEqual([
        'beforeEnter',
        'beforeLeave',
        'beforeEnter',
        'afterEnter',
      ]);
      ctx.runtime.invokeInCallbackScope(() => exposes.controls.leave());
      expect(ctx.runtime.session.viewIntent.getSnapshot().present).toBe(true);
      ctx.delays[3].task();
      expect(exposes.transitionState.get()).toBe('closed');
      expect(exposes.isPresent.get()).toBe(false);
      expect(ctx.events.at(-1)).toEqual({ key: 'afterLeave', present: true });
      expect(ctx.runtime.session.viewIntent.getSnapshot().present).toBe(false);
      ctx.runtime.invokeInCallbackScope(() => exposes.controls.enter());
      expect(ctx.runtime.session.viewIntent.getSnapshot().present).toBe(true);
      expect(exposes.transitionState.get()).toBe('entering');
    } finally {
      await ctx.runtime.session.unmount();
    }
  });

  it('reduces Transition waits to zero without collapsing phase or event order', async () => {
    const ctx = transitionRuntime(
      { open: true, appear: true, enterDuration: 240, leaveDuration: 180 },
      true
    );
    try {
      expect(ctx.getExposes().transitionState.get()).toBe('entering');
      expect(ctx.delays.map((delay) => delay.durationMs)).toEqual([0]);
      expect(ctx.events.map((event) => event.key)).toEqual(['beforeEnter']);
      ctx.delays[0].task();
      expect(ctx.getExposes().transitionState.get()).toBe('entered');
      ctx.runtime.controller.applyRawProps({ open: false, enterDuration: 240, leaveDuration: 180 });
      expect(ctx.getExposes().transitionState.get()).toBe('leaving');
      expect(ctx.runtime.session.viewIntent.getSnapshot().present).toBe(true);
      expect(ctx.delays.map((delay) => delay.durationMs)).toEqual([0, 0]);
      ctx.delays[1].task();
      expect(ctx.getExposes().transitionState.get()).toBe('closed');
      expect(ctx.runtime.session.viewIntent.getSnapshot().present).toBe(false);
      expect(ctx.events.map((event) => event.key)).toEqual([
        'beforeEnter',
        'afterEnter',
        'beforeLeave',
        'afterLeave',
      ]);
    } finally {
      await ctx.runtime.session.unmount();
    }
  });
});
