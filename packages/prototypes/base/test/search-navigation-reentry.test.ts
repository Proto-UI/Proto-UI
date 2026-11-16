import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { definePrototype, type AnatomyFamily, type Prototype } from '@proto.ui/core';
import { asCollectionItem } from '@proto.ui/hooks';
import * as autocomplete from '../src/autocomplete';
import * as combobox from '../src/combobox';
import * as command from '../src/command';

// C-SCROLL-TARGET-REVEAL-0001-CONSUMER/LIFETIME. Actual Runtime and WC
// public callbacks/getters exercise navigation ownership. No layout, offset,
// native input or compiler acceptance is inferred from these source journeys.
const families = [
  ['autocomplete', autocomplete, autocomplete.AUTOCOMPLETE_FAMILY],
  ['combobox', combobox, combobox.COMBOBOX_FAMILY],
  ['command', command, command.COMMAND_FAMILY],
] as const;
type Mode = (typeof families)[number][0];
type Action = 'navigate' | 'activate' | 'query' | 'disabled' | 'readOnly';
const actions: Action[] = ['navigate', 'activate', 'query', 'disabled', 'readOnly'];
type PublicElement = HTMLElement & { getExposes(): Record<string, any> };
const roots = new Set<HTMLElement>();
const lifetimes = new Map<string, { created: number; disposed: number }>();
let metadataSequence = 0;

function adapt(prototype: Prototype<any>) {
  AdaptToWebComponent(prototype, {
    diagnostics: {
      onLifecycleEvent(event) {
        const count = lifetimes.get(prototype.name) ?? { created: 0, disposed: 0 };
        if (event.type === 'instance.created') count.created++;
        if (event.type === 'instance.dispose.done') count.disposed++;
        lifetimes.set(prototype.name, count);
      },
    },
  });
}
for (const [, module] of families) {
  for (const value of new Set(Object.values(module))) {
    if (value && typeof value === 'object' && 'name' in value && 'setup' in value)
      adapt(value as Prototype<any>);
  }
}
const flush = async () => {
  for (let index = 0; index < 16; index++) await Promise.resolve();
};
const pointerMove = (item: HTMLElement, pointerType = 'mouse', buttons = 0) =>
  item.dispatchEvent(
    new PointerEvent('pointermove', { pointerType, buttons, bubbles: true, composed: true })
  );
afterEach(async () => {
  for (const root of roots) root.remove();
  roots.clear();
  await expect
    .poll(() => [...lifetimes.values()].every((count) => count.created === count.disposed))
    .toBe(true);
});

async function fixture(mode: Mode, rootProps: Record<string, unknown> = {}) {
  const make = (part: string, props: Record<string, unknown> = {}) => {
    const element = document.createElement(`base-${mode}-${part}`) as PublicElement;
    setElementProps(element, props);
    return element;
  };
  const root = make('root', { filter: false, ...rootProps });
  const input = make('input', { a11yLabel: 'Find a result' });
  const content = make('content');
  const choices = ['first', 'disabled', 'middle', 'last'].map((value) => {
    const item = make('item', { value, textValue: value, disabled: value === 'disabled' });
    item.textContent = value;
    return item;
  });
  roots.add(root);
  content.append(...choices);
  root.append(input, content);
  document.body.append(root);
  await flush();
  const editor = input.querySelector('input')!;
  expect(editor).toBeInstanceOf(HTMLInputElement);
  editor.focus();
  await flush();
  const active = () => editor.getAttribute('aria-activedescendant');
  const key = async (key: string) => {
    editor.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
    await flush();
  };
  const apply = (action: Action) => {
    if (action === 'navigate') root.getExposes().__navigate('last');
    else if (action === 'activate') root.getExposes().__activate(choices[3].id);
    else if (action === 'query') root.getExposes().setInputValue('new query');
    else setElementProps(root, { [action]: true });
  };
  return { root, input, content, choices, editor, active, key, apply };
}

async function appendMetadataReader(f: Awaited<ReturnType<typeof fixture>>, family: AnatomyFamily) {
  let nextRead: (() => void) | undefined;
  let reentries = 0;
  const id = `search-metadata-${++metadataSequence}`;
  const prototype = definePrototype({
    name: `test-search-metadata-${metadataSequence}`,
    setup() {
      asCollectionItem().configure({
        family,
        getMeta: () => {
          const callback = nextRead;
          nextRead = undefined;
          if (callback) {
            reentries++;
            callback();
          }
          return { id, value: id, text: id, keywords: '', disabled: false };
        },
      });
    },
  });
  adapt(prototype);
  const item = document.createElement(prototype.name);
  item.id = id;
  f.content.prepend(item);
  await flush();
  return {
    arm(callback: () => void) {
      nextRead = callback;
    },
    reentries: () => reentries,
  };
}

