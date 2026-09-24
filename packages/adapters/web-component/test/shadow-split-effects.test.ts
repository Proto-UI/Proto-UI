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

function wrapMatchingRulesInFalseSupports(cssText: string, selector: string): string {
  let cursor = 0;
  let result = '';
  while (true) {
    const start = cssText.indexOf(selector, cursor);
    if (start < 0) return result + cssText.slice(cursor);
    const open = cssText.indexOf('{', start);
    let depth = 1;
    let close = open + 1;
    for (; close < cssText.length && depth; close += 1) {
      if (cssText[close] === '{') depth += 1;
      else if (cssText[close] === '}') depth -= 1;
    }
    result += `${cssText.slice(cursor, start)}@supports (display: definitely-not-a-value) {${cssText.slice(start, close)}}`;
    cursor = close;
  }
}

// Simulate a self-consistent older generated companion so version-specific
// recipe checks remain independently exercised after base integrity validation.
function rewriteBaseDeclarations(cssText: string, edit: (declarations: string) => string): string {
  const selector = `:host([${ROOT}])`;
  const start = cssText.indexOf(`${selector} {`);
  const open = cssText.indexOf('{', start);
  const close = cssText.indexOf('}', open);
  if (start < 0 || open < 0 || close < 0) throw new Error('generated base recipe not found');
  const declarations = edit(
    cssText
      .slice(open + 1, close)
      .replace(/\s*--pui-split-compiled-receipt:\s*[a-z0-9]+;\s*$/, '\n')
  );
  const input = `${selector.replace(/\s/g, '')}{${declarations.replace(/\s/g, '')}}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
  }
  const body = `${declarations.trimEnd()}\n  --pui-split-compiled-receipt: ${(hash >>> 0).toString(
    36
  )};\n`;
  return `${cssText.slice(0, open + 1)}${body}${cssText.slice(close)}`;
}

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
    ).toThrow(/used-value-rounding/);
    effects.requestFlush();
    expect([host.outerHTML, surface.outerHTML]).toEqual(previous);
    expect(() =>
      effects.queueStyle(
        createRootStyleEffect([
          ...effect(['block', 'border', 'transition-all']).entries,
          ...lowerRootStyleTokens(['border-2'], 'data-[checked]').entries,
        ])
      )
    ).toThrow(/used-value-rounding/);
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
    ).toThrow(/used-value-rounding/);
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
      /directional:"border-b"/
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
        cssText: rewriteBaseDeclarations(options.artifact.cssText, (declarations) =>
          declarations.replace('--pui-split-motion-recipe: h1;', '')
        ),
      },
    });
    expect(() => old.queueStyle(effect(tokens))).toThrow(/H1 recipe.*fix:/);
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

  it('rejects a conditionally lowered composite before changing either target', () => {
    const { host, surface, effects } = setup(['block', 'inline-flex', 'data-[open]:inline-flex']);
    effects.queueStyle(effect(['block']));
    effects.requestFlush();
    const before = [host.outerHTML, surface.outerHTML];
    const conditional = lowerRootStyleTokens(['inline-flex'], 'data-[open]');

    expect(() => effects.queueStyle(conditional)).toThrow(/inline-flex.*conditional-composite/);
    expect([host.outerHTML, surface.outerHTML]).toEqual(before);
    effects.requestFlush();
    expect([host.outerHTML, surface.outerHTML]).toEqual(before);
    effects.dispose();
  });

  it.each(['translate-x-2', 'inline-grid', 'w-96', 'transition-all'])(
    'rejects %s before either target changes, including runtime origin in diagnostics',
    (token) => {
      const { host, surface, effects } = setup();
      effects.queueStyle(effect(['bg-primary']));
      effects.requestFlush();
      const before = [host.outerHTML, surface.outerHTML];
      let diagnostic = '';
      try {
        effects.queueStyle(effect(['bg-black', token], 'runtime'));
      } catch (error) {
        diagnostic = String(error);
      }
      expect(diagnostic).toMatch(/pilot.*runtime token/);
      expect(diagnostic).toMatch(/fix: .+/);
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
    let diagnostic = '';
    try {
      effects.queueStyle(
        createRootStyleEffect([
          ...lowered.entries,
          resolveRootStyleEntry('extension-token', 'setup'),
        ])
      );
    } catch (error) {
      diagnostic = String(error);
    }
    expect(diagnostic).toMatch(/extension-token.*missing token/);
    expect(diagnostic).toMatch(/fix: companion or change\/remove token/);
    effects.requestFlush();
    expect([host.outerHTML, surface.outerHTML]).toEqual(before);
    effects.dispose();
  });

  it('rejects recipe and token receipts that exist only in comments or unrelated selectors', () => {
    const { host, surface, effects, options } = setup();
    effects.dispose();
    const before = [host.outerHTML, surface.outerHTML];
    const oldBase = rewriteBaseDeclarations(options.artifact.cssText, (declarations) =>
      declarations.replace('--pui-split-motion-recipe: h1;', '')
    );
    const commentOnlyRecipe = createShadowSplitEffectsPort({
      ...options,
      artifact: {
        ...options.artifact,
        cssText: oldBase.replace(
          '@layer proto-ui {',
          '@layer proto-ui {\n/* --pui-split-motion-recipe: h1; */'
        ),
      },
    });
    expect(() => commentOnlyRecipe.queueStyle(effect(['transition-all']))).toThrow(/H1 recipe/);
    commentOnlyRecipe.dispose();

    const receipt = `:host([${ROOT}~="bg-primary"])`;
    const unrelatedReceipt = createShadowSplitEffectsPort({
      ...options,
      artifact: {
        ...options.artifact,
        cssText: options.artifact.cssText.replace(
          receipt,
          `[data-proof='${receipt}'] /* ${receipt} */`
        ),
      },
    });
    expect(() => unrelatedReceipt.queueStyle(effect(['bg-primary']))).toThrow(/missing token/);
    expect([host.outerHTML, surface.outerHTML]).toEqual(before);
    unrelatedReceipt.dispose();
  });

  it('rejects a compiled token receipt with an unrelated required host gate', () => {
    const { host, surface, effects, options } = setup(['block', 'w-full']);
    effects.dispose();
    const before = [host.outerHTML, surface.outerHTML];
    const gated = createShadowSplitEffectsPort({
      ...options,
      artifact: {
        ...options.artifact,
        cssText: options.artifact.cssText.replaceAll(
          `[${ROOT}~="w-full"]`,
          `[${ROOT}~="w-full"][data-never]`
        ),
      },
    });

    expect(() => gated.queueStyle(effect(['block', 'w-full']))).toThrow(/w-full.*missing token/);
    expect([host.outerHTML, surface.outerHTML]).toEqual(before);
    gated.dispose();
  });

  it('rejects the sizing recipe when the artifact is behind an unrelated conditional gate', () => {
    const { host, surface, effects, options } = setup(['block', 'w-full']);
    effects.dispose();
    const before = [host.outerHTML, surface.outerHTML];

    expect(() =>
      createShadowSplitEffectsPort({
        ...options,
        artifact: {
          ...options.artifact,
          cssText: `@supports (display: definitely-not-a-value) {${options.artifact.cssText}}`,
        },
      })
    ).toThrow(/sizing-recipe/);
    expect([host.outerHTML, surface.outerHTML]).toEqual(before);
  });

  it.each([
    'display: grid;',
    '--pui-split-padding-top: 0px;',
    'padding-top: var(--pui-split-padding-top);',
    'border-top-width: var(--pui-split-border-top);',
  ])('rejects a sizing recipe missing the base declaration %s', (declaration) => {
    const { host, surface, effects, options } = setup(['block', 'w-full']);
    effects.dispose();
    const before = [host.outerHTML, surface.outerHTML];
    const cssText = options.artifact.cssText.replace(declaration, '');
    expect(cssText).not.toBe(options.artifact.cssText);

    expect(() =>
      createShadowSplitEffectsPort({
        ...options,
        artifact: { ...options.artifact, cssText },
      })
    ).toThrow(/sizing-recipe/);
    expect([host.outerHTML, surface.outerHTML]).toEqual(before);
  });

  it('rejects a compiled token receipt behind an unrelated conditional gate', () => {
    const { host, surface, effects, options } = setup(['block', 'w-full']);
    effects.dispose();
    const before = [host.outerHTML, surface.outerHTML];
    const gated = createShadowSplitEffectsPort({
      ...options,
      artifact: {
        ...options.artifact,
        cssText: wrapMatchingRulesInFalseSupports(
          options.artifact.cssText,
          `:host([${ROOT}~="w-full"])`
        ),
      },
    });

    expect(() => gated.queueStyle(effect(['block', 'w-full']))).toThrow(/w-full.*missing token/);
    expect([host.outerHTML, surface.outerHTML]).toEqual(before);
    gated.dispose();
  });

  it('accepts the generated unconditional layer wrapper case-insensitively', () => {
    const { host, effects, options } = setup(['block', 'w-full']);
    effects.dispose();
    const layered = createShadowSplitEffectsPort({
      ...options,
      artifact: {
        ...options.artifact,
        cssText: options.artifact.cssText.replaceAll('@layer proto-ui', '@LAYER proto-ui'),
      },
    });

    layered.queueStyle(effect(['block', 'w-full']));
    layered.requestFlush();
    expect(host.getAttribute(ROOT)).toBe('block w-full');
    layered.dispose();
  });

  it('rejects a compiled token receipt embedded in an invalid selector list', () => {
    const { host, surface, effects, options } = setup(['block', 'w-full']);
    effects.dispose();
    const before = [host.outerHTML, surface.outerHTML];
    const receipt = `:host([${ROOT}~="w-full"])`;
    const invalidList = createShadowSplitEffectsPort({
      ...options,
      artifact: {
        ...options.artifact,
        cssText: options.artifact.cssText.replaceAll(receipt, `${receipt}, :pui-nonexistent`),
      },
    });

    expect(() => invalidList.queueStyle(effect(['block', 'w-full']))).toThrow(
      /w-full.*missing token/
    );
    expect([host.outerHTML, surface.outerHTML]).toEqual(before);
    invalidList.dispose();
  });

  it('rejects a compiled token receipt whose declaration recipe was altered', () => {
    const { host, surface, effects, options } = setup(['block', 'w-full']);
    effects.dispose();
    const before = [host.outerHTML, surface.outerHTML];
    const receipt = `:host([${ROOT}~="w-full"])`;
    const cssText = options.artifact.cssText.replace(
      `${receipt} {\n    width: 100%;`,
      `${receipt} {\n    color: red;`
    );
    expect(cssText).not.toBe(options.artifact.cssText);
    const altered = createShadowSplitEffectsPort({
      ...options,
      artifact: { ...options.artifact, cssText },
    });

    expect(() => altered.queueStyle(effect(['block', 'w-full']))).toThrow(/w-full.*missing token/);
    expect([host.outerHTML, surface.outerHTML]).toEqual(before);
    altered.dispose();
  });

  it('retains punctuation inside the compiled token selector value', () => {
    const token = 'transition-[color,box-shadow]';
    const { host, effects } = setup(['block', token]);
    effects.queueStyle(effect(['block', token]));
    effects.requestFlush();
    expect(host.getAttribute(ROOT)).toBe(`block ${token}`);
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
    expect(() => createShadowSplitEffectsPort(options)).toThrow(/projection-owned/);
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
