import * as React from 'react';
import { act } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import * as base from '../../../prototypes/base/src/select';
import * as shadcn from '../../../prototypes/shadcn/src/select';
import { createReactAdapter } from '../src';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

for (const [family, prototypes] of Object.entries({ base, shadcn })) {
  describe(`React ${family} Select retained presence`, () => {
    it.each(['popper', 'item-aligned'] as const)(
      'reopens retained %s Content after its prior portal view retires',
      async (position) => {
        // Happy DOM has no layout. Supply bounded layout facts, including the
        // size lease's actual writes/readback, rather than zero-width boxes.
        // This is lifecycle evidence, not native geometry or CSS evidence.
        const hasRole = (element: HTMLElement, role: string) =>
          element.classList.contains(`test-select-retained-${role}`);
        // Retired views use actual display:none host CSS, so they have no box.
        const hasLayout = (element: HTMLElement) => {
          if (!element.isConnected) return false;
          for (let node: HTMLElement | null = element; node; node = node.parentElement) {
            if (getComputedStyle(node).display === 'none') return false;
          }
          return true;
        };
        const priorOffsetParent = Object.getOwnPropertyDescriptor(
          HTMLElement.prototype,
          'offsetParent'
        );
        Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
          configurable: true,
          get(this: HTMLElement) {
            return this.parentElement;
          },
        });
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
          this: HTMLElement
        ) {
          if (!hasLayout(this)) return new DOMRect();
          const name = this.className;
          const rect: [number, number, number, number] = name.includes('retained-trigger')
            ? [180, 240, 180, 36]
            : name.includes('retained-value')
              ? [193, 248, 50, 20]
              : name.includes('retained-surface')
                ? [0, 0, 180, 106]
                : name.includes('retained-item-text')
                  ? [13, 37, 50, 20]
                  : [0, 0, 180, 32];
          return new DOMRect(...rect);
        });
        vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
          this: HTMLElement
        ) {
          if (!hasLayout(this)) return 0;
          if (hasRole(this, 'trigger')) return 180;
          if (hasRole(this, 'value') || hasRole(this, 'item-text')) return 13;
          return hasRole(this, 'item') ? 4 : 0;
        });
        for (const property of ['clientLeft', 'clientTop'] as const) {
          vi.spyOn(HTMLElement.prototype, property, 'get').mockImplementation(function (
            this: HTMLElement
          ) {
            if (!hasLayout(this)) return 0;
            return hasRole(this, 'surface') ? 1 : 0;
          });
        }
        vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
          this: HTMLElement
        ) {
          if (!hasLayout(this)) return 0;
          if (hasRole(this, 'surface'))
            return Number.parseFloat(this.parentElement?.style.minWidth ?? '') || 180;
          if (hasRole(this, 'viewport')) return this.parentElement!.offsetWidth - 2;
          if (hasRole(this, 'item'))
            return Number.parseFloat(this.style.width) || this.parentElement!.offsetWidth - 8;
          return hasRole(this, 'value') || hasRole(this, 'item-text') ? 50 : 180;
        });
        vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
          this: HTMLElement
        ) {
          if (!hasLayout(this)) return 0;
          return this.offsetWidth - (hasRole(this, 'surface') ? 2 : 0);
        });
        vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
          this: HTMLElement
        ) {
          return this.clientWidth;
        });
        vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
          this: HTMLElement
        ) {
          if (!hasLayout(this)) return 0;
          if (hasRole(this, 'item')) return Number.parseFloat(this.style.height) || 32;
          if (hasRole(this, 'trigger')) return 36;
          return hasRole(this, 'viewport') ? 108 : hasRole(this, 'surface') ? 110 : 32;
        });
        vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
          this: HTMLElement
        ) {
          if (!hasLayout(this)) return 0;
          return hasRole(this, 'item') ? this.offsetHeight : 108;
        });
        vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
          this: HTMLElement
        ) {
          return this.clientHeight;
        });
        vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
          this: HTMLElement
        ) {
          if (!hasLayout(this)) return 0;
          return hasRole(this, 'item') ? 4 : 0;
        });
        const adapt = createReactAdapter({ ...React, createPortal });
        const Root = adapt(prototypes.selectRoot);
        const Trigger = adapt(prototypes.selectTrigger);
        const Content = adapt(prototypes.selectContent);
        const Value = adapt(prototypes.selectValue);
        const Surface = adapt(prototypes.selectSurface);
        const Viewport = adapt(prototypes.selectViewport);
        const ItemText = adapt(prototypes.selectItemText);
        const Item = adapt(prototypes.selectItem);
        const refs: Record<string, any> = {};
        const host = document.createElement('div');
        document.body.append(host);
        const root = createRoot(host);
        const settle = async () => {
          await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
          });
        };
        const content = () => document.querySelector<HTMLElement>('.test-select-retained-content');
        const request = async (open: boolean) => {
          let accepted = false;
          await act(async () => {
            accepted = refs.root.getExposes().requestOpen({
              open,
              reason: 'programmatic',
              focusReason: 'programmatic',
            });
          });
          await settle();
          expect(accepted).toBe(true);
        };
        try {
          await act(async () => {
            root.render(
              React.createElement(
                Root,
                {
                  ref: (value: any) => {
                    refs.root = value;
                  },
                  defaultValue: 'alpha',
                },
                React.createElement(
                  Trigger,
                  { hostClassName: 'test-select-retained-trigger' },
                  React.createElement(Value, { hostClassName: 'test-select-retained-value' })
                ),
                React.createElement(
                  Content,
                  {
                    ref: (value: any) => {
                      refs.content = value;
                    },
                    hostClassName: 'test-select-retained-content',
                    position,
                    enterDuration: 0,
                    leaveDuration: 0,
                  },
                  React.createElement(
                    Surface,
                    {
                      hostClassName: 'test-select-retained-surface',
                      // Happy DOM does not supply browser-used zero defaults.
                      // Neutral fixture chrome keeps the real geometry guard meaningful.
                      style: { border: '1px solid black', padding: '0px', margin: '0px' },
                    },
                    React.createElement(
                      Viewport,
                      {
                        hostClassName: 'test-select-retained-viewport',
                        style: { padding: '4px', border: '0px', margin: '0px' },
                      },
                      React.createElement(
                        Item,
                        {
                          value: 'alpha',
                          textValue: 'Alpha',
                          hostClassName: 'test-select-retained-item',
                          style: { margin: '0px', padding: '0px', border: '0px' },
                        },
                        React.createElement(
                          ItemText,
                          { hostClassName: 'test-select-retained-item-text' },
                          'Alpha'
                        )
                      )
                    )
                  )
                )
              )
            );
          });
          await settle();
          await request(true);
          expect(content()?.getAttribute('role')).toBe('listbox');
          expect(refs.content.getExposes().alignmentDiagnostic.get()).toBe('');
          expect(refs.content.getExposes().transitionState.get()).toBe('entered');
          expect(document.querySelectorAll('[data-pui-portal-mount]')).toHaveLength(1);

          await request(false);
          expect(refs.content.getExposes().transitionState.get()).toBe('closed');
          expect(document.querySelectorAll('[data-pui-portal-mount]')).toHaveLength(0);

          await request(true);
          expect(refs.root.getExposes().open.get()).toBe(true);
          expect(refs.content.getExposes().open.get()).toBe(true);
          expect(refs.content.getExposes().alignmentDiagnostic.get()).toBe('');
          expect(refs.content.getExposes().transitionState.get()).toBe('entered');
          expect(content()?.getAttribute('role')).toBe('listbox');
          expect(document.querySelectorAll('[data-pui-portal-mount]')).toHaveLength(1);
        } finally {
          await act(async () => root.unmount());
          host.remove();
          vi.restoreAllMocks();
          if (priorOffsetParent)
            Object.defineProperty(HTMLElement.prototype, 'offsetParent', priorOffsetParent);
          else Reflect.deleteProperty(HTMLElement.prototype, 'offsetParent');
        }
      }
    );
  });
}
