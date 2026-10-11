// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from './parser';
import { emitWebComponentSource } from './web-component-source';
import { compilationArtifacts } from './compile';
import { ssrStyleDependencies, ssrStyleEnvironmentError } from './web-component-ssr-style';
import { loadGeneratedModule, type FixtureServer } from '../test/button-ssr-fixture';

function compileFont(environment?: string) {
  const parsed = parsePrototype(`import {definePrototype,tw} from '@proto.ui/core';
export default definePrototype({name:'fallback-font',setup(def){def.feedback.style.use(tw('font-sans'));}});`);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  return {
    ir: parsed.value,
    output: emitWebComponentSource(parsed.value, {
      ssr: true,
      ...(environment === undefined
        ? {}
        : { styleEnvironment: { id: 'consumer-font', cssText: environment } }),
    }),
  };
}

describe('bounded SSR CSS variable fallback and closed environment syntax', () => {
  it('retains actual canonical font-sans lowering and generated server rendering without an environment', () => {
    const { ir, output } = compileFont();
    if (!output.ok) throw new Error(JSON.stringify(output.diagnostics));
    const artifacts = compilationArtifacts({ ir, output: output.value });
    expect(artifacts.find((file) => file.path === 'Component.css')?.contents).toContain(
      'var(--pui-font-sans, ui-sans-serif, system-ui, sans-serif)'
    );
    expect(artifacts.some((file) => file.path === 'Component.environment.css')).toBe(false);
    const server = loadGeneratedModule(artifacts, 'Component.ts') as unknown as FixtureServer;
    expect(server.renderToString({}, { slotHtml: 'Readable fallback' }).html).toContain(
      'Readable fallback'
    );
  });

  it('accepts transitive fallback without demanding an optional variable', () => {
    expect(
      ssrStyleDependencies(
        'x{border-radius:var(--pui-radius-md)}',
        ':root{--pui-radius-md:var(--optional-radius,0.5rem)}'
      )
    ).toEqual({ required: ['--pui-radius-md'], missing: [], cyclic: [], invalid: [] });
  });

  it('preserves nested fallbacks, function commas and complete font-family lists', () => {
    expect(
      ssrStyleDependencies(
        'x{font-family:var(--font,var(--other,"a,b",system-ui,sans-serif));color:var(--color,rgb(1,2,3));width:calc(var(--size,var(--other-size,1rem)) * 2)}'
      ).missing
    ).toEqual([]);
  });

  it('still diagnoses a final missing reference when no fallback closes the chain', () => {
    expect(ssrStyleDependencies('x{color:var(--a,var(--b))}').missing).toEqual(['--b']);
    expect(ssrStyleDependencies('x{border-radius:var(--radius)}').missing).toEqual(['--radius']);
  });

  it('does not demand an unused fallback when the primary resolves', () => {
    expect(
      ssrStyleDependencies('x{color:var(--primary,var(--unused))}', ':root{--primary:red}')
    ).toMatchObject({ required: ['--primary'], missing: [], cyclic: [] });
  });

  it('uses a closed outer fallback when a primary has an unresolved dependency', () => {
    expect(
      ssrStyleDependencies('x{color:var(--primary,red)}', ':root{--primary:initial!important}')
    ).toMatchObject({ missing: [], cyclic: [] });
    expect(
      ssrStyleDependencies(
        'x{font-family:var(--primary,var(--unused))}',
        ':root{--primary:"initial"}'
      )
    ).toMatchObject({ missing: [] });
    expect(
      ssrStyleDependencies('x{color:var(--primary,red)}', ':root{--primary:var(--missing)}')
    ).toMatchObject({ required: [], missing: [], cyclic: [] });
  });

  it.each(['unset', 'inherit', 'revert', 'revert-layer'])(
    'refuses context-dependent %s definitions even when a consuming fallback exists',
    (keyword) => {
      for (const value of [keyword, '  ' + keyword.toUpperCase() + ' /* cascade */ !important ']) {
        for (const consumer of ['var(--radius)', 'var(--radius,0.5rem)']) {
          for (const [component, environment] of [
            [`x{border-radius:${consumer}}`, `:root{--radius:${value}}`],
            [`x{--radius:${value};border-radius:${consumer}}`, ''],
          ]) {
            expect(ssrStyleDependencies(component, environment).invalid).toEqual([
              `Custom property --radius uses context-dependent CSS-wide keyword ${keyword}`,
            ]);
          }
        }
        expect(compileFont(`:root{--pui-font-sans:${value}}`).output).toMatchObject({
          ok: false,
          diagnostics: [{ message: expect.stringContaining('context-dependent CSS-wide keyword') }],
        });
      }
      expect(
        ssrStyleDependencies('x{font-family:var(--font)}', `:root{--font:"${keyword}"}`)
      ).toMatchObject({ required: ['--font'], missing: [], invalid: [] });
      expect(
        ssrStyleDependencies('x{font-family:var(--font)}', `:root{--font:${keyword},sans-serif}`)
      ).toMatchObject({ missing: [], invalid: [] });
      // Keyword tokens used as ordinary var() fallback values are not declarations
      // of a context-dependent custom property. Property grammar is outside this checker.
      expect(ssrStyleDependencies(`x{color:var(--absent,${keyword})}`)).toMatchObject({
        missing: [],
        invalid: [],
      });
      expect(
        ssrStyleDependencies(
          'x{color:var(--good,var(--unused))}',
          `:root{--good:red;--unused:${keyword}}`
        )
      ).toMatchObject({ required: ['--good'], missing: [], invalid: [] });
    }
  );

  it.each(['unset', 'inherit', 'revert', 'revert-layer'])(
    'does not let a candidate cycle conceal a context-dependent %s alternative',
    (keyword) => {
      for (const environment of [
        `:root{--pui-font-sans:var(--pui-font-sans);--pui-font-sans:${keyword}}`,
        `:root{--pui-font-sans:var(--pui-font-sans)}@media (min-width:1px){:root{--pui-font-sans:${keyword}}}`,
        `:root{--pui-font-sans:var(--alias);--alias:var(--pui-font-sans);--alias:${keyword}}`,
      ]) {
        expect(compileFont(environment).output).toMatchObject({
          ok: false,
          diagnostics: [{ message: expect.stringContaining('context-dependent CSS-wide keyword') }],
        });
      }
      expect(
        ssrStyleDependencies(
          'x{color:var(--good,var(--unused))}',
          `:root{--good:red;--unused:var(--unused);--unused:${keyword}}`
        )
      ).toMatchObject({ required: ['--good'], missing: [], cyclic: [], invalid: [] });
    }
  );

  it.each([
    '--pui-font-sans:var(--pui-font-sans);--pui-font-sans:var(--bad);--bad:inherit',
    '--pui-font-sans:var(--pui-font-sans);--pui-font-sans:var(--missing,var(--bad));--bad:inherit',
    '--pui-font-sans:var(--alias) var(--bad);--alias:var(--pui-font-sans);--alias:Arial;--bad:inherit',
  ])('rejects an actually consumed context dependency in a noncyclic candidate: %s', (css) => {
    expect(compileFont(`:root{${css}}`).output).toMatchObject({
      ok: false,
      diagnostics: [{ message: expect.stringContaining('context-dependent CSS-wide keyword') }],
    });
  });

  it.each([
    '--x:var(--x);--x:var(--good,var(--bad));--good:red;--bad:inherit',
    '--x:var(--x,var(--bad));--bad:inherit',
    '--x:var(--x) var(--other);--other:var(--x);--other:inherit',
  ])('ignores context values never consumed by a viable candidate: %s', (css) => {
    expect(ssrStyleDependencies('x{color:var(--x,red)}', `:root{${css}}`)).toMatchObject({
      missing: [],
      cyclic: [],
      invalid: [],
    });
  });

  const candidateRing = (prefix: string, size: number) =>
    Array.from(
      { length: size },
      (_, index) =>
        `--${prefix}${index}:var(--${prefix}${(index + 1) % size});--${prefix}${index}:red;`
    ).join('');

  it('admits exactly 256 candidate choices and caches repeated consumption', () => {
    const css = `:root{${candidateRing('a', 8)}}`;
    expect(
      ssrStyleDependencies(
        'x{color:var(--a0,red);background:var(--a0,blue);outline-color:var(--a1,green)}',
        css
      )
    ).toMatchObject({ missing: [], cyclic: [], invalid: [] });
  });

  it('rejects over-budget choices before enumeration even with a closed outer fallback', () => {
    expect(
      ssrStyleDependencies('x{color:var(--a0,red)}', `:root{${candidateRing('a', 9)}}`).invalid
    ).toEqual(['Unsupported SSR custom-property cycle: candidate budget exceeded']);
  });

  it('keeps local custom-property ownership ahead of environment candidates', () => {
    expect(
      ssrStyleDependencies(
        'x{--a:red;color:var(--a)}',
        ':root{--a:var(--a);--a:var(--bad);--bad:inherit}'
      )
    ).toMatchObject({ required: [], missing: [], cyclic: [], invalid: [] });
  });

  it('shares the candidate budget across separately consumed SCCs', () => {
    for (const size of [7, 8]) {
      const result = ssrStyleDependencies(
        'x{color:var(--a0,red);background:var(--b0,blue)}',
        `:root{${candidateRing('a', 7)}${candidateRing('b', size)}}`
      );
      expect(result.invalid).toEqual(
        size === 7 ? [] : ['Unsupported SSR custom-property cycle: candidate budget exceeded']
      );
    }
  });

  it('checks cross-SCC aliases and preserves their selected fallback paths', () => {
    expect(
      ssrStyleDependencies(
        'x{color:var(--a,red)}',
        ':root{--a:var(--a);--a:var(--b);--b:var(--b);--b:var(--bad);--bad:inherit}'
      ).invalid
    ).toEqual(['Custom property --bad uses context-dependent CSS-wide keyword inherit']);
    expect(
      ssrStyleDependencies(
        'x{color:var(--a,red)}',
        ':root{--a:var(--a);--a:var(--b);--b:var(--b);--b:var(--good,var(--bad));--good:red;--bad:inherit}'
      )
    ).toMatchObject({ missing: [], cyclic: [], invalid: [] });
  });

  it('does not enumerate a large unconsumed SCC or an unused fallback subtree', () => {
    expect(
      ssrStyleDependencies(
        'x{color:var(--good,var(--unused0))}',
        `:root{--good:red;${candidateRing('unused', 20)}}`
      )
    ).toMatchObject({ required: ['--good'], missing: [], cyclic: [], invalid: [] });
  });

  it('bounds candidate graph traversal independently of the combination count', () => {
    // 8 nodes + 16 declarations + 8 references = 32 work units; 179 unused
    // literal definitions add 358. One extra reference crosses 100,000 / 256.
    const padding = Array.from({ length: 179 }, (_, index) => `--padding${index}:red;`).join('');
    const css = `:root{${candidateRing('a', 8)}${padding}}`;
    expect(ssrStyleDependencies('x{color:var(--a0,red)}', css).invalid).toEqual([]);
    expect(
      ssrStyleDependencies(
        'x{color:var(--a0,red)}',
        css.replace('--padding0:red', '--padding0:var(--padding1)')
      ).invalid
    ).toEqual(['Unsupported SSR custom-property cycle: traversal budget exceeded']);
  });

  it('does not inspect a context-dependent fallback outside a guaranteed-invalid SCC', () => {
    expect(
      ssrStyleDependencies('x{color:var(--x,red)}', ':root{--x:var(--x,var(--bad));--bad:inherit}')
    ).toMatchObject({ required: [], missing: [], cyclic: [], invalid: [] });
  });

  it('keeps initial guaranteed-invalid fallback distinct from context-dependent keywords', () => {
    expect(
      ssrStyleDependencies('x{color:var(--x)}', ':root{--x: INITIAL !important}')
    ).toMatchObject({ missing: ['--x'], invalid: [] });
    expect(
      ssrStyleDependencies('x{color:var(--x,red)}', ':root{--x: INITIAL !important}')
    ).toMatchObject({ required: [], missing: [], invalid: [] });
  });

  it('does not parse quoted text or comments as references and supports empty fallback', () => {
    expect(
      ssrStyleDependencies(
        'x{font-family:"var(--not-a-reference)";color:var(/* ignored, */ --missing,)}'
      )
    ).toMatchObject({ required: [], missing: [], invalid: [] });
  });

  it('does not let fallbacks inside cyclic declarations dissolve the actual CSS cycle', () => {
    const result = ssrStyleDependencies(
      'x{color:var(--a)}',
      ':root{--a:var(--b,red);--b:var(--a,blue)}'
    );
    expect(result.cyclic).toEqual(['--a']);
    expect(
      ssrStyleDependencies(
        'x{color:var(--c)}',
        ':root{--a:var(--b) var(--c);--b:var(--a);--c:var(--b,red)}'
      ).cyclic
    ).toEqual(['--c']);
    expect(
      ssrStyleDependencies('x{color:var(--a)}', ':root{--a:var(--known,var(--a));--known:red}')
        .cyclic
    ).toEqual(['--a']);
  });

  it('permits a caller fallback around a guaranteed-invalid cycle, including local variables', () => {
    expect(ssrStyleDependencies('x{color:var(--a,red)}', ':root{--a:var(--a)}')).toMatchObject({
      missing: [],
      cyclic: [],
    });
    expect(ssrStyleDependencies('x{--a:var(--a);color:var(--a,red)}')).toMatchObject({
      missing: [],
      cyclic: [],
    });
  });

  it('allows a valid consumer font/color subset and ignores resource-looking quoted font text', () => {
    expect(
      compileFont(
        '@layer theme { :root {--pui-font-sans:"A font, with commas",Arial,sans-serif;--color:lab(2% 0 0);} }'
      ).output.ok
    ).toBe(true);
    expect(ssrStyleEnvironmentError(':root{--pui-font-sans:"url(example)";}')).toBeNull();
  });

  it.each([
    String.raw`@\69mport 'https://example.invalid/theme.css';`,
    String.raw`:root{--x:u\72l('https://example.invalid/pixel');}`,
  ])('refuses escaped active CSS syntax without network access: %s', (environment) => {
    expect(compileFont(environment).output).toMatchObject({
      ok: false,
      diagnostics: [{ message: expect.stringContaining('closed SSR stylesheet') }],
    });
  });

  it.each([
    'url("https://example.invalid/a")',
    'image-set("https://example.invalid/a" 1x)',
    '-webkit-image-set("https://example.invalid/a" 1x)',
  ])('refuses resource-bearing or unsupported functions: %s', (value) => {
    expect(compileFont(':root{--image:' + value + '}').output.ok).toBe(false);
  });

  it.each([
    "@import 'https://example.invalid/a';",
    '@font-face{font-family:remote;src:local(Arial)}',
    '@supports(display:grid){:root{--x:red}}',
  ])('refuses non-admitted at-rule syntax: %s', (environment) => {
    expect(compileFont(environment).output.ok).toBe(false);
  });

  it.each(['x{color:var(--a}', 'x{color:var(red)}'])(
    'does not accept malformed var syntax as a closed dependency: %s',
    (css) => {
      expect(ssrStyleDependencies(css).invalid.length).toBeGreaterThan(0);
    }
  );
});
