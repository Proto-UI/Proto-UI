import * as React from 'react';
import { tableCaption, tableCell, tableRoot, tableRow } from '@proto.ui/prototypes-base/table';

import { createReactAdapter } from '../src';

// The public adapter signature must accept the real React module emitted by
// the CLI (`import * as React from 'react'`) without a consumer-side cast.
createReactAdapter(React);

// Empty portable props must not forbid Adapter-owned presentation or children.
const adapt = createReactAdapter(React);
const Table = adapt(tableRoot);
const Caption = adapt(tableCaption);
const Row = adapt(tableRow);
const Cell = adapt(tableCell);
React.createElement(Table, {
  className: 'table',
  hostClassName: 'host',
  surfaceClassName: 'surface',
  style: { display: 'block' },
  hostStyle: { color: 'inherit' },
  surfaceStyle: { color: 'inherit' },
  children: 'content',
});
React.createElement(Caption, { className: 'caption', children: 'Purpose' });
React.createElement(Row, { className: 'row', children: 'Cells' });

// @ts-expect-error Empty portable props do not accept unknown business facts.
React.createElement(Table, { unknownProtoProp: true });
// @ts-expect-error Non-empty Prototype facts retain their original type.
React.createElement(Cell, { headers: 123 });
