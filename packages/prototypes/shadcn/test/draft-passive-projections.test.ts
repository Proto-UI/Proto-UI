import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import { styleScope } from '../src/style-scope';
import { asyncRegionRoot } from '../src/async-region';
import { liveRegionRoot } from '../src/live-region';
import { imageRoot } from '../src/image';
import { transition } from '../src/transition';
import { tableRoot, tableCaption, tableRow, tableHeaderCell, tableCell } from '../src/table';
import type { ShadcnTableRootExposes } from '../src/table';

AdaptToWebComponent(styleScope);
AdaptToWebComponent(asyncRegionRoot);
AdaptToWebComponent(liveRegionRoot);
AdaptToWebComponent(imageRoot);
AdaptToWebComponent(transition);
AdaptToWebComponent(tableRoot);
AdaptToWebComponent(tableCaption);
AdaptToWebComponent(tableRow);
AdaptToWebComponent(tableHeaderCell);
AdaptToWebComponent(tableCell);

type ConsumerElement<Exposes = Record<string, unknown>> = HTMLElement & {
  getExposes(): Exposes;
  update(): void;
};

type StateReader<T> = { get(): T };
type AsyncExposes = { busy: StateReader<boolean> };
type ImageExposes = { source: StateReader<string>; loadingStatus: StateReader<string> };
type TransitionExposes = {
  transitionState: StateReader<string>;
  isPresent: StateReader<boolean>;
  controls: { complete(): void };
};
type TableSnapshot = NonNullable<ReturnType<ShadcnTableRootExposes['getStructure']['fn']>>;
type TableExposes = { getStructure(): TableSnapshot | null };

function element<Exposes = Record<string, unknown>>(
  name: string,
  props: Record<string, unknown> = {}
): ConsumerElement<Exposes> {
  // Registered Proto custom elements provide getExposes/update beyond HTMLElement.
  const result = document.createElement(name) as ConsumerElement<Exposes>;
  setElementProps(result, props);
  return result;
}

function getStructure(root: ConsumerElement<TableExposes>): TableSnapshot {
  const snapshot = root.getExposes().getStructure();
  if (!snapshot) throw new Error('Table Structure snapshot is unavailable');
  return snapshot;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.restoreAllMocks();
});

