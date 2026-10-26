import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  deriveShadcnMotionPalette,
  extractShadcnThemeVariablesCss,
  generateShadcnMotionPalette,
  parseStaticLab,
  SHADCN_PALETTE_OUTPUT,
  SHADCN_THEME_SOURCE,
} from '../generate-shadcn-motion-palette.js';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const theme = (light: string, dark = '') =>
  `:root { ${light} } :root.dark, :root[data-theme='dark'] { ${dark} }`;
const source = (css: string) => `export const SHADCN_THEME_VARIABLES_CSS = \`${css}\`;`;

function close(actual: readonly number[] | null, expected: readonly number[], epsilon = 1e-7) {
  assert.ok(actual, 'Expected a supported static Lab color');
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) =>
    assert.ok(Math.abs(value - expected[index]) <= epsilon, `${actual} differs from ${expected}`)
  );
}

test('extracts the canonical variable-bank literal through the AST without executing source code', () => {
  const css = theme('--primary: lab(100 0 0);');
  assert.equal(
    extractShadcnThemeVariablesCss(`throw new Error('Do not execute');\n${source(css)}`),
    css
  );
  const composedTheme =
    `${source(css)}\n` +
    'export const SHADCN_THEME_PAINT_CSS = `@layer theme {}`;\n' +
    'export const SHADCN_THEME_CSS = `${SHADCN_THEME_VARIABLES_CSS}${SHADCN_THEME_PAINT_CSS}`;';
  assert.equal(extractShadcnThemeVariablesCss(composedTheme), css);
  assert.throws(
    () =>
      extractShadcnThemeVariablesCss(
        source(css).replace('SHADCN_THEME_VARIABLES_CSS', 'SHADCN_THEME_CSS')
      ),
    /static template literal/
  );
  assert.throws(
    () => extractShadcnThemeVariablesCss('// ' + source(css)),
    /static template literal/
  );
  assert.throws(
    () => extractShadcnThemeVariablesCss(`${source(css)}\n${source(css)}`),
    /static template literal/
  );
  assert.throws(
    () =>
      extractShadcnThemeVariablesCss(
        'export const SHADCN_THEME_VARIABLES_CSS = `:root { ${dynamic} }`;'
      ),
    /static template literal/
  );
  assert.throws(
    () => extractShadcnThemeVariablesCss('export const SHADCN_THEME_VARIABLES_CSS = getTheme();'),
    /static template literal/
  );
});

test('CSS Color 4 D50 white adaptation preserves neutral black, white and grey', () => {
  close(parseStaticLab('lab(0% 0 0)'), [0, 0, 0, 1]);
  close(parseStaticLab('lab(100% 0 0)'), [1, 1, 1, 1]);
  // CIE L*=50: Y=((50+16)/116)^3; neutral sRGB=1.055*Y^(1/2.4)-0.055.
  const grey = 1.055 * ((66 / 116) ** 3) ** (1 / 2.4) - 0.055;
  close(parseStaticLab('lab(50 0 0)'), [grey, grey, grey, 1]);
  // The lower branch: L*=1 -> Y=27/24389 -> sRGB=12.92*Y.
  const lowGrey = (12.92 * 27) / 24389;
  close(parseStaticLab('lab(1 0 0)'), [lowGrey, lowGrey, lowGrey, 1]);
});

test('chromatic D50 conversion agrees with the CSS Color 4 leaf example', () => {
  // https://www.w3.org/TR/css-color-4/ section 2, leaf-color example.
  // Its illustrative sRGB values differ from the current section 19 matrices
  // by up to 3.4e-5; use a 0.013-byte tolerance rather than treating the prose
  // example as a high-precision reference vector. Neutral equations above
  // independently test D50 adaptation and both transfer branches to 1e-7.
  close(parseStaticLab('lab(51.2345% -13.6271 16.2401)'), [0.41587, 0.50367, 0.36664, 1], 5e-5);
});

test('supports CSS Lab percentages, signed exponents and non-premultiplied alpha', () => {
  close(parseStaticLab('LAB(5e1% +8% -1.6% / 25%)'), parseStaticLab('lab(50 10 -2 / .25)')!);
  close(parseStaticLab('lab(100 0 0 / .15)'), [1, 1, 1, 0.15]);
  close(parseStaticLab('lab(100 0 0 / 0)'), [1, 1, 1, 0]);
  close(parseStaticLab('lab(100 0 0 / 150%)'), [1, 1, 1, 1]);
  close(parseStaticLab('lab(100 0 0 / -1)'), [1, 1, 1, 0]);
});

