import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOwnedTwTokenApplier } from '../src/feedback-style';
import { installDefaultHostDisplay } from '../src/host-display';
import { createWebEffectsPort } from '../src/runtime/effects-port';

const cleanups: Array<() => void> = [];
let customElementId = 0;

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function observeAttributes(host: HTMLElement) {
  const observer = new MutationObserver(() => {});
  observer.observe(host, { attributes: true, attributeOldValue: true });
  cleanups.push(() => observer.disconnect());
  return () => observer.takeRecords().map((record) => record.attributeName);
}

describe('WC owned style avoids equal live DOM writes', () => {
  it('keeps each ownership update and hook while repeated tokens produce no mutation', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const mutations = observeAttributes(host);
    const onChange = vi.fn();
    const applier = createOwnedTwTokenApplier(host, { onChange });

    applier.apply(['w-full', 'bg-primary']);
    expect(mutations()).toEqual(['data-pui-style']);
    applier.apply(['w-full', 'bg-primary', 'bg-primary', '']);

    expect(mutations()).toEqual([]);
    expect([...applier.getOwned()]).toEqual(['w-full', 'bg-primary']);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('records a second identical owner even though neither acquisition nor first release writes', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const first = createOwnedTwTokenApplier(host);
    const second = createOwnedTwTokenApplier(host);
    first.apply(['w-full']);
    const mutations = observeAttributes(host);

    second.apply(['w-full']);
    expect(mutations()).toEqual([]);
    first.clear();
    expect(mutations()).toEqual([]);
    expect(host.getAttribute('data-pui-style')).toBe('w-full');
    expect([...second.getOwned()]).toEqual(['w-full']);
    second.clear();
    expect(mutations()).toEqual(['data-pui-style']);
    expect(host.hasAttribute('data-pui-style')).toBe(false);
  });

  it('does not acquire an existing external token during an equal projection', () => {
    const host = document.createElement('div');
    host.setAttribute('data-pui-style', 'w-full');
    document.body.append(host);
    const mutations = observeAttributes(host);
    const applier = createOwnedTwTokenApplier(host);

    applier.apply(['w-full']);
    applier.clear();

    expect(mutations()).toEqual([]);
    expect(host.getAttribute('data-pui-style')).toBe('w-full');
    expect([...applier.getOwned()]).toEqual([]);
  });

  it('repairs a foreign replacement and retains its new external token on release', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const applier = createOwnedTwTokenApplier(host);
    applier.apply(['w-full']);
    host.setAttribute('data-pui-style', 'consumer-token');
    const mutations = observeAttributes(host);

    applier.apply(['w-full']);
    expect(mutations()).toEqual(['data-pui-style']);
    expect(host.getAttribute('data-pui-style')).toBe('consumer-token w-full');
    applier.clear();
    expect(host.getAttribute('data-pui-style')).toBe('consumer-token');
  });

  it('reconciles a withdrawn external overlap before deciding a later write is equal', () => {
    const host = document.createElement('div');
    host.setAttribute('data-pui-style', 'consumer-token w-full');
    document.body.append(host);
    const applier = createOwnedTwTokenApplier(host);
    applier.apply(['w-full']);
    host.setAttribute('data-pui-style', 'consumer-token');
    applier.apply(['w-full']);
    const mutations = observeAttributes(host);

    applier.apply(['w-full']);
    expect(mutations()).toEqual([]);
    applier.clear();
    expect(host.getAttribute('data-pui-style')).toBe('consumer-token');
  });

  it('still removes a present empty attribute and leaves an already absent one alone', () => {
    const host = document.createElement('div');
    host.setAttribute('data-pui-style', '');
    document.body.append(host);
    const mutations = observeAttributes(host);
    const onChange = vi.fn();
    const applier = createOwnedTwTokenApplier(host, { onChange });

    applier.apply([]);
    expect(mutations()).toEqual(['data-pui-style']);
    applier.apply([]);
    expect(mutations()).toEqual([]);
    expect(host.hasAttribute('data-pui-style')).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('allows an equal projection hook to install a successor token set', () => {
    const host = document.createElement('div');
    document.body.append(host);
    let replace = false;
    const onChange = vi.fn(() => {
      if (!replace) return;
      replace = false;
      applier.apply(['bg-primary']);
    });
    const applier = createOwnedTwTokenApplier(host, { onChange });
    applier.apply(['w-full']);
    const mutations = observeAttributes(host);

    replace = true;
    applier.apply(['w-full']);

    expect(mutations()).toEqual(['data-pui-style']);
    expect(host.getAttribute('data-pui-style')).toBe('bg-primary');
    expect([...applier.getOwned()]).toEqual(['bg-primary']);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('allows an equal projection hook to retire its owner', () => {
    const host = document.createElement('div');
    document.body.append(host);
    let retire = false;
    const onChange = vi.fn(() => {
      if (!retire) return;
      retire = false;
      applier.clear();
    });
    const applier = createOwnedTwTokenApplier(host, { onChange });
    applier.apply(['w-full']);
    const mutations = observeAttributes(host);

    retire = true;
    applier.apply(['w-full']);

    expect(mutations()).toEqual(['data-pui-style']);
    expect(host.hasAttribute('data-pui-style')).toBe(false);
    expect([...applier.getOwned()]).toEqual([]);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('keeps real custom-element reactions for changed values without repeating them for equal values', () => {
    const values: Array<string | null> = [];
    class StyleReactionElement extends HTMLElement {
      static observedAttributes = ['data-pui-style'];
      attributeChangedCallback(_name: string, _oldValue: string | null, value: string | null) {
        values.push(value);
      }
    }
    const tag = `pui-owned-style-reaction-${++customElementId}`;
    customElements.define(tag, StyleReactionElement);
    const host = document.createElement(tag);
    document.body.append(host);
    const applier = createOwnedTwTokenApplier(host);

    applier.apply(['w-full']);
    applier.apply(['w-full']);
    applier.apply(['bg-primary']);
    applier.clear();

    expect(values).toEqual(['w-full', 'bg-primary', null]);
  });
});

describe('WC fallback display uses live class ownership', () => {
  it('leaves a retained fallback class untouched on repeated synchronization', () => {
    const host = document.createElement('div');
    host.className = 'consumer';
    document.body.append(host);
    const display = installDefaultHostDisplay(host);
    const mutations = observeAttributes(host);

    display.sync();
    display.sync();

    expect(mutations()).toEqual([]);
    expect([...host.classList]).toEqual(['consumer', 'pui-host-root']);
  });

  it('keeps presentation ownership while removing only a newly introduced fallback class', () => {
    const host = document.createElement('div');
    host.className = 'consumer';
    document.body.append(host);
    const display = installDefaultHostDisplay(host, { displayOwner: 'presentation' });
    const mutations = observeAttributes(host);

    display.sync();
    expect(mutations()).toEqual([]);
    host.classList.add('pui-host-root');
    mutations();
    display.sync();
    expect(mutations()).toEqual(['class']);
    expect(host.className).toBe('consumer');
    display.sync();
    expect(mutations()).toEqual([]);
  });

  it('repairs external class removal and responds to explicit display changes', () => {
    const host = document.createElement('div');
    host.className = 'consumer';
    document.body.append(host);
    const display = installDefaultHostDisplay(host);
    host.classList.remove('pui-host-root');
    display.sync();
    expect(host.classList.contains('pui-host-root')).toBe(true);
    host.classList.add('inline-flex');
    display.sync();
    expect(host.classList.contains('pui-host-root')).toBe(false);
    host.classList.remove('inline-flex');
    display.sync();
    expect([...host.classList]).toEqual(['consumer', 'pui-host-root']);
    display.disconnect();
    const mutations = observeAttributes(host);
    display.disconnect();
    expect(mutations()).toEqual([]);
    expect(host.className).toBe('consumer');
  });

  it('preserves every effects flush and hook while equal paint causes no style or class mutation', () => {
    const host = document.createElement('div');
    host.className = 'consumer';
    document.body.append(host);
    const display = installDefaultHostDisplay(host);
    const onChange = vi.fn(display.sync);
    const effects = createWebEffectsPort(createOwnedTwTokenApplier(host, { onChange }));
    effects.queueStyle({ kind: 'tw', tokens: ['bg-primary'] });
    effects.requestFlush();
    const mutations = observeAttributes(host);

    effects.requestFlush();
    effects.flushNow?.();
    expect(mutations()).toEqual([]);
    expect(onChange).toHaveBeenCalledTimes(3);
    effects.queueStyle({ kind: 'tw', tokens: ['inline-flex'] });
    effects.requestFlush();
    expect(mutations()).toEqual(['data-pui-style', 'class']);
    expect(host.className).toBe('consumer');
    effects.queueStyle({ kind: 'tw', tokens: ['bg-primary'] });
    effects.requestFlush();
    expect(mutations()).toEqual(['data-pui-style', 'class']);
    expect(host.getAttribute('data-pui-style')).toBe('bg-primary');
    expect([...host.classList]).toEqual(['consumer', 'pui-host-root']);
    expect(onChange).toHaveBeenCalledTimes(5);
  });
});
