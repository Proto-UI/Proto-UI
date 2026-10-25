import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import ts from 'typescript';

const root = fileURLToPath(new URL('../..', import.meta.url));
export const SHADCN_THEME_SOURCE = 'packages/cli/src/legacy/type.ts';
export const SHADCN_PALETTE_OUTPUT = 'apps/www/src/generated/shadcn-motion-palette.ts';

type Rgba = readonly [number, number, number, number];
type Diagnostic = {
  code: 'missing-reference' | 'reference-cycle' | 'unsupported-value';
  value: string;
  path: readonly string[];
};
type ModePalette = {
  colors: Record<string, Rgba>;
  expectedInputs: Record<string, string>;
  unresolved: Record<string, Diagnostic>;
};
type Resolution = { color: Rgba; input: string } | { diagnostic: Diagnostic };

/** Read only the canonical variable-bank literal without importing or executing the CLI module. */
export function extractShadcnThemeVariablesCss(source: string): string {
  const ast = ts.createSourceFile(SHADCN_THEME_SOURCE, source, ts.ScriptTarget.Latest, true);
  const declarations = ast.statements.flatMap((statement) =>
    ts.isVariableStatement(statement) &&
    statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
    statement.declarationList.flags & ts.NodeFlags.Const
      ? statement.declarationList.declarations.filter(
          (declaration) =>
            ts.isIdentifier(declaration.name) &&
            declaration.name.text === 'SHADCN_THEME_VARIABLES_CSS'
        )
      : []
  );
  const initializer = declarations[0]?.initializer;
  if (
    declarations.length !== 1 ||
    !initializer ||
    !ts.isNoSubstitutionTemplateLiteral(initializer)
  ) {
    throw new Error(
      'SHADCN_THEME_VARIABLES_CSS must be one exported const with a static template literal.'
    );
  }
  return initializer.text;
}

/** This is deliberately a bounded parser for the canonical theme, not a CSS evaluator. */
function readThemeDeclarations(css: string) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // This exact low-priority paint projection consumes existing color roles;
  // it introduces no new palette declaration or arbitrary CSS evaluation.
  const selectionPaint =
    /@layer\s+theme\s*\{\s*::selection\s*\{\s*background-color\s*:\s*var\(--selection\)\s*;\s*color\s*:\s*var\(--selection-foreground\)\s*;\s*\}\s*\}/g;
  if ([...withoutComments.matchAll(selectionPaint)].length > 1) {
    throw new Error('Repeated SHADCN_THEME_CSS selection paint rule.');
  }
  const text = withoutComments.replace(selectionPaint, '');
  const blocks = [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  if (
    blocks
      .map((block) => block[0])
      .join('')
      .trim() !== text.trim()
  ) {
    throw new Error('Unsupported SHADCN_THEME_CSS structure (nested or incomplete rule).');
  }
  const modes: Partial<Record<'light' | 'dark', Record<string, string>>> = {};
  for (const [, selector, body] of blocks) {
    const selectors = selector.split(',').map((part) => part.trim());
    const mode =
      selectors.length === 1 && selectors[0] === ':root'
        ? 'light'
        : selectors.length === 2 &&
            selectors.includes(':root.dark') &&
            selectors.some((part) => /^:root\[data-theme=(?:'dark'|"dark")\]$/.test(part))
          ? 'dark'
          : null;
    if (!mode || modes[mode]) {
      throw new Error(`Unsupported or repeated SHADCN_THEME_CSS selector: ${selector.trim()}`);
    }
    const declarations: Record<string, string> = {};
    for (const declaration of body
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)) {
      const match = /^(--[\w-]+)\s*:\s*(\S[\s\S]*)$/.exec(declaration);
      if (!match || /!\s*important/i.test(match[2]) || Object.hasOwn(declarations, match[1])) {
        throw new Error(`Unsupported or repeated SHADCN_THEME_CSS declaration: ${declaration}`);
      }
      declarations[match[1]] = match[2].trim();
    }
    modes[mode] = declarations;
  }
  if (!modes.light || !modes.dark) {
    throw new Error('SHADCN_THEME_CSS must contain the canonical light and dark rules.');
  }
  return { light: modes.light, dark: { ...modes.light, ...modes.dark } };
}

