import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as autocomplete from '../../src/autocomplete';
import * as combobox from '../../src/combobox';
import * as command from '../../src/command';
const groups = [
  { slug: 'autocomplete', module: autocomplete },
  { slug: 'combobox', module: combobox },
  { slug: 'command', module: command },
];
const owned = new Set<HTMLElement>();
const lives = new Map<string, { made: number; dead: number }>();
for (const group of groups)
  for (const value of Object.values(group.module))
    if (value && typeof value === 'object' && 'name' in value && 'setup' in value) {
      const p = value as any;
      AdaptToWebComponent(p, {
        diagnostics: {
          onLifecycleEvent(e) {
            const x = lives.get(p.name) ?? { made: 0, dead: 0 };
            if (e.type === 'instance.created') x.made++;
            if (e.type === 'instance.dispose.done') x.dead++;
            lives.set(p.name, x);
          },
        },
      });
    }
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const e of owned) e.remove();
  owned.clear();
  await expect.poll(() => [...lives.values()].every((x) => x.made === x.dead)).toBe(true);
});
function fixture(
  slug: string,
  props = {},
  choices = [
    ['apple', 'Apple'],
    ['pear', 'Pear'],
    ['orange', 'Orange'],
    ['disabled', 'Disabled'],
  ]
) {
  const make = (part: string, props = {}): any => {
    const e = document.createElement(`base-${slug}-${part}`);
    setElementProps(e, props);
    owned.add(e);
    return e;
  };
  const root = make('root', props),
    input = make('input', { a11yLabel: 'Search options' }),
    content = make('content'),
    empty = make('empty');
  empty.textContent = 'No results';
  const items = choices.map(([value, textValue]) => {
    const e = make('item', { value, textValue, disabled: value === 'disabled' });
    e.textContent = textValue;
    return e;
  });
  content.append(...items, empty);
  root.append(input, content);
  document.body.append(root);
  return { root, input, content, empty, items };
}
function type(input: any, value: string, composing = false) {
  const target = input.querySelector('input') as HTMLInputElement;
  target.value = value;
  target.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      data: value,
      inputType: 'insertText',
      isComposing: composing,
    })
  );
}
describe.each(groups)('$slug search', ({ slug }) => {
  it('filters real text input and preserves active-descendant keyboard ownership', async () => {
    const p = fixture(slug);
    await flush();
    const editor = p.input.querySelector('input') as HTMLInputElement;
    expect(editor).toBeTruthy();
    editor.focus();
    type(p.input, 'pe');
    await flush();
    expect(p.root.getExposes().inputValue.get()).toBe('pe');
    expect(p.root.getExposes().visibleCount.get()).toBe(1);
    expect(p.items[0].getExposes().visible.get()).toBe(false);
    expect(p.items[1].getExposes().visible.get()).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await flush();
    expect(document.activeElement).toBe(editor);
    expect(editor.getAttribute('aria-activedescendant')).toBe(p.items[1].id);
    const events: any[] = [];
    p.root.addEventListener(slug === 'command' ? 'execute' : 'valueChange', (e: any) =>
      events.push(e.detail)
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flush();
    expect(events).toEqual([
      expect.objectContaining({ value: slug === 'autocomplete' ? 'Pear' : 'pear' }),
    ]);
    expect(p.root.getExposes().open.get()).toBe(slug === 'command');
  });
  it('handles empty results and suppresses disabled/readOnly commits', async () => {
    const p = fixture(slug);
    await flush();
    type(p.input, 'absent');
    await flush();
    expect(p.root.getExposes().visibleCount.get()).toBe(0);
    expect(p.empty.getExposes().visible.get()).toBe(true);
    setElementProps(p.root, { readOnly: true });
    expect(p.root.getExposes().select('pear')).toBe(false);
    p.root.getExposes().setInputValue('pear');
    expect(p.root.getExposes().inputValue.get()).toBe('absent');
  });
});
it('combobox retains controlled value and query until owner responds', async () => {
  const p = fixture('combobox', { value: 'apple', inputValue: '' });
  await flush();
  type(p.input, 'pe');
  await flush();
  expect(p.root.getExposes().inputValue.get()).toBe('');
  const requests: unknown[] = [];
  p.root.addEventListener('valueChange', (e: any) => requests.push(e.detail));
  expect(p.root.getExposes().select('pear')).toBe(true);
  expect(p.root.getExposes().value.get()).toBe('apple');
  expect(requests).toHaveLength(1);
});
it('autocomplete commits unmatched free text while combobox rejects it', async () => {
  for (const slug of ['autocomplete', 'combobox']) {
    const p = fixture(slug);
    await flush();
    p.root.getExposes().setInputValue('Custom');
    expect(p.root.getExposes().select('Custom', 'free-text')).toBe(slug === 'autocomplete');
    expect(p.root.getExposes().value.get()).toBe(slug === 'autocomplete' ? 'Custom' : '');
  }
});
it('does not select options while IME composition is active', async () => {
  const p = fixture('combobox');
  await flush();
  const editor = p.input.querySelector('input') as HTMLInputElement;
  editor.focus();
  editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  type(p.input, 'pe', true);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(p.root.getExposes().value.get()).toBe('');
  editor.value = 'pe';
  editor.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'pe' }));
  await flush();
  expect(p.root.getExposes().inputValue.get()).toBe('pe');
});

