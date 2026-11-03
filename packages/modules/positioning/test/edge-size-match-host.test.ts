import { afterEach, expect, it } from 'vitest';
import type { AnchoredPositionConnection } from '@proto.ui/core';
import { createFloatingUiAnchoredPositionHost } from '../src/web/floating-ui-host';

afterEach(() => document.body.replaceChildren());

const rect = (x: number, y: number, width: number, height: number): DOMRect =>
  ({
    x,
    y,
    width,
    height,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({ x, y, width, height }),
  }) as DOMRect;

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

it('edge sizing matches actual declared used boxes before reporting success without switching placement', async () => {
  const root = document.documentElement;
  const oldWidth = Object.getOwnPropertyDescriptor(root, 'clientWidth');
  const oldHeight = Object.getOwnPropertyDescriptor(root, 'clientHeight');
  const anchor = document.createElement('button');
  const floating = document.createElement('div');
  const row = document.createElement('div');
  let lease:
    | ReturnType<ReturnType<typeof createFloatingUiAnchoredPositionHost>['attach']>
    | undefined;
  try {
    Object.defineProperties(root, {
      clientWidth: { configurable: true, get: () => window.innerWidth },
      clientHeight: { configurable: true, get: () => window.innerHeight },
    });
    row.textContent = 'Row';
    row.style.margin = '0';
    floating.style.cssText = 'box-sizing:border-box;padding:5px;border:2px solid black';
    floating.append(row);
    document.body.append(anchor, floating);
    const number = (value: string, fallback: number) =>
      value ? Number.parseFloat(value) : fallback;
    const rowWidth = () => number(row.style.width, 40);
    const rowHeight = () => number(row.style.height, 12);
    // This controlled layout derives every matched dimension from actual owned
    // style writes. The legacy product therefore still reads its intrinsic box.
    const frameWidth = () => Math.max(rowWidth() + 14, number(floating.style.minWidth, 0));
    Object.defineProperties(anchor, {
      offsetWidth: { configurable: true, get: () => 180 },
      offsetHeight: { configurable: true, get: () => 36 },
      getBoundingClientRect: { configurable: true, value: () => rect(100, 100, 180, 36) },
    });
    Object.defineProperties(row, {
      offsetWidth: { configurable: true, get: rowWidth },
      offsetHeight: { configurable: true, get: rowHeight },
      clientWidth: { configurable: true, get: rowWidth },
      clientHeight: { configurable: true, get: rowHeight },
      scrollWidth: { configurable: true, get: () => 40 },
      scrollHeight: { configurable: true, get: () => 12 },
      getBoundingClientRect: {
        configurable: true,
        value: () => rect(7, 7, rowWidth(), rowHeight()),
      },
    });
    Object.defineProperties(floating, {
      offsetWidth: { configurable: true, get: frameWidth },
      offsetHeight: { configurable: true, get: () => rowHeight() + 14 },
      clientWidth: { configurable: true, get: () => frameWidth() - 4 },
      clientHeight: { configurable: true, get: () => rowHeight() + 10 },
      getBoundingClientRect: {
        configurable: true,
        value: () => rect(0, 0, frameWidth(), rowHeight() + 14),
      },
    });
    const sizing: Array<{
      status: unknown;
      measured: { width: number; height: number };
      placement: { side: string | undefined; align: string | undefined; top: string };
    }> = [];
    // The intersection keeps this falsifier executable against the frozen old
    // API; production declarations will independently define this new request.
    const request: AnchoredPositionConnection & {
      sizeMatch: { reference: unknown; targets: readonly unknown[] };
      onSizeMatch(status: unknown): void;
    } = {
      anchor,
      floating,
      config: {
        side: 'bottom',
        align: 'start',
        sideOffset: 4,
        alignOffset: 0,
        strategy: 'fixed',
        avoidCollisions: false,
        collisionBoundary: 'viewport',
        collisionPadding: 0,
      },
      sizeMatch: { reference: anchor, targets: [row] },
      onSizeMatch: (status) =>
        sizing.push({
          status,
          measured: { width: row.offsetWidth, height: row.offsetHeight },
          placement: {
            side: floating.dataset.side,
            align: floating.dataset.align,
            top: floating.style.top,
          },
        }),
    };
    lease = createFloatingUiAnchoredPositionHost().attach(request);
    await flush();
    expect({ width: row.offsetWidth, height: row.offsetHeight }).toEqual({
      width: 180,
      height: 36,
    });
    const applied = sizing.filter(
      (entry) => (entry.status as { status?: unknown })?.status === 'applied'
    );
    expect(applied.length).toBeGreaterThan(0);
    for (const entry of applied)
      expect(entry).toEqual({
        status: { status: 'applied' },
        measured: { width: 180, height: 36 },
        placement: { side: 'bottom', align: 'start', top: '140px' },
      });
    expect(floating.dataset.side).toBe('bottom');
    expect(floating.dataset.align).toBe('start');
    expect(floating.style.left).toBe('100px');
    expect(floating.style.top).toBe('140px');
  } finally {
    try {
      lease?.dispose();
    } finally {
      if (oldWidth) Object.defineProperty(root, 'clientWidth', oldWidth);
      else Reflect.deleteProperty(root, 'clientWidth');
      if (oldHeight) Object.defineProperty(root, 'clientHeight', oldHeight);
      else Reflect.deleteProperty(root, 'clientHeight');
    }
  }
  expect(row.style.width).toBe('');
  expect(row.style.height).toBe('');
  expect(floating.style.padding).toBe('5px');
});