describe('shadcn draft passive projections', () => {
  it('keeps busy descendants and focus while forwarding the Base busy state', async () => {
    const root = element<AsyncExposes>(asyncRegionRoot.name);
    const control = document.createElement('button');
    control.textContent = 'Retry';
    root.append(control);
    document.body.append(root);
    await flush();
    control.focus();

    expect(root.getAttribute('aria-busy')).toBe('false');
    expect(root.getExposes().busy.get()).toBe(false);
    setElementProps(root, { busy: true });
    await flush();
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(root.getExposes().busy.get()).toBe(true);
    expect(root.firstChild).toBe(control);
    expect(document.activeElement).toBe(control);
    expect(root.hasAttribute('role')).toBe(false);
    expect(root.hasAttribute('aria-live')).toBe(false);

    setElementProps(root, { busy: false });
    await flush();
    expect(root.getAttribute('aria-busy')).toBe('false');
    expect(root.getExposes().busy.get()).toBe(false);
    expect(root.firstChild).toBe(control);
    expect(document.activeElement).toBe(control);
  });

  it('updates live semantics without replacing the authored announcement', async () => {
    const root = element(liveRegionRoot.name);
    const payload = document.createElement('span');
    payload.textContent = 'New message';
    root.append(payload);
    document.body.append(root);
    await flush();
    expect(root.getAttribute('role')).toBe('status');
    expect(root.getAttribute('aria-live')).toBe('polite');
    expect(root.getAttribute('aria-atomic')).toBe('true');

    setElementProps(root, { politeness: 'assertive', atomic: false });
    await flush();
    expect(root.getAttribute('role')).toBe('alert');
    expect(root.getAttribute('aria-live')).toBe('assertive');
    expect(root.getAttribute('aria-atomic')).toBe('false');
    expect(root.firstChild).toBe(payload);
    expect(root.textContent).toBe('New message');
    expect(Object.keys(root.getExposes())).toEqual([]);
    expect(root.tabIndex).toBe(-1);
  });

  it('uses the Image View target and ignores completion from an obsolete source', async () => {
    const requests: Array<{ resolve(): void; reject(error?: unknown): void }> = [];
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(() => {
      const { promise, resolve, reject } = Promise.withResolvers<void>();
      requests.push({ resolve: () => resolve(undefined), reject });
      return promise;
    });
    const root = element<ImageExposes>(imageRoot.name, {
      source: 'image:a',
      alternativeText: 'First image',
      a11yMode: 'informative',
      fit: 'cover',
    });
    const changes: string[] = [];
    root.addEventListener('loadingStatusChange', (event) =>
      changes.push((event as CustomEvent<{ status: string }>).detail.status)
    );
    document.body.append(root);
    await flush();

    const image = root.querySelector('img');
    if (!image) throw new Error('Image View did not materialize its target');
    const exposes = root.getExposes();
    expect(root.querySelectorAll('img')).toHaveLength(1);
    expect(image.getAttribute('src')).toBe('image:a');
    expect(image.alt).toBe('First image');
    expect(image.style.objectFit).toBe('cover');
    expect(exposes.loadingStatus.get()).toBe('loading');
    expect(requests).toHaveLength(1);

    setElementProps(root, {
      source: 'image:b',
      alternativeText: '',
      a11yMode: 'decorative',
      fit: 'contain',
    });
    root.update();
    await flush();
    expect(root.querySelector('img')).toBe(image);
    expect(image.getAttribute('src')).toBe('image:b');
    expect(image.alt).toBe('');
    expect(image.style.objectFit).toBe('contain');
    expect(exposes.source.get()).toBe('image:b');
    expect(requests).toHaveLength(2);

    requests[0].resolve();
    await flush();
    expect(exposes.loadingStatus.get()).toBe('loading');
    requests[1].resolve();
    await flush();
    expect(exposes.loadingStatus.get()).toBe('loaded');
    expect(changes.filter((status) => status === 'loaded')).toHaveLength(1);
  });

  it('preserves standalone transition content through leave and exposes phase completion', async () => {
    const root = element<TransitionExposes>(transition.name, {
      defaultOpen: true,
      leaveDuration: 10000,
    });
    const content = document.createElement('span');
    content.textContent = 'Transition payload';
    root.append(content);
    const events: string[] = [];
    for (const name of ['beforeLeave', 'afterLeave']) {
      root.addEventListener(name, () => events.push(name));
    }
    document.body.append(root);
    await flush();
    const exposes = root.getExposes();
    expect(exposes.transitionState.get()).toBe('entered');
    expect(exposes.isPresent.get()).toBe(true);
    expect(root.firstChild).toBe(content);

    setElementProps(root, { open: false, leaveDuration: 10000 });
    await flush();
    expect(exposes.transitionState.get()).toBe('leaving');
    expect(exposes.isPresent.get()).toBe(true);
    expect(root.firstChild).toBe(content);
    expect(events).toEqual(['beforeLeave']);
    exposes.controls.complete();
    await flush();
    expect(exposes.transitionState.get()).toBe('closed');
    expect(exposes.isPresent.get()).toBe(false);
    expect(events).toEqual(['beforeLeave', 'afterLeave']);
  });
});

