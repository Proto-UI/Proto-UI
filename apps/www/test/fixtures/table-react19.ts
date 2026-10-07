// Browser-only consumer fixture. No fake React hooks or manually assigned ARIA.
import { createReactAdapter } from '@proto.ui/adapter-react';
import {
  tableCaption,
  tableCell,
  tableHeaderCell,
  tableRoot,
  tableRow,
} from '@proto.ui/prototypes-base/table';
import type * as ReactTypes from 'react';

type ReactDOMClient = {
  createRoot(host: HTMLElement): { render(node: ReactTypes.ReactNode): void; unmount(): void };
};

export function mountTableReact19(
  host: HTMLElement,
  React: typeof ReactTypes,
  ReactDOM: ReactDOMClient
) {
  const adapt = createReactAdapter(React);
  const Table = adapt(tableRoot);
  const Caption = adapt(tableCaption);
  const Row = adapt(tableRow);
  const Header = adapt(tableHeaderCell);
  const Cell = adapt(tableCell);
  const element = React.createElement;

  function App() {
    const [invalid, setInvalid] = React.useState(false);
    const [reversed, setReversed] = React.useState(false);
    return element(
      React.Fragment,
      null,
      element(
        'button',
        { 'data-table-action': 'invalidate', onClick: () => setInvalid(true) },
        'Invalidate header'
      ),
      element(
        'button',
        { 'data-table-action': 'recover', onClick: () => setInvalid(false) },
        'Recover header'
      ),
      element(
        'button',
        { 'data-table-action': 'reverse', onClick: () => setReversed(!reversed) },
        'Reverse header order'
      ),
      element(
        Table,
        { className: 'fixture-table' },
        element(Caption, { className: 'fixture-caption' }, 'Quarterly accounts'),
        element(
          Row,
          { className: 'fixture-heading-row' },
          element(
            Header,
            {
              className: 'fixture-quarter',
              headerKey: 'quarter-key',
              headerKind: 'column',
              columnSpan: 3,
            },
            'Quarter'
          )
        ),
        element(
          Row,
          { className: 'fixture-data-row' },
          element(
            Header,
            { className: 'fixture-owner', headerKey: 'owner-key', headerKind: 'row', rowSpan: 2 },
            'Owner'
          ),
          element(
            Cell,
            {
              className: 'fixture-value',
              columnSpan: 2,
              headers: invalid
                ? ['missing-key']
                : reversed
                  ? ['quarter-key', 'owner-key']
                  : ['owner-key', 'quarter-key'],
            },
            'Ada'
          )
        ),
        element(
          Row,
          { className: 'fixture-tail-row' },
          element(
            Cell,
            { className: 'fixture-tail', columnSpan: 2, headers: ['quarter-key', 'owner-key'] },
            'Byron'
          )
        )
      )
    );
  }

  const root = ReactDOM.createRoot(host);
  root.render(element(App));
  return () => root.unmount();
}