test('explicitly clamps lightness and encoded sRGB channels without fabricating gamut mapping', () => {
  close(parseStaticLab('lab(-20 10 20)'), [0, 0, 0, 1]);
  close(parseStaticLab('lab(120 10 20)'), [1, 1, 1, 1]);
  const clipped = parseStaticLab('lab(50 200 200)');
  assert.ok(clipped);
  assert.ok(clipped.every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 1));
  assert.equal(clipped[0], 1);
  assert.equal(clipped[1], 0);
  assert.equal(clipped[2], 0);
});

test('unsupported color syntax and non-finite conversion produce no numeric fallback', () => {
  for (const value of [
    'red',
    'rgb(255 0 0)',
    'oklab(50% 0 0)',
    'lab(none 0 0)',
    'lab(50 0 0 / none)',
    'lab(from red l a b)',
    'lab(calc(50 + 1) 0 0)',
    'lab(50, 0, 0)',
    'lab(50 0 0 0.5)',
    'lab(50 0 0) trailing',
    'lab(1e309 0 0)',
    'lab(50 1e308 0)',
  ]) {
    assert.equal(parseStaticLab(value), null, value);
  }
});

test('theme inheritance and chained references share resolved values and expected inputs', () => {
  const css = theme(
    '--radius: 0.625rem; --foreground: lab(2 0 0); --surface: lab(99 0 0); --code: var(--surface); --nested: var(--code);',
    '--surface: lab(8 0 0);'
  );
  const result = deriveShadcnMotionPalette(css);
  assert.equal(result.sourceHash, `sha256:${createHash('sha256').update(css).digest('hex')}`);
  assert.deepEqual(result.light.colors.code, result.light.colors.surface);
  assert.deepEqual(result.dark.colors.nested, result.dark.colors.surface);
  assert.deepEqual(result.dark.colors.foreground, result.light.colors.foreground);
  assert.equal(result.light.expectedInputs.nested, 'lab(99 0 0)');
  assert.equal(result.dark.expectedInputs.nested, 'lab(8 0 0)');
  assert.deepEqual(result.light.unresolved, {});
  assert.ok(!('radius' in result.light.colors));
  assert.ok(!('--code' in result.light.colors));
});

test('missing references, cycles and unsupported values retain explicit diagnostics', () => {
  const result = deriveShadcnMotionPalette(
    theme(
      '--a: var(--b); --b: var(--a); --chart: var(--color-blue-300); --future: color(display-p3 1 0 0); --alias: var(--future); --fallback: var(--missing, lab(0 0 0));'
    )
  );
  assert.deepEqual(result.light.colors, {});
  assert.deepEqual(result.light.expectedInputs, {});
  assert.deepEqual(result.light.unresolved.a, {
    code: 'reference-cycle',
    value: 'var(--b)',
    path: ['--a', '--b', '--a'],
  });
  assert.deepEqual(result.light.unresolved.chart, {
    code: 'missing-reference',
    value: 'var(--color-blue-300)',
    path: ['--chart', '--color-blue-300'],
  });
  assert.equal(result.light.unresolved.future.code, 'unsupported-value');
  assert.deepEqual(result.light.unresolved.alias.path, ['--alias', '--future']);
  assert.equal(result.light.unresolved.fallback.code, 'unsupported-value');
});

test('cycles are resolved independently per mode and do not poison supported roles', () => {
  const result = deriveShadcnMotionPalette(
    theme('--a: var(--b); --b: lab(10 0 0); --good: lab(80 0 0);', '--b: var(--a);')
  );
  assert.ok(result.light.colors.a);
  assert.equal(result.dark.unresolved.a.code, 'reference-cycle');
  assert.deepEqual(result.dark.colors.good, result.light.colors.good);
});

test('unrecognized CSS rule/declaration structures fail rather than selecting guessed colors', () => {
  for (const css of [
    ':root { --a: lab(50 0 0); }',
    theme('--a: lab(50 0 0);') + ' .custom { --a: lab(20 0 0); }',
    theme('--a: lab(50 0 0) !important;'),
    theme('--a: lab(50 0 0); --a: lab(20 0 0);'),
    theme('color: red;'),
    '@media (prefers-color-scheme: dark) { ' + theme('--a: lab(50 0 0);') + ' }',
    theme('--a: lab(50 0 0);') + ' trailing',
  ]) {
    assert.throws(() => deriveShadcnMotionPalette(css), /SHADCN_THEME_CSS/);
  }
});

