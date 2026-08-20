import { describe, it, expect } from 'vitest';
import type { DefHandle, Prototype } from '@proto.ui/core';
import { tw } from '@proto.ui/core';
import { AdaptToWebComponent } from '../../src/adapt';

describe('adapter-web-component: rule expose-state-web optimization (v0)', () => {
  it('short-circuits to selector token when state is exposed and non-continuous', async () => {
    const proto: Prototype = {
      name: 'x-rule-esw-opt',
      setup(def: DefHandle<any>) {
        const disabled = def.state.bool('btn.disabled', false);
        def.expose('disabled', disabled);

        def.rule({
          when: (w) => w.state(disabled).eq(true),
          intent: (i) => i.feedback.style.use(tw('opacity-50')),
        });

        def.lifecycle.onMounted(() => {
          disabled.set(true);
        });

        return (r: any) => [r.el('div', {}, ['ok'])];
      },
    } as any;

    const El = AdaptToWebComponent(proto);
    const el = new El();
    document.body.appendChild(el);

    await Promise.resolve();
    await Promise.resolve();

    // selector-style token should be present in Proto UI's data style channel.
    expect(el.getAttribute('data-pui-style')).toBe('data-[btn-disabled]:opacity-50');
    expect(el.classList.contains('data-[btn-disabled]:opacity-50'), el.className).toBe(false);
    expect(el.classList.contains('opacity-50')).toBe(false);

    // expose-state-web should still toggle attr
    expect(el.getAttribute('data-btn-disabled')).toBe('');

    document.body.removeChild(el);
  });

  it('collapses a condition that lowers to the same variant twice', async () => {
    const proto: Prototype = {
      name: 'x-rule-esw-duplicate-lowering',
      setup(def: DefHandle<any>) {
        const hovered = def.state.bool('hovered', false);
        def.expose('hovered', hovered);

        def.rule({
          when: (w) => w.all(w.state(hovered).eq(true), w.state(hovered).eq(true)),
          intent: (i) => i.feedback.style.use(tw('bg-muted')),
        });

        def.lifecycle.onMounted(() => {
          hovered.set(true);
        });

        return (r: any) => [r.el('div', {}, ['ok'])];
      },
    } as any;

    const El = AdaptToWebComponent(proto);
    const el = new El();
    document.body.appendChild(el);

    await Promise.resolve();
    await Promise.resolve();

    // The extractor accumulates variants into a Set, so a repeated condition
    // yields one segment there. A second segment here would be a class with no
    // generated rule.
    expect(el.getAttribute('data-pui-style')).toBe('data-[hovered]:bg-muted');

    document.body.removeChild(el);
  });

  it('optimizes false bool state conditions to internal not-[data-*] selector tokens', async () => {
    const proto: Prototype = {
      name: 'x-rule-esw-negative-bool-opt',
      setup(def: DefHandle<any>) {
        const hovered = def.state.bool('hovered', false);
        const active = def.state.bool('active', false);
        def.expose('hovered', hovered);
        def.expose('active', active);

        def.rule({
          when: (w) => w.all(w.state(hovered).eq(true), w.state(active).eq(false)),
          intent: (i) => i.feedback.style.use(tw('bg-muted')),
        });

        def.lifecycle.onMounted(() => {
          hovered.set(true);
        });

        return (r: any) => [r.el('div', {}, ['ok'])];
      },
    } as any;

    const El = AdaptToWebComponent(proto);
    const el = new El();
    document.body.appendChild(el);

    await Promise.resolve();
    await Promise.resolve();

    expect(el.getAttribute('data-pui-style')).toBe('data-[hovered]:not-[data-active]:bg-muted');
    expect(el.getAttribute('data-hovered')).toBe('');
    expect(el.hasAttribute('data-active')).toBe(false);
    expect(el.classList.contains('data-[hovered]:not-[data-active]:bg-muted'), el.className).toBe(
      false
    );
    expect(el.classList.contains('bg-muted')).toBe(false);

    document.body.removeChild(el);
  });

  it('does not optimize a standalone false bool state condition', async () => {
    const proto: Prototype = {
      name: 'x-rule-esw-standalone-negative-bool',
      setup(def: DefHandle<any>) {
        const open = def.state.bool('open', false);
        def.expose('open', open);

        def.rule({
          when: (w) => w.state(open).eq(false),
          intent: (i) => i.feedback.style.use(tw('hidden')),
        });

        return (r: any) => [r.el('div', {}, ['ok'])];
      },
    } as any;

    const El = AdaptToWebComponent(proto);
    const el = new El();
    document.body.appendChild(el);

    await Promise.resolve();
    await Promise.resolve();

    expect(el.getAttribute('data-pui-style')).toBe('hidden');
    expect(el.hasAttribute('data-open')).toBe(false);
    expect(el.classList.contains('not-[data-open]:hidden'), el.className).toBe(false);

    document.body.removeChild(el);
  });

  it('does not optimize when state is continuous number (number.range)', async () => {
    const proto: Prototype = {
      name: 'x-rule-esw-range',
      setup(def: DefHandle<any>) {
        const value = def.state.numberRange('slider.value', 0.5, {
          min: 0,
          max: 1,
        });
        def.expose('value', value);

        def.rule({
          when: (w) => w.state(value).eq(0.5),
          intent: (i) => i.feedback.style.use(tw('opacity-50')),
        });

        return (r: any) => [r.el('div', {}, ['ok'])];
      },
    } as any;

    const El = AdaptToWebComponent(proto);
    const el = new El();
    document.body.appendChild(el);

    await Promise.resolve();
    await Promise.resolve();

    // fallback to runtime style token
    expect(el.getAttribute('data-pui-style')).toBe('opacity-50');
    expect(el.classList.contains('opacity-50')).toBe(false);
    // no selector token for continuous number
    expect(el.classList.contains('data-[slider-value=0.5]:opacity-50')).toBe(false);

    document.body.removeChild(el);
  });

  it('optimizes state+meta(colorScheme=dark) rule into dark:* selector tokens', async () => {
    const proto: Prototype = {
      name: 'x-rule-meta-dark-opt',
      setup(def: DefHandle<any>) {
        const disabled = def.state.bool('btn.disabled', false);
        def.expose('disabled', disabled);

        def.rule({
          when: (w) => w.all(w.state(disabled).eq(true), w.meta('colorScheme').eq('dark')),
          intent: (i) => i.feedback.style.use(tw('bg-zinc-950')),
        });

        def.lifecycle.onMounted(() => {
          disabled.set(true);
        });

        return (r: any) => [r.el('div', {}, ['ok'])];
      },
    } as any;

    const El = AdaptToWebComponent(proto);
    const el = new El();
    document.body.appendChild(el);

    await Promise.resolve();
    await Promise.resolve();

    // Variants are ordered the way the generated stylesheet writes them, so the
    // dark segment leads regardless of where the condition sits in `when`.
    expect(el.getAttribute('data-pui-style')).toBe('dark:data-[btn-disabled]:bg-zinc-950');
    expect(el.classList.contains('data-[btn-disabled]:dark:bg-zinc-950'), el.className).toBe(false);
    expect(el.classList.contains('bg-zinc-950')).toBe(false);

    document.body.removeChild(el);
  });

  it('optimizes a pure meta(colorScheme=dark) rule on a Prototype with no exposed state', async () => {
    const proto: Prototype = {
      name: 'x-rule-meta-only-dark-opt',
      setup(def: DefHandle<any>) {
        // No def.state, no def.expose: the exposed-state map stays empty, and a
        // pure-meta candidate must still lower rather than fall back to the
        // default plan, which samples the scheme once and goes stale.
        def.rule({
          when: (w) => w.meta('colorScheme').eq('dark'),
          intent: (i) => i.feedback.style.use(tw('bg-zinc-950')),
        });

        return (r: any) => [r.el('div', {}, ['ok'])];
      },
    } as any;

    const El = AdaptToWebComponent(proto);
    const el = new El();
    document.body.appendChild(el);

    await Promise.resolve();
    await Promise.resolve();

    expect(el.getAttribute('data-pui-style')).toBe('dark:bg-zinc-950');
    expect(el.classList.contains('dark:bg-zinc-950'), el.className).toBe(false);
    expect(el.classList.contains('bg-zinc-950')).toBe(false);

    document.body.removeChild(el);
  });

  it('maps supported official semantics to standard web variants', async () => {
    const proto: Prototype = {
      name: 'x-rule-esw-semantic-opt',
      setup(def: DefHandle<any>) {
        const hovered = def.state.fromInteraction('hovered');
        const pressed = def.state.fromInteraction('pressed');
        const invalid = def.state.fromAccessibility('invalid');

        def.expose('hovered', hovered);
        def.expose('pressed', pressed);
        def.expose('invalid', invalid);

        def.rule({
          when: (w) => w.state(hovered).eq(true),
          intent: (i) => i.feedback.style.use(tw('opacity-50')),
        });
        def.rule({
          when: (w) => w.state(pressed).eq(true),
          intent: (i) => i.feedback.style.use(tw('ring-2')),
        });
        def.rule({
          when: (w) => w.state(invalid).eq(true),
          intent: (i) => i.feedback.style.use(tw('border-destructive')),
        });

        def.lifecycle.onMounted(() => {
          hovered.set(true);
          pressed.set(true);
          invalid.set(true);
        });

        return (r: any) => [r.el('div', {}, ['ok'])];
      },
    } as any;

    const El = AdaptToWebComponent(proto);
    const el = new El();
    document.body.appendChild(el);

    await Promise.resolve();
    await Promise.resolve();

    expect(el.getAttribute('data-pui-style')).toBe(
      'hover:opacity-50 active:ring-2 data-[invalid]:border-destructive'
    );
    expect(el.classList.contains('hover:opacity-50'), el.className).toBe(false);
    expect(el.classList.contains('active:ring-2'), el.className).toBe(false);
    expect(el.classList.contains('data-[invalid]:border-destructive'), el.className).toBe(false);

    document.body.removeChild(el);
  });

  it('can fall back to data-* selectors when host policy disallows native variants', async () => {
    const proto: Prototype = {
      name: 'x-rule-esw-semantic-fallback',
      setup(def: DefHandle<any>) {
        const disabled = def.state.fromInteraction('disabled');
        const focusVisible = def.state.fromInteraction('focusVisible');

        def.expose('disabled', disabled);
        def.expose('focusVisible', focusVisible);

        def.rule({
          when: (w) => w.state(disabled).eq(true),
          intent: (i) => i.feedback.style.use(tw('opacity-50')),
        });
        def.rule({
          when: (w) => w.state(focusVisible).eq(true),
          intent: (i) => i.feedback.style.use(tw('ring-2')),
        });

        def.lifecycle.onMounted(() => {
          disabled.set(true);
          focusVisible.set(true);
        });

        return (r: any) => [r.el('div', {}, ['ok'])];
      },
    } as any;

    const El = AdaptToWebComponent(proto);
    const el = new El();
    document.body.appendChild(el);

    await Promise.resolve();
    await Promise.resolve();

    expect(el.getAttribute('data-pui-style')).toBe(
      'data-[disabled]:opacity-50 data-[focus-visible]:ring-2'
    );
    expect(el.classList.contains('data-[disabled]:opacity-50'), el.className).toBe(false);
    expect(el.classList.contains('data-[focus-visible]:ring-2'), el.className).toBe(false);
    expect(el.classList.contains('disabled:opacity-50'), el.className).toBe(false);
    expect(el.classList.contains('focus-visible:ring-2'), el.className).toBe(false);

    document.body.removeChild(el);
  });
});
