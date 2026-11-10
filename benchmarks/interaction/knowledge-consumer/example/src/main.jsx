import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as Tabs from '@radix-ui/react-tabs';
import './style.css';

const sections = [
  { value: 'overview', label: 'Overview', text: 'A starting point for the reference.' },
  { value: 'unavailable', label: 'Unavailable', text: 'This section is unavailable.', disabled: true },
  { value: 'details', label: 'Details', text: 'The supporting details for this reference.' },
  { value: 'history', label: 'History', text: 'The changes recorded for this reference.' },
];

function ReferenceSections() {
  return (
    <Tabs.Root defaultValue="overview" orientation="horizontal" activationMode="manual">
      <Tabs.List className="tabs-list" aria-label="Reference sections" loop={true}>
        {sections.map(({ value, label, disabled }) => (
          <Tabs.Trigger key={value} className="tab" value={value} disabled={disabled}>
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {sections.map(({ value, label, text }) => (
        <Tabs.Content key={value} className="tab-panel" value={value}>
          <h2>{label}</h2>
          <p>{text}</p>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}

function App() {
  const [mounted, setMounted] = useState(true);
  const [afterActions, setAfterActions] = useState(0);

  return (
    <main>
      <header>
        <p className="eyebrow">Reference workspace</p>
        <h1>Explore the reference</h1>
        <p className="hint">Use the arrow keys to explore sections, then press Enter or Space to open one.</p>
      </header>
      <section className="reference-card" aria-label="Reference fixture">
        {mounted ? <ReferenceSections /> : <p role="status">Reference removed.</p>}
      </section>
      <div className="host-actions">
        <button type="button" disabled={!mounted} onClick={() => setMounted(false)}>
          Remove reference fixture
        </button>
        <button type="button" onClick={() => setAfterActions((count) => count + 1)}>
          After fixture
        </button>
      </div>
      <p className="host-result" role="status">After fixture action count: {afterActions}</p>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
