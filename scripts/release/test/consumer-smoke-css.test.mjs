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
  assertDefaultButtonTokens,
  assertStyledButton,
  assertStyledSwitch,
  assertSwitchThumbState,
  loadConsumerStyles,
  unwrapGeneratedTokenLayer,
  unwrapGeneratedThemeSelectionLayer,
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

// Independent recipe expectations from P-SHADCN-SWITCH[-THUMB]-CURRENT-VISUAL-SURFACE.
function switchFixture(document) {
  const element = document.createElement('div');
  element.setAttribute('aria-checked', 'false');
  element.setAttribute(
    'data-pui-style',
    'inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent p-0 shadow-xs'
  );
  const thumb = document.createElement('span');
  thumb.setAttribute(
    'data-pui-style',
    'pointer-events-none block size-4 rounded-full bg-background ring-0 ring-offset-0 translate-x-0'
  );
  element.appendChild(thumb);
  document.body.appendChild(element);
  return element;
}

test('loads actual complete CLI output, preserves original bytes/hash, and observes structural CSS', (t) => {
  const { directory, stylesDir, window } = fixture(t);
  const element = switchFixture(window.document);
  assert.throws(() => assertStyledSwitch(element, 'zero CSS'), /structural CSS not applied/);
  const result = loadConsumerStyles(window.document, { root: directory });
  assertStyledSwitch(element, 'generated CSS');
  assert.notEqual(window.getComputedStyle(element).position, 'relative');
  assert.equal(
    result.styles[0].textContent,
    unwrapGeneratedThemeSelectionLayer(css['shadcn-theme.css'])
  );
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
    /No cascade-layer, selection-paint, width\/layout, paint, or native hit-testing equivalence/
  );
  // Rem declarations are checked above; rendered geometry and motion need a browser.
});

test('rejects theme-only CSS, dropped token CSS and the historical Nova recipe', (t) => {
  const { directory, window } = fixture(t);
  const element = switchFixture(window.document);
  const result = loadConsumerStyles(window.document, { root: directory });
  const tokenSheet = result.styles[1];
  tokenSheet.remove();
  assert.throws(() => assertStyledSwitch(element, 'theme only'), /structural CSS not applied/);
  window.document.head.appendChild(tokenSheet);
  assertStyledSwitch(element, 'restored CSS');
  element.setAttribute(
    'data-pui-style',
    element
      .getAttribute('data-pui-style')
      .replace('h-[1.15rem] w-8', 'relative h-[18.4px] w-[32px]')
      .replace('shadow-xs', '')
  );
  assert.throws(() => assertStyledSwitch(element, 'old Nova'), /current recipe token is missing/);
});

for (const [name, token, from, to] of [
  ['root rem height', 'h-[1.15rem]', 'height: 1.15rem;', 'height: 18.4px;'],
  ['root rem width', 'w-8', 'width: 2rem;', 'width: 32px;'],
  [
    'root shadow size',
    'shadow-xs',
    '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    '0 1px 3px 0 rgb(0 0 0 / 0.1)',
  ],
  ['root shadow application', 'shadow-xs', 'box-shadow:', '--unused-shadow:'],
  ['thumb rem width', 'size-4', 'width: 1rem;', 'width: 16px;'],
  ['thumb rem height', 'size-4', 'height: 1rem;', 'height: 16px;'],
  ['unchecked travel', 'translate-x-0', '--pui-translate-x: 0px;', '--pui-translate-x: 2px;'],
  ['active checked travel', 'translate-x-[calc(100%_-_2px)]', 'calc(100% - 2px)', '14px'],
  [
    'active checked transform',
    'translate-x-[calc(100%_-_2px)]',
    'transform:',
    '--unused-transform:',
  ],
  [
    'checked travel',
    'data-[checked]:not-[data-draggable]:translate-x-[calc(100%_-_2px)]',
    'calc(100% - 2px)',
    '14px',
  ],
  [
    'checked transform',
    'data-[checked]:not-[data-draggable]:translate-x-[calc(100%_-_2px)]',
    'transform:',
    '--unused-transform:',
  ],
]) {
  test(`rejects missing or stale ${name} declaration in installed generated CSS`, (t) => {
    const { directory, window } = fixture(t);
    const element = switchFixture(window.document);
    const { styles } = loadConsumerStyles(window.document, { root: directory });
    const text = styles[1].textContent;
    const start = text.indexOf(`:where([data-pui-style~="${token}"])`);
    assert.ok(start >= 0);
    const end = text.indexOf('}', start) + 1;
    const rule = text.slice(start, end);
    assert.ok(rule.includes(from));
    styles[1].textContent = text.slice(0, start) + rule.replace(from, to) + text.slice(end);
    assert.throws(() => assertStyledSwitch(element, name), /generated CSS declaration is missing/);
  });
}

