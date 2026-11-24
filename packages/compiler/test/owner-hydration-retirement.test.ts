// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { loadGeneratedModule } from './button-ssr-fixture';
import { compileOwnerHydrationFixture } from './owner-hydration-fixture';

interface PublicState {
  get(): number;
}
interface GeneratedHost extends HTMLElement {
  hydrationStatus: string;
  logicalOwner: symbol | null;
  connectedCallback(): void;
  getExposes(): { value: PublicState };
  setProps(props: { seed: number }): void;
  dispose(): void;
}

let sequence = 0;
const mounted = new Set<GeneratedHost>();
afterEach(() => {
  for (const host of mounted) {
    host.dispose();
    host.remove();
  }
  mounted.clear();
  document.body.replaceChildren();
  document.head.replaceChildren();
});

function fixture() {
  const tagName = `pui-owner-retirement-${++sequence}`;
  const { files, server, css } = compileOwnerHydrationFixture(tagName);
  const client = loadGeneratedModule(files, 'Component.client.ts') as { register(): void };
  client.register();
  const inert = document.createElement('template');
  inert.innerHTML = server.renderToString({ seed: 3 }).html;
  const host = inert.content.firstElementChild as GeneratedHost;
  const stylesheet = document.createElement('style');
  stylesheet.setAttribute('data-pui-ssr-css', server.hydrationArtifacts.css);
  stylesheet.textContent = css;
  document.head.append(stylesheet);
  mounted.add(host);
  return host;
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('C-LIFECYCLE-OWNER-INITIALIZATION-0001-D/E: generated WC retirement', () => {
  it.each(['unmounted', 'disposed'])(
    'finishes a detached owner before a %s-triggered reconnect can publish its replacement',
    async (reconnectPhase) => {
      const host = fixture();
      const phases: string[] = [];
      const duringReconnect: (symbol | null)[] = [];
      let reconnect = true;
      host.addEventListener('phase', (event) => {
        const phase = (event as CustomEvent<string>).detail;
        phases.push(phase);
        if (phase === reconnectPhase && reconnect) {
          reconnect = false;
          document.body.append(host);
          duringReconnect.push(host.logicalOwner);
        }
      });
      document.body.append(host);
      expect(host.hydrationStatus).toBe('adopted');
      const originalOwner = host.logicalOwner;
      const originalState = host.getExposes().value;

      host.remove();
      await settle();
      expect(host.isConnected).toBe(true);
      expect(host.logicalOwner).not.toBeNull();
      expect(host.logicalOwner).not.toBe(originalOwner);
      expect(duringReconnect).toEqual([null]);
      expect(host.getExposes().value).not.toBe(originalState);
      expect(() => originalState.get()).toThrow(/disposed/i);
      expect(phases).toEqual(['created', 'mounted', 'unmounted', 'disposed', 'created', 'mounted']);
      // The old owner must not close the newly assigned port after the reconnect.
      host.setProps({ seed: 9 });
      await settle();
      expect(host.getExposes().value.get()).toBe(9);
      expect(host.querySelector('output')?.textContent).toBe('9');
      host.dispose();
      expect(phases.filter((phase) => phase === 'disposed')).toHaveLength(2);
    }
  );

  it('keeps explicit terminal disposal terminal even when its cleanup reconnects the element', async () => {
    const host = fixture();
    host.addEventListener('phase', (event) => {
      if ((event as CustomEvent<string>).detail === 'disposed') document.body.append(host);
    });
    document.body.append(host);
    const state = host.getExposes().value;
    host.dispose();
    await settle();
    expect(host.logicalOwner).toBeNull();
    expect(() => state.get()).toThrow(/disposed/i);
    expect(() => host.setProps({ seed: 9 })).toThrow(/disposed/i);
  });
});
