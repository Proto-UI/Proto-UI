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

// Fourteen shared source variables plus four derived radii; Bootstrap also owns destructive.
// The explicit contract rejects missing and unknown entries, not just bad colors.
const sharedDraftVariables = [
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
  'radius-lg',
  'radius-md',
  'radius-sm',
  'radius-xl',
  'ring',
  'secondary',
  'secondary-foreground',
].map((name) => `--pui-${name}`);
const requiredDraftVariables = {
  'bootstrap-2-3-2': [...sharedDraftVariables, '--pui-destructive'].sort(),
  'liquid-glass': [...sharedDraftVariables],
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
  assert.deepEqual(themes['bootstrap-2-3-2'].light, themes['bootstrap-2-3-2'].dark);
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
  assert.deepEqual(tokens['bg-[linear-gradient(#08c,#04c)]'], {
    'background-color': '#006dcc',
    'background-image': 'linear-gradient(to bottom, #08c, #04c)',
  });
  assert.equal(tokens['bg-[#04c]']['background-image'], 'none');
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