test('rejects removal of the non-draggable guard from the checked rule', (t) => {
  const { directory, window } = fixture(t);
  const element = switchFixture(window.document);
  const { styles } = loadConsumerStyles(window.document, { root: directory });
  const selector =
    ':where([data-pui-style~=\"data-[checked]:not-[data-draggable]:translate-x-[calc(100%_-_2px)]\"])[data-checked]:not([data-draggable])';
  assert.ok(styles[1].textContent.includes(selector));
  styles[1].textContent = styles[1].textContent.replace(
    selector,
    selector.replace(':not([data-draggable])', '')
  );
  assert.throws(
    () => assertStyledSwitch(element, 'missing draggable guard'),
    /generated CSS rule is missing/
  );
});

test('rejects a missing checked selector and a missing or unstyled default Thumb', (t) => {
  const { directory, window } = fixture(t);
  const element = switchFixture(window.document);
  const { styles } = loadConsumerStyles(window.document, { root: directory });
  const text = styles[1].textContent;
  styles[1].textContent = text.replace(
    ':where([data-pui-style~="data-[checked]:not-[data-draggable]:translate-x-[calc(100%_-_2px)]"])[data-checked]:not([data-draggable])',
    ':where([data-pui-style~="data-[checked]:not-[data-draggable]:translate-x-[calc(100%_-_2px)]"])[data-unchecked]:not([data-draggable])'
  );
  assert.throws(() => assertStyledSwitch(element, 'wrong state'), /generated CSS rule is missing/);
  styles[1].textContent = text;
  const thumb = element.firstElementChild;
  thumb.removeAttribute('data-pui-style');
  assert.throws(
    () => assertStyledSwitch(element, 'unstyled Thumb'),
    /Thumb structural CSS not applied/
  );
  thumb.remove();
  assert.throws(() => assertStyledSwitch(element, 'missing Thumb'), /Thumb is missing/);
});

for (const [name, mutate] of [
  ['last declaration wins', (rule) => rule.replace('width: 2rem;', 'width: 2rem; width: 99px;')],
  ['duplicate selector', (rule) => rule + rule.replace('width: 2rem;', 'width: 99px;')],
  ['commented rule', (rule) => `/* ${rule} */`],
  ['inactive media', (rule) => `@media (min-width: 99999px) { ${rule} }`],
]) {
  test(`rejects ${name} as evidence for the default width`, (t) => {
    const { directory, window } = fixture(t);
    const element = switchFixture(window.document);
    const { styles } = loadConsumerStyles(window.document, { root: directory });
    const text = styles[1].textContent;
    const start = text.indexOf(':where([data-pui-style~="w-8"])');
    const end = text.indexOf('}', start) + 1;
    styles[1].textContent = text.slice(0, start) + mutate(text.slice(start, end)) + text.slice(end);
    assert.throws(
      () => assertStyledSwitch(element, name),
      /generated CSS (rule|declaration) is missing/
    );
  });
}

