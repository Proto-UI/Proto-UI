import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertDemoSpec,
  collectPrototypeIds,
  type DemoChild,
  type DemoSetupContext,
} from '../PrototypePreviewer/demo-types';
import {
  assertProjectionRecipeClosure,
  createProjectionComposition,
} from '../PrototypePreviewer/projection-composition';
import { createHomepageShowcase, HOMEPAGE_SHOWCASE_ID } from './homepage-showcase';
import { PREVIEW_SURFACE_ID } from './homepage-live-preview';
import type { RuntimeId } from '../PrototypePreviewer/runtimes/registry';

function mount(runtime: RuntimeId, locale = 'en') {
  let active = true;
  let current = true;
  const content = createHomepageShowcase(
    'shadcn',
    runtime,
    locale,
    () => active,
    () => current
  );
  const refs: Record<string, HTMLElement> = {};
  const props: Record<string, Record<string, unknown>> = {};
  const host = document.createElement('div');
  function render(node: DemoChild, parent: HTMLElement) {
    if (typeof node === 'string' || node.kind === 'text') {
      parent.append(typeof node === 'string' ? node : node.text);
      return;
    }
    const element = document.createElement('div');
    if (node.kind === 'box')
      for (const [name, value] of Object.entries(node.attrs ?? {}))
        element.setAttribute(name, value);
    if (node.ref) {
      refs[node.ref] = element;
      props[node.ref] = node.kind === 'proto' ? { ...node.props } : {};
    }
    for (const child of node.children ?? []) render(child, element);
    parent.append(element);
  }
  render(content.demo.root, host);
  document.body.append(host);
  const api: DemoSetupContext['api'] = {
    call: vi.fn(),
    getExposes: vi.fn(),
    setProps: vi.fn((ref, values) => Object.assign(props[ref]!, values)),
  };
  const cleanup = content.demo.setup!({ host, refs, api })!;
  const event = (ref: string, name: string, detail: Record<string, unknown> = {}) => {
    if (runtime === 'wc') refs[ref]!.dispatchEvent(new CustomEvent(name, { detail }));
    else
      (props[ref]![`on${name[0]!.toUpperCase()}${name.slice(1)}`] as (detail: unknown) => void)(
        detail
      );
  };
  return {
    refs,
    props,
    api,
    event,
    cleanup,
    deactivate: () => {
      active = false;
      current = false;
    },
    lock: () => {
      active = false;
    },
    unlock: () => {
      active = true;
    },
  };
}
afterEach(() => document.body.replaceChildren());

