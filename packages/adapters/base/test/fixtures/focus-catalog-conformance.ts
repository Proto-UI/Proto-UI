import { describe, expect, it } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
import { asFocusable, asFocusEntry, asFocusRoving } from '@proto.ui/hooks';

export type FocusCatalogTree = { proto: Prototype; children?: FocusCatalogTree[] };
export type FocusCatalogMount = {
  host: HTMLElement;
  flush(): Promise<void>;
  click(target: HTMLElement): Promise<void>;
  unmount(): Promise<void>;
};

export function focusCatalogAdapterConformance(
  name: string,
  mount: (tree: FocusCatalogTree[]) => Promise<FocusCatalogMount>
) {
  describe(`${name}: Focus catalog translation`, () => {
    it('T-FOCUS-0002-CASE-ENTRY: delegates to a descendant and uses self only as fallback', async () => {
      let entry!: ReturnType<typeof asFocusEntry>;
      const proto = definePrototype({
        name: `focus-entry-${name}-catalog`,
        setup() {
          entry = asFocusEntry();
          entry.configure({ strategy: 'descendant-first', fallback: 'self' });
          return (r) => r.el('button', 'entry target');
        },
      });
      const mounted = await mount([{ proto }]);
      try {
        await mounted.flush();
        const root = mounted.host.querySelector<HTMLElement>('[data-pui-root]')!;
        const button = root.querySelector('button')!;
        expect(root.hasAttribute('tabindex')).toBe(false);
        entry.focus();
        await mounted.flush();
        expect(document.activeElement).toBe(button);
        button.blur();
        entry.setDisabled(true);
        entry.focus();
        expect(document.activeElement).not.toBe(button);
        button.disabled = true;
        entry.setDisabled(false);
        expect(root.tabIndex).toBe(0);
        entry.focus();
        expect(document.activeElement).toBe(root);
      } finally {
        await mounted.unmount();
      }
    });

    it.each(['self', 'none'] as const)(
      'T-FOCUS-0002-CASE-NATIVE-ENTRY: native summary wins over %s fallback',
      async (fallback) => {
        let entry!: ReturnType<typeof asFocusEntry>;
        const proto = definePrototype({
          name: `focus-summary-${name}-${fallback}`,
          setup() {
            entry = asFocusEntry();
            entry.configure({ strategy: 'descendant-first', fallback });
            return (r) => r.el('details', [r.el('summary', 'native entry')]);
          },
        });
        const mounted = await mount([{ proto }]);
        try {
          await mounted.flush();
          const root = mounted.host.querySelector<HTMLElement>('[data-pui-root]')!;
          const summary = root.querySelector('summary')!;
          expect(summary.hasAttribute('tabindex')).toBe(false);
          expect(root.hasAttribute('tabindex')).toBe(false);
          entry.focus();
          await mounted.flush();
          expect(document.activeElement).toBe(summary);
          expect(root.hasAttribute('tabindex')).toBe(false);
          summary.blur();
          summary.setAttribute('tabindex', '-1');
          entry.setDisabled(true);
          entry.setDisabled(false);
          entry.focus();
          await mounted.flush();
          expect(document.activeElement).not.toBe(summary);
          if (fallback === 'self') {
            expect(document.activeElement).toBe(root);
            expect(root.tabIndex).toBe(0);
          } else {
            expect(root.hasAttribute('tabindex')).toBe(false);
            expect(document.activeElement).not.toBe(root);
          }
        } finally {
          await mounted.unmount();
        }
      }
    );

    it.each(['orphan', 'second'] as const)(
      'does not promote a %s summary to a native entry target',
      async (kind) => {
        let entry!: ReturnType<typeof asFocusEntry>;
        const proto = definePrototype({
          name: `focus-invalid-summary-${name}-${kind}`,
          setup() {
            entry = asFocusEntry();
            entry.configure({ strategy: 'descendant-first', fallback: 'none' });
            return (r) => r.el('div');
          },
        });
        const mounted = await mount([{ proto }]);
        try {
          await mounted.flush();
          const root = mounted.host.querySelector<HTMLElement>('[data-pui-root]')!;
          const region = root.querySelector('div')!;
          const summary = document.createElement('summary');
          if (kind === 'second') {
            const details = document.createElement('details');
            const first = document.createElement('summary');
            first.tabIndex = -1;
            details.append(first, summary);
            region.append(details);
          } else region.append(summary);
          entry.focus();
          await mounted.flush();
          expect(document.activeElement).not.toBe(summary);
          expect(root.hasAttribute('tabindex')).toBe(false);
        } finally {
          await mounted.unmount();
        }
      }
    );

    for (const kind of [
      'hidden-input',
      'hidden-tabindex',
      'orphan-area',
      'unassociated-area',
    ] as const) {
      it.each(['self', 'none'] as const)(
        `T-FOCUS-0002-CASE-UNUSABLE-NATIVE: ${kind} preserves %s fallback`,
        async (fallback) => {
          let entry!: ReturnType<typeof asFocusEntry>;
          const proto = definePrototype({
            name: `focus-unusable-${name}-${kind}-${fallback}`,
            setup() {
              entry = asFocusEntry();
              entry.configure({ strategy: 'descendant-first', fallback });
              return (r) => r.el('div');
            },
          });
          const mounted = await mount([{ proto }]);
          try {
            await mounted.flush();
            const root = mounted.host.querySelector<HTMLElement>('[data-pui-root]')!;
            const region = root.querySelector('div')!;
            const candidate = document.createElement(kind.startsWith('hidden') ? 'input' : 'area');
            if (kind.startsWith('hidden')) candidate.setAttribute('type', 'hidden');
            else candidate.setAttribute('href', '#target');
            if (kind === 'hidden-tabindex') candidate.setAttribute('tabindex', '0');
            if (kind === 'unassociated-area') {
              const map = document.createElement('map');
              map.name = `missing-image-${name}-${fallback}`;
              map.append(candidate);
              region.append(map);
            } else region.append(candidate);
            entry.setDisabled(true);
            entry.setDisabled(false);
            entry.focus();
            await mounted.flush();
            expect(document.activeElement).not.toBe(candidate);
            if (fallback === 'self') {
              expect(document.activeElement).toBe(root);
              expect(root.tabIndex).toBe(0);
              root.blur();
            } else {
              expect(document.activeElement).not.toBe(root);
              expect(root.hasAttribute('tabindex')).toBe(false);
            }
            const button = document.createElement('button');
            region.append(button);
            entry.setDisabled(true);
            entry.setDisabled(false);
            entry.focus();
            await mounted.flush();
            expect(document.activeElement).toBe(button);
            expect(root.hasAttribute('tabindex')).toBe(false);
          } finally {
            await mounted.unmount();
          }
        }
      );
    }

    it.each(['area', 'iframe', 'audio', 'video'] as const)(
      'delegates to selected native %s candidates',
      async (tag) => {
        let entry!: ReturnType<typeof asFocusEntry>;
        const proto = definePrototype({
          name: `focus-native-${tag}-${name}`,
          setup() {
            entry = asFocusEntry();
            entry.configure({ strategy: 'descendant-first', fallback: 'none' });
            return (r) => r.el('div');
          },
        });
        const mounted = await mount([{ proto }]);
        try {
          await mounted.flush();
          const root = mounted.host.querySelector<HTMLElement>('[data-pui-root]')!;
          const target = document.createElement(tag);
          if (tag === 'area') {
            target.setAttribute('href', '#target');
            target.setAttribute('alt', 'Image map entry');
            target.setAttribute('shape', 'rect');
            target.setAttribute('coords', '0,0,20,20');
          }
          if (tag === 'audio' || tag === 'video') target.setAttribute('controls', '');
          if (tag === 'area') {
            const map = document.createElement('map');
            map.name = `focus-map-${name}`;
            map.append(target);
            const image = document.createElement('img');
            image.alt = 'Focus entry map';
            image.width = 20;
            image.height = 20;
            image.src =
              'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            image.useMap = `#${map.name}`;
            root.querySelector('div')!.append(image, map);
          } else root.querySelector('div')!.append(target);
          entry.focus();
          await mounted.flush();
          expect(document.activeElement).toBe(target);
          expect(root.hasAttribute('tabindex')).toBe(false);
        } finally {
          await mounted.unmount();
        }
      }
    );

    it('T-FOCUS-0002-CASE-ROVING: logical membership preserves programmatic focus outside Tab order', async () => {
      let roving!: ReturnType<typeof asFocusRoving>;
      const members: Array<ReturnType<typeof asFocusable>> = [];
      const parent = definePrototype({
        name: `focus-roving-${name}-catalog`,
        setup() {
          roving = asFocusRoving();
          roving.configure({ loop: false, orientation: 'horizontal' });
          return (r) => r.slot();
        },
      });
      const children = [0, 1].map((index) =>
        definePrototype({
          name: `focus-item-${name}-catalog-${index}`,
          setup() {
            members[index] = asFocusable();
            members[index].configure({ navParticipation: index ? 'none' : 'auto' });
            return (r) => r.el('span', String(index));
          },
        })
      );
      for (let generation = 0; generation < 2; generation++) {
        const mounted = await mount([
          { proto: parent, children: children.map((proto) => ({ proto })) },
        ]);
        try {
          await mounted.flush();
          const roots = mounted.host.querySelectorAll<HTMLElement>('[data-pui-root]');
          expect(roots[1].tabIndex).toBe(0);
          expect(roots[2].tabIndex).toBe(-1);
          roving.focusFirst();
          await mounted.flush();
          expect(document.activeElement).toBe(roots[1]);
          expect(members[0].focused.get()).toBe(true);
          roving.focusNext();
          await mounted.flush();
          expect(document.activeElement).toBe(roots[2]);
          expect(members[0].focused.get()).toBe(false);
          expect(members[1].focused.get()).toBe(true);
          members[0].setDisabled(true);
          members[0].focus();
          expect(document.activeElement).toBe(roots[2]);
        } finally {
          await mounted.unmount();
        }
      }
    });
  });
}