const number = String.raw`[+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?%?`;
const labPattern = new RegExp(
  String.raw`^lab\(\s*(${number})\s+(${number})\s+(${number})(?:\s*\/\s*(${number}))?\s*\)$`,
  'i'
);
const clamp = (value: number, max = 1) => Math.min(max, Math.max(0, value));
const component = (value: string, percentageScale: number) =>
  value.endsWith('%') ? (Number(value.slice(0, -1)) * percentageScale) / 100 : Number(value);
const multiply = (matrix: readonly (readonly number[])[], vector: readonly number[]) =>
  matrix.map((row) =>
    row.reduce((sum, coefficient, index) => sum + coefficient * vector[index], 0)
  );

/**
 * CSS Color 4: https://www.w3.org/TR/css-color-4/#specifying-lab-lch
 * Conversion equations/matrices: https://www.w3.org/TR/css-color-4/#color-conversion-code
 * Lab (D50) -> XYZ D50 -> Bradford-adapted XYZ D65 -> gamma-encoded sRGB.
 * L is clamped to [0,100]; a/b percentages use +/-125 and are not clamped.
 * Alpha is clamped to [0,1] and retained separately, never premultiplied.
 * The bounded motion palette clips encoded RGB channels to [0,1]. This is
 * explicit channel clipping, not CSS Color 4 perceptual gamut mapping.
 * CSS none, relative colors, calc(), and other color functions are unsupported.
 */
