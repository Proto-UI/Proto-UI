import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  drawerRoot,
  drawerContent,
  drawerHeader,
  drawerFooter,
  drawerTitle,
} from '../src/drawer';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';

const Root = AdaptToWebComponent(drawerRoot);
const Content = AdaptToWebComponent(drawerContent);
const Header = AdaptToWebComponent(drawerHeader);
const Footer = AdaptToWebComponent(drawerFooter);
const Title = AdaptToWebComponent(drawerTitle);
async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
function fixture() {
  const root = new Root();
  const content = new Content();
  const header = new Header();
  const footer = new Footer();
  const title = new Title();
  setElementProps(root, { defaultOpen: true });
  setElementProps(content, { side: 'bottom' });
  title.textContent = 'Drawer title';
  header.append(title);
  content.append(header, footer);
  root.append(content);
  document.body.append(root);
  return { root, content, header, footer, title };
}
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

// Independent oracle: 02cad61166c4c20edbc8a3f71bd720eed4c1f49b
// apps/v4/registry/new-york-v4/ui/drawer.tsx. These are live source-host CSS
// facts, not native layout, clipping or typography-inheritance acceptance.
it('realizes pinned Header/Footer layout and inherited Title typography on their actual owners', async () => {
  const { content, header, footer, title } = fixture();
  await flush();
  expect(content.contains(header)).toBe(true);
  expect(content.contains(footer)).toBe(true);
  expect(header.contains(title)).toBe(true);
  expect(content.getAttribute('aria-labelledby')).toBe(title.id);
  for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
    const headerCss = render((header.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean));
    const footerCss = render((footer.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean));
    const titleCss = render((title.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean));
    expect(headerCss).toContain('display: flex;');
    expect(headerCss).toContain('flex-direction: column;');
    expect(headerCss).toContain('gap: 0.125rem;');
    expect(headerCss).toContain('padding: 1rem;');
    expect(footerCss).toContain('margin-top: auto;');
    expect(footerCss).toContain('gap: 0.5rem;');
    expect(footerCss).toContain('padding: 1rem;');
    expect(titleCss).toContain('font-weight: 600;');
    expect(titleCss).not.toContain('font-size:');
    expect(titleCss).not.toContain('line-height:');
    for (const css of [headerCss, footerCss, titleCss])
      expect(css).not.toContain('Unsupported Proto UI style tokens');
  }
});

it('updates only the pinned accepted-side edge paint while retaining the same open owner and caller nodes', async () => {
  const { root, content, header, title } = fixture();
  await flush();
  const open = root.getExposes().open;
  for (const [side, border, corner] of [
    ['bottom', 'top', 'top-left'],
    ['top', 'bottom', 'bottom-left'],
    ['left', 'right', null],
    ['right', 'left', null],
  ] as const) {
    setElementProps(content, { side });
    await flush();
    const tokens = (content.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render(tokens);
      expect(css).toContain(`border-${border}-width: 1px;`);
      if (corner) expect(css).toContain(`border-${corner}-radius: var(--pui-radius-lg);`);
      else expect(css).not.toContain('-radius:');
      // The shared form-control reset emits `padding: 0` unconditionally, so
      // absence of padding tokens is asserted at token granularity instead.
      expect(tokens.some((token) => /^p[trblxy]?-|^px-|^py-|^p-\[/.test(token))).toBe(false);
      expect(css).not.toContain('display: grid;');
      expect(css).not.toContain('Unsupported Proto UI style tokens');
    }
    expect(root.getExposes().open).toBe(open);
    expect(open.get()).toBe(true);
    expect(content.contains(header)).toBe(true);
    expect(header.contains(title)).toBe(true);
  }
});