for (const [mode, , family] of families) {
  describe(`${mode} current keyboard navigation`, () => {
    it('keeps ordinary boundary navigation, disabled skipping and input focus', async () => {
      const f = await fixture(mode);
      await f.key('ArrowUp');
      expect(f.root.getExposes().open.get()).toBe(true);
      expect(f.active()).toBe(f.choices[3].id);
      await f.key('ArrowDown');
      expect(f.active()).toBe(f.choices[0].id);
      await f.key('ArrowDown');
      expect(f.active()).toBe(f.choices[2].id);
      expect(f.root.getExposes().value.get()).toBe('');
      expect(document.activeElement).toBe(f.editor);
    });

    if (mode !== 'command') {
      it.each(actions)('preserves newer %s from synchronous openChange', async (action) => {
        const f = await fixture(mode);
        expect(f.root.getExposes().open.get()).toBe(false);
        let reentries = 0;
        let acceptedActive: string | null | undefined;
        f.root.addEventListener('openChange', (event) => {
          if (!(event as CustomEvent).detail.open || reentries > 0) return;
          reentries++;
          f.apply(action);
          acceptedActive = f.active();
        });
        await f.key('ArrowDown');
        expect(reentries).toBe(1);
        if (action === 'navigate' || action === 'activate')
          expect(acceptedActive).toBe(f.choices[3].id);
        else expect(acceptedActive).toBeNull();
        expect(f.active()).toBe(acceptedActive);
        expect(f.root.getExposes().value.get()).toBe('');
        if (action === 'query') expect(f.root.getExposes().inputValue.get()).toBe('new query');
      });
    }

    it.each(actions)(
      'preserves newer %s from a real Collection metadata getter',
      async (action) => {
        const f = await fixture(mode);
        const reader = await appendMetadataReader(f, family);
        let acceptedActive: string | null | undefined;
        let acceptedOpen: boolean | undefined;
        reader.arm(() => {
          f.apply(action);
          acceptedActive = f.active();
          acceptedOpen = f.root.getExposes().open.get();
        });
        await f.key('ArrowDown');
        expect(reader.reentries()).toBe(1);
        expect(f.active()).toBe(acceptedActive);
        expect(f.root.getExposes().open.get()).toBe(acceptedOpen);
        expect(f.root.getExposes().value.get()).toBe('');
        if (action === 'query') expect(f.root.getExposes().inputValue.get()).toBe('new query');
      }
    );
  });
}

