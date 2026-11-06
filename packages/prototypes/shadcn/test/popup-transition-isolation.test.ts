import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
  renderProtoShadowSplitStyleArtifact,
} from '../../../cli/src/services/proto-style-css';
import { dropdownRoot, dropdownTrigger, dropdownContent } from '../src/dropdown';
import { contextMenuRoot, contextMenuTrigger, contextMenuContent } from '../src/context-menu';
import { menubarRoot, menubarTrigger, menubarContent } from '../src/menubar';
import { popoverRoot, popoverTrigger, popoverContent } from '../src/popover';
import { hoverCardRoot, hoverCardTrigger, hoverCardContent } from '../src/hover-card';
import { SHADCN_STYLE_IDS } from '../src/style-scope';

// P-BASE-DROPDOWN-MENU-CONTENT-PRESENCE: perceptual motion must not
// interpolate positioning geometry. These are source-host and CSS projection
// controls, not browser first-frame/black-rectangle acceptance.
const families = [
  { name: 'dropdown', root: dropdownRoot, trigger: dropdownTrigger, content: dropdownContent },
  {
    name: 'context-menu',
    root: contextMenuRoot,
    trigger: contextMenuTrigger,
    content: contextMenuContent,
  },
  { name: 'menubar', root: menubarRoot, trigger: menubarTrigger, content: menubarContent },
  { name: 'popover', root: popoverRoot, trigger: popoverTrigger, content: popoverContent },
  { name: 'hover-card', root: hoverCardRoot, trigger: hoverCardTrigger, content: hoverCardContent },
] as const;
for (const family of families) {
  for (const prototype of [family.root, family.trigger, family.content]) {
    if (!customElements.get(prototype.name)) AdaptToWebComponent(prototype as any);
  }
}
const roots: HTMLElement[] = [];
async function flush() {
  for (let i = 0; i < 24; i++) await Promise.resolve();
}
afterEach(async () => {
  for (const root of roots.splice(0)) root.remove();
  await flush();
});

function tokens(element: Element) {
  return (element.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
}
async function fixture(family: (typeof families)[number], profile: string, navigation = false) {
  const root = document.createElement(family.root.name);
  const trigger = document.createElement(family.trigger.name);
  const content = document.createElement(family.content.name);
  setElementProps(root, {
    styleProfile: profile,
    ...(family.name === 'menubar' ? { value: 'menu' } : { open: true }),
    a11yLabel: 'Popup transition regression',
  });
  setElementProps(trigger, { value: 'menu' });
  setElementProps(content, {
    value: 'menu',
    side: 'bottom',
    ...(navigation ? { presentation: 'navigation' } : {}),
  });
  trigger.textContent = 'Open';
  content.textContent = 'Popup';
  root.append(trigger, content);
  roots.push(root);
  document.body.append(root);
  await flush();
  return { root, content };
}
function expectNoPropertyInterpolation(accepted: string[]) {
  expect(accepted).toContain('transition-none');
  expect(accepted).not.toContain('transition-all');
  for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
    const css = render(accepted);
    const selector = '[data-pui-style~="transition-none"]';
    const start = css.indexOf(selector);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(css.slice(start).split('}')[0]).toContain('transition-property: none;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  }
  const split = renderProtoShadowSplitStyleArtifact(accepted, {
    rootTokens: accepted,
    templateTokens: [],
  }).cssText;
  const host = ':host([data-pui-split-root-style~="transition-none"])';
  const surface = `${host} > [data-pui-split-surface][data-pui-style~="transition-none"]`;
  for (const selector of [host, surface]) {
    const start = split.indexOf(`${selector} {`);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(split.slice(start).split('}')[0]).toContain('transition-property: none;');
  }
}

describe('Shadcn positioned popup transition isolation', () => {
  for (const family of families) {
    it.each(SHADCN_STYLE_IDS)(`${family.name} %s keeps keyframes without geometry transitions`, async (profile) => {
      const { content } = await fixture(family, profile);
      const accepted = tokens(content);
      expectNoPropertyInterpolation(accepted);
      const utilities = accepted.map((token) => token.split(':').at(-1));
      for (const motion of ['animate-in', 'fade-in-0', 'zoom-in-95']) {
        expect(utilities).toContain(motion);
      }
      expect(utilities).not.toContain('animate-none');
      const css = renderProtoStyleTokenCss(accepted);
      expect(css).toContain('animation-name: pui-enter;');
      expect(css).toContain('animation-duration: var(--pui-animation-duration, 150ms);');
      if (profile !== 'new-york-v4') {
        expect(accepted).toContain('duration-100');
        expect(css).toContain('--pui-animation-duration: 100ms;');
      } else if (family.name === 'hover-card') {
        expect(accepted).toContain('duration-200');
        expect(css).toContain('--pui-animation-duration: 200ms;');
      }
    });
  }
  it('preserves navigation Popover entry policy and the current surface across profile changes', async () => {
    const family = families.find((entry) => entry.name === 'popover')!;
    const { root, content } = await fixture(family, 'rhea', true);
    for (const profile of ['rhea', 'new-york-v4', 'nova']) {
      setElementProps(root, { styleProfile: profile, open: true });
      await flush();
      const accepted = tokens(content);
      expectNoPropertyInterpolation(accepted);
      expect(accepted.map((token) => token.split(':').at(-1))).toContain('animate-none');
      expect(accepted).toContain('duration-100');
      expect(content.isConnected).toBe(true);
    }
  });
});