describe.each(groups)('$slug registered-option admission', ({ slug }) => {
  it.each([false, true])(
    'rejects a filtered duplicate value when the hidden duplicate is disabled=%s',
    async (hiddenDisabled) => {
      const p = fixture(slug, { defaultOpen: true }, [
        ['shared', 'Alpha'],
        ['shared', 'Beta'],
      ]);
      setElementProps(p.items[1], { value: 'shared', textValue: 'Beta', disabled: hiddenDisabled });
      await flush();
      expect(p.root.getExposes().visibleCount.get()).toBe(2);
      p.root.getExposes().setInputValue('Alpha');
      await flush();
      expect(p.items.map((item) => item.getExposes().visible.get())).toEqual([true, false]);
      const events: unknown[] = [];
      p.root.addEventListener(slug === 'command' ? 'execute' : 'valueChange', (e: any) =>
        events.push(e.detail)
      );
      const accepted = p.root.getExposes().select('shared');
      await flush();
      const selection = {
        accepted,
        value: p.root.getExposes().value.get(),
        inputValue: p.root.getExposes().inputValue.get(),
        open: p.root.getExposes().open.get(),
        events,
      };
      p.root.getExposes().setInputValue('');
      await flush();
      expect({
        selection,
        selected: p.items.map((item) => item.getExposes().selected.get()),
      }).toEqual({
        selection: {
          accepted: false,
          value: '',
          inputValue: 'Alpha',
          open: true,
          events: [],
        },
        selected: [slug === 'command', false],
      });
    }
  );

  it('does not exempt owner-filtered children from duplicate-value rejection', async () => {
    const p = fixture(slug, { filter: false }, [
      ['shared', 'Alpha'],
      ['shared', 'Beta'],
    ]);
    await flush();
    p.root.getExposes().setInputValue('Alpha');
    await flush();
    expect(p.root.getExposes().visibleCount.get()).toBe(2);
    expect(p.root.getExposes().select('shared')).toBe(false);
  });

  it('keeps visibility and disabled checks for otherwise unique values', async () => {
    const p = fixture(slug);
    await flush();
    p.root.getExposes().setInputValue('Pear');
    await flush();
    expect(p.root.getExposes().select('apple')).toBe(false);
    p.root.getExposes().setInputValue('Disabled');
    await flush();
    expect(p.root.getExposes().select('disabled')).toBe(false);
    p.root.getExposes().setInputValue('Pear');
    await flush();
    const events: unknown[] = [];
    p.root.addEventListener(slug === 'command' ? 'execute' : 'valueChange', (e: any) =>
      events.push(e.detail)
    );
    expect(p.root.getExposes().select('pear')).toBe(true);
    expect(events).toEqual([
      {
        value: slug === 'autocomplete' ? 'Pear' : 'pear',
        textValue: 'Pear',
        reason: 'programmatic',
      },
    ]);
    expect(p.root.getExposes().open.get()).toBe(slug === 'command');
  });

  it('rejects ambiguous controlled requests while preserving legal owner refusal', async () => {
    const p = fixture(slug, { value: 'owner', inputValue: 'Alpha', open: true }, [
      ['shared', 'Alpha'],
      ['shared', 'Beta'],
      ['unique', 'Unique'],
    ]);
    await flush();
    expect(p.root.getExposes().visibleCount.get()).toBe(1);
    const events: unknown[] = [];
    p.root.addEventListener(slug === 'command' ? 'execute' : 'valueChange', (e: any) =>
      events.push(e.detail)
    );
    const ambiguous = p.root.getExposes().select('shared');
    const ambiguousEvents = [...events];
    events.length = 0;
    setElementProps(p.root, { value: 'owner', inputValue: 'Unique', open: true });
    await flush();
    expect(p.root.getExposes().select('unique')).toBe(true);
    expect(events).toEqual([
      {
        value: slug === 'autocomplete' ? 'Unique' : 'unique',
        textValue: 'Unique',
        reason: 'programmatic',
      },
    ]);
    expect(p.root.getExposes().value.get()).toBe('owner');
    expect(p.root.getExposes().inputValue.get()).toBe('Unique');
    expect(p.root.getExposes().open.get()).toBe(true);
    expect({ ambiguous, ambiguousEvents }).toEqual({
      ambiguous: false,
      ambiguousEvents: [],
    });
  });
});

it('preserves unmatched autocomplete free text alongside duplicate suggestions', async () => {
  const p = fixture('autocomplete', {}, [
    ['shared', 'Alpha'],
    ['shared', 'Beta'],
  ]);
  await flush();
  p.root.getExposes().setInputValue('Custom');
  await flush();
  expect(p.root.getExposes().visibleCount.get()).toBe(0);
  expect(p.root.getExposes().select('Custom', 'free-text')).toBe(true);
  expect(p.root.getExposes().value.get()).toBe('Custom');
});
