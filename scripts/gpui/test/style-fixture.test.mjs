// Negative evidence for the style fixture gate: a stale fixture must fail the
// check, not merely be expected to. The check is run as the repository runs
// it, through its CLI, so the test cannot pass while the gate is broken.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SCRIPT = path.join(ROOT, 'scripts/gpui/generate-style-fixture.mts');
const FIXTURE = path.join(ROOT, 'native/gpui/fixtures/style-tokens.json');
const THEME = path.join(ROOT, 'native/gpui/fixtures/theme-tokens.json');
const TSX = path.join(ROOT, 'node_modules/.bin/tsx');

function runCheck(fixture, theme = THEME) {
  return spawnSync(TSX, [SCRIPT, '--check', '--fixture', fixture, '--theme-fixture', theme], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('the committed fixtures are current', () => {
  const result = runCheck(FIXTURE);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  // Both fixtures are reported, so a silently skipped one would show up here.
  assert.match(result.stdout, /\d+ compiled, \d+ without declarations .* current/);
  assert.match(result.stdout, /themes current/);
});

test('a declaration that holds only under a media condition is not recorded', () => {
  const tokens = JSON.parse(readFileSync(FIXTURE, 'utf8')).tokens;
  // `animate-spin` stops only under `prefers-reduced-motion: reduce`.
  assert.equal(tokens['animate-spin']['animation-name'], 'pui-spin');
  assert.equal(tokens['animate-spin'].animation, undefined);
});

test('selection tokens are neither element declarations nor no-op markers', () => {
  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  assert.equal(fixture.tokens.flex.display, 'flex');
  assert.ok(fixture.noDeclarations.includes('peer'));
  for (const token of ['selection:bg-primary', 'selection:text-primary-foreground']) {
    assert.equal(fixture.tokens[token], undefined, `${token} must not style the whole element`);
    assert.ok(!fixture.order.includes(token), `${token} has no element declaration order`);
    assert.ok(!fixture.noDeclarations.includes(token), `${token} must remain diagnosable`);
  }
});

test('authored Toast styles are declarations rather than selector-only markers', () => {
  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  for (const token of [
    'duration-300',
    'ease-out',
    'leading-[1.4]',
    'opacity-95',
    'pointer-events-auto',
    'shadow-[0_4px_12px_rgb(0_0_0/10%)]',
    'order-[var(--pui-stack-index)]',
    'z-0',
    'z-[calc(1000_-_var(--pui-stack-index))]',
  ]) {
    assert.ok(fixture.tokens[token], `${token} must retain its compiled declarations`);
    assert.ok(fixture.order.includes(token), `${token} must retain cascade order`);
    assert.ok(!fixture.noDeclarations.includes(token), `${token} is not a selector marker`);
  }
  // Live Toasts use the full opening index for both flex and paint order.
  // Preserve the variable expressions; fixed layers no longer cover authored stacking.
  assert.deepEqual(fixture.tokens['order-[var(--pui-stack-index)]'], {
    order: 'var(--pui-stack-index)',
  });
  assert.deepEqual(fixture.tokens['z-[calc(1000_-_var(--pui-stack-index))]'], {
    'z-index': 'calc(1000 - var(--pui-stack-index))',
  });
  // The native vocabulary treats every noDeclarations entry as intentionally
  // ignorable. A fresh snapshot must not conceal an unimplemented utility.
  assert.deepEqual(
    fixture.noDeclarations.filter(
      (token) => token !== 'peer' && !/^group\/[a-z0-9-]+$/.test(token)
    ),
    []
  );
});

test('the Spinner single border-color intent retains the existing native declaration gaps', () => {
  const tokens = JSON.parse(readFileSync(FIXTURE, 'utf8')).tokens;
  // Same declarations as the former border-current + border-t-transparent pair.
  // GPUI still reports currentColor / border-top-color through its explicit
  // gap inventory; changing token grouping must not invent native support.
  assert.deepEqual(tokens['border-[transparent_currentColor_currentColor_currentColor]'], {
    'border-color': 'currentColor',
    'border-top-color': 'transparent',
  });
});

test('Card row sizing retains exact declarations despite the native grid gaps', () => {
  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const cases = [
    ['auto-rows-min', { 'grid-auto-rows': 'min-content' }],
    ['grid-rows-[auto_auto]', { 'grid-template-rows': 'auto auto' }],
  ];
  for (const [token, declarations] of cases) {
    assert.deepEqual(fixture.tokens[token], declarations);
    assert.ok(fixture.order.includes(token));
    assert.ok(!fixture.noDeclarations.includes(token));
  }
});

test('a stale fixture fails the check', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-ui-style-fixture-'));
  const copy = path.join(dir, 'style-tokens.json');
  copyFileSync(FIXTURE, copy);
  assert.equal(runCheck(copy).status, 0, 'an untouched copy must still pass');

  // One declaration changed is enough: the check compares the whole file.
  const corrupted = JSON.parse(readFileSync(copy, 'utf8'));
  corrupted.tokens.flex = { display: 'block' };
  writeFileSync(copy, `${JSON.stringify(corrupted, null, 2)}\n`);

  const result = runCheck(copy);
  assert.notEqual(result.status, 0, 'a stale fixture must fail');
  assert.match(result.stderr, /is stale; run pnpm gpui:style-fixture/);
});

test('a missing fixture fails the check', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-ui-style-fixture-'));
  const result = runCheck(path.join(dir, 'absent.json'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing/);
});

test('a stale theme fixture fails the check', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'proto-ui-theme-fixture-'));
  const copy = path.join(dir, 'theme-tokens.json');
  copyFileSync(THEME, copy);
  assert.equal(runCheck(FIXTURE, copy).status, 0, 'an untouched copy must still pass');

  const corrupted = JSON.parse(readFileSync(copy, 'utf8'));
  corrupted.themes.shadcn.light['--pui-background'] = 'rebeccapurple';
  writeFileSync(copy, `${JSON.stringify(corrupted, null, 2)}\n`);

  const result = runCheck(FIXTURE, copy);
  assert.notEqual(result.status, 0, 'a stale theme fixture must fail');
  assert.match(result.stderr, /theme-tokens\.json is stale/);
});