test('rejects computed width and shadow-variable overrides', (t) => {
  const { directory, window } = fixture(t);
  const element = switchFixture(window.document);
  loadConsumerStyles(window.document, { root: directory });
  element.style.width = '99px';
  assert.throws(
    () => assertStyledSwitch(element, 'inline width'),
    /computed CSS mismatch: Root width/
  );
  element.style.removeProperty('width');
  element.style.setProperty('--pui-shadow', 'none');
  assert.throws(
    () => assertStyledSwitch(element, 'inline shadow'),
    /computed CSS mismatch: Root shadow variable/
  );
});

test('preserves simple rem computation at a larger root font without claiming layout', (t) => {
  const { directory, window } = fixture(t);
  window.document.documentElement.style.fontSize = '32px';
  const element = switchFixture(window.document);
  loadConsumerStyles(window.document, { root: directory });
  assertStyledSwitch(element, 'root 32px');
});

test('requires runtime-evaluated Thumb travel and explicit Root/Thumb checked agreement', (t) => {
  const { directory, window } = fixture(t);
  const element = switchFixture(window.document);
  loadConsumerStyles(window.document, { root: directory });
  const thumb = element.firstElementChild;
  const original = thumb.getAttribute('data-pui-style');
  thumb.setAttribute('data-pui-style', original.replace('translate-x-0', ''));
  assert.throws(
    () => assertStyledSwitch(element, 'missing unchecked travel'),
    /effective translate endpoint/
  );
  element.setAttribute('aria-checked', 'true');
  element.setAttribute('data-checked', '');
  assert.throws(() => assertStyledSwitch(element, 'state drift'), /checked state mismatch/);
  thumb.setAttribute('data-checked', '');
  thumb.setAttribute(
    'data-pui-style',
    original.replace(
      'translate-x-0',
      'data-[checked]:not-[data-draggable]:translate-x-[calc(100%_-_2px)]'
    )
  );
  assert.throws(
    () => assertStyledSwitch(element, 'old lowered recipe'),
    /effective translate endpoint/
  );
  thumb.setAttribute(
    'data-pui-style',
    original.replace('translate-x-0', 'translate-x-[calc(100%_-_2px)]')
  );
  assertStyledSwitch(element, 'checked active recipe');
  assert.throws(
    () => assertSwitchThumbState(element, false, 'wrong expected state'),
    /checked state mismatch/
  );
});

for (const [name, checked, token, inline] of [
  ['unchecked active token', false, 'translate-x-0', ''],
  ['checked active token', true, 'translate-x-[calc(100%_-_2px)]', ''],
  ['unchecked resident endpoint', false, '', '0px 0px'],
  ['unchecked canonical zero', false, '', '0px'],
]) {
  test(`accepts the exact ${name} channel`, (t) => {
    const { window } = fixture(t);
    const element = switchFixture(window.document);
    element.setAttribute('aria-checked', String(checked));
    element.toggleAttribute('data-checked', checked);
    const thumb = element.firstElementChild;
    thumb.toggleAttribute('data-checked', checked);
    thumb.setAttribute('data-pui-style', token);
    thumb.style.setProperty('translate', inline);
    assertSwitchThumbState(element, checked, name);
  });
}