for (const family of ['shadcn', 'brutalist'] as const) {
  it.each(['wc', 'react', 'vue', 'vue2'] as const)(
    `${family}/%s derives the final gallery recipe without unused Select parts`,
    (runtime) => {
      for (const locale of ['en', 'zh-cn']) {
        const content = createHomepageShowcase(family, runtime, locale, () => true);
        assertDemoSpec(content.demo);
        expect(() =>
          assertProjectionRecipeClosure(content.demo.root, content.recipe.prototypeIds, content.recipe.id)
        ).not.toThrow();
        expect(content.recipe.prototypeIds).not.toContain(`${family}-select-label`);
        expect(content.recipe.prototypeIds).not.toContain(`${family}-select-separator`);
        if (family === 'shadcn')
          expect(content.recipe.prototypeIds).toContain('shadcn-select-group');
        const required = `${family}-command-item`;
        expect(content.recipe.prototypeIds).toContain(required);
        expect(() =>
          assertProjectionRecipeClosure(
            content.demo.root,
            content.recipe.prototypeIds.filter((id) => id !== required),
            content.recipe.id
          )
        ).toThrow(`uses undeclared Prototype(s): ${required}`);
        expect(() =>
          assertProjectionRecipeClosure(
            content.demo.root,
            [...content.recipe.prototypeIds, `${family}-select-separator`],
            content.recipe.id
          )
        ).toThrow(`missing required Prototype(s): ${family}-select-separator`);
      }
    }
  );

  it(`${family} has a closed explicit recipe using real lane parts and family-owned passive card surfaces`, () => {
    const content = createHomepageShowcase(family, 'wc', 'en', () => true);
    assertDemoSpec(content.demo);
    const ids = new Set<string>();
    collectPrototypeIds(content.demo.root, ids);
    expect([...ids].sort()).toEqual([...content.recipe.prototypeIds].sort());
    // The closed recipe now includes the actual family Label relation owner.
    expect(ids.size).toBe(family === 'shadcn' ? 64 : 56);
    if (family === 'shadcn') {
      for (const part of ['root', 'header', 'content'])
        expect(ids.has(`shadcn-card-${part}`)).toBe(true);
      expect(ids.has('shadcn-surface-root')).toBe(false);
      expect(ids.has('shadcn-select-group')).toBe(true);
    }
    const sceneIds = [
      'command-root',
      'command-input',
      'command-content',
      'command-item',
      'command-empty',
      'progress-root',
      'progress-label',
      'progress-track',
      'progress-indicator',
      'progress-value',
      'slider-root',
      'slider-track',
      'slider-indicator',
      'slider-thumb',
      'accordion-root',
      'accordion-item',
      'accordion-heading',
      'accordion-trigger',
      'accordion-content',
    ].map((suffix) => `${family}-${suffix}`);
    if (family === 'shadcn') sceneIds.push('shadcn-command-input-wrapper', 'shadcn-input-shell');
    const assertRecipe = (recipe: readonly string[]) => {
      expect(recipe).toHaveLength(ids.size);
      expect(new Set(recipe).size).toBe(recipe.length);
      expect([...recipe].sort()).toEqual([...ids].sort());
      for (const id of sceneIds) expect(recipe.filter((value) => value === id)).toHaveLength(1);
    };
    const recipe = [...content.recipe.prototypeIds];
    assertRecipe(recipe);
    for (const sceneId of sceneIds) {
      expect(() => assertRecipe(recipe.filter((id) => id !== sceneId))).toThrow();
      expect(() => assertRecipe([...recipe, sceneId])).toThrow();
    }
    expect(ids.has(`${family}-label-root`)).toBe(true);
    expect(
      [...ids].every((id) => id.startsWith(`${family}-`) || id === PREVIEW_SURFACE_ID(family))
    ).toBe(true);
    expect(ids.has(`${family}-hover-card-root`)).toBe(true);
    expect(ids.has(`${family}-card-root`)).toBe(family === 'shadcn');
    const composition = createProjectionComposition({
      ownerId: 'settings',
      runtimeId: 'wc',
      projectionFamilyId: family,
      generation: 1,
      componentId: 'button',
      childDemo: content.demo,
      contentRecipe: content.recipe,
      controlIds: [],
      controls: {
        runtime: {
          label: 'Runtime',
          options: [{ value: 'wc', label: 'Web Components' }],
          onValueChange() {},
        },
        family: { label: 'Style', options: [{ value: family, label: family }], onValueChange() {} },
        component: { label: 'Unused', options: [], onValueChange() {} },
      },
    });
    expect(JSON.stringify(composition.demo.root)).toContain(
      `"data-projection-id":"${HOMEPAGE_SHOWCASE_ID}"`
    );
    expect(JSON.stringify(composition.demo.root)).not.toContain('"data-projection-id":"button"');
  });
}