export function parseStaticLab(value: string): Rgba | null {
  const match = labPattern.exec(value);
  if (!match) return null;
  const input = [
    component(match[1], 100),
    component(match[2], 125),
    component(match[3], 125),
    match[4] === undefined ? 1 : component(match[4], 1),
  ];
  if (!input.every(Number.isFinite)) return null;
  const [rawL, a, b, rawAlpha] = input;
  const lightness = clamp(rawL, 100);
  const alpha = clamp(rawAlpha);
  // CSS Color 4 specifies black/white at the clamped lightness endpoints.
  if (lightness === 0) return [0, 0, 0, alpha];
  if (lightness === 100) return [1, 1, 1, alpha];
  const fy = (lightness + 16) / 116;
  const inverseLab = (f: number) => (f ** 3 > 216 / 24389 ? f ** 3 : (116 * f - 16) / (24389 / 27));
  const xyzD50 = [
    inverseLab(fy + a / 500) * (0.3457 / 0.3585),
    inverseLab(fy),
    inverseLab(fy - b / 200) * ((1 - 0.3457 - 0.3585) / 0.3585),
  ];
  const xyzD65 = multiply(
    [
      [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
      [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
      [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
    ],
    xyzD50
  );
  const linearRgb = multiply(
    [
      [12831 / 3959, -329 / 214, -1974 / 3959],
      [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
      [705 / 12673, -2585 / 12673, 705 / 667],
    ],
    xyzD65
  );
  if (!linearRgb.every(Number.isFinite)) return null;
  const rgb = linearRgb.map((channel) => {
    const encoded =
      Math.abs(channel) <= 0.0031308
        ? 12.92 * channel
        : Math.sign(channel) * (1.055 * Math.abs(channel) ** (1 / 2.4) - 0.055);
    // Nine fractional digits preserve sub-byte precision and stable generated text.
    return Number(clamp(encoded).toFixed(9));
  });
  return [rgb[0], rgb[1], rgb[2], alpha];
}

function resolveMode(declarations: Record<string, string>): ModePalette {
  const colors: ModePalette['colors'] = {};
  const expectedInputs: ModePalette['expectedInputs'] = {};
  const unresolved: ModePalette['unresolved'] = {};
  const resolve = (name: string, ancestors: string[]): Resolution => {
    const value = declarations[name];
    const trace = [...ancestors, name];
    if (ancestors.includes(name)) {
      return { diagnostic: { code: 'reference-cycle', value, path: trace } };
    }
    if (value === undefined) {
      return { diagnostic: { code: 'missing-reference', value: `var(${name})`, path: trace } };
    }
    const reference = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value);
    if (reference) return resolve(reference[1], trace);
    const color = parseStaticLab(value);
    return color
      ? { color, input: value }
      : { diagnostic: { code: 'unsupported-value', value, path: trace } };
  };
  for (const name of Object.keys(declarations).sort()) {
    // Radius is the canonical theme's known dimensional token, not a color role.
    if (name === '--radius') continue;
    const role = name.slice(2);
    const resolved = resolve(name, []);
    if ('diagnostic' in resolved) unresolved[role] = resolved.diagnostic;
    else {
      colors[role] = resolved.color;
      expectedInputs[role] = resolved.input;
    }
  }
  return { colors, expectedInputs, unresolved };
}

export function deriveShadcnMotionPalette(css: string) {
  const declarations = readThemeDeclarations(css);
  return {
    sourceHash: `sha256:${createHash('sha256').update(css).digest('hex')}`,
    light: resolveMode(declarations.light),
    dark: resolveMode(declarations.dark),
  };
}

export async function generateShadcnMotionPalette(
  options: {
    sourcePath?: string;
    outputPath?: string;
    check?: boolean;
  } = {}
) {
  const sourcePath = options.sourcePath ?? path.join(root, SHADCN_THEME_SOURCE);
  const outputPath = options.outputPath ?? path.join(root, SHADCN_PALETTE_OUTPUT);
  const palette = deriveShadcnMotionPalette(
    extractShadcnThemeVariablesCss(await readFile(sourcePath, 'utf8'))
  );
  const config = (await resolveConfig(path.join(root, SHADCN_PALETTE_OUTPUT))) ?? {};
  const generated = await format(
    `/**
 * Generated from ${SHADCN_THEME_SOURCE}#SHADCN_THEME_VARIABLES_CSS.
 * Run: node --import tsx scripts/styles/generate-shadcn-motion-palette.ts [--check]
 * Do not edit by hand. sourceHash hashes the exact extracted CSS literal.
 * RGBA is non-premultiplied, gamma-encoded sRGB in [0,1], with channel clipping.
 * Lab conversion uses CSS Color 4 D50 -> Bradford D65; no perceptual gamut mapping.
 * expectedInputs contains resolved source Lab strings for provenance checks only.
 * External variables and unsupported values remain unresolved; no fallback is invented.
 */
export type ShadcnMotionRgba = readonly [number, number, number, number];
export type ShadcnMotionPaletteMode = {
  readonly colors: Readonly<Record<string, ShadcnMotionRgba>>;
  readonly expectedInputs: Readonly<Record<string, string>>;
  readonly unresolved: Readonly<Record<string, {
    readonly code: 'missing-reference' | 'reference-cycle' | 'unsupported-value';
    readonly value: string;
    readonly path: readonly string[];
  }>>;
};
export const SHADCN_MOTION_PALETTE = ${JSON.stringify(palette, null, 2)} as const satisfies {
  readonly sourceHash: string;
  readonly light: ShadcnMotionPaletteMode;
  readonly dark: ShadcnMotionPaletteMode;
};
`,
    { ...config, filepath: outputPath, parser: 'typescript' }
  );
  if (options.check) {
    const current = await readFile(outputPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (current !== generated) {
      throw new Error(
        `Shadcn motion palette is stale or missing: ${outputPath}. Run the generator.`
      );
    }
  } else {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, generated);
  }
  return palette;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== '--check')) {
    throw new Error('Usage: generate-shadcn-motion-palette.ts [--check]');
  }
  await generateShadcnMotionPalette({ check: args.includes('--check') });
}