function edgeFixture(options: { rejectWrites?: boolean; authoredWidth?: string } = {}) {
  const root = document.documentElement;
  const priorWidth = Object.getOwnPropertyDescriptor(root, 'clientWidth');
  const priorHeight = Object.getOwnPropertyDescriptor(root, 'clientHeight');
  const anchor = document.createElement('button');
  const floating = document.createElement('div');
  const row = document.createElement('div');
  const reference = { width: 180, height: 36 };
  let lease:
    | ReturnType<ReturnType<typeof createFloatingUiAnchoredPositionHost>['attach']>
    | undefined;
  const restoreViewport = () => {
    if (priorWidth) Object.defineProperty(root, 'clientWidth', priorWidth);
    else Reflect.deleteProperty(root, 'clientWidth');
    if (priorHeight) Object.defineProperty(root, 'clientHeight', priorHeight);
    else Reflect.deleteProperty(root, 'clientHeight');
  };
  try {
    Object.defineProperties(root, {
      clientWidth: { configurable: true, get: () => window.innerWidth },
      clientHeight: { configurable: true, get: () => window.innerHeight },
    });
    floating.style.cssText = 'box-sizing:border-box;padding:5px;border:2px solid black';
    row.style.margin = '0';
    if (options.authoredWidth) row.style.setProperty('width', options.authoredWidth, 'important');
    floating.append(row);
    document.body.append(anchor, floating);
    const n = (value: string, fallback: number) => (value ? Number.parseFloat(value) : fallback);
    const width = () => (options.rejectWrites ? 40 : n(row.style.width, 40));
    const height = () => (options.rejectWrites ? 12 : n(row.style.height, 12));
    const frameWidth = () => Math.max(width() + 14, n(floating.style.minWidth, 0));
    Object.defineProperties(anchor, {
      offsetWidth: { configurable: true, get: () => reference.width },
      offsetHeight: { configurable: true, get: () => reference.height },
      getBoundingClientRect: {
        configurable: true,
        value: () => rect(100, 100, reference.width, reference.height),
      },
    });
    Object.defineProperties(row, {
      offsetWidth: { configurable: true, get: width },
      offsetHeight: { configurable: true, get: height },
      clientWidth: { configurable: true, get: width },
      clientHeight: { configurable: true, get: height },
      scrollWidth: { configurable: true, get: () => 40 },
      scrollHeight: { configurable: true, get: () => 12 },
      getBoundingClientRect: { configurable: true, value: () => rect(7, 7, width(), height()) },
    });
    Object.defineProperties(floating, {
      offsetWidth: { configurable: true, get: frameWidth },
      offsetHeight: { configurable: true, get: () => height() + 14 },
      clientWidth: { configurable: true, get: () => frameWidth() - 4 },
      clientHeight: { configurable: true, get: () => height() + 10 },
      getBoundingClientRect: {
        configurable: true,
        value: () => rect(0, 0, frameWidth(), height() + 14),
      },
    });
    const connection = (
      onSizeMatch: NonNullable<AnchoredPositionConnection['onSizeMatch']>
    ): AnchoredPositionConnection => ({
      anchor,
      floating,
      config: {
        side: 'bottom',
        align: 'start',
        sideOffset: 4,
        alignOffset: 0,
        strategy: 'fixed',
        avoidCollisions: false,
        collisionBoundary: 'viewport',
        collisionPadding: 0,
      },
      sizeMatch: { reference: anchor, targets: [row] },
      onSizeMatch,
    });
    return {
      anchor,
      floating,
      row,
      reference,
      connection,
      attach(request: AnchoredPositionConnection) {
        lease = createFloatingUiAnchoredPositionHost().attach(request);
        return lease;
      },
      dispose() {
        try {
          lease?.dispose();
        } finally {
          restoreViewport();
        }
      },
    };
  } catch (error) {
    restoreViewport();
    throw error;
  }
}