for (const [mode, , family] of families) {
  describe(`${mode} interaction ownership across owner and metadata callbacks`, () => {
    if (mode !== 'command') {
      it.each([false, true])('respects controlled open acceptance %s', async (accept) => {
        const f = await fixture(mode, { open: false, inputValue: '' });
        let requests = 0;
        f.root.addEventListener('openChange', (event) => {
          if (!(event as CustomEvent).detail.open) return;
          requests++;
          setElementProps(f.root, { filter: false, open: accept, inputValue: '' });
        });
        await f.key('ArrowDown');
        expect(requests).toBe(1);
        expect(f.root.getExposes().open.get()).toBe(accept);
        expect(f.active()).toBe(accept ? f.choices[0].id : null);
        expect(document.activeElement).toBe(f.editor);
      });

      it('does not apply old navigation after the owner replaces the controlled query', async () => {
        const f = await fixture(mode, { open: false, inputValue: '' });
        let acceptedActive: string | null | undefined;
        let requests = 0;
        f.root.addEventListener('openChange', (event) => {
          if (!(event as CustomEvent).detail.open || requests > 0) return;
          requests++;
          setElementProps(f.root, { filter: false, open: true, inputValue: 'new query' });
          acceptedActive = f.active();
        });
        await f.key('ArrowDown');
        expect(requests).toBe(1);
        expect(f.root.getExposes().inputValue.get()).toBe('new query');
        expect(f.root.getExposes().open.get()).toBe(true);
        expect(acceptedActive).toBeNull();
        expect(f.active()).toBe(acceptedActive);
      });
    }

    it.each(['navigate', 'query'] as const)(
      'pointer activation preserves newer %s accepted in metadata',
      async (action) => {
        const f = await fixture(mode);
        if (mode !== 'command') f.root.getExposes().openPopup();
        const reader = await appendMetadataReader(f, family);
        let acceptedActive: string | null | undefined;
        reader.arm(() => {
          f.apply(action);
          acceptedActive = f.active();
        });
        pointerMove(f.choices[0]);
        await flush();
        expect(reader.reentries()).toBe(1);
        if (action === 'navigate') expect(acceptedActive).toBe(f.choices[3].id);
        expect(f.active()).toBe(acceptedActive);
        expect(f.root.getExposes().value.get()).toBe('');
        if (action === 'query') expect(f.root.getExposes().inputValue.get()).toBe('new query');
      }
    );

    it.each(['query request', 'controlled query'] as const)(
      'publishes only current filtered items after metadata accepts a newer %s',
      async (source) => {
        const f = await fixture(mode, { filter: true });
        if (mode !== 'command') f.root.getExposes().openPopup();
        const reader = await appendMetadataReader(f, family);
        reader.arm(() => {
          if (source === 'query request') f.root.getExposes().setInputValue('last');
          else setElementProps(f.root, { filter: true, inputValue: 'last' });
        });
        // Updating a real Item publishes its metadata through the normal
        // owner refresh path, with no replaced Anatomy or Context port.
        setElementProps(f.choices[0], { value: 'first', textValue: 'first updated' });
        await flush();
        expect(reader.reentries()).toBe(1);
        expect(f.root.getExposes().inputValue.get()).toBe('last');
        expect(f.editor.value).toBe('last');
        expect(f.root.getExposes().visibleCount.get()).toBe(1);
        expect(f.choices.map((item) => item.getExposes().visible.get())).toEqual([
          false,
          false,
          false,
          true,
        ]);
        expect(f.root.getExposes().value.get()).toBe('');
      }
    );
  });
}

for (const [mode, , family] of families) {
  describe(`${mode} current query and selection completion`, () => {
    it.each([false, true])(
      'does not emit an older query after metadata accepts a newer one (controlled %s)',
      async (controlled) => {
        const f = await fixture(mode, controlled ? { inputValue: '' } : {});
        const reader = await appendMetadataReader(f, family);
        const requests: string[] = [];
        f.root.addEventListener('inputValueChange', (event) => {
          const value = (event as CustomEvent).detail.value;
          requests.push(value);
          if (controlled) setElementProps(f.root, { filter: false, inputValue: value });
        });
        reader.arm(() => f.root.getExposes().setInputValue('newer query'));
        f.root.getExposes().setInputValue('older query');
        await flush();
        expect(reader.reentries()).toBe(1);
        expect(requests).toEqual(['newer query']);
        expect(f.root.getExposes().inputValue.get()).toBe('newer query');
        expect(f.editor.value).toBe('newer query');
        expect(f.root.getExposes().value.get()).toBe('');
      }
    );

    it('preserves the newer selection accepted while reading candidate metadata', async () => {
      const f = await fixture(mode);
      if (mode !== 'command') f.root.getExposes().openPopup();
      const reader = await appendMetadataReader(f, family);
      const events: string[] = [];
      f.root.addEventListener(mode === 'command' ? 'execute' : 'valueChange', (event) => {
        events.push((event as CustomEvent).detail.value);
      });
      reader.arm(() => f.root.getExposes().select('last'));
      f.root.getExposes().select('first');
      await flush();
      expect(reader.reentries()).toBe(1);
      expect(events).toEqual(['last']);
      expect(f.root.getExposes().value.get()).toBe(mode === 'command' ? '' : 'last');
      expect(f.root.getExposes().inputValue.get()).toBe(mode === 'command' ? '' : 'last');
    });

    if (mode !== 'command') {
      it.each(['selected label', 'different query'] as const)(
        'distinguishes controlled selection confirmation from owner %s',
        async (queryChoice) => {
          const f = await fixture(mode, { value: '', inputValue: '' });
          f.root.getExposes().openPopup();
          const launcher = document.createElement('button');
          launcher.textContent = 'Choose first result';
          f.root.append(launcher);
          launcher.focus();
          expect(document.activeElement).toBe(launcher);
          const values: string[] = [];
          let ownerQuery = '';
          f.root.addEventListener('valueChange', (event) => {
            const detail = (event as CustomEvent).detail;
            values.push(detail.value);
            ownerQuery = queryChoice === 'selected label' ? detail.textValue : 'newer query';
            setElementProps(f.root, {
              filter: false,
              value: detail.value,
              inputValue: ownerQuery,
            });
          });
          f.root.getExposes().select('first');
          await flush();
          expect(values).toEqual(['first']);
          expect(f.root.getExposes().value.get()).toBe('first');
          expect(f.root.getExposes().inputValue.get()).toBe(ownerQuery);
          expect(f.editor.value).toBe(ownerQuery);
          expect(f.root.getExposes().open.get()).toBe(queryChoice === 'different query');
          if (queryChoice === 'selected label') expect(document.activeElement).toBe(f.editor);
        }
      );

      it('does not close a newer query opened by the selection callback', async () => {
        const f = await fixture(mode);
        f.root.getExposes().openPopup();
        const values: string[] = [];
        const queries: string[] = [];
        f.root.addEventListener('inputValueChange', (event) => {
          queries.push((event as CustomEvent).detail.value);
        });
        f.root.addEventListener('valueChange', (event) => {
          values.push((event as CustomEvent).detail.value);
          f.root.getExposes().setInputValue('newer query');
        });
        f.root.getExposes().select('first');
        await flush();
        expect(values).toEqual(['first']);
        expect(queries).toEqual(['newer query']);
        expect(f.root.getExposes().inputValue.get()).toBe('newer query');
        expect(f.root.getExposes().open.get()).toBe(true);
        expect(f.active()).toBeNull();
        expect(document.activeElement).toBe(f.editor);
      });
    }
  });
}

