import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  collectMatrixInteractiveFacts,
  matrixHostsReady,
  collectMatrixReadinessDiagnostics,
} from './demo-matrix-observation';

const roles = ['button', 'textbox'];

function cell(state = 'loading') {
  let grid = document.querySelector('.demo-matrix__adapters');
  if (!grid) {
    document.body.innerHTML =
      '<article class="demo-matrix__item" id="textarea"><div class="demo-matrix__adapters"></div></article>';
    grid = document.querySelector('.demo-matrix__adapters')!;
  }
  const adapter = document.createElement('section');
  adapter.className = 'demo-matrix__adapter';
  adapter.innerHTML = `<div data-previewer-id="fixture" data-inited="1" data-projection-mode="fixed-family" data-projection-state="${state}"><div class="host"><span>Loading</span></div></div>`;
  grid.append(adapter);
  return {
    root: adapter.querySelector<HTMLElement>('[data-previewer-id]')!,
    host: adapter.querySelector<HTMLElement>('.host')!,
  };
}

function generation(host: HTMLElement, state: 'staging' | 'active') {
  const wrapper = document.createElement('div');
  wrapper.dataset.projectionGenerationState = state;
  wrapper.innerHTML =
    '<textarea role="textbox" aria-label="Notes"></textarea><div role="button">Focus</div><div role="button">Blur</div>';
  if (state === 'staging') {
    wrapper.inert = true;
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.style.opacity = '0';
  }
  host.append(wrapper);
  return wrapper;
}

function signatureCount() {
  const rows = collectMatrixInteractiveFacts(roles).textarea;
  expect(rows).toHaveLength(4);
  return new Set(
    rows.map((row) => row.map((control) => `${control.role}|${control.name}`).join('\n'))
  ).size;
}

beforeEach(() => {
  document.body.replaceChildren();
  // Explicit layout injection: staging remains non-zero-sized in the real
  // materializer. This unit suite tests sampling, not browser geometry/paint.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 20,
    bottom: 20,
    width: 20,
    height: 20,
    toJSON: () => ({}),
  });
});
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('Demo Matrix committed projection observations', () => {
  it('rejects empty pages and initialized skeletons that satisfy the previous child-count wait', () => {
    expect(matrixHostsReady()).toBe(false);
    const cells = Array.from({ length: 4 }, () => cell());
    expect(
      cells.every(({ root, host }) => root.dataset.inited === '1' && host.childElementCount > 0)
    ).toBe(true);
    expect(matrixHostsReady()).toBe(false);
  });

  it('rejects a laid-out staging tree until both ready and active are present', () => {
    const { root, host } = cell();
    const candidate = generation(host, 'staging');
    expect(candidate.querySelector('textarea')!.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(matrixHostsReady()).toBe(false);
    root.dataset.projectionState = 'ready';
    expect(matrixHostsReady()).toBe(false);
    candidate.dataset.projectionGenerationState = 'active';
    root.dataset.projectionState = 'loading';
    expect(matrixHostsReady()).toBe(false);
    root.dataset.projectionState = 'ready';
    expect(matrixHostsReady()).toBe(true);
  });

  it('does not count staged controls beside a committed generation', () => {
    for (let index = 0; index < 4; index++) {
      const { host } = cell('ready');
      generation(host, 'active');
      const staged = generation(host, 'staging');
      staged.querySelector('textarea')!.setAttribute('aria-label', `Uncommitted ${index}`);
    }
    expect(matrixHostsReady()).toBe(true);
    expect(signatureCount()).toBeLessThanOrEqual(1);
    expect(collectMatrixInteractiveFacts(roles).textarea.every((row) => row.length === 3)).toBe(
      true
    );
  });

  it('keeps the original parity assertion failing for a missing role after readiness', () => {
    const candidates = Array.from({ length: 4 }, () => generation(cell('ready').host, 'active'));
    expect(matrixHostsReady()).toBe(true);
    expect(signatureCount()).toBeLessThanOrEqual(1);
    candidates[1].querySelector('[role="button"]')!.removeAttribute('role');
    expect(matrixHostsReady()).toBe(true);
    expect(signatureCount()).toBe(2);
    expect(() => expect(signatureCount()).toBeLessThanOrEqual(1)).toThrow();
  });

  it('preserves accessible-name differences in active generations', () => {
    const candidates = Array.from({ length: 4 }, () => generation(cell('ready').host, 'active'));
    candidates[2].querySelector('textarea')!.setAttribute('aria-label', 'Wrong label');
    expect(matrixHostsReady()).toBe(true);
    expect(signatureCount()).toBe(2);
  });

  it('allows existing error assertions to observe a rendered failure and preserves legacy hosts', () => {
    const { root, host } = cell('error');
    host.innerHTML = '<pre>[Preview Error]\nmount failed</pre>';
    expect(matrixHostsReady()).toBe(true);
    expect(host.textContent).toContain('[Preview Error]');
    root.removeAttribute('data-projection-mode');
    host.innerHTML = '<button>Legacy control</button>';
    expect(matrixHostsReady()).toBe(true);
    host.replaceChildren();
    expect(matrixHostsReady()).toBe(false);
  });
});

describe('Demo Matrix read-only failure diagnostics', () => {
  it('identifies uninitialized and skeleton rows without changing readiness', () => {
    const { root, host } = cell('loading');
    root.dataset.inited = '0';
    const before = document.body.innerHTML;
    const facts = collectMatrixReadinessDiagnostics(4);
    expect(facts).toMatchObject({
      demos: 1,
      expectedPreviewers: 4,
      previewers: 1,
      initialized: 0,
      uninitializedCount: 1,
      notReadyCount: 1,
    });
    expect(facts.notReadyRows[0]).toMatchObject({
      demoId: 'textarea',
      previewerId: 'fixture',
      hostPresent: true,
      activeGenerations: 0,
      projectionState: 'loading',
    });
    expect(matrixHostsReady()).toBe(false);
    expect(host.childElementCount).toBe(1);
    expect(document.body.innerHTML).toBe(before);
  });
  it('separates initialized staging, committed active, unavailable and rendered errors', () => {
    const a = cell('ready');
    generation(a.host, 'staging');
    const b = cell('ready');
    generation(b.host, 'active');
    const c = cell('error');
    c.host.textContent = '[Preview Error] exact fixture failure';
    const unavailable = document.createElement('div');
    unavailable.className = 'demo-matrix__adapter';
    unavailable.dataset.unavailable = 'unsupported';
    document.body.append(unavailable);
    const facts = collectMatrixReadinessDiagnostics(4);
    expect(facts).toMatchObject({
      initialized: 3,
      expectedPreviewers: 3,
      unavailable: 1,
      uninitializedCount: 0,
      notReadyCount: 1,
    });
    expect(facts.notReadyRows[0].activeGenerations).toBe(0);
    expect(facts.previewErrors[0].previewError).toContain('exact fixture failure');
    expect(facts.notReadyRows.some((row) => row.previewError !== null)).toBe(false);
    expect(matrixHostsReady()).toBe(false);
    a.host.querySelector<HTMLElement>(
      '[data-projection-generation-state]'
    )!.dataset.projectionGenerationState = 'active';
    expect(collectMatrixReadinessDiagnostics(4).notReadyCount).toBe(0);
    expect(matrixHostsReady()).toBe(true);
  });
});