// Source palettes and the common renderer own this finite key contract, including
// all seven derived radius variants. Family-only navbar and destructive-foreground
// keys stay explicit so omissions and unknown entries are both rejected.
const sharedDraftVariables = [
  'accent',
  'accent-foreground',
  'background',
  'border',
  'font-heading',
  'font-mono',
  'font-sans',
  'foreground',
  'muted',
  'muted-foreground',
  'primary',
  'primary-foreground',
  'radius',
  'radius-2xl',
  'radius-3xl',
  'radius-4xl',
  'radius-lg',
  'radius-md',
  'radius-sm',
  'radius-xl',
  'ring',
  'secondary',
  'secondary-foreground',
].map((name) => `--pui-${name}`);
const requiredDraftVariables = {
  'bootstrap-2-3-2': [
    ...sharedDraftVariables,
    '--pui-destructive',
    '--pui-navbar-border',
    '--pui-navbar-bottom',
    '--pui-navbar-foreground',
    '--pui-navbar-top',
  ].sort(),
  'liquid-glass': [
    ...sharedDraftVariables,
    '--pui-destructive',
    '--pui-destructive-foreground',
  ].sort(),
};
function assertDraftPaletteKeys(keys, family, label = family) {
  assert.deepEqual([...keys].sort(), requiredDraftVariables[family], `${label} must be complete`);
}

test('draft palette key contract rejects every omission and any unowned key', () => {
  const themes = JSON.parse(readFileSync(THEME, 'utf8')).themes;
  for (const family of ['bootstrap-2-3-2', 'liquid-glass']) {
    for (const mode of ['light', 'dark']) {
      const keys = Object.keys(themes[family][mode]);
      assert.doesNotThrow(() => assertDraftPaletteKeys(keys, family, `${family}/${mode}`));
      for (const missing of requiredDraftVariables[family])
        assert.throws(
          () =>
            assertDraftPaletteKeys(
              keys.filter((key) => key !== missing),
              family
            ),
          /must be complete/
        );
      for (const extra of ['--pui-unowned-fixture-key', '--pui-pui-font-sans'])
        assert.throws(() => assertDraftPaletteKeys([...keys, extra], family), /must be complete/);
    }
  }
});

