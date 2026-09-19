import { describe, expect, it, vi } from 'vitest';
import {
  createRootStyleEffect,
  resolveRootStyleEntry,
  lowerRootStyleTokens,
} from '@proto.ui/core/internal';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';
import {
  createShadowSplitEffectsPort,
  SHADOW_SPLIT_ROOT_STYLE_ATTR as ROOT,
  SHADOW_SPLIT_SURFACE_ATTR as SURFACE,
} from '../src/shadow-split-effects';

function setup(
  tokens = ['flex', 'w-full', 'p-2', 'border-2', 'bg-primary', 'bg-black', 'dark:p-4']
) {
  const host = document.createElement('x-split-test');
  const root = host.attachShadow({ mode: 'open' });
  const surface = document.createElement('div');
  root.append(surface);
  surface.setAttribute('data-pui-style', 'consumer');
  const options = {
    host,
    surface,
    prototypeName: 'pilot',
    artifact: renderProtoShadowSplitStyleArtifact(tokens),
  };
  const effects = createShadowSplitEffectsPort(options);
  return { host, surface, effects, options };
}
const effect = (tokens: string[], origin: 'setup' | 'runtime' = 'setup') =>
  createRootStyleEffect(tokens.map((t) => resolveRootStyleEntry(t, origin)));

