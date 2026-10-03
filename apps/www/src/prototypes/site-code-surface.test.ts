import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import SiteCodeSurface from './site-code-surface.proto';
import { BRUTALIST_PANEL_TOKENS } from '../../../../packages/prototypes/brutalist/src/style';

const Surface = AdaptToWebComponent(SiteCodeSurface, { registerAs: 'test-site-code-surface' });
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(() => document.body.replaceChildren());
it('owns only passive family frame/separator paint through canonical tokens', async () => {
  const surface = new Surface();
  document.body.append(surface);
  await settle();
  const update = async (family: string, part: string) => {
    setElementProps(surface, { family, part });
    surface.update();
    await settle();
    return surface.getAttribute('data-pui-style')!.split(/\s+/);
  };
  expect(await update('shadcn', 'frame')).toEqual(
    expect.arrayContaining(['rounded-xl', 'border-border', 'bg-muted'])
  );
  expect(await update('brutalist', 'frame')).toEqual(
    expect.arrayContaining(BRUTALIST_PANEL_TOKENS.split(/\s+/))
  );
  const toolbar = await update('brutalist', 'toolbar');
  expect(toolbar).toContain('border-b-2');
  expect(toolbar).not.toContain('bg-secondary-background');
  expect(toolbar).not.toContain('rounded-xl');
  expect(await update('shadcn', 'toolbar')).toContain('border-b');
  expect(surface.hasAttribute('role')).toBe(false);
  expect(surface.hasAttribute('tabindex')).toBe(false);
  expect(surface.getExposes()).toEqual({});
});
