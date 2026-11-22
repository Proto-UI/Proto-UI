import * as React from 'react';
import { createRoot } from 'react-dom/client';
import * as Radix from '@radix-ui/react-tabs';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { tabsRoot, tabsList, tabsTrigger, tabsContent } from '@proto.ui/prototypes-base/tabs';
import { applyMessage, projectSurface } from './mapping.mjs';
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
const initial = structuredClone(input[0]);
if (mutation === 'missing-label') delete initial.createSurface.components[0]['@accessibility'];
if (mutation === 'dynamic-title') initial.createSurface.components[0].tabs[0].title = { '@path': '/title' } as never;

type Projected = ReturnType<typeof projectSurface>;

function OrdinaryCatalog({ model }: { model: Projected }) {
  return <Radix.Root defaultValue={model.tabs[0].value} activationMode={mode} orientation="horizontal">
    <Radix.List aria-label={model.label} loop>
      {model.tabs.map((tab) => <Radix.Trigger key={tab.value} value={tab.value}>{tab.title}</Radix.Trigger>)}
    </Radix.List>
    {model.tabs.map((tab) => <Radix.Content key={tab.value} value={tab.value}><p>{tab.text}</p></Radix.Content>)}
  </Radix.Root>;
}

function ProtoCatalog({ model }: { model: Projected }) {
  return <ProtoRoot defaultValue={model.tabs[0].value} activationMode={mode} orientation="horizontal">
    <ProtoList a11yLabel={model.label} loop>
      {model.tabs.map((tab) => <ProtoTrigger key={tab.value} value={tab.value}>{tab.title}</ProtoTrigger>)}
    </ProtoList>
    {model.tabs.map((tab) => <ProtoContent key={tab.value} value={tab.value}><p>{tab.text}</p></ProtoContent>)}
  </ProtoRoot>;
}

function Application() {
  const retired = React.useRef(new Set<string>());
  const [surface, setSurface] = React.useState(() => {
    try { return applyMessage(null, initial, retired.current); }
    catch (error) { return { rejected: String(error) }; }
  });
  const surfaceRef = React.useRef(surface);
  const model = surface && !surface.rejected ? projectSurface(surface) : null;
  React.useLayoutEffect(() => {
    surfaceRef.current = surface;
    (window as any).__catalogStudy = {
      apply(message: unknown) {
        const next = applyMessage(surfaceRef.current, message, retired.current);
        surfaceRef.current = next;
        setSurface(next);
      },
      path, mode,
    };
    return () => { delete (window as any).__catalogStudy; };
  }, [surface]);
  return <>
    <header><p className="eyebrow">Pinned A2UI 1.0 · Tabs catalog experiment</p><h1>Account settings</h1>
      <p className="summary">One declarative description, an ordinary catalog and a Proto UI catalog.</p></header>
    <main>
      <section className="catalog" aria-label="Rendered catalog"
        onKeyDownCapture={mutation === 'swallowed-arrow' ? (event) => {
          if (event.key === 'ArrowRight') {
            (window as any).__catalogMutationCount = ((window as any).__catalogMutationCount ?? 0) + 1;
            event.preventDefault(); event.stopPropagation();
          }
        } : undefined}>
        {surface?.rejected ? <p role="alert">{surface.rejected}</p> : model ?
          path === 'ordinary' ? <OrdinaryCatalog key={model.id} model={model} /> : <ProtoCatalog key={model.id} model={model} />
          : <p role="status">Surface deleted</p>}
      </section>
      <p className="caption">{path === 'ordinary' ? 'Radix React Tabs 1.1.13' : 'Proto UI Base Tabs · React Adapter'} · {mode} activation</p>
      <button id="host-action" onClick={() => { document.getElementById('host-result')!.textContent = 'Host action completed'; }}>Continue in host</button>
      <output id="host-result" aria-live="polite" />
    </main>
  </>;
}

const events: unknown[] = [];
for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click', 'focusin']) {
  document.addEventListener(type, (event) => events.push({ type, trusted: event.isTrusted,
    key: (event as KeyboardEvent).key ?? null,
    role: (event.target as Element)?.getAttribute?.('role') ?? null,
    name: (event.target as Element)?.textContent?.slice(0, 100) ?? null }), true);
}
(window as any).__catalogEvents = events;
createRoot(document.getElementById('app')!).render(<Application />);
