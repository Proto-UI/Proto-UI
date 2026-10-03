import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import {
  captureHeaderPreferenceLease,
  inspectHeaderPreferenceLease,
  headerPreferenceLeaseIssues,
  measureHeaderPreferenceFocusRing,
} from './site-header-breakpoint-evidence';

function fixture() {
  document.body.innerHTML = `<header data-homepage-runtime data-runtime-generation="7"><div data-site-header-panel><div id="home-preferences"><div data-projection-control="runtime"><div data-demo-ref="__pui_projection__runtime_root" data-projection-owner="homepage-home-preferences" data-projection-generation="7" data-projection-runtime="wc" data-projection-family="shadcn"><button role="combobox" aria-controls="runtime-options" data-projection-owner="homepage-home-preferences" data-projection-generation="7" data-projection-runtime="wc" data-projection-family="shadcn"><span data-projection-prototype="shadcn-select-value">Web Components</span></button></div></div></div></div></header><div role="listbox" id="runtime-options"><button role="option" aria-selected="true">Web Components</button></div>`;
  const trigger = document.querySelector<HTMLButtonElement>('[role="combobox"]')!;
  const root = trigger.parentElement! as HTMLElement & { getExposes: () => typeof entries };
  const value = { get: () => 'wc' };
  const text = { get: () => 'Web Components' };
  let entries = { value, textValue: text };
  root.getExposes = () => entries;
  const portal = document.querySelector<HTMLElement>('[role="listbox"]')!;
  const selected = portal.querySelector<HTMLButtonElement>('[role="option"]')!;
  vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 20, 180, 44));
  vi.spyOn(portal, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 68, 180, 160));
  selected.focus();
  const lease = captureHeaderPreferenceLease(trigger, { root, control: 'runtime' });
  const options = { insidePanel: true, portal, selected, focused: 'portal' as const };
  return {
    root,
    trigger,
    portal,
    selected,
    lease,
    options,
    replaceState() {
      entries = { value: { get: () => 'wc' }, textValue: { get: () => 'Web Components' } };
    },
    inspect: () => inspectHeaderPreferenceLease(lease, options),
  };
}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('breakpoint evidence rejects locator-shaped false positives', () => {
  it('accepts the same physical nodes, selected portal and public state entries', () => {
    const f = fixture();
    expect(headerPreferenceLeaseIssues(f.inspect())).toEqual([]);
    const desktop = document.createElement('div');
    document.querySelector('header')!.append(desktop);
    desktop.append(document.querySelector('#home-preferences')!);
    expect(
      headerPreferenceLeaseIssues(
        inspectHeaderPreferenceLease(f.lease, { ...f.options, insidePanel: false })
      )
    ).toEqual([]);
  });
  it('rejects a clone with identical selectors, attributes, value and generation', () => {
    const f = fixture();
    f.root.replaceWith(f.root.cloneNode(true));
    expect(headerPreferenceLeaseIssues(f.inspect())).toEqual(
      expect.arrayContaining(['sameRoot', 'sameTrigger', 'connected'])
    );
  });
  it('rejects semantic state handle recreation on the very same WC host', () => {
    const f = fixture();
    f.replaceState();
    expect(headerPreferenceLeaseIssues(f.inspect())).toContain('publicStateIdentityRetained');
    expect(f.inspect().sameRoot).toBe(true);
    expect(f.inspect().selectionRetained).toBe(true);
  });
  it('rejects a replacement portal or focused option despite reusing its public ID', () => {
    const f = fixture();
    f.portal.replaceWith(f.portal.cloneNode(true));
    expect(headerPreferenceLeaseIssues(f.inspect())).toEqual(
      expect.arrayContaining(['portalRetained', 'selectedOptionRetained', 'focusRetained'])
    );
  });
  it('rejects generation drift, source owner contamination and duplicate controls', () => {
    const f = fixture();
    f.root.dataset.projectionGeneration = '8';
    f.trigger.dataset.projectionOwner = 'site-header-surface-1';
    f.root.parentElement!.append(f.trigger.cloneNode(true));
    expect(headerPreferenceLeaseIssues(f.inspect())).toEqual(
      expect.arrayContaining(['generationRetained', 'coordinatesRetained', 'sameTrigger'])
    );
  });
  it('rejects hidden settings or wrong destination even if values and identities survive', () => {
    const f = fixture();
    document.querySelector<HTMLElement>('[data-site-header-panel]')!.hidden = true;
    expect(headerPreferenceLeaseIssues(f.inspect())).toContain('visible');
    expect(
      headerPreferenceLeaseIssues(
        inspectHeaderPreferenceLease(f.lease, { ...f.options, insidePanel: false })
      )
    ).toContain('expectedLocation');
  });
});