for (const [mode] of families) {
  describe(`${mode} pointer intent after keyboard navigation`, () => {
    it('does not let enter-only delivery replace the keyboard active item', async () => {
      const f = await fixture(mode);
      if (mode !== 'command') f.root.getExposes().openPopup();
      await f.key('End');
      expect(f.active()).toBe(f.choices[3].id);
      f.choices[0].dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      await flush();
      expect(f.active()).toBe(f.choices[3].id);
      expect(f.root.getExposes().value.get()).toBe('');
      expect(document.activeElement).toBe(f.editor);
    });

    it('lets a known unpressed mouse move take active without selecting or moving input focus', async () => {
      const f = await fixture(mode);
      if (mode !== 'command') f.root.getExposes().openPopup();
      await f.key('End');
      expect(f.active()).toBe(f.choices[3].id);
      pointerMove(f.choices[0]);
      await flush();
      expect(f.active()).toBe(f.choices[0].id);
      expect(f.choices.map((item) => item.getExposes().active.get())).toEqual([
        true,
        false,
        false,
        false,
      ]);
      expect(f.root.getExposes().value.get()).toBe('');
      expect(f.root.getExposes().inputValue.get()).toBe('');
      expect(document.activeElement).toBe(f.editor);
    });

    it.each([
      ['unknown', 'unknown', 0],
      ['touch', 'touch', 0],
      ['pen', 'pen', 0],
      ['pressed mouse', 'mouse', 1],
    ] as const)(
      'does not give %s movement the keyboard active item',
      async (_name, type, buttons) => {
        const f = await fixture(mode);
        if (mode !== 'command') f.root.getExposes().openPopup();
        await f.key('End');
        expect(f.active()).toBe(f.choices[3].id);
        pointerMove(f.choices[0], type, buttons);
        await flush();
        expect(f.active()).toBe(f.choices[3].id);
        expect(f.root.getExposes().value.get()).toBe('');
        expect(document.activeElement).toBe(f.editor);
      }
    );

    it.each(['disabled', 'readOnly'] as const)(
      'does not activate from mouse movement while %s',
      async (guard) => {
        const f = await fixture(mode);
        if (mode !== 'command') f.root.getExposes().openPopup();
        await f.key('End');
        setElementProps(f.root, { filter: false, [guard]: true });
        await flush();
        const active = f.active();
        const focus = document.activeElement;
        pointerMove(f.choices[0]);
        await flush();
        expect(f.active()).toBe(active);
        expect(f.root.getExposes().value.get()).toBe('');
        expect(document.activeElement).toBe(focus);
      }
    );
  });
}