it('edge sizing rejects a real used-box mismatch and restores partial style writes', async () => {
  const f = edgeFixture({ rejectWrites: true });
  const statuses: unknown[] = [];
  try {
    f.attach(f.connection((status) => statuses.push(status)));
    await flush();
    expect(statuses.at(-1)).toEqual({ status: 'unavailable', reason: 'size-conflict' });
    expect(statuses).not.toContainEqual({ status: 'applied' });
    expect([f.row.offsetWidth, f.row.offsetHeight]).toEqual([40, 12]);
    expect(f.row.style.width).toBe('');
    expect(f.row.style.height).toBe('');
    expect(f.floating.style.minWidth).toBe('');
  } finally {
    f.dispose();
  }
});

it('edge sizing preserves authored important width rather than silently taking ownership', async () => {
  const f = edgeFixture({ authoredWidth: '70px' });
  const statuses: unknown[] = [];
  try {
    f.attach(f.connection((status) => statuses.push(status)));
    await flush();
    expect(statuses.at(-1)).toEqual({ status: 'unavailable', reason: 'size-conflict' });
    expect(f.row.style.width).toBe('70px');
    expect(f.row.style.getPropertyPriority('width')).toBe('important');
    expect(f.row.style.height).toBe('');
  } finally {
    f.dispose();
  }
  expect(f.row.style.width).toBe('70px');
  expect(f.row.style.getPropertyPriority('width')).toBe('important');
});

it('edge zero-layout pending resumes with actual positive used boxes on the same connection', async () => {
  const f = edgeFixture();
  const statuses: unknown[] = [];
  f.reference.width = 0;
  try {
    const lease = f.attach(f.connection((status) => statuses.push(status)));
    await flush();
    expect(statuses.at(-1)).toEqual({ status: 'pending-target', reason: 'missing-target' });
    expect(f.row.style.width).toBe('');
    f.reference.width = 180;
    lease.requestUpdate();
    await flush();
    expect(statuses.at(-1)).toEqual({ status: 'applied' });
    expect([f.row.offsetWidth, f.row.offsetHeight]).toEqual([180, 36]);
  } finally {
    f.dispose();
  }
});