// D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001 K: preflight is atomic; cleanup is owned.
describe('private Shadow split effects', () => {
  it('rejects unimplemented animated border rounding but retains fixed-border sizing animation', () => {
    const { host, surface, effects } = setup([
      'block',
      'border',
      'border-2',
      'data-[checked]:border-2',
      'transition-all',
      'w-32',
      'w-64',
    ]);
    effects.queueStyle(effect(['block', 'border', 'w-32', 'transition-all']));
    effects.requestFlush();
    const previous = [host.outerHTML, surface.outerHTML];
    expect(() =>
      effects.queueStyle(effect(['block', 'border-2', 'w-64', 'transition-all'], 'runtime'))
    ).toThrow(/used-value rounding/);
    effects.requestFlush();
    expect([host.outerHTML, surface.outerHTML]).toEqual(previous);
    expect(() =>
      effects.queueStyle(
        createRootStyleEffect([
          ...effect(['block', 'border', 'transition-all']).entries,
          ...lowerRootStyleTokens(['border-2'], 'data-[checked]').entries,
        ])
      )
    ).toThrow(/used-value rounding/);
    effects.queueStyle(effect(['block', 'border', 'w-64', 'transition-all']));
    effects.requestFlush();
    expect(host.getAttribute(ROOT)).toContain('w-64');
    effects.dispose();
  });
  it('rejects overlapping animated border widths independently of effect entry order', () => {
    const { host, surface, effects } = setup(['block', 'border-2', 'border-b', 'transition-all']);
    const before = [host.outerHTML, surface.outerHTML];
    expect(() =>
      effects.queueStyle(effect(['block', 'border-b', 'border-2', 'transition-all']))
    ).toThrow(/used-value rounding/);
    expect([host.outerHTML, surface.outerHTML]).toEqual(before);
    effects.requestFlush();
    expect([host.outerHTML, surface.outerHTML]).toEqual(before);
    effects.dispose();
  });
  it('admits logical padding without reading writing mode during atomic preflight', () => {
    const { host, surface, effects } = setup(['block', 'px-2']);
    host.style.writingMode = 'vertical-rl';
    document.body.append(host);
    try {
      expect(host.style.writingMode).toBe('vertical-rl');
      expect(() => effects.queueStyle(effect(['block', 'px-2']))).not.toThrow();
      effects.requestFlush();
      expect(host.getAttribute(ROOT)).toBe('block px-2');
      expect(surface.getAttribute('data-pui-style')).toBe('consumer block px-2');
    } finally {
      effects.dispose();
      host.remove();
    }
  });
  it('rejects logical padding combined with unrepresented directional compensation', () => {
    const { host, surface, effects } = setup(['block', 'px-2', 'border-b']);
    const before = [host.outerHTML, surface.outerHTML];
    expect(() => effects.queueStyle(effect(['block', 'px-2', 'border-b']))).toThrow(
      /directional token "border-b"/
    );
    expect([host.outerHTML, surface.outerHTML]).toEqual(before);
    effects.requestFlush();
    expect([host.outerHTML, surface.outerHTML]).toEqual(before);
    effects.dispose();
  });
  it('keeps geometry and hit tokens off the surface and rejects old recipes atomically', () => {
    const tokens = [
      'block',
      'translate-y-px',
      'pointer-events-none',
      'will-change-transform',
      'transition-all',
    ];
    const { host, surface, effects, options } = setup(tokens);
    effects.queueStyle(effect(tokens));
    effects.requestFlush();
    expect(surface.getAttribute('data-pui-style')).toBe('consumer block transition-all');
    expect(host.getAttribute(ROOT)).toBe(tokens.join(' '));
    effects.dispose();
    const old = createShadowSplitEffectsPort({
      ...options,
      artifact: {
        ...options.artifact,
        cssText: options.artifact.cssText.replace('--pui-split-motion-recipe: h1;', ''),
      },
    });
    expect(() => old.queueStyle(effect(tokens))).toThrow(/H1 physical recipe is absent/);
    expect(host.hasAttribute(ROOT)).toBe(false);
    expect(surface.getAttribute('data-pui-style')).toBe('consumer');
    old.dispose();
  });
  it('routes placement only to host membership and surface/composite to inner membership', () => {
    const { host, surface, effects } = setup();
    effects.queueStyle(effect(['flex', 'w-full', 'p-2', 'border-2', 'bg-primary']));
    expect(host.hasAttribute(ROOT)).toBe(false);
    effects.requestFlush();
    expect(host.getAttribute(ROOT)).toBe('flex w-full p-2 border-2 bg-primary');
    expect(host.hasAttribute('data-pui-style')).toBe(false);
    expect(surface.getAttribute('data-pui-style')).toBe('consumer flex p-2 border-2 bg-primary');
    effects.dispose();
    effects.dispose();
    expect(host.hasAttribute(ROOT)).toBe(false);
    expect(surface.hasAttribute(SURFACE)).toBe(false);
    expect(surface.getAttribute('data-pui-style')).toBe('consumer');
  });

  it.each(['translate-x-2', 'inline-grid', 'w-96', 'transition-all'])(
    'rejects %s before either target changes, including runtime origin in diagnostics',
    (token) => {
      const { host, surface, effects } = setup();
      effects.queueStyle(effect(['bg-primary']));
      effects.requestFlush();
      const before = [host.outerHTML, surface.outerHTML];
      expect(() => effects.queueStyle(effect(['bg-black', token], 'runtime'))).toThrow(
        /pilot.*runtime token/
      );
      expect([host.outerHTML, surface.outerHTML]).toEqual(before);
      effects.requestFlush();
      expect([host.outerHTML, surface.outerHTML]).toEqual(before);
      effects.dispose();
    }
  );

  it('rejects initial unresolved effects with no marker or token residue', () => {
    const { host, surface, effects } = setup();
    expect(() => effects.queueStyle(effect(['bg-primary', 'invisible']))).toThrow(/unresolved/);
    expect(host.hasAttribute(ROOT)).toBe(false);
    expect(surface.hasAttribute(SURFACE)).toBe(false);
    expect(surface.getAttribute('data-pui-style')).toBe('consumer');
    effects.dispose();
  });

  it('rejects fallback tokens absent from the artifact before changing either target', () => {
    const { host, surface, effects } = setup();
    effects.queueStyle(effect(['bg-primary']));
    effects.requestFlush();
    const before = [host.outerHTML, surface.outerHTML];
    const lowered = lowerRootStyleTokens(['p-4'], 'dark');
    expect(() =>
      effects.queueStyle(
        createRootStyleEffect([
          ...lowered.entries,
          resolveRootStyleEntry('extension-token', 'setup'),
        ])
      )
    ).toThrow(/extension-token.*physical token is absent from the compiled split closure/);
    effects.requestFlush();
    expect([host.outerHTML, surface.outerHTML]).toEqual(before);
    effects.dispose();
  });

  it('preserves fallback provenance when the exact physical token belongs to the artifact', () => {
    const { host, surface, effects, options } = setup();
    effects.dispose();
    const admitted = createShadowSplitEffectsPort({
      ...options,
      artifact: {
        ...options.artifact,
        cssText: `${options.artifact.cssText}\n:host([${ROOT}~="extension-token"]) {}`,
      },
    });
    const lowered = lowerRootStyleTokens(['p-4'], 'dark');
    admitted.queueStyle(
      createRootStyleEffect([...lowered.entries, resolveRootStyleEntry('extension-token', 'setup')])
    );
    admitted.requestFlush();
    expect(host.getAttribute(ROOT)).toBe('dark:p-4 extension-token');
    expect(surface.getAttribute('data-pui-style')).toBe('consumer dark:p-4 extension-token');
    admitted.dispose();
  });

  it('rolls back both targets after an injected DOM write failure', () => {
    const { host, surface, effects } = setup();
    effects.queueStyle(effect(['bg-primary']));
    effects.requestFlush();
    const before = [host.outerHTML, surface.outerHTML];
    const set = surface.setAttribute.bind(surface);
    let failOnce = true;
    vi.spyOn(surface, 'setAttribute').mockImplementation((name, value) => {
      set(name, value);
      if (name === 'data-pui-style' && failOnce) {
        failOnce = false;
        throw new Error('injected host failure');
      }
    });
    effects.queueStyle(effect(['bg-black']));
    expect(() => effects.requestFlush()).toThrow('injected host failure');
    expect([host.outerHTML, surface.outerHTML]).toEqual(before);
    effects.queueStyle(effect(['bg-black']));
    effects.requestFlush();
    expect(surface.getAttribute('data-pui-style')).toBe('consumer bg-black');
    effects.dispose();
  });

  it('enforces exclusive ownership and can rebind after disposal', () => {
    const { effects, options } = setup();
    expect(() => createShadowSplitEffectsPort(options)).toThrow(/already owned/);
    effects.dispose();
    const next = createShadowSplitEffectsPort(options);
    expect(() => effects.queueStyle(effect([]))).toThrow(/disposed/);
    next.dispose();
  });

  it('keeps each flush snapshot coherent when another effect is queued during a write', () => {
    const { host, surface, effects } = setup();
    const set = host.setAttribute.bind(host);
    let queued = false;
    vi.spyOn(host, 'setAttribute').mockImplementation((name, value) => {
      set(name, value);
      if (name === ROOT && !queued) {
        queued = true;
        effects.queueStyle(effect(['bg-black']));
      }
    });
    effects.queueStyle(effect(['bg-primary']));
    effects.requestFlush();
    expect(host.getAttribute(ROOT)).toBe('bg-primary');
    expect(surface.getAttribute('data-pui-style')).toBe('consumer bg-primary');
    effects.requestFlush();
    expect(host.getAttribute(ROOT)).toBe('bg-black');
    expect(surface.getAttribute('data-pui-style')).toBe('consumer bg-black');
    effects.dispose();
  });

  it('attempts all owned cleanup even if clearing surface tokens throws', () => {
    const { host, surface, effects, options } = setup();
    effects.queueStyle(effect(['p-2']));
    effects.requestFlush();
    const set = surface.setAttribute.bind(surface);
    const spy = vi.spyOn(surface, 'setAttribute').mockImplementation((name, value) => {
      set(name, value);
      if (name === 'data-pui-style') throw new Error('cleanup failure');
    });
    expect(() => effects.dispose()).toThrow('cleanup failure');
    expect(host.hasAttribute(ROOT)).toBe(false);
    expect(surface.hasAttribute(SURFACE)).toBe(false);
    spy.mockRestore();
    createShadowSplitEffectsPort(options).dispose();
  });

  it('drains a reentrant flush request after completing the current coherent projection', () => {
    const { host, surface, effects } = setup();
    const set = host.setAttribute.bind(host);
    let queued = false;
    vi.spyOn(host, 'setAttribute').mockImplementation((name, value) => {
      set(name, value);
      if (name === ROOT && !queued) {
        queued = true;
        effects.queueStyle(effect(['bg-black']));
        effects.requestFlush();
      }
    });
    effects.queueStyle(effect(['bg-primary']));
    effects.requestFlush();
    expect(host.getAttribute(ROOT)).toBe('bg-black');
    expect(surface.getAttribute('data-pui-style')).toBe('consumer bg-black');
    effects.dispose();
  });
});
