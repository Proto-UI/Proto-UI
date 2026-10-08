import { afterEach, describe, expect, it, vi } from 'vitest';
import { installCarrierStyleDiagnostics } from './carrier-diagnostics.mjs';

const original = window.getComputedStyle;
afterEach(() => {
  window.getComputedStyle = original;
  delete (window as any).__carrierStyleDiagnostics;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('carrier admission diagnostics (observation harness, not browser CSS proof)', () => {
  function setup() {
    const host = document.createElement('button');
    const scene = document.createElement('section');
    scene.dataset.runtime = 'fixture';
    scene.append(host);
    document.body.append(scene);
    const style = document.createElement('div').style;
    style.position = 'absolute';
    style.backgroundImage = 'url("data:image/png;base64,AA==")';
    const getStyle = vi.fn((_host, pseudo) =>
      pseudo ? style : ({ position: 'relative', isolation: 'isolate' } as CSSStyleDeclaration)
    );
    window.getComputedStyle = getStyle;
    installCarrierStyleDiagnostics();
    const samples = (window as any).__carrierStyleDiagnostics;
    return { host, style, getStyle, samples };
  }

  it('observes only owned pseudo reads and preserves the exact original return object', () => {
    const { host, style, getStyle, samples } = setup();
    expect(window.getComputedStyle(host, '::before')).toBe(style);
    expect(samples).toHaveLength(0);
    host.setAttribute('data-pui-material-carrier', 'contact-v1');
    expect(window.getComputedStyle(host, '::after')).toBe(style);
    expect(samples).toHaveLength(0);
    expect(window.getComputedStyle(host, '::before')).toBe(style);
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({
      runtime: 'fixture',
      connected: true,
      tree: 'document',
      host: { position: 'relative', isolation: 'isolate' },
      computed: { position: 'absolute', 'background-image': style.backgroundImage },
    });
    expect(getStyle).toHaveBeenCalledTimes(4);
    expect(getStyle.mock.contexts.every((context) => context === window)).toBe(true);
  });

  it('copies values before rejected-carrier cleanup and bounds the retained sample count', () => {
    const { host, style, samples } = setup();
    host.setAttribute('data-pui-material-carrier', 'contact-v1');
    host.style.setProperty('--pui-material-width', '120px');
    window.getComputedStyle(host, '::before');
    style.position = 'fixed';
    host.removeAttribute('style');
    for (let i = 0; i < 40; i++) window.getComputedStyle(host, '::before');
    host.removeAttribute('data-pui-material-carrier');
    expect(samples).toHaveLength(32);
    expect(samples[0].computed.position).toBe('absolute');
    expect(samples[0].inline).toContain('--pui-material-width: 120px');
    expect(samples[1].computed.position).toBe('fixed');
  });

  it('does not turn a diagnostics error into a production failure', () => {
    const { host, style, samples } = setup();
    host.setAttribute('data-pui-material-carrier', 'contact-v1');
    vi.spyOn(host, 'closest').mockImplementation(() => {
      throw new Error('observation failed');
    });
    expect(window.getComputedStyle(host, '::before')).toBe(style);
    expect(samples).toHaveLength(0);
  });

  it('preserves original computed-style errors', () => {
    const { host, getStyle } = setup();
    getStyle.mockImplementation(() => {
      throw new Error('original computed style failure');
    });
    expect(() => window.getComputedStyle(host, '::before')).toThrow(
      'original computed style failure'
    );
  });
});
