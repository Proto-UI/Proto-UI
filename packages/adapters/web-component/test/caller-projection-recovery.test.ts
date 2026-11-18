import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent } from '../src';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';

let id = 0;

// The original native18 remains the selected-text oracle. These cases cover
// recovery admission and the shell slot's lifetime after owner retirement.
describe('failed initial split caller projection recovery', () => {
  it.each(['restore', 'adopt', 'remove nested', 'replace nested'] as const)(
    'retains a caller-only slot only after a complete rollback (%s)',
    async (mutation) => {
      const suffix = ++id;
      const reactionTag = `pui-caller-recovery-reaction-${suffix}`;
      const input = document.createElement('input');
      input.value = 'Caller';
      const container = document.createElement('div');
      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Action');
      container.append(button);
      const caller = mutation === 'restore' || mutation === 'adopt' ? input : container;
      const foreign = document.implementation.createHTMLDocument();
      let reacted = false;
      customElements.define(
        reactionTag,
        class extends HTMLElement {
          connectedCallback() {
            if (reacted) return;
            reacted = true;
            if (mutation === 'remove nested') button.remove();
            else if (mutation === 'replace nested') button.replaceWith(button.cloneNode());
            else {
              input.value = 'Reset';
              if (mutation === 'adopt') foreign.body.append(foreign.adoptNode(input));
            }
          }
        }
      );
      const environmentListeners = new Set<() => void>();
      let staleClicks = 0;
      const { promise: disposed, resolve: finishDisposal } = Promise.withResolvers<void>();
      const C = AdaptToWebComponent(
        definePrototype({
          name: `pui-caller-recovery-${suffix}`,
          setup(def) {
            const target = def.feedback.style.declareDecoration();
            def.event.on('host:click', () => staleClicks++);
            def.expose.method('ping', () => 'live');
            return (r) => [r.decoration(target), r.slot(), r.el(reactionTag, {})];
          },
        }),
        {
          shadow: {
            mode: 'open',
            presentation: 'split',
            styleArtifact: renderProtoShadowSplitStyleArtifact([]),
            colorSchemeSource: {
              get: () => 'light',
              subscribe(listener) {
                environmentListeners.add(listener);
                return () => environmentListeners.delete(listener);
              },
            },
          },
          diagnostics: {
            onLifecycleEvent(event) {
              if (event.type === 'instance.dispose.done') finishDisposal();
            },
          },
          schedule: (task) => task(),
        }
      );
      const host = new C();
      host.append(caller);
      const errors: unknown[] = [];
      const capture = (event: ErrorEvent) => {
        errors.push(event.error);
        event.preventDefault();
      };
      window.addEventListener('error', capture);
      try {
        try {
          document.body.append(host);
        } catch (error) {
          errors.push(error);
        }
        expect(reacted).toBe(true);
        expect(errors).toHaveLength(1);
        await disposed;
        expect(errors[0]).toBeInstanceOf(Error);
        expect((errors[0] as Error).name).toBe('Error');
        expect((errors[0] as Error).message).toContain('decoration caller projection changed');
        expect(environmentListeners.size).toBe(0);
        expect(host.getExposes?.() ?? {}).toEqual({});
        expect(host.hasAttribute('data-pui-color-scheme')).toBe(false);
        expect(host.hasAttribute('data-pui-split-root-style')).toBe(false);
        host.click();
        expect(staleClicks).toBe(0);
        const root = host.shadowRoot!;
        if (mutation === 'adopt') {
          expect(caller.ownerDocument).toBe(foreign);
          expect(caller.parentNode).toBe(foreign.body);
          expect(input.value).toBe('Reset');
          expect(root.childNodes).toHaveLength(0);
          return;
        }
        expect(host.firstChild).toBe(caller);
        if (caller === input) expect(input.value).toBe('Caller');
        else {
          expect(container.firstChild).toBe(button);
          expect(button.nextSibling).toBeNull();
        }
        expect(root.childNodes).toHaveLength(1);
        const recoverySlot = root.firstChild as HTMLSlotElement;
        expect(recoverySlot.localName).toBe('slot');
        expect(recoverySlot.attributes).toHaveLength(0);
        expect(recoverySlot.childNodes).toHaveLength(0);
        const recoveredAssignments = recoverySlot.assignedNodes();
        expect(recoveredAssignments).toHaveLength(1);
        expect(recoveredAssignments[0]).toBe(caller);

        host.remove();
        await Promise.resolve();
        document.body.append(host);
        expect(errors).toHaveLength(1);
        expect(recoverySlot.parentNode).toBeNull();
        const surface = root.querySelector('[part="surface"]')!;
        expect(surface).not.toBeNull();
        expect(root.querySelectorAll('slot')).toHaveLength(1);
        const publishedAssignments = surface.querySelector('slot')!.assignedNodes();
        expect(publishedAssignments).toHaveLength(1);
        expect(publishedAssignments[0]).toBe(caller);
        const exposes = host.getExposes();
        if (typeof exposes.ping !== 'function') throw new Error('Missing public ping method.');
        expect(exposes.ping()).toBe('live');
      } finally {
        host.remove();
        await Promise.resolve();
        window.removeEventListener('error', capture);
      }
    }
  );
});