it('edge reconfiguration drops the older async status and uses the current placement', async () => {
  const f = edgeFixture();
  const old: unknown[] = [];
  const current: unknown[] = [];
  try {
    const lease = f.attach(f.connection((status) => old.push(status)));
    const next = f.connection((status) => current.push(status));
    lease.update({ ...next, config: { ...next.config, side: 'top', sideOffset: 8 } });
    await flush();
    expect(old).toEqual([]);
    expect(current.at(-1)).toEqual({ status: 'applied' });
    expect(f.floating.dataset.side).toBe('top');
    expect(f.floating.style.top).toBe('42px');
    expect([f.row.offsetWidth, f.row.offsetHeight]).toEqual([180, 36]);
  } finally {
    f.dispose();
  }
});

it('withdrawing edge sizing restores rows and does not deliver late applied status', async () => {
  const f = edgeFixture();
  const statuses: unknown[] = [];
  try {
    const lease = f.attach(f.connection((status) => statuses.push(status)));
    const request = f.connection((status) => statuses.push(status));
    const { sizeMatch: _sizing, onSizeMatch: _status, ...ordinary } = request;
    lease.update(ordinary);
    await flush();
    expect(statuses).toEqual([]);
    expect(f.row.style.width).toBe('');
    expect(f.row.style.height).toBe('');
    expect([f.row.offsetWidth, f.row.offsetHeight]).toEqual([40, 12]);
    expect(f.floating.dataset.side).toBe('bottom');
  } finally {
    f.dispose();
  }
});

it('disposing edge sizing before the async solve prevents stale placement and status writes', async () => {
  const f = edgeFixture();
  const statuses: unknown[] = [];
  try {
    const lease = f.attach(f.connection((status) => statuses.push(status)));
    lease.dispose();
    await flush();
    expect(statuses).toEqual([]);
    expect(f.row.style.width).toBe('');
    expect(f.row.style.height).toBe('');
    expect(f.floating.style.top).toBe('');
    expect(f.floating.style.left).toBe('');
    expect(f.floating.style.getPropertyValue('--proto-ui-anchor-width')).toBe('');
  } finally {
    f.dispose();
  }
});

it('an explicit non-null invalid edge reference is unavailable rather than perpetual missing layout', async () => {
  const f = edgeFixture();
  const statuses: unknown[] = [];
  const invalid = {};
  try {
    const request = f.connection((status) => statuses.push(status));
    f.attach({ ...request, anchor: invalid, sizeMatch: { reference: invalid, targets: [f.row] } });
    await flush();
    expect(statuses.at(-1)).toEqual({ status: 'unavailable', reason: 'invalid-association' });
    expect(f.row.style.width).toBe('');
    expect(f.row.style.height).toBe('');
  } finally {
    f.dispose();
  }
});

it('a foreign-document edge reference is rejected without certifying or sizing local rows', async () => {
  const f = edgeFixture();
  const statuses: unknown[] = [];
  const other = document.implementation.createHTMLDocument('foreign');
  const anchor = other.createElement('button');
  other.body.append(anchor);
  try {
    const request = f.connection((status) => statuses.push(status));
    f.attach({ ...request, anchor, sizeMatch: { reference: anchor, targets: [f.row] } });
    await flush();
    expect(statuses.at(-1)).toEqual({ status: 'unavailable', reason: 'invalid-association' });
    expect(f.row.style.width).toBe('');
    expect(f.row.style.height).toBe('');
  } finally {
    f.dispose();
  }
});

it('a genuinely missing edge reference remains pending and a current replacement can apply', async () => {
  const f = edgeFixture();
  const statuses: unknown[] = [];
  try {
    const request = f.connection((status) => statuses.push(status));
    const lease = f.attach({
      ...request,
      anchor: null,
      sizeMatch: { reference: null, targets: [f.row] },
    });
    await flush();
    expect(statuses.at(-1)).toEqual({ status: 'pending-target', reason: 'missing-target' });
    expect(f.row.style.width).toBe('');
    lease.update(request);
    await flush();
    expect(statuses.at(-1)).toEqual({ status: 'applied' });
    expect([f.row.offsetWidth, f.row.offsetHeight]).toEqual([180, 36]);
  } finally {
    f.dispose();
  }
});