for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
  describe(`${runtime} task event contract`, () => {
    it('shares scene state while preserving authored props and withdrawing callbacks', async () => {
      const task = mount(runtime);
      task.event('composition-command', 'execute', { value: 'prototype' });
      await Promise.resolve();
      expect(task.props['composition-progress']).toMatchObject({ value: 60, min: 0, max: 100 });
      expect(task.props['composition-slider']).toMatchObject({
        value: 60,
        step: 5,
        min: 0,
        max: 100,
      });
      task.event('composition-slider', 'valueChange', { value: 75 });
      await Promise.resolve();
      expect(task.props['composition-progress']!.value).toBe(75);
      task.lock();
      task.event('composition-command', 'execute', { value: 'review' });
      await Promise.resolve();
      expect(task.props['composition-progress']!.value).toBe(75);
      task.unlock();
      for (let count = 0; count < 3; count++) {
        task.event('composition-reset', 'click');
        await Promise.resolve();
        expect(task.props['composition-progress']!.value).toBe(40);
      }
      task.event('composition-command', 'execute', { value: 'review' });
      const beforeWithdrawal = task.props['composition-progress']!.value;
      task.deactivate();
      task.cleanup();
      task.event('composition-reset', 'click');
      await Promise.resolve();
      expect(task.props['composition-progress']!.value).toBe(beforeWithdrawal);
    });
    it('edits, saves an actual page-local snapshot, restores defaults and saves again', async () => {
      const task = mount(runtime);
      expect(task.props['settings-save']!.disabled).toBe(true);
      task.event('settings-view', 'valueChange', { value: 'board' });
      task.event('settings-summary', 'checkedChange', { checked: true });
      task.event('settings-note', 'valueChange', { value: 'Plan', composing: false });
      await Promise.resolve();
      expect(task.refs.settings!.dataset.dirty).toBe('true');
      expect(task.props['settings-view']!.value).toBe('board');
      expect(task.props['settings-summary']!.checked).toBe(true);
      expect(task.props['settings-note']!.value).toBe('Plan');
      expect(task.refs['settings-count']!.textContent).toBe('4 / 240 characters');
      task.event('settings-save', 'click');
      await Promise.resolve();
      expect(task.refs.settings!.dataset.dirty).toBe('false');
      expect(task.refs['settings-feedback']!.textContent).toBe(
        'Saved to this page · Push · Weekly summary on · Note: 4 characters'
      );
      expect(task.props['settings-save']!.disabled).toBe(true);
      task.event('settings-reset', 'click');
      await Promise.resolve();
      expect(task.props['settings-view']!.value).toBe('list');
      expect(task.props['settings-summary']!.checked).toBe(false);
      expect(task.props['settings-note']!.value).toBe('');
      expect(task.refs.settings!.dataset.dirty).toBe('true');
      expect(task.props['settings-reset']!.disabled).toBe(true);
      task.event('settings-save', 'click');
      await Promise.resolve();
      expect(task.refs['settings-feedback']!.textContent).toBe(
        'Saved to this page · Email · Weekly summary off · Note: 0 characters'
      );
      task.cleanup();
      task.cleanup();
    });

    it('reverts dirty state, rejects invalid inputs and blocks partial IME saves', async () => {
      const task = mount(runtime, 'zh-cn');
      task.event('settings-view', 'valueChange', { value: 'invalid' });
      task.event('settings-summary', 'checkedChange', { checked: 'true' });
      expect(task.refs.settings!.dataset.dirty).toBe('false');
      task.event('settings-summary', 'checkedChange', { checked: true });
      task.event('settings-summary', 'checkedChange', { checked: false });
      expect(task.refs.settings!.dataset.dirty).toBe('false');
      task.event('settings-note', 'compositionStart');
      task.event('settings-note', 'valueChange', { value: '备', composing: true });
      await Promise.resolve();
      expect(task.props['settings-save']!.disabled).toBe(true);
      task.event('settings-save', 'click');
      await Promise.resolve();
      expect(task.refs['settings-feedback']!.textContent).toBe('有未保存的更改');
      task.event('settings-note', 'compositionEnd', { value: '备注' });
      await Promise.resolve();
      expect(task.props['settings-save']!.disabled).toBe(false);
      task.event('settings-save', 'click');
      await Promise.resolve();
      expect(task.refs['settings-feedback']!.textContent).toContain('备注 2 字');
      task.cleanup();
    });

    if (runtime === 'wc' || runtime === 'react') {
      it('coalesces owner feedback without entering props during the outward callback', async () => {
        const task = mount(runtime);
        await Promise.resolve();
        vi.mocked(task.api.setProps).mockClear();
        task.event('settings-view', 'valueChange', { value: 'board' });
        task.event('settings-summary', 'checkedChange', { checked: true });
        task.event('settings-note', 'valueChange', { value: 'First' });
        task.event('settings-note', 'valueChange', { value: 'Latest' });
        expect(task.api.setProps).not.toHaveBeenCalled();
        task.lock();
        await Promise.resolve();
        expect(task.props['settings-view']!.value).toBe('board');
        expect(task.props['settings-summary']!.checked).toBe(true);
        expect(task.props['settings-note']!.value).toBe('Latest');
        expect(
          vi.mocked(task.api.setProps).mock.calls.filter(([ref]) => ref === 'settings-note')
        ).toHaveLength(1);
        // Failed replacement retains this generation, including accepted input.
        task.unlock();
        task.event('settings-save', 'click');
        await Promise.resolve();
        expect(task.refs.settings!.dataset.dirty).toBe('false');
        expect(task.refs['settings-feedback']!.textContent).toContain('Note: 6 characters');
        task.cleanup();
      });

      it('revokes pending owner feedback on supersession or unmount', async () => {
        for (const dispose of [false, true]) {
          const task = mount(runtime);
          await Promise.resolve();
          task.event('settings-view', 'valueChange', { value: 'calendar' });
          task.event('settings-summary', 'checkedChange', { checked: true });
          task.event('settings-note', 'valueChange', { value: 'Queued' });
          if (dispose) task.cleanup();
          else task.deactivate();
          await Promise.resolve();
          expect(task.props['settings-view']!.value).toBe('list');
          expect(task.props['settings-summary']!.checked).toBe(false);
          expect(task.props['settings-note']!.value).toBe('');
          task.cleanup();
        }
      });
    }

    it('gates stale events, cleans subscriptions and starts the next mount at defaults', async () => {
      const task = mount(runtime);
      task.event('settings-note', 'valueChange', { value: 'Unsaved' });
      await Promise.resolve();
      task.deactivate();
      task.event('settings-save', 'click');
      await Promise.resolve();
      task.event('settings-reset', 'click');
      await Promise.resolve();
      task.event('settings-note', 'valueChange', { value: 'Stale' });
      expect(task.props['settings-note']!.value).toBe('Unsaved');
      expect(task.refs.settings!.dataset.dirty).toBe('true');
      task.cleanup();
      task.event('settings-note', 'valueChange', { value: 'After cleanup' });
      expect(task.props['settings-note']!.value).toBe('Unsaved');
      const next = mount(runtime);
      expect(next.props['settings-note']!.value).toBe('');
      expect(next.refs.settings!.dataset.dirty).toBe('false');
      next.cleanup();
    });
  });
}

