import { afterEach, expect, it } from 'vitest';
import { getElementProps, setElementProps } from '@proto.ui/adapter-web-component';
import { renderDemo } from '../PrototypePreviewer/demo-renderer';
import { loadPrototypes } from '../PrototypePreviewer/prototype-modules';
import { createHomepageShowcase } from './homepage-showcase';
import { homepageButtonVariant } from './homepage-button-variants';
import { installGeneratedProtoUiStylesheet } from '../../../test/helpers/generated-stylesheet';
import type { ProjectionFamilyId } from '../PrototypePreviewer/projection-families';

/**
 * Each family's declared Button `variant` enum, transcribed from that
 * family's own `def.props.define` options. Keeping this independent of the
 * shared mapping table lets the assertion below catch a mapping entry that
 * names a variant the family does not declare.
 */
const BUTTON_VARIANT_OPTIONS: Readonly<Record<ProjectionFamilyId, readonly string[]>> = {
  shadcn: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
  brutalist: ['solid', 'surface', 'destructive'],
  'bootstrap-2-3-2': ['default', 'primary', 'warning', 'danger', 'success', 'info', 'inverse'],
  'liquid-glass': ['regular', 'prominent'],
};

// Identify passive copy by its authored role within each card. For mutable copy the
// ref distinguishes the intended owner even when two fields have the same role.
const CARD_TEXT_OWNERS: Record<string, Record<string, number>> = {
  controls: { '[data-demo-ref="gallery-controls-feedback"][role="status"]': 1 },
  shortcuts: { '.home-gallery__shortcut-title': 4 },
  editor: {
    '.home-gallery__title': 1,
    '.home-gallery__caption': 1,
    '[data-demo-ref="editor-preview"]': 1,
  },
  milestones: {
    '.home-gallery__title': 1,
    '.home-gallery__caption': 4,
    '.home-gallery__eyebrow': 6,
    '.home-gallery__submetric': 3,
  },
  spark: {
    '.home-gallery__title': 1,
    '[data-demo-ref="gallery-spark-metric"]': 1,
    '[data-demo-ref="gallery-spark-badge"]': 1,
  },
  ecosystem: {
    '.home-gallery__title': 1,
    '.home-gallery__caption': 5,
    '.home-gallery__stat-value': 4,
  },
  preferences: {
    '.home-gallery__title': 1,
    '.home-gallery__caption': 1,
    '.home-settings__label': 3,
    '[data-demo-ref="settings-count"]': 1,
    '[data-demo-ref="settings-feedback"][role="status"]': 1,
  },
  overlays: {
    '.home-gallery__title': 1,
    '.home-gallery__caption': 1,
    '[data-demo-ref="gallery-dialog-feedback"][role="status"]': 1,
  },
  protocol: {
    '.home-gallery__title': 1,
    '.home-gallery__caption': 1,
    '.home-settings__label': 2,
    '[data-demo-ref="gallery-protocol-status"][role="status"]': 1,
  },
  hover: { '.home-gallery__title': 2, '.home-gallery__caption': 1, '.home-gallery__copy': 1 },
  highlights: {
    '.home-gallery__title': 1,
    '.home-gallery__caption': 3,
    '.home-gallery__stat-value': 2,
  },
  choices: {
    '.home-gallery__title': 1,
    '.home-gallery__caption': 1,
    '.home-gallery__choice-desc': 3,
    '[data-demo-ref="choice-feedback"][role="status"]': 1,
  },
  throughput: {
    '.home-gallery__title': 1,
    '.home-gallery__caption': 2,
    '.home-gallery__chart-label': 8,
    '.home-gallery__eyebrow': 2,
    '.home-gallery__stat-value': 2,
  },
};

