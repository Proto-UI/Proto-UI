import * as React from 'react';
import { readPreferences } from './storage';

export function App() {
  const [name, setName] = React.useState(() => readPreferences().displayName);
  const [failSave, setFailSave] = React.useState(false);
  return (
    <main>
      <h1>Preferences</h1>
      <label htmlFor="display-name">Display name</label>
      <input id="display-name" value={name} onChange={(event) => setName(event.target.value)} />
      <label className="error-control">
        <input type="checkbox" checked={failSave} onChange={(event) => setFailSave(event.target.checked)} />
        Inject a storage error for the debugging exercise
      </label>
      <p role="status">No changes saved in this session.</p>
    </main>
  );
}
