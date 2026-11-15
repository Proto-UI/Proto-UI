import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderProtoStyleTokenCss } from '../../../../../../packages/cli/src/services/proto-style-css';
import { createControlLabelDemo } from '../../../components/PrototypePreviewer/control-label-demo';
import { renderDemo } from '../../../components/PrototypePreviewer/demo-renderer';
import {
  assertDemoSpec,
  collectPrototypeIds,
  type DemoRenderResult,
  type DemoSpec,
} from '../../../components/PrototypePreviewer/demo-types';
import { loadPrototype } from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import baseDemo from './demo-base-label.demo';
import shadcnDemo from './demo-shadcn-label.demo';
import brutalistDemo from './demo-brutalist-label.demo';

const families = ['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'];
const views: DemoRenderResult[] = [];

// Rhea's self-region needs the positioned principal box authored by its
// relative/inline-flex tokens. Supply their emitted rules before mounting the
// real WC recipes, and retain the stylesheet until every view has retired.
const recipeSheet = document.createElement('style');
beforeAll(() => {
  // happy-dom needs the emitted rules outside their cascade-layer wrapper.
  recipeSheet.textContent = renderProtoStyleTokenCss(['relative', 'inline-flex'])
    .replace('@layer proto-ui {', '')
    .replace(/}\s*$/, '');
  document.head.append(recipeSheet);
});
afterAll(() => recipeSheet.remove());

afterEach(async () => {
  for (const view of views.splice(0).reverse()) await view.destroy();
  document.body.replaceChildren();
});

async function mountLabelDemo(demo: DemoSpec) {
  const ids = new Set<string>();
  collectPrototypeIds(demo.root, ids);
  for (const id of ids) await loadPrototype(id);
  const host = document.createElement('div');
  document.body.append(host);
  const view = await renderDemo({ runtime: 'wc', host, demo });
  views.push(view);
  return { host, view };
}

// Synthetic host-unit input, not browser-generated input or AT evidence.
function pointerClick(element: HTMLElement) {
  for (const type of ['pointerdown', 'pointerup'])
    element.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        composed: true,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        buttons: type === 'pointerdown' ? 1 : 0,
        clientX: 10,
        clientY: 10,
      })
    );
  element.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
  );
}

describe('public independent Label recipes and docs', () => {
  it.each(families)(
    '%s has a real public loader, explicit association recipe and bilingual reader page',
    async (family) => {
      const id = `${family}-label-root`;
      await loadPrototype(id);
      expect(getPrototype(id).name).toBe(id);
      const demo = createControlLabelDemo(id);
      assertDemoSpec(demo);
      const ids = new Set<string>();
      collectPrototypeIds(demo.root, ids);
      expect(ids).toEqual(
        new Set([
          id,
          'base-checkbox-root',
          'base-switch-root',
          'base-radio-group-root',
          'base-radio-group-item',
          'base-input-root',
          'base-textarea-root',
        ])
      );
      for (const locale of ['en', 'zh-cn']) {
        const folder = family === 'brutalist' ? 'brutalist/components' : family;
        const page = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${folder}/label.mdx`,
          'utf8'
        );
        expect(page).toContain(`demo-${family}-label`);
        expect(page).toContain('draft');
        expect(page).toContain('instanceAssociations');
        expect(page).toContain("'wc', 'react', 'vue', 'vue2'");
      }
    }
  );
  it('homepage visible Checkbox names use the public associated Label rather than a hidden copy', () => {
    const source = readFileSync(
      'apps/www/src/components/Homepage/homepage-gallery-parts.ts',
      'utf8'
    );
    const helper = source.slice(
      source.indexOf('const checkbox ='),
      source.indexOf('const status =')
    );
    expect(helper).toContain('label-root');
    expect(helper).toContain('choice:${ref}');
    expect(helper).not.toContain('sr-only');
  });

  it.each([
    { family: 'base', demo: baseDemo },
    { family: 'shadcn', demo: shadcnDemo },
    { family: 'brutalist', demo: brutalistDemo },
  ])(
    '$family public consumer isolates proposals and retires its old pair',
    async ({ family, demo }) => {
      // Render the actual exported recipe twice: identical data association keys
      // must never join two App Maker instances or their outward callbacks.
      const first = await mountLabelDemo(demo);
      const second = await mountLabelDemo(demo);
      const firstLabel = first.host.querySelector<HTMLElement>(
        '[data-demo-ref="label-controlled"]'
      )!;
      const secondLabel = second.host.querySelector<HTMLElement>(
        '[data-demo-ref="label-controlled"]'
      )!;
      const firstControl = first.host.querySelector<HTMLElement>('[data-demo-ref="controlled"]')!;
      const secondControl = second.host.querySelector<HTMLElement>('[data-demo-ref="controlled"]')!;
      const firstRequests = first.host.querySelector('[data-demo-ref="controlled-requests"]')!;
      const secondRequests = second.host.querySelector('[data-demo-ref="controlled-requests"]')!;
      const firstSwitch = first.host.querySelector<HTMLElement>('[data-demo-ref="switch"]')!;
      const secondSwitch = second.host.querySelector<HTMLElement>('[data-demo-ref="switch"]')!;
      await vi.waitFor(() => {
        expect(firstLabel.id).not.toBe('');
        expect(secondLabel.id).not.toBe(firstLabel.id);
        expect(firstControl.getAttribute('aria-labelledby')).toBe(firstLabel.id);
        expect(secondControl.getAttribute('aria-labelledby')).toBe(secondLabel.id);
        if (family === 'shadcn') {
          for (const root of [firstSwitch, secondSwitch]) {
            const computed = getComputedStyle(root);
            expect(computed.display).toBe('inline-flex');
            expect(computed.position).toBe('relative');
            expect(root.getAttribute('data-pui-static-hit')).toMatch(/^\d+$/);
          }
          expect(firstSwitch.getAttribute('data-pui-static-hit')).not.toBe(
            secondSwitch.getAttribute('data-pui-static-hit')
          );
        }
      });
      const secondHitId = secondSwitch.getAttribute('data-pui-static-hit');

      pointerClick(firstLabel);
      await vi.waitFor(() => expect(firstRequests.textContent).toBe('Requests: 1'));
      expect(firstControl.getAttribute('aria-checked')).toBe('false');
      expect(secondRequests.textContent).toBe('Requests: 0');
      expect(secondControl.getAttribute('aria-checked')).toBe('false');

      views.splice(views.indexOf(first.view), 1);
      await first.view.destroy();
      if (family === 'shadcn') {
        await vi.waitFor(() => {
          expect(firstSwitch.hasAttribute('data-pui-static-hit')).toBe(false);
          expect(secondSwitch.getAttribute('data-pui-static-hit')).toBe(secondHitId);
        });
      }
      pointerClick(firstLabel);
      pointerClick(secondLabel);
      await vi.waitFor(() => expect(secondRequests.textContent).toBe('Requests: 1'));
      expect(firstRequests.textContent).toBe('Requests: 1');
      expect(secondControl.getAttribute('aria-checked')).toBe('false');
      expect(secondControl.getAttribute('aria-labelledby')).toBe(secondLabel.id);
    }
  );
});