let rendered: Awaited<ReturnType<typeof renderDemo>> | undefined;
afterEach(async () => {
  await rendered?.destroy();
  rendered = undefined;
  document.body.replaceChildren();
});
// The published page loads the generated token sheet, and a host that only
// declares `relative` becomes a positioned padding box through that rule.
installGeneratedProtoUiStylesheet();
for (const family of ['shadcn', 'brutalist', 'bootstrap-2-3-2'] as const) {
  it(`${family} retains full editor and preferences props through edits and resets`, async () => {
    const content = createHomepageShowcase(family, 'wc', 'en', () => true);
    await loadPrototypes([...content.recipe.prototypeIds]);
    const host = document.createElement('div');
    document.body.append(host);
    rendered = await renderDemo({ runtime: 'wc', demo: content.demo, host });
    const ref = (name: string) => host.querySelector<HTMLElement>(`[data-demo-ref="${name}"]`)!;
    const input = (name: string) => ref(name).querySelector<HTMLTextAreaElement>('textarea')!;
    const settle = async () => {
      for (let i = 0; i < 16; i++) await Promise.resolve();
    };
    const verify = () => {
      if (family === 'shadcn') {
        for (const name of ['settings-note', 'editor-text']) {
          const tokens = input(name).getAttribute('data-pui-style')?.split(/\s+/) ?? [];
          expect(tokens).toContain('rounded-[var(--pui-radius-2xl)]');
          expect(tokens).toContain('resize-none');
          expect(tokens).toContain('bg-input/50');
          expect(tokens).not.toContain('resize-y');
          expect(tokens).not.toContain('shadow-xs');
          expect(getElementProps(ref(name))).not.toHaveProperty('styleProfile');
        }
        const tabsList = host.querySelector<HTMLElement>('wc-shadcn-tabs-list')!;
        expect(tabsList.getAttribute('data-pui-style')?.split(/\s+/)).toContain('rounded-full');
        expect(getElementProps(tabsList)).not.toHaveProperty('styleProfile');
      }
      for (const name of ['settings-save', 'settings-reset', 'editor-reset']) {
        // Family-owned wrapping replaces homepage numeric height overrides.
        expect(getElementProps(ref(name))).toMatchObject({ wrap: true });
        for (const property of ['height', 'minHeight', 'whiteSpace', 'overflowWrap'] as const)
          expect(ref(name).style[property]).toBe('');
        const tokens = (ref(name).getAttribute('data-pui-style') ?? '').split(/\s+/);
        expect(tokens).toContain('h-auto');
        expect(tokens).toContain('whitespace-normal');
        expect(tokens).not.toContain('whitespace-nowrap');
        expect(tokens).toContain(
          family === 'brutalist' ? 'min-h-10' : family === 'shadcn' ? 'min-h-9' : 'min-h-8'
        );
      }
      expect(Number(input('editor-text').rows)).toBe(4);
      expect(input('editor-text').getAttribute('aria-label')).toBe('Edit example text');
      expect(Number(input('settings-note').rows)).toBe(3);
      expect(Number(input('settings-note').maxLength)).toBe(240);
      expect(input('settings-note').placeholder).toBe('Add a note for this example');
      expect(input('settings-note').getAttribute('aria-label')).toBe('Additional note');
      expect(getElementProps(ref('settings-view'))).toMatchObject({ closeOnSelect: true });
      expect(getElementProps(ref('settings-reset'))).toMatchObject({
        variant: homepageButtonVariant(family, 'secondary'),
      });
      // The authored variant must be a name this family actually declares, so
      // an unknown entry cannot silently fall back to the family default.
      expect(BUTTON_VARIANT_OPTIONS[family]).toContain(homepageButtonVariant(family, 'secondary'));
    };
    await settle();
    verify();
    const assertTextOwners = () => {
      // Direct WC rendering retains authored boxes inside detached content hosts.
      const owners = [...host.querySelectorAll('[data-home-text]')];
      const cardId = (owner: Element) =>
        owner.closest('[data-gallery-demo]')?.getAttribute('data-gallery-demo');
      const ownersOf = (id: string) => owners.filter((owner) => cardId(owner) === id);
      for (const [id, roles] of Object.entries(CARD_TEXT_OWNERS)) {
        const cardOwners = ownersOf(id);
        for (const [selector, count] of Object.entries(roles)) {
          const matches = cardOwners.filter((owner) => owner.matches(selector));
          expect(matches, `${id} ${selector}`).toHaveLength(count);
        }
        expect(cardOwners, id).toHaveLength(Object.values(roles).reduce((sum, n) => sum + n, 0));
      }
      for (const [id, title] of Object.entries({
        milestones: 'Release milestones',
        ecosystem: 'Adapter parity',
        protocol: 'Quick setup',
        highlights: 'Architecture notes',
        throughput: 'Component matrix',
      })) {
        const cardOwners = ownersOf(id);
        const heading = cardOwners.find((owner) => owner.matches('[role="heading"]'));
        expect(heading?.textContent?.trim(), id).toBe(title);
      }
      const scenes = {
        'workspace-command': [
          'What comes next?',
          'Find a step to update the plan on this page.',
          'Page-only demo. No external actions.',
        ],
        'workspace-progress': [
          'Plan threshold',
          'Drag or use arrow keys to adjust your plan.',
          'Current progress',
          '40%',
          '0% (MIN)',
          '100% (MAX)',
          'Plan progress: 40%',
        ],
        'workspace-analytics': [
          'Plan rhythm',
          'Six stages. One idea taking shape.',
          'Idea',
          'Plan',
          'Build',
          'Refine',
          'Review',
          'Done',
          'Up next',
          'Build a prototype',
          'Plan complete',
          '40%',
          'Still to explore',
          '60%',
        ],
        'workspace-help': [
          'A little help along the way',
          'Open a question and keep exploring.',
          'Choose a result in the step finder, or adjust the progress. Both scenes use the same page-local plan.',
          'Use Tab to move focus, arrows and Enter to choose search results, and arrows to adjust the slider.',
          'This is an interactive example on the current page. Nothing is uploaded, published or saved to an account. Reloading restores the defaults.',
        ],
      };
      const expectedCards = [...Object.keys(CARD_TEXT_OWNERS), ...Object.keys(scenes)].sort();
      expect([...host.querySelectorAll('[data-gallery-demo]')].map(cardId).sort()).toEqual(
        expectedCards
      );
      expect([...new Set(owners.map(cardId))].sort()).toEqual(expectedCards);
      for (const [id, texts] of Object.entries(scenes)) {
        const actual = ownersOf(id);
        expect(
          actual.map((owner) => owner.textContent?.trim()),
          id
        ).toEqual(texts);
      }
      for (const owner of owners) {
        const roots = owner.querySelectorAll('[data-pui-root]');
        expect(roots).toHaveLength(1);
        const text = roots[0]!;
        expect(text.localName).toBe(`wc-${family}-text-root`);
        expect(text.getAttribute('data-pui-style')).toContain('font-');
        expect(text.querySelectorAll('[data-home-text-slot]')).toHaveLength(1);
      }
    };
    const shortcutTile = host.querySelector('[data-gallery-demo="shortcuts"]')!;
    const groups = shortcutTile.querySelectorAll('[role="group"]');
    expect(groups).toHaveLength(4);
    for (const group of groups) {
      const items = group.querySelectorAll('[role="button"][aria-pressed]');
      expect(items).toHaveLength(4);
      for (const item of items) {
        expect(item.querySelector('svg')).not.toBeNull();
        expect(
          item.querySelector('.home-gallery__shortcut-text')?.textContent?.trim()
        ).toBeTruthy();
      }
    }
    const cardsShortcut = ref('shortcut-prototypes-cards');
    cardsShortcut.click();
    await settle();
    expect(cardsShortcut.getAttribute('aria-pressed')).toBe('true');
    expect(ref('shortcut-prototypes-buttons').getAttribute('aria-pressed')).toBe('false');
    assertTextOwners();
    // Remove the existing feedback owner from Controls while keeping its Text and the
    // gallery-wide inventory intact. The observer must identify the missing Controls role.
    const feedback = ref('gallery-controls-feedback');
    const parent = feedback.parentElement!;
    const next = feedback.nextSibling;
    ref('choice-feedback').after(feedback);
    try {
      expect(assertTextOwners).toThrow(/gallery-controls-feedback/);
    } finally {
      parent.insertBefore(feedback, next);
    }
    // Four formerly passive Text slots are now real Label prototypes. Keep
    // their own identity and exact one-control naming edges in the inventory.
    const labels = Array.from(host.querySelectorAll<HTMLElement>(`wc-${family}-label-root`));
    const expectedLabels = [
      ['gallery-checkbox', 'Select'],
      ['choice-product', 'Product updates'],
      ['choice-components', 'New components'],
      ['choice-events', 'Community events'],
    ] as const;
    const verifyLabels = () => {
      expect(labels).toHaveLength(4);
      const ids = labels.map((label) => label.id);
      expect(new Set(ids).size).toBe(4);
      expect(ids.every(Boolean)).toBe(true);
      for (const [name, text] of expectedLabels) {
        const control = ref(name);
        const label = labels.find((label) => label.textContent?.trim() === text)!;
        expect(label, text).toBeDefined();
        expect(label.hasAttribute('data-pui-root')).toBe(true);
        expect(label.closest('[data-home-text]')).toBeNull();
        expect(label.getAttribute('data-pui-style')).toContain('font-');
        expect(control.getAttribute('role')).toBe('checkbox');
        expect(control.getAttribute('aria-labelledby')?.split(/\s+/)).toEqual([label.id]);
        for (const other of labels.filter((other) => other !== label)) {
          expect(control.getAttribute('aria-labelledby')?.split(/\s+/)).not.toContain(other.id);
        }
      }
    };
    verifyLabels();
    // Bounded observer negative controls: a missing or cross-wired relation
    // must be detected even when every Label is still present.
    const labelledControl = ref('gallery-checkbox');
    const originalRelation = labelledControl.getAttribute('aria-labelledby')!;
    labelledControl.removeAttribute('aria-labelledby');
    expect(verifyLabels).toThrow();
    labelledControl.setAttribute(
      'aria-labelledby',
      labels.find((label) => label.textContent?.trim() === 'Product updates')!.id
    );
    expect(verifyLabels).toThrow();
    labelledControl.setAttribute('aria-labelledby', originalRelation);
    verifyLabels();
    for (const tile of host.querySelectorAll('[data-gallery-demo]')) {
      const id = tile.getAttribute('data-gallery-demo');
      const surface = tile.querySelector('[data-pui-root]')!;
      if (family === 'shadcn') {
        expect(surface.localName).toBe('wc-shadcn-card-root');
        expect(getElementProps(surface as HTMLElement)).toMatchObject({ styleProfile: 'luma' });
        const headless =
          id === 'controls' || id === 'shortcuts' || id === 'hover' || id === 'overlays';
        expect(tile.querySelectorAll('wc-shadcn-card-header').length).toBe(headless ? 0 : 1);
        expect(tile.querySelectorAll('wc-shadcn-card-content').length).toBeGreaterThanOrEqual(1);
        const tokens = surface.getAttribute('data-pui-style')?.split(/\s+/) ?? [];
        expect(tokens).toContain('rounded-[var(--pui-radius-4xl)]');
        expect(tokens).toContain(id === 'shortcuts' ? 'py-4' : 'py-6');
        expect(tokens).toContain('shadow-md');
        expect(tokens).toContain('ring-1');
        for (const property of ['padding', 'borderRadius', 'background', 'boxShadow'] as const)
          expect((surface as HTMLElement).style[property]).toBe('');
      } else if (family === 'brutalist') {
        expect(surface.localName).toBe('wc-brutalist-card-root');
        const tokens = surface.getAttribute('data-pui-style')?.split(/\s+/) ?? [];
        expect(tokens).toContain('border-2');
        expect(tokens).toContain('shadow-[4px_4px_0_0_#000]');
      } else {
        expect(getElementProps(surface as HTMLElement)).toMatchObject({
          variant: 'outline',
          elevation: 'raised',
        });
        expect(surface.getAttribute('data-pui-style')?.includes('shadow-')).toBe(true);
      }
    }
    if (family === 'brutalist') {
      const tabsList = host.querySelector<HTMLElement>('[role="tablist"]')!;
      expect(tabsList).not.toBeNull();
      expect(host.querySelectorAll('[role="tab"]')).toHaveLength(2);
      expect(tabsList.style.flexWrap).toBe('wrap');
      expect(tabsList.style.height).toBe('auto');
      expect(tabsList.style.minHeight).toBe('3rem');
      for (const trigger of host.querySelectorAll<HTMLElement>('[role="tab"]')) {
        expect(trigger.style.whiteSpace).toBe('normal');
        expect(trigger.style.maxWidth).toBe('100%');
      }
      const authored = content.demo.root;
      const visit = (node: unknown): any[] => {
        if (!node || typeof node !== 'object') return [];
        const value = node as { prototypeId?: string; children?: unknown[] };
        return [
          ...(value.prototypeId === 'brutalist-dialog-trigger' ? [value] : []),
          ...(value.children ?? []).flatMap(visit),
        ];
      };
      expect(visit(authored)[0].children).toEqual(['Open dialog']);
    }
    for (const name of ['editor-text', 'settings-note']) {
      const node = input(name);
      node.value = 'A meaningful edit';
      node.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: node.value, inputType: 'insertText' })
      );
      await settle();
      expect(node.value).toBe('A meaningful edit');
      verify();
    }
    if (family === 'shadcn') {
      const editor = input('editor-text');
      const card = ref('editor-text').closest<HTMLElement>('wc-shadcn-card-root')!;
      const tabsList = card.querySelector<HTMLElement>('wc-shadcn-tabs-list')!;
      for (const styleProfile of ['new-york-v4', 'luma'] as const) {
        setElementProps(card, { styleProfile });
        await settle();
        expect(input('editor-text')).toBe(editor);
        expect(editor.value).toBe('A meaningful edit');
        const tokens = editor.getAttribute('data-pui-style')?.split(/\s+/) ?? [];
        expect(tokens).toContain(styleProfile === 'luma' ? 'resize-none' : 'resize-y');
        expect(tokens).not.toContain(styleProfile === 'luma' ? 'resize-y' : 'resize-none');
        expect(tabsList.getAttribute('data-pui-style')?.split(/\s+/)).toContain(
          styleProfile === 'luma' ? 'rounded-full' : 'rounded-lg'
        );
        expect(getElementProps(ref('editor-text'))).not.toHaveProperty('styleProfile');
        expect(getElementProps(tabsList)).not.toHaveProperty('styleProfile');
      }
      const select = ref('settings-view');
      const trigger = ref('settings-view-trigger');
      const settingsCard = select.closest<HTMLElement>('wc-shadcn-card-root')!;
      const note = input('settings-note');
      for (const styleProfile of ['new-york-v4', 'luma'] as const) {
        setElementProps(settingsCard, { styleProfile });
        await settle();
        expect(ref('settings-view')).toBe(select);
        expect(ref('settings-view-trigger')).toBe(trigger);
        expect(input('settings-note')).toBe(note);
        expect(note.value).toBe('A meaningful edit');
        expect(getElementProps(select)).not.toHaveProperty('styleProfile');
        expect(getElementProps(trigger)).not.toHaveProperty('styleProfile');
        expect(trigger.getAttribute('data-pui-style')?.split(/\s+/)).toContain(
          styleProfile === 'luma' ? 'rounded-[var(--pui-radius-3xl)]' : 'rounded-md'
        );
        expect(trigger.getAttribute('data-pui-style')?.split(/\s+/)).toContain('h-9');
      }
      verify();
    }
    ref('editor-reset').click();
    await settle();
    expect(input('editor-text').value).toBe('Compose your interface from the same prototypes.');
    verify();
    ref('settings-reset').click();
    await settle();
    expect(input('settings-note').value).toBe('');
    verify();
  }, 20000);
}