for (const [name, checked, token, inline, priority = '', transform = ''] of [
  ['missing zero channel', false, '', ''],
  ['missing checked channel', true, '', ''],
  ['stale unchecked token', true, 'translate-x-0', ''],
  ['stale checked token', false, 'translate-x-[calc(100%_-_2px)]', ''],
  [
    'obsolete single-state checked token',
    true,
    'data-[checked]:translate-x-[calc(100%_-_2px)]',
    '',
  ],
  [
    'lowered compound checked token',
    true,
    'data-[checked]:not-[data-draggable]:translate-x-[calc(100%_-_2px)]',
    '',
  ],
  ['nonzero unchecked inline', false, '', '1px 0px'],
  ['unmeasured checked inline', true, '', '14px 0px'],
  ['competing token and inline', false, 'translate-x-0', '0px 0px'],
  ['extra translation axis', false, 'translate-x-0 translate-y-1', ''],
  ['external inline priority', false, '', '0px 0px', 'important'],
  ['competing inline transform', false, '', '0px 0px', '', 'scale(2)'],
]) {
  test(`rejects ${name} instead of accepting an arbitrary nonempty style`, (t) => {
    const { window } = fixture(t);
    const element = switchFixture(window.document);
    element.setAttribute('aria-checked', String(checked));
    element.toggleAttribute('data-checked', checked);
    const thumb = element.firstElementChild;
    thumb.toggleAttribute('data-checked', checked);
    thumb.setAttribute('data-pui-style', token);
    thumb.style.setProperty('translate', inline, priority);
    thumb.style.setProperty('transform', transform);
    assert.throws(
      () => assertSwitchThumbState(element, checked, name),
      /effective translate endpoint/
    );
  });
}

for (const [name, token, mutate] of [
  [
    'comment-trivia duplicate',
    'h-[1.15rem]',
    (rule, text) =>
      text + '\n/* appended rule */\n' + rule.replace('height: 1.15rem;', 'height: 99px;'),
  ],
  [
    'earlier important height',
    'h-[1.15rem]',
    (rule, text) =>
      text.replace(
        rule,
        rule.replace('height: 1.15rem;', 'height: 99px !important; height: 1.15rem;')
      ),
  ],
  [
    'uppercase height override',
    'h-[1.15rem]',
    (rule, text) =>
      text.replace(rule, rule.replace('height: 1.15rem;', 'height: 1.15rem; HEIGHT: 99px;')),
  ],
  [
    'important checked transform',
    'data-[checked]:not-[data-draggable]:translate-x-[calc(100%_-_2px)]',
    (rule, text) =>
      text.replace(rule, rule.replace('transform:', 'transform: scale(99) !important; transform:')),
  ],
]) {
  test(`rejects ${name} through the host CSSOM`, (t) => {
    const { directory, window } = fixture(t);
    const element = switchFixture(window.document);
    const { styles } = loadConsumerStyles(window.document, { root: directory });
    const text = styles[1].textContent;
    const start = text.indexOf(`:where([data-pui-style~="${token}"])`);
    const end = text.indexOf('}', start) + 1;
    styles[1].textContent = mutate(text.slice(start, end), text);
    assert.throws(
      () => assertStyledSwitch(element, name),
      /generated CSS (rule|declaration) is missing/
    );
  });
}

test('rejects a missing active checked CSS rule even while the unused lowered rule remains', (t) => {
  const { directory, window } = fixture(t);
  const element = switchFixture(window.document);
  loadConsumerStyles(window.document, { root: directory });
  const style = window.document.querySelector('style[data-consumer-smoke-css="tokens"]');
  const text = style.textContent;
  const start = text.indexOf(':where([data-pui-style~="translate-x-[calc(100%_-_2px)]"])');
  assert.ok(start >= 0);
  const end = text.indexOf('}', start) + 1;
  style.textContent = text.slice(0, start) + text.slice(end);
  element.setAttribute('aria-checked', 'true');
  element.setAttribute('data-checked', '');
  const thumb = element.firstElementChild;
  thumb.setAttribute('data-checked', '');
  thumb.setAttribute(
    'data-pui-style',
    thumb.getAttribute('data-pui-style').replace('translate-x-0', 'translate-x-[calc(100%_-_2px)]')
  );
  assert.throws(
    () => assertStyledSwitch(element, 'missing active recipe'),
    /generated CSS rule is missing/
  );
});

