import * as React from 'react';
import { createRoot } from 'react-dom/client';
import * as Radix from '@radix-ui/react-tabs';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { tabsRoot, tabsList, tabsTrigger, tabsContent } from '@proto.ui/prototypes-base/tabs';
import { applyMessage, projectSurface } from './mapping.mjs';
import type { Surface } from './mapping.mjs';
import input from './fixtures/settings.json';

const adapt = createReactAdapter(React);
const ProtoRoot = adapt(tabsRoot);
const ProtoList = adapt(tabsList);
const ProtoTrigger = adapt(tabsTrigger);
const ProtoContent = adapt(tabsContent);
const query = new URLSearchParams(location.search);
const mode = query.get('mode') === 'automatic' ? 'automatic' : 'manual';
const path = query.get('path') === 'ordinary' ? 'ordinary' : 'proto';
const mutation = query.get('mutation');
function initialMessage(): unknown {
  const initial = structuredClone(input[0]);
  const [root, ...remaining] = initial.createSurface.components;
  if (!root?.tabs?.length) throw new Error('Expected the pinned nonempty Tabs fixture');
  if (mutation === 'missing-label') {
    const { '@accessibility': omittedLabel, ...withoutLabel } = root;
    return {
      ...initial,
      createSurface: { ...initial.createSurface, components: [withoutLabel, ...remaining] },
    };
  }
  if (mutation !== 'dynamic-title') return initial;
  return {
    ...initial,
    createSurface: {
      ...initial.createSurface,
      components: [
        {
          ...root,
          tabs: root.tabs.map((tab, index) =>
            index === 0 ? { ...tab, title: { '@path': '/title' } } : tab
          ),
        },
        ...remaining,
      ],
    },
  };
}
const initial = initialMessage();

type Projected = ReturnType<typeof projectSurface>;
type SurfaceState = Surface | { rejected: string } | null;
type CatalogEvent = {
  type: string;
  trusted: boolean;
  key: string | null;
  role: string | null;
  name: string | null;
};

declare global {
  interface Window {
    __catalogStudy?: {
      apply(message: unknown): void;
      path: 'ordinary' | 'proto';
      mode: 'automatic' | 'manual';
    };
    __catalogMutationCount?: number;
    __catalogEvents?: CatalogEvent[];
  }
}

function OrdinaryCatalog({ model }: { model: Projected }) {
  return (
    <Radix.Root defaultValue={model.tabs[0].value} activationMode={mode} orientation="horizontal">
      <Radix.List aria-label={model.label} loop>
        {model.tabs.map((tab) => (
          <Radix.Trigger key={tab.value} value={tab.value}>
            {tab.title}
          </Radix.Trigger>
        ))}
      </Radix.List>
      {model.tabs.map((tab) => (
        <Radix.Content key={tab.value} value={tab.value}>
          <p>{tab.text}</p>
        </Radix.Content>
      ))}
    </Radix.Root>
  );
}

function ProtoCatalog({ model }: { model: Projected }) {
  return (
    <ProtoRoot defaultValue={model.tabs[0].value} activationMode={mode} orientation="horizontal">
      <ProtoList a11yLabel={model.label} loop>
        {model.tabs.map((tab) => (
          <ProtoTrigger key={tab.value} value={tab.value}>
            {tab.title}
          </ProtoTrigger>
        ))}
      </ProtoList>
      {model.tabs.map((tab) => (
        <ProtoContent key={tab.value} value={tab.value}>
          <p>{tab.text}</p>
        </ProtoContent>
      ))}
    </ProtoRoot>
  );
}

function Application() {
  const retired = React.useRef(new Set<string>());
  const [surface, setSurface] = React.useState<SurfaceState>(() => {
    try {
      return applyMessage(null, initial, retired.current);
    } catch (error) {
      return { rejected: String(error) };
    }
  });
  const surfaceRef = React.useRef(surface);
  const rejection = surface && 'rejected' in surface ? surface.rejected : null;
  const model = surface && !('rejected' in surface) ? projectSurface(surface) : null;
  React.useLayoutEffect(() => {
    surfaceRef.current = surface;
    window.__catalogStudy = {
      apply(message: unknown) {
        if (surfaceRef.current && 'rejected' in surfaceRef.current)
          throw new Error('Cannot update a rejected initial surface');
        const next = applyMessage(surfaceRef.current, message, retired.current);
        surfaceRef.current = next;
        setSurface(next);
      },
      path,
      mode,
    };
    return () => {
      delete window.__catalogStudy;
    };
  }, [surface]);
  return (
    <>
      <header>
        <p className="eyebrow">Pinned A2UI 1.0 · Tabs catalog experiment</p>
        <h1>Account settings</h1>
        <p className="summary">
          One declarative description, an ordinary catalog and a Proto UI catalog.
        </p>
      </header>
      <main>
        <section
          className="catalog"
          aria-label="Rendered catalog"
          onKeyDownCapture={
            mutation === 'swallowed-arrow'
              ? (event) => {
                  if (event.key === 'ArrowRight') {
                    window.__catalogMutationCount = (window.__catalogMutationCount ?? 0) + 1;
                    event.preventDefault();
                    event.stopPropagation();
                  }
                }
              : undefined
          }
        >
          {rejection ? (
            <p role="alert">{rejection}</p>
          ) : model ? (
            path === 'ordinary' ? (
              <OrdinaryCatalog key={model.id} model={model} />
            ) : (
              <ProtoCatalog key={model.id} model={model} />
            )
          ) : (
            <p role="status">Surface deleted</p>
          )}
        </section>
        <p className="caption">
          {path === 'ordinary' ? 'Radix React Tabs 1.1.13' : 'Proto UI Base Tabs · React Adapter'} ·{' '}
          {mode} activation
        </p>
        <button
          id="host-action"
          onClick={() => {
            document.getElementById('host-result')!.textContent = 'Host action completed';
          }}
        >
          Continue in host
        </button>
        <output id="host-result" aria-live="polite" />
      </main>
    </>
  );
}

const events: CatalogEvent[] = [];
for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click', 'focusin']) {
  document.addEventListener(
    type,
    (event) =>
      events.push({
        type,
        trusted: event.isTrusted,
        key: event instanceof KeyboardEvent ? event.key : null,
        role: event.target instanceof Element ? event.target.getAttribute('role') : null,
        name:
          event.target instanceof Element
            ? (event.target.textContent?.slice(0, 100) ?? null)
            : null,
      }),
    true
  );
}
window.__catalogEvents = events;
createRoot(document.getElementById('app')!).render(<Application />);
