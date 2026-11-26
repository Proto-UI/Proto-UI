import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { accordionRoot, accordionItem, accordionTrigger } from '../src/accordion';
import { collapsibleRoot, collapsibleTrigger } from '../src/collapsible';
import { hoverCardRoot, hoverCardTrigger } from '../src/hover-card';
import { THEME, renderThemeCss } from '../src/theme';
import { readFileSync } from 'node:fs';

const commands = [
  { root: accordionRoot, item: accordionItem, trigger: accordionTrigger, darkInk: 'ring' },
  { root: collapsibleRoot, trigger: collapsibleTrigger, darkInk: 'foreground' },
  { root: hoverCardRoot, trigger: hoverCardTrigger, darkInk: 'foreground' },
] as const;
for (const prototype of [
  accordionRoot,
  accordionItem,
  accordionTrigger,
  collapsibleRoot,
  collapsibleTrigger,
  hoverCardRoot,
  hoverCardTrigger,
])
  AdaptToWebComponent(prototype, { registerAs: `contrast-${prototype.name}` });
const flush = async () => {
  for (let index = 0; index < 30; index++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  document.documentElement.classList.remove('dark');
  await flush();
});

function luminance(hex: string) {
  const rgb = hex
    .slice(1)
    .match(/../g)!
    .map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe('Bootstrap readable page adaptation', () => {
  for (const [mode, palette] of Object.entries(THEME)) {
    it(`${mode} page and navbar retain WCAG AA normal-text contrast`, () => {
      // WCAG 2.2 SC 1.4.3, not an assertion that all historic Button colors pass.
      for (const background of [palette.background, palette.secondary, palette.muted]) {
        expect(contrast(palette.foreground, background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(palette['muted-foreground'], background)).toBeGreaterThanOrEqual(4.5);
      }
      for (const background of [palette['navbar-top'], palette['navbar-bottom']]) {
        expect(contrast(palette['navbar-foreground'], background)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
  it('preserves the light historical palette and publishes distinct dark values', () => {
    expect(THEME.light.foreground).toBe('#333333');
    expect(THEME.light.background).toBe('#ffffff');
    expect(THEME.dark.foreground).not.toBe(THEME.light.foreground);
    expect(contrast(THEME.dark['accent-foreground'], THEME.dark.accent)).toBeGreaterThanOrEqual(
      4.5
    );
    expect(contrast(THEME.light['accent-foreground'], THEME.light.accent)).toBeGreaterThanOrEqual(
      4.5
    );
    expect(renderThemeCss()).toContain('--pui-navbar-border: #002b60');
  });
  it('keeps composed light and dark surface pairs semantic', () => {
    const popover = readFileSync(
      'packages/prototypes/bootstrap-2-3-2/src/popover/title.proto.ts',
      'utf8'
    );
    expect(popover).toContain('bg-secondary text-secondary-foreground');
    const days = readFileSync(
      'packages/prototypes/bootstrap-2-3-2/src/calendar/day-paint.ts',
      'utf8'
    );
    expect(days).toContain("tw('bg-muted border-border font-bold')");
    expect(days).toContain("tw('bg-secondary')");
    expect(days).not.toContain('bg-[#eee]');
    const row = readFileSync(
      'packages/prototypes/bootstrap-2-3-2/src/data-table/data-table.proto.ts',
      'utf8'
    );
    expect(row).toContain('bg-accent text-accent-foreground');
  });
  it('keeps supporting copy and link interaction ink readable in dark mode', async () => {
    const description = readFileSync(
      'packages/prototypes/bootstrap-2-3-2/src/fieldset/description.proto.ts',
      'utf8'
    );
    expect(description).toContain('text-muted-foreground');
    expect(description).not.toContain('text-[#555]');
    // Real host color-scheme and borrowed hover facts select the current
    // per-command semantic ink; historical light-mode blue remains valid.
    document.documentElement.classList.add('dark');
    for (const command of commands) {
      const root = document.createElement(`contrast-${command.root.name}`);
      const trigger = document.createElement(`contrast-${command.trigger.name}`) as HTMLElement & {
        getExposes(): { hovered: { get(): boolean } };
      };
      if ('item' in command) {
        const item = document.createElement(`contrast-${command.item.name}`);
        setElementProps(item, { value: 'details' });
        item.append(trigger);
        root.append(item);
      } else root.append(trigger);
      document.body.append(root);
      await flush();
      trigger.dispatchEvent(new PointerEvent('pointerenter'));
      await flush();
      expect(trigger.getExposes().hovered.get()).toBe(true);
      const tokens = (trigger.getAttribute('data-pui-style') ?? '').split(/\s+/);
      if ('item' in command) {
        // This simple rule lowers to a guarded CSS selector; the Adapter
        // keeps its prefix rather than replacing it with an unconditional ink.
        expect(tokens).toContain('dark:text-ring');
        expect(tokens).toContain(
          'dark:data-[hovered]:not-[data-collapse-blocked]:not-[data-disabled]:underline'
        );
      } else {
        expect(tokens).toContain(`text-${command.darkInk}`);
        expect(tokens).toContain('underline');
      }
      expect(tokens).not.toContain('text-[#005580]');
      for (const background of [THEME.dark.background, THEME.dark.secondary, THEME.dark.muted])
        expect(contrast(THEME.dark[command.darkInk], background)).toBeGreaterThanOrEqual(4.5);
      root.remove();
      await flush();
    }
    // Old literal hover ink is still a discriminating dark-page negative control.
    expect(contrast('#005580', THEME.dark.background)).toBeLessThan(4.5);
    expect(contrast(THEME.dark['muted-foreground'], THEME.dark.background)).toBeGreaterThanOrEqual(
      4.5
    );
    expect(contrast(THEME.dark.foreground, THEME.dark.background)).toBeGreaterThanOrEqual(4.5);
  });
  it('keeps transparent numeric copy and OTP separators readable on both themes', () => {
    for (const path of ['slider/value.proto.ts', 'input-otp/separator.proto.ts']) {
      const source = readFileSync(`packages/prototypes/bootstrap-2-3-2/src/${path}`, 'utf8');
      expect(source).toContain('text-muted-foreground');
      expect(source).not.toContain('text-[#555]');
    }
    // Negative control: the old literal ink fails on the actual dark page palette.
    expect(contrast('#555555', THEME.dark.background)).toBeLessThan(4.5);
    for (const palette of Object.values(THEME)) {
      for (const background of [palette.background, palette.secondary, palette.muted]) {
        expect(contrast(palette['muted-foreground'], background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('keeps white control ink paired instead of inheriting dark page text', () => {
    for (const path of [
      'checkbox/root.proto.ts',
      'checkbox-group/indicator-paint.ts',
      'slider/values-thumb.proto.ts',
    ]) {
      const source = readFileSync(`packages/prototypes/bootstrap-2-3-2/src/${path}`, 'utf8');
      expect(source).toContain('text-[#333]');
      expect(source).not.toContain('text-foreground');
    }
  });
});
