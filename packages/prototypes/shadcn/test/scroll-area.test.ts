import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../src/scroll-area';

AdaptToWebComponent(ShadcnScrollAreaRoot);
AdaptToWebComponent(ShadcnScrollAreaViewport);
AdaptToWebComponent(ShadcnScrollAreaScrollbar);
AdaptToWebComponent(ShadcnScrollAreaThumb);
async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) await Promise.resolve();
}
async function settle(): Promise<void> {
  await flush();
  await new Promise((r) => setTimeout(r, 0));
  await flush();
}
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('prototypes/shadcn: scroll-area', () => {
  it('renders root, viewport, scrollbar, thumb with correct entry names and visual grammar', async () => {
    expect(ShadcnScrollAreaRoot.name).toBe('shadcn-scroll-area-root');
    expect(ShadcnScrollAreaViewport.name).toBe('shadcn-scroll-area-viewport');
    expect(ShadcnScrollAreaScrollbar.name).toBe('shadcn-scroll-area-scrollbar');
    expect(ShadcnScrollAreaThumb.name).toBe('shadcn-scroll-area-thumb');

    const root = document.createElement(ShadcnScrollAreaRoot.name) as any;
    const viewport = document.createElement(ShadcnScrollAreaViewport.name) as any;
    const scrollbar = document.createElement(ShadcnScrollAreaScrollbar.name) as any;
    const thumb = document.createElement(ShadcnScrollAreaThumb.name) as any;
    root.appendChild(viewport);
    root.appendChild(scrollbar);
    scrollbar.appendChild(thumb);
    document.body.appendChild(root);
    await settle();

    expect(styleContains(root, 'relative')).toBe(true);
    expect(styleContains(root, 'overflow-hidden')).toBe(true);
    expect(styleContains(viewport, 'h-full')).toBe(true);
    expect(styleContains(viewport, 'w-full')).toBe(true);
    expect(styleContains(scrollbar, 'absolute')).toBe(true);
    expect(styleContains(scrollbar, 'flex')).toBe(true);
    expect(styleContains(thumb, 'rounded-full')).toBe(true);
    expect(styleContains(thumb, 'bg-border')).toBe(true);
  });
});