test('both draft family palettes come from source with exactly one variable prefix', () => {
  const themes = JSON.parse(readFileSync(THEME, 'utf8')).themes;
  assert.deepEqual(Object.keys(themes).sort(), [
    'bootstrap-2-3-2',
    'brutalist',
    'liquid-glass',
    'shadcn',
  ]);
  assert.equal(themes['bootstrap-2-3-2'].light['--pui-primary'], '#0044cc');
  assert.equal(themes['bootstrap-2-3-2'].dark['--pui-primary'], '#0044cc');
  assert.equal(themes['bootstrap-2-3-2'].light['--pui-background'], '#ffffff');
  assert.equal(themes['bootstrap-2-3-2'].dark['--pui-background'], '#161616');
  assert.equal(themes['bootstrap-2-3-2'].light['--pui-navbar-top'], '#006dcc');
  assert.equal(themes['bootstrap-2-3-2'].dark['--pui-navbar-top'], '#0055aa');
  assert.equal(themes['liquid-glass'].light['--pui-secondary'], '#ffffff');
  assert.equal(themes['liquid-glass'].dark['--pui-secondary'], '#2c2c2e');
  for (const name of ['bootstrap-2-3-2', 'liquid-glass']) {
    for (const mode of ['light', 'dark']) {
      const keys = Object.keys(themes[name][mode]);
      assert.ok(keys.every((key) => key.startsWith('--pui-') && !key.startsWith('--pui-pui-')));
      assertDraftPaletteKeys(keys, name, `${name}/${mode}`);
    }
  }
});

test('Bootstrap gradients keep their flat fallback and explicit unsupported paint input', () => {
  const tokens = JSON.parse(readFileSync(FIXTURE, 'utf8')).tokens;
  assert.deepEqual(tokens['bg-[#006dcc_linear-gradient(#08c,#04c)_0_0_repeat-x]'], {
    'background-color': '#006dcc',
    'background-image': 'linear-gradient(to bottom, #08c, #04c)',
    'background-position': '0 0',
    'background-repeat': 'repeat-x',
  });
  assert.deepEqual(tokens['bg-[#04c_none_0_0_repeat-x]'], {
    'background-color': '#04c',
    'background-image': 'none',
    'background-position': '0 0',
    'background-repeat': 'repeat-x',
  });
  assert.equal(tokens['font-normal']['font-weight'], '400');
  assert.equal(tokens['leading-5']['line-height'], '1.25rem');
  assert.equal(tokens['opacity-65'].opacity, '0.65');
});

test('family shadow and Liquid blur inputs remain recorded without claiming native support', () => {
  const tokens = JSON.parse(readFileSync(FIXTURE, 'utf8')).tokens;
  assert.deepEqual(tokens['backdrop-blur-xs'], { 'backdrop-filter': 'blur(4px)' });
  assert.equal(
    tokens['bg-secondary/80']['background-color'],
    'color-mix(in oklab, var(--pui-secondary) 80%, transparent)'
  );
  const shadows = [
    [
      'shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_1px_2px_rgb(0_0_0/5%)]',
      'inset 0 1px 0 rgb(255 255 255 / 0.2), 0 1px 2px rgb(0 0 0 / 0.05)',
    ],
    [
      'shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]',
      'inset 0 2px 4px rgb(0 0 0 / 0.15), 0 1px 2px rgb(0 0 0 / 0.05)',
    ],
  ];
  for (const [token, value] of shadows) {
    assert.equal(tokens[token]['--pui-shadow'], value);
    assert.equal(
      tokens[token]['box-shadow'],
      'var(--pui-ring-offset-shadow, 0 0 #0000), var(--pui-ring-shadow, 0 0 #0000), var(--pui-shadow, 0 0 #0000)'
    );
  }
});

test('Web pseudo-element envelopes remain an explicit native diagnostic gap', () => {
  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  assert.ok(fixture.unsupportedSelectors.includes('hit-envelope-translate-1'));
  assert.equal(fixture.tokens['hit-envelope-translate-1'], undefined);
  assert.ok(!fixture.noDeclarations.includes('hit-envelope-translate-1'));
  assert.ok(!fixture.order.includes('hit-envelope-translate-1'));
});