for (const property of [
  '--pui-translate-x',
  '--pui-translate-y',
  '--pui-scale-x',
  '--pui-scale-y',
]) {
  test(`rejects inline ${property} overriding the token channel`, (t) => {
    const { directory, window } = fixture(t);
    const element = switchFixture(window.document);
    loadConsumerStyles(window.document, { root: directory });
    element.firstElementChild.style.setProperty(property, '99px');
    assert.throws(
      () => assertStyledSwitch(element, 'inline variable override'),
      /effective translate endpoint/
    );
    assert.throws(
      () => assertSwitchThumbState(element, false, 'inline variable override'),
      /effective translate endpoint/
    );
  });
}

test('rejects Root marker drift independently of aria and Thumb markers', (t) => {
  const { window } = fixture(t);
  const element = switchFixture(window.document);
  element.setAttribute('aria-checked', 'true');
  const thumb = element.firstElementChild;
  thumb.setAttribute('data-checked', '');
  thumb.setAttribute('data-pui-style', 'translate-x-[calc(100%_-_2px)]');
  assert.throws(
    () => assertSwitchThumbState(element, true, 'missing Root marker'),
    /checked state mismatch/
  );
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
    assert.ok(source.includes('assertStyledSwitch('));
    assert.ok(source.includes('assertStyledButton('));
    assert.ok(!source.includes("includes('group/button')"));
  }
  const packedReact = readFileSync(
    join(root, 'scripts/release/consumer-smoke/react-vite/smoke.tsx'),
    'utf8'
  );
  assert.ok(packedReact.includes('assertStyledButton('));
  const vue2 = readFileSync(join(root, 'packages/cli/test/smoke-render/vue2.mjs'), 'utf8');
  assert.ok(vue2.includes('assertDefaultButtonTokens('));
  assert.ok(!vue2.includes('assertStyledButton('));
  assert.ok(!vue2.includes('loadConsumerStyles('));
  const cli = readFileSync(join(root, 'scripts/release/consumer-smoke-cli.mjs'), 'utf8');
  const vue2Runner = cli.slice(cli.indexOf('function runVue2Consumer('));
  assert.ok(vue2Runner.includes("'--no-styles'"));
  assert.ok(vue2Runner.includes("join(consumerDir, 'consumer-smoke-css.mjs')"));
});

// P-SHADCN-BUTTON-RHEA-LUMA-PROFILES: independent fixed-upstream consumer oracle.
function buttonFixture(document) {
  const element = document.createElement('div');
  element.className = 'user-added';
  element.setAttribute(
    'data-pui-style',
    'inline-flex shrink-0 items-center justify-center rounded-[var(--pui-radius-2xl)] text-sm leading-5 py-0 font-medium border border-transparent bg-primary text-primary-foreground h-8 gap-1.5 px-3 whitespace-nowrap'
  );
  document.body.append(element);
  return element;
}

test('Rhea Button tokens and actual generated CSS replace the obsolete marker oracle', (t) => {
  const { directory, window } = fixture(t);
  const button = buttonFixture(window.document);
  assertDefaultButtonTokens(button, 'tokens only');
  assert.throws(() => assertStyledButton(button, 'zero CSS'), /Button generated CSS mismatch/);
  loadConsumerStyles(window.document, { root: directory });
  assertStyledButton(button, 'fixed Rhea default');
  window.document.documentElement.style.fontSize = '32px';
  assertStyledButton(button, 'font-relative default');
});

