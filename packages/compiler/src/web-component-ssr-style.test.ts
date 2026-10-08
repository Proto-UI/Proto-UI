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