it('ignores the native click when WC emits its protocol click', () => {
  const task = mount('wc');
  task.event('settings-note', 'valueChange', { value: 'Draft' });
  task.refs['settings-save']!.dispatchEvent(new MouseEvent('click'));
  expect(task.refs.settings!.dataset.dirty).toBe('true');
  task.event('settings-save', 'click');
  expect(task.refs.settings!.dataset.dirty).toBe('false');
  task.cleanup();
});

for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
  it(`${runtime}: gallery compositions have real independent task results and revoke stale work`, async () => {
    const gallery = mount(runtime);
    gallery.event('gallery-primary', 'click');
    expect(gallery.refs['gallery-controls-feedback']!.textContent).toBe(
      'Primary button: Activated'
    );
    gallery.event('editor-text', 'valueChange', { value: 'Editable result' });
    gallery.event('editor-bold', 'activeChange', { active: true });
    await Promise.resolve();
    expect(gallery.props['editor-text']!.value).toBe('Editable result');
    expect(gallery.refs['editor-preview']!.textContent).toBe('Editable result');
    expect(gallery.props['editor-preview-text']!.weight).toBe('bold');
    gallery.event('gallery-menu-add', 'select', { value: 'add' });
    expect(gallery.refs['gallery-dialog-feedback']!.textContent).toBe('Copies: 1');
    gallery.event('gallery-confirm', 'click');
    expect(gallery.refs['gallery-dialog-feedback']!.textContent).toBe('Confirmed');
    gallery.event('choice-product', 'checkedChange', { checked: false });
    gallery.event('choice-apply', 'click');
    expect(gallery.refs['choice-feedback']!.textContent).toBe('Applied 1 selections');
    gallery.deactivate();
    gallery.event('gallery-menu-add', 'select');
    expect(gallery.refs['gallery-dialog-feedback']!.textContent).toBe('Confirmed');
    gallery.cleanup();
  });
}