test('recognizes only the exact low-layer selection paint consuming existing roles', () => {
  const css = theme('--selection: lab(2.75381% 0 0); --selection-foreground: lab(100% 0 0);');
  const paint =
    '@layer theme { ::selection { background-color: var(--selection); color: var(--selection-foreground); } }';
  const withPaint = deriveShadcnMotionPalette(css + paint);
  const withoutPaint = deriveShadcnMotionPalette(css);
  assert.deepEqual(withPaint.light, withoutPaint.light);
  assert.deepEqual(withPaint.dark, withoutPaint.dark);
  // Direct derivation binds its complete input; generation extracts the variable-bank literal.
  assert.notEqual(withPaint.sourceHash, withoutPaint.sourceHash);
  for (const invalid of [
    paint + paint,
    paint.replace('@layer theme', '@layer utilities'),
    paint.replace('::selection', '*'),
    paint.replace('var(--selection);', 'red;'),
    paint.replace('var(--selection);', 'var(--selection) !important;'),
    paint.replace(
      'color: var(--selection-foreground);',
      'color: var(--selection-foreground); user-select: none;'
    ),
  ])
    assert.throws(() => deriveShadcnMotionPalette(css + invalid), /SHADCN_THEME_CSS/);
});

test('canonical source produces readonly typed output, resolves aliases and leaves external roles open', async () => {
  const palette = await generateShadcnMotionPalette({ check: true });
  const source = await readFile(path.join(root, SHADCN_THEME_SOURCE), 'utf8');
  const variableBank = extractShadcnThemeVariablesCss(source);
  assert.match(variableBank, /--selection:\s*lab\(/);
  assert.doesNotMatch(variableBank, /::selection|background-color\s*:/);
  assert.equal(
    palette.sourceHash,
    `sha256:${createHash('sha256').update(variableBank).digest('hex')}`
  );
  for (const mode of [palette.light, palette.dark]) {
    assert.deepEqual(Object.keys(mode.expectedInputs), Object.keys(mode.colors));
    assert.deepEqual(Object.keys(mode.unresolved), [
      'chart-1',
      'chart-2',
      'chart-3',
      'chart-4',
      'chart-5',
    ]);
    assert.ok(
      Object.values(mode.unresolved).every((diagnostic) => diagnostic.code === 'missing-reference')
    );
    assert.deepEqual(mode.colors.code, mode.colors.surface);
    assert.ok(
      Object.values(mode.colors).every(
        (color) =>
          color.length === 4 &&
          color.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
      )
    );
  }
  close(palette.dark.colors.input, [1, 1, 1, 0.15]);
  close(palette.dark.colors.border, [1, 1, 1, 0.1]);
  assert.notDeepEqual(palette.light.colors.input, palette.dark.colors.input);
  const generated = await readFile(path.join(root, SHADCN_PALETTE_OUTPUT), 'utf8');
  assert.match(generated, /readonly \[number, number, number, number\]/);
  assert.match(generated, /as const satisfies/);
});

test('generation check detects changed canonical source and never overwrites stale output', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'shadcn-palette-test-'));
  const sourcePath = path.join(temporary, 'theme.ts');
  const outputPath = path.join(temporary, 'palette.ts');
  try {
    const canonical = await readFile(path.join(root, SHADCN_THEME_SOURCE), 'utf8');
    await writeFile(sourcePath, canonical);
    await assert.rejects(
      generateShadcnMotionPalette({ sourcePath, outputPath, check: true }),
      /stale or missing/
    );
    const before = await generateShadcnMotionPalette({ sourcePath, outputPath });
    const originalOutput = await readFile(outputPath, 'utf8');
    await generateShadcnMotionPalette({ sourcePath, outputPath, check: true });
    await writeFile(
      sourcePath,
      canonical.replace('--background: lab(100% 0 0)', '--background: lab(90% 0 0)')
    );
    await assert.rejects(
      generateShadcnMotionPalette({ sourcePath, outputPath, check: true }),
      /stale or missing/
    );
    assert.equal(await readFile(outputPath, 'utf8'), originalOutput);
    const after = await generateShadcnMotionPalette({ sourcePath, outputPath });
    assert.notEqual(after.sourceHash, before.sourceHash);
    assert.notDeepEqual(after.light.colors.background, before.light.colors.background);
    await generateShadcnMotionPalette({ sourcePath, outputPath, check: true });
    await writeFile(outputPath, (await readFile(outputPath, 'utf8')) + '// stale manual edit\n');
    await assert.rejects(
      generateShadcnMotionPalette({ sourcePath, outputPath, check: true }),
      /stale or missing/
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