for (const [name, mutate] of [
  ['marker alone', (element) => element.setAttribute('data-pui-style', 'group/button')],
  [
    'old height',
    (element) =>
      element.setAttribute(
        'data-pui-style',
        element.getAttribute('data-pui-style').replace('h-8', 'h-9')
      ),
  ],
  [
    'old radius',
    (element) =>
      element.setAttribute(
        'data-pui-style',
        element
          .getAttribute('data-pui-style')
          .replace('rounded-[var(--pui-radius-2xl)]', 'rounded-md')
      ),
  ],
  [
    'old padding',
    (element) =>
      element.setAttribute(
        'data-pui-style',
        element.getAttribute('data-pui-style').replace('px-3', 'px-4')
      ),
  ],
  ['class leakage', (element) => element.classList.add('rounded-[var(--pui-radius-2xl)]')],
]) {
  test(`Button consumer oracle rejects ${name}`, (t) => {
    const { window } = fixture(t);
    const element = buttonFixture(window.document);
    mutate(element);
    assert.throws(
      () => assertDefaultButtonTokens(element, name),
      /Button (current recipe token is missing|leaked prototype token)/
    );
  });
}

test('Button CSS check rejects a stale installed height despite valid prototype tokens', (t) => {
  const { directory, window } = fixture(t);
  const element = buttonFixture(window.document);
  loadConsumerStyles(window.document, { root: directory });
  const override = window.document.createElement('style');
  override.textContent = '[data-pui-style] { height: 36px; }';
  window.document.head.append(override);
  assert.throws(
    () => assertStyledButton(element, 'stale CSS'),
    /Button generated CSS mismatch: height=/
  );
});

for (const [property, value] of [
  ['padding-inline', '10px'],
  ['padding-block', '4px'],
]) {
  test(`Button CSS check rejects stale ${property} despite valid prototype tokens`, (t) => {
    const { directory, window } = fixture(t);
    const element = buttonFixture(window.document);
    loadConsumerStyles(window.document, { root: directory });
    const override = window.document.createElement('style');
    override.textContent = `[data-pui-style] { ${property}: ${value}; }`;
    window.document.head.append(override);
    assert.throws(
      () => assertStyledButton(element, 'stale padding'),
      /Button generated CSS mismatch: padding/
    );
  });
}

const selectionBody = `::selection {
      background-color: var(--pui-selection);
      color: var(--pui-selection-foreground);
    }`;
const selectionLayer = `@layer theme {
    ${selectionBody}
  }`;

test('recognizes only canonical generated theme selection and retains all other bytes', () => {
  const theme = css['shadcn-theme.css'];
  assert.ok(theme.includes(selectionLayer));
  assert.equal(
    unwrapGeneratedThemeSelectionLayer(theme),
    theme.replace(selectionLayer, selectionBody)
  );
  const quoted = `/* ${selectionLayer} */\n[data-value="@layer"] { content: "@import"; }\n`;
  assert.equal(
    unwrapGeneratedThemeSelectionLayer(quoted + theme),
    quoted + theme.replace(selectionLayer, selectionBody)
  );
  assert.equal(
    unwrapGeneratedThemeSelectionLayer(':root { --pui-selection: black; }'),
    ':root { --pui-selection: black; }'
  );
  assert.throws(
    () => unwrapGeneratedTokenLayer(`${prefix}\n${selectionLayer}\n}\n`),
    /consumer CSS smoke:/
  );
});

for (const [name, invalid] of Object.entries({
  'unknown layer': selectionLayer.replace('@layer theme', '@layer arbitrary'),
  'unknown selector': selectionLayer.replace('::selection', '*'),
  'changed role': selectionLayer.replace('--pui-selection)', '--pui-primary)'),
  'additional declaration': selectionLayer.replace(
    'color: var(--pui-selection-foreground);',
    'color: var(--pui-selection-foreground); display: none;'
  ),
  'important paint': selectionLayer.replace('--pui-selection);', '--pui-selection) !important;'),
  'duplicated rule': selectionLayer + selectionLayer,
  'nested rule': `@media (prefers-color-scheme: dark) { ${selectionLayer} }`,
  'additional import': selectionLayer + "\n@import './unapproved.css';",
  'unbalanced suffix': selectionLayer + '}',
})) {
  test(`theme selection fails closed on ${name}`, () => {
    assert.throws(() => unwrapGeneratedThemeSelectionLayer(invalid), /consumer CSS smoke:/);
  });
}