describe('actual clipping oracle with explicitly injected unit geometry', () => {
  function ringFixture() {
    document.body.innerHTML =
      '<div style="overflow-x: auto; overflow-y: auto"><button style="--pui-ring-width:2px;--pui-ring-offset-width:2px;box-shadow:0 0 0 4px black">Runtime</button></div>';
    const clip = document.querySelector('div')!;
    const trigger = document.querySelector('button')!;
    vi.spyOn(clip, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 220, 120));
    vi.spyOn(clip, 'clientWidth', 'get').mockReturnValue(220);
    vi.spyOn(clip, 'clientHeight', 'get').mockReturnValue(120);
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 20, 100, 44));
    vi.spyOn(trigger, 'matches').mockReturnValue(true);
    trigger.focus();
    return { trigger, clip };
  }
  it('measures the family-owned ring extent instead of checking only the target box', () => {
    const { trigger } = ringFixture();
    const facts = measureHeaderPreferenceFocusRing(trigger);
    expect(facts.ring).toEqual({ left: 16, right: 124, top: 16, bottom: 68 });
    expect(facts.clipping).toHaveLength(1);
    expect(facts.unclipped).toBe(true);
    expect(facts.ringWidth).toBe(2);
    expect(facts.ringOffset).toBe(2);
  });
  it('rejects a clipped ring while the entire target rectangle remains visible', () => {
    const { trigger, clip } = ringFixture();
    vi.mocked(clip.getBoundingClientRect).mockReturnValue(new DOMRect(20, 20, 100, 44));
    vi.mocked(Object.getOwnPropertyDescriptor(clip, 'clientWidth')!.get!).mockReturnValue(100);
    vi.mocked(Object.getOwnPropertyDescriptor(clip, 'clientHeight')!.get!).mockReturnValue(44);
    const facts = measureHeaderPreferenceFocusRing(trigger);
    expect(facts.target.left).toBe(20);
    expect(facts.target.right).toBe(120);
    expect(facts.unclipped).toBe(false);
    expect(facts.clipping[0]).toMatchObject({ containsX: false, containsY: false });
  });
});

it('keeps the exact Playwright-serialized probes executable without build-time closures', () => {
  const source = readFileSync(
    'apps/www/src/content/docs/zh-cn/site-header-breakpoint-evidence.ts',
    'utf8'
  );
  const module = { exports: {} as Record<string, Function> };
  runInNewContext(transformSync(source, { loader: 'ts', format: 'cjs', keepNames: true }).code, {
    module,
    exports: module.exports,
  });
  const f = fixture();
  for (const name of [
    'captureHeaderPreferenceLease',
    'inspectHeaderPreferenceLease',
    'measureHeaderPreferenceFocusRing',
  ]) {
    const serialized = module.exports[name]!.toString();
    expect(serialized).not.toContain('__name');
    const browserFunction = runInNewContext(`(${serialized})`);
    if (name === 'captureHeaderPreferenceLease')
      expect(browserFunction(f.trigger, { root: f.root, control: 'runtime' }).root).toBe(f.root);
    if (name === 'inspectHeaderPreferenceLease')
      expect(headerPreferenceLeaseIssues(browserFunction(f.lease, f.options))).toEqual([]);
    if (name === 'measureHeaderPreferenceFocusRing')
      expect(browserFunction(f.trigger).target.width).toBe(180);
  }
});