describe('shadcn passive table composition', () => {
  it('switches all nine source profiles without retaining previous geometry', async () => {
    const root = element<TableExposes>(tableRoot.name);
    const caption = element(tableCaption.name);
    const row = element(tableRow.name);
    const header = element(tableHeaderCell.name, { headerKey: 'h', headerKind: 'column' });
    const cell = element(tableCell.name, { headers: ['h'] });
    caption.textContent = 'Heading';
    header.textContent = 'Column';
    cell.textContent = 'Value';
    row.append(header, cell);
    root.append(caption, row);
    document.body.append(root);
    await flush();

    const profiles = [
      { styleProfile: 'vega', smallText: false, largeCell: false, sera: false },
      { styleProfile: 'nova', smallText: false, largeCell: false, sera: false },
      { styleProfile: 'maia', smallText: false, largeCell: true, sera: false },
      { styleProfile: 'lyra', smallText: true, largeCell: false, sera: false },
      { styleProfile: 'mira', smallText: true, largeCell: false, sera: false },
      { styleProfile: 'luma', smallText: false, largeCell: true, sera: false },
      { styleProfile: 'sera', smallText: false, largeCell: true, sera: true },
      { styleProfile: 'rhea', smallText: false, largeCell: false, sera: false },
      { styleProfile: 'new-york-v4', smallText: false, largeCell: false, sera: false },
    ] as const;
    for (const profile of profiles) {
      setElementProps(root, { styleProfile: profile.styleProfile });
      await flush();
      expect(getStructure(root).valid).toBe(true);
      expect(styleContains(root, 'text-xs')).toBe(profile.smallText);
      expect(styleContains(root, 'text-sm')).toBe(!profile.smallText);
      expect(styleContains(caption, 'text-xs')).toBe(profile.smallText);
      expect(styleContains(caption, 'text-sm')).toBe(!profile.smallText);
      expect(styleContains(header, 'h-12')).toBe(profile.largeCell);
      expect(styleContains(header, 'h-10')).toBe(!profile.largeCell);
      expect(styleContains(header, 'uppercase')).toBe(profile.sera);
      expect(styleContains(header, 'text-muted-foreground')).toBe(profile.sera);
      expect(styleContains(header, 'text-foreground')).toBe(!profile.sera);
      expect(styleContains(cell, 'p-3')).toBe(profile.largeCell);
      expect(styleContains(cell, 'p-2')).toBe(!profile.largeCell);
    }
  });

  it('retains Base header relationships, content and owner identity across style changes', async () => {
    const outer = element(styleScope.name, { styleProfile: 'lyra' });
    const root = element<TableExposes>(tableRoot.name);
    const caption = element(tableCaption.name);
    const headerRow = element(tableRow.name);
    const dataRow = element(tableRow.name);
    const header = element(tableHeaderCell.name, {
      headerKey: 'name',
      headerKind: 'column',
      columnSpan: 2,
    });
    const cell = element(tableCell.name, { headers: ['name'] });
    const secondCell = element(tableCell.name, { headers: ['name'] });
    const value = document.createElement('button');
    caption.textContent = 'Accounts';
    header.textContent = 'Name';
    value.textContent = 'Alice';
    secondCell.textContent = 'Bob';
    cell.append(value);
    headerRow.append(header);
    dataRow.append(cell, secondCell);
    root.append(caption, headerRow, dataRow);
    outer.append(root);
    document.body.append(outer);
    await flush();

    const before = getStructure(root);
    expect(before).toMatchObject({ valid: true, rowCount: 2, columnCount: 2 });
    expect(before.rows[0].cells[0].columnSpan).toBe(2);
    expect(before.rows[1].cells[0].columnHeaders).toEqual([before.rows[0].cells[0].ref]);
    expect(before.rows[1].cells[1].columnHeaders).toEqual([before.rows[0].cells[0].ref]);
    expect(root.getAttribute('role')).toBe('table');
    expect(header.getAttribute('role')).toBe('columnheader');
    expect(header.getAttribute('aria-colspan')).toBe('2');
    expect(cell.getAttribute('role')).toBe('cell');
    expect(styleContains(root, 'text-xs')).toBe(true);
    expect(styleContains(header, 'h-10')).toBe(true);
    expect(styleContains(cell, 'p-2')).toBe(true);
    value.focus();

    setElementProps(outer, { styleProfile: 'sera' });
    await flush();
    const after = getStructure(root);
    expect(after.rows[0].ref).toBe(before.rows[0].ref);
    expect(after.rows[1].cells[0].columnHeaders).toEqual([after.rows[0].cells[0].ref]);
    expect(styleContains(root, 'text-sm')).toBe(true);
    expect(styleContains(root, 'text-xs')).toBe(false);
    expect(styleContains(header, 'h-12')).toBe(true);
    expect(styleContains(header, 'uppercase')).toBe(true);
    expect(styleContains(header, 'h-10')).toBe(false);
    expect(styleContains(cell, 'p-3')).toBe(true);
    expect(styleContains(cell, 'p-2')).toBe(false);
    expect(cell.firstChild).toBe(value);
    expect(document.activeElement).toBe(value);

    setElementProps(header, {
      headerKey: 'name',
      headerKind: 'column',
      columnSpan: 2,
      styleProfile: 'nova',
    });
    await flush();
    expect(styleContains(header, 'h-10')).toBe(true);
    expect(styleContains(header, 'uppercase')).toBe(false);
    expect(styleContains(cell, 'p-3')).toBe(true);

    setElementProps(dataRow, { styleProfile: 'lyra' });
    await flush();
    expect(styleContains(cell, 'p-2')).toBe(true);
    expect(styleContains(cell, 'p-3')).toBe(false);
    expect(cell.firstChild).toBe(value);
    expect(document.activeElement).toBe(value);

    setElementProps(cell, { headers: ['missing'] });
    await flush();
    expect(getStructure(root).valid).toBe(false);
    expect(getStructure(root).diagnostics.map((item) => item.code)).toContain(
      'missing-header-target'
    );
  });

  it('uses caller-declared visual sections for header, body and footer borders', async () => {
    const root = element<TableExposes>(tableRoot.name);
    const heading = element(tableRow.name, { section: 'header', lastInSection: true });
    const first = element(tableRow.name, { section: 'body' });
    const last = element(tableRow.name, { section: 'body', lastInSection: true });
    const footer = element(tableRow.name, { section: 'footer', lastInSection: true });
    const header = element(tableHeaderCell.name, { headerKey: 'h', headerKind: 'column' });
    header.textContent = 'Name';
    heading.append(header);
    for (const [row, value] of [
      [first, 'First'],
      [last, 'Last'],
      [footer, 'Total'],
    ] as const) {
      const cell = element(tableCell.name, { headers: ['h'] });
      cell.textContent = value;
      row.append(cell);
    }
    root.append(heading, first, last, footer);
    document.body.append(root);
    await flush();

    const before = getStructure(root);
    expect(before).toMatchObject({ valid: true, rowCount: 4, columnCount: 1 });
    expect(styleContains(heading, 'border-b')).toBe(true);
    expect(styleContains(first, 'border-b')).toBe(true);
    expect(styleContains(last, 'border-b')).toBe(false);
    expect(styleContains(last, 'border-0')).toBe(true);
    expect(styleContains(footer, 'border-t')).toBe(true);
    expect(styleContains(footer, 'border-b-0')).toBe(true);
    expect(styleContains(footer, 'bg-muted/50')).toBe(true);
    expect(styleContains(footer, 'font-medium')).toBe(true);
    expect(footer.getAttribute('role')).toBe('row');
    expect(footer.hasAttribute('aria-selected')).toBe(false);

    setElementProps(last, { section: 'header', lastInSection: true });
    setElementProps(footer, { section: 'body', lastInSection: true });
    await flush();
    const after = getStructure(root);
    expect(after.valid).toBe(true);
    expect(after.rows.map((row) => row.ref)).toEqual(before.rows.map((row) => row.ref));
    expect(styleContains(last, 'border-b')).toBe(true);
    expect(styleContains(last, 'border-0')).toBe(false);
    expect(styleContains(footer, 'border-0')).toBe(true);
    expect(styleContains(footer, 'border-b-0')).toBe(false);
    expect(styleContains(footer, 'border-t')).toBe(false);
    expect(styleContains(footer, 'bg-muted/50')).toBe(false);
    expect(footer.getAttribute('role')).toBe('row');
  });

  it('projects pointer hover only as paint and clears it without selecting the row', async () => {
    const root = element<TableExposes>(tableRoot.name);
    const row = element(tableRow.name);
    const header = element(tableHeaderCell.name, { headerKey: 'h', headerKind: 'column' });
    const cell = element(tableCell.name, { headers: ['h'] });
    row.append(header, cell);
    root.append(row);
    document.body.append(root);
    await flush();
    const structure = getStructure(root);
    expect(structure.valid).toBe(true);
    expect(styleContains(row, 'bg-muted/50')).toBe(false);
    row.dispatchEvent(new PointerEvent('pointerenter'));
    await flush();
    expect(styleContains(row, 'bg-muted/50')).toBe(true);
    expect(getStructure(root).rows[0].ref).toBe(structure.rows[0].ref);
    expect(row.hasAttribute('aria-selected')).toBe(false);
    row.dispatchEvent(new PointerEvent('pointerleave'));
    await flush();
    expect(styleContains(row, 'bg-muted/50')).toBe(false);

    row.dispatchEvent(new PointerEvent('pointerenter'));
    await flush();
    expect(styleContains(row, 'bg-muted/50')).toBe(true);
    row.remove();
    await flush();
    root.append(row);
    await flush();
    expect(styleContains(row, 'bg-muted/50')).toBe(false);
    expect(getStructure(root).valid).toBe(true);
  });
});
