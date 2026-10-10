import { afterEach, expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import { asCarouselPrevious } from '@proto.ui/prototypes-base/carousel';
import * as shadcn from '@proto.ui/prototypes-shadcn/carousel';
import * as brutalist from '@proto.ui/prototypes-brutalist/carousel';
import * as bootstrap from '@proto.ui/prototypes-bootstrap-2-3-2/carousel';
import * as liquid from '@proto.ui/prototypes-liquid-glass/carousel';
const families = { shadcn, brutalist, 'bootstrap-2-3-2': bootstrap, 'liquid-glass': liquid };
const flush = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
for (const [family, atoms] of Object.entries(families)) {
  for (const proto of new Set(Object.values(atoms)))
    if (proto && typeof proto === 'object' && 'setup' in proto)
      AdaptToWebComponent(proto as any, { registerAs: `audit-${(proto as any).name}` });
  it(`${family}: disabled navigation has inherited fact and must register family feedback`, async () => {
    const root = document.createElement(`audit-${family}-carousel-root`);
    const viewport = document.createElement(`audit-${family}-carousel-viewport`);
    const slide = document.createElement(`audit-${family}-carousel-slide`);
    const previous = document.createElement(`audit-${family}-carousel-previous`) as any;
    viewport.append(slide);
    root.append(viewport, previous);
    document.body.append(root);
    await flush();
    expect(previous.getExposes().disabled.get()).toBe(true);
    expect(previous.getAttribute('aria-disabled')).toBe('true');
    const style = previous.getAttribute('data-pui-style') ?? '';
    console.log(family, JSON.stringify({ disabled: previous.getExposes().disabled.get(), style }));
    expect(style.split(/\s+/), 'required disabled family rule is not registered').toContain(
      'data-[disabled]:opacity-50'
    );
  });
}
it('control: legal nested capture registers disabled style without compiler changes', async () => {
  let captured: any;
  AdaptToWebComponent(
    definePrototype({
      name: 'audit-nested-navigation-control',
      setup(def) {
        const inherited = asCarouselPrevious();
        captured = inherited;
        const button = inherited.getAsHookHandle?.('as-button');
        if (!button?.stateHandles) throw new Error('Required nested Button state is unavailable');
        def.rule({
          when: (w) => w.state(button.stateHandles!.disabled).eq(true),
          intent: (i) => i.feedback.style.use(tw('opacity-50')),
        });
        return inherited.render;
      },
    })
  );
  const root = document.createElement('audit-shadcn-carousel-root');
  const viewport = document.createElement('audit-shadcn-carousel-viewport');
  viewport.append(document.createElement('audit-shadcn-carousel-slide'));
  const previous = document.createElement('audit-nested-navigation-control') as any;
  root.append(viewport, previous);
  document.body.append(root);
  await flush();
  expect(captured.stateHandles).toBeUndefined();
  expect(captured.getAsHookHandle('as-button').stateHandles.disabled.get()).toBe(true);
  expect(previous.getAttribute('data-pui-style').split(/\s+/)).toContain(
    'data-[disabled]:opacity-50'
  );
});
