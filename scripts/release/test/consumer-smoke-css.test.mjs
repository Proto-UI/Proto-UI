import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Window } from 'happy-dom';
import {
  assertPositionedSwitch,
  loadConsumerStyles,
  unwrapGeneratedTokenLayer,
} from '../consumer-smoke-css.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const generated = spawnSync(
  process.execPath,
  [
    '--import',
    'tsx',
    '--input-type=module',
    '-e',
    `
  import { renderProtoStyleTokenCss, renderProtoStyleEntryCss, renderPrefixedThemeCss } from './packages/cli/src/services/proto-style-css.ts';
  import { SHADCN_STYLE_TOKENS } from './packages/cli/src/generated/shadcn-style-tokens.ts';
  import { SHADCN_THEME_CSS } from './packages/cli/src/legacy/type.ts';
  console.log(JSON.stringify({
    'proto-ui-style.css': renderProtoStyleEntryCss({themeImport:'./shadcn-theme.css',tokensImport:'./proto-ui-tokens.generated.css'}),
    'shadcn-theme.css': renderPrefixedThemeCss(SHADCN_THEME_CSS),
    'proto-ui-tokens.generated.css': renderProtoStyleTokenCss(SHADCN_STYLE_TOKENS),
  }));
`,
  ],
  { cwd: root, encoding: 'utf8' }
);
assert.equal(generated.status, 0, generated.stderr);
const css = JSON.parse(generated.stdout);
const tokens = css['proto-ui-tokens.generated.css'];
const marker = '@layer proto-ui {';
const prefix = tokens.slice(0, tokens.indexOf(marker) + marker.length);
const body = tokens.slice(prefix.length, -2);

test('unwraps only the exact CLI outer layer, preserving all selector/declaration/order bytes', () => {
  assert.equal(unwrapGeneratedTokenLayer(tokens), body);
  assert.ok(body.includes('@keyframes pui-enter'));
  assert.ok(body.includes('@media'));
  const quoted =
    '\n  /* } @layer ignored { */\n  [data-value="{ @layer }"] { content: "}\\\"{"; }\n';
  assert.equal(unwrapGeneratedTokenLayer(`${prefix}${quoted}}\n`), quoted);
});

for (const [name, value] of Object.entries({
  unlayered: body,
  otherLayer: tokens.replace(marker, '@layer other {'),
  noHeader: tokens.slice(tokens.indexOf(marker)),
  siblingBefore: 'body { color: red; }\n' + tokens,
  siblingAfter: tokens + 'body { color: red; }\n',
  secondLayer: tokens + '@layer proto-ui {}\n',
  nestedLayer: `${prefix}\n @layer extra {}\n}\n`,
  nestedImport: `${prefix}\n @import 'other.css';\n}\n`,
  escapedLayer: `${prefix}\n @la\\79 er extra {}\n}\n`,
  disguisedSibling: `${prefix}\n}\nbody { color: red; }\n{\n}\n`,
  unbalanced: `${prefix}\n a { color: red;\n}\n`,
  unclosedComment: `${prefix}\n /* unfinished\n}\n`,
  unclosedQuote: `${prefix}\n a { content: "oops; }\n}\n`,
})) {
  test(`fails closed on ${name}`, () =>
    assert.throws(() => unwrapGeneratedTokenLayer(value), /consumer CSS smoke:/));
}

function fixture(t) {
  const directory = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'consumer-css-test-'));
  const stylesDir = join(directory, 'src', 'styles');
  mkdirSync(stylesDir, { recursive: true });
  for (const [name, value] of Object.entries(css)) writeFileSync(join(stylesDir, name), value);
  const window = new Window();
  t.after(async () => {
    await window.happyDOM.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { directory, stylesDir, window };
}

test('loads actual complete CLI output, preserves original bytes/hash, and observes structural CSS', (t) => {
  const { directory, stylesDir, window } = fixture(t);
  const element = window.document.createElement('div');
  element.setAttribute('data-pui-style', 'relative inline-flex w-[32px]');
  window.document.body.appendChild(element);
  assert.throws(() => assertPositionedSwitch(element, 'zero CSS'), /structural CSS not applied/);
  const result = loadConsumerStyles(window.document, { root: directory });
  assertPositionedSwitch(element, 'generated CSS');
  assert.equal(result.styles[0].textContent, css['shadcn-theme.css']);
  assert.equal(result.styles[1].textContent, body);
  const manifest = JSON.parse(readFileSync(join(result.evidenceDir, 'manifest.json'), 'utf8'));
  for (const file of manifest.files) {
    const before = readFileSync(join(stylesDir, file.name));
    assert.deepEqual(readFileSync(join(result.evidenceDir, file.name)), before);
    assert.equal(file.sha256, createHash('sha256').update(before).digest('hex'));
    assert.equal(file.bytes, before.length);
  }
  assert.match(
    manifest.limitation,
    /No cascade-layer, width\/layout, paint, or native hit-testing equivalence/
  );
  // Deliberately no width/geometry assertion: HappyDOM is not a layout engine.
});

test('rejects unexpected import order and never partially installs CSS', (t) => {
  const { directory, stylesDir, window } = fixture(t);
  writeFileSync(
    join(stylesDir, 'proto-ui-style.css'),
    css['proto-ui-style.css'].replace('layer(theme)', 'layer(other)')
  );
  assert.throws(
    () => loadConsumerStyles(window.document, { root: directory }),
    /entry\/import order/
  );
  assert.equal(window.document.styleSheets.length, 0);
});

test('rejects unrecognized imported theme structure without partial installation', (t) => {
  const { directory, stylesDir, window } = fixture(t);
  writeFileSync(
    join(stylesDir, 'shadcn-theme.css'),
    "@import 'unexpected.css';\n" + css['shadcn-theme.css']
  );
  assert.throws(
    () => loadConsumerStyles(window.document, { root: directory }),
    /additional @layer or @import/
  );
  assert.equal(window.document.styleSheets.length, 0);
});

test('keeps styled/no-styles cases separate and browser entry on the original CSS', () => {
  const react = readFileSync(join(root, 'scripts/release/consumer-smoke-react.mjs'), 'utf8');
  assert.ok(react.includes("[cli, 'init', '--yes', '--no-interactive']"));
  assert.ok(react.includes("import './styles/proto-ui-style.css'"));
  const noStyles = readFileSync(join(root, 'scripts/release/consumer-smoke-no-styles.mjs'), 'utf8');
  assert.ok(noStyles.includes("'--no-styles'"));
  assert.ok(noStyles.includes('assertNoGeneratedStyles();'));
  assert.ok(noStyles.includes("join(root, 'consumer-owned-styles')"));
  for (const renderer of ['react', 'vue', 'wc']) {
    const source = readFileSync(
      join(root, `packages/cli/test/smoke-render/${renderer}.mjs`),
      'utf8'
    );
    assert.ok(source.includes('loadConsumerStyles(document'));
    assert.ok(source.includes('assertPositionedSwitch('));
  }
});
