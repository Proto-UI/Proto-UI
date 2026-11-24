import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-toolbar': formatCode(`
<wc-shadcn-toolbar-root style-profile="rhea" a11y-label="Document actions">
  <wc-shadcn-toolbar-button style-profile="rhea" value="undo">Undo</wc-shadcn-toolbar-button>
  <wc-shadcn-toolbar-button style-profile="rhea" value="redo">Redo</wc-shadcn-toolbar-button>
  <wc-shadcn-toolbar-separator style-profile="rhea"></wc-shadcn-toolbar-separator>
  <wc-shadcn-toolbar-button style-profile="rhea" value="cut">Cut</wc-shadcn-toolbar-button>
  <wc-shadcn-toolbar-button style-profile="rhea" value="copy">Copy</wc-shadcn-toolbar-button>
  <wc-shadcn-toolbar-button style-profile="rhea" value="paste" disabled>Paste</wc-shadcn-toolbar-button>
  <wc-shadcn-toolbar-separator style-profile="rhea"></wc-shadcn-toolbar-separator>
  <wc-shadcn-toolbar-button style-profile="rhea" value="save" variant="default">Save</wc-shadcn-toolbar-button>
</wc-shadcn-toolbar-root>
    `),
    'demo-shadcn-toolbar-variants': formatCode(`
<wc-shadcn-toolbar-root style-profile="rhea" a11y-label="Button variants">
  <wc-shadcn-toolbar-button style-profile="rhea" value="ghost" variant="ghost">Ghost</wc-shadcn-toolbar-button>
  <wc-shadcn-toolbar-button style-profile="rhea" value="outline" variant="outline">Outline</wc-shadcn-toolbar-button>
  <wc-shadcn-toolbar-button style-profile="rhea" value="secondary" variant="secondary">Secondary</wc-shadcn-toolbar-button>
  <wc-shadcn-toolbar-separator style-profile="rhea"></wc-shadcn-toolbar-separator>
  <wc-shadcn-toolbar-button style-profile="rhea" value="default" variant="default">Publish</wc-shadcn-toolbar-button>
  <wc-shadcn-toolbar-button style-profile="rhea" value="delete" variant="destructive">Delete</wc-shadcn-toolbar-button>
</wc-shadcn-toolbar-root>
    `),
    'demo-shadcn-toolbar-sizes': formatCode(`
<wc-shadcn-toolbar-root style-profile="rhea" a11y-label="Compact formatting toolbar">
  <wc-shadcn-toolbar-button style-profile="rhea" value="bold" size="icon">
    <span aria-hidden="true">B</span><span class="sr-only">Bold</span>
  </wc-shadcn-toolbar-button>
  <wc-shadcn-toolbar-button style-profile="rhea" value="italic" size="icon">
    <span aria-hidden="true">I</span><span class="sr-only">Italic</span>
  </wc-shadcn-toolbar-button>
  <wc-shadcn-toolbar-separator style-profile="rhea"></wc-shadcn-toolbar-separator>
  <wc-shadcn-toolbar-button style-profile="rhea" value="comment" size="sm">Small</wc-shadcn-toolbar-button>
  <wc-shadcn-toolbar-button style-profile="rhea" value="share" size="default" variant="outline">Default</wc-shadcn-toolbar-button>
  <wc-shadcn-toolbar-button style-profile="rhea" value="export" size="lg" variant="secondary">Large</wc-shadcn-toolbar-button>
</wc-shadcn-toolbar-root>
    `),
    'demo-shadcn-toolbar-vertical': formatCode(`
<wc-shadcn-toolbar-root style-profile="rhea" orientation="vertical" a11y-label="Canvas tools">
  <wc-shadcn-toolbar-button style-profile="rhea" value="select">Select</wc-shadcn-toolbar-button>
  <wc-shadcn-toolbar-button style-profile="rhea" value="frame">Frame</wc-shadcn-toolbar-button>
  <wc-shadcn-toolbar-button style-profile="rhea" value="text">Text</wc-shadcn-toolbar-button>
  <wc-shadcn-toolbar-separator style-profile="rhea"></wc-shadcn-toolbar-separator>
  <wc-shadcn-toolbar-button style-profile="rhea" value="zoom-in">Zoom In</wc-shadcn-toolbar-button>
  <wc-shadcn-toolbar-button style-profile="rhea" value="zoom-out">Zoom Out</wc-shadcn-toolbar-button>
</wc-shadcn-toolbar-root>
    `),
    'demo-shadcn-toolbar-disabled': formatCode(`
<div class="grid justify-items-center gap-4">
  <wc-shadcn-toolbar-root style-profile="rhea" disabled a11y-label="Read-only actions">
    <wc-shadcn-toolbar-button style-profile="rhea" value="undo">Undo</wc-shadcn-toolbar-button>
    <wc-shadcn-toolbar-button style-profile="rhea" value="redo">Redo</wc-shadcn-toolbar-button>
    <wc-shadcn-toolbar-separator style-profile="rhea"></wc-shadcn-toolbar-separator>
    <wc-shadcn-toolbar-button style-profile="rhea" value="save" variant="default">Save</wc-shadcn-toolbar-button>
  </wc-shadcn-toolbar-root>

  <wc-shadcn-toolbar-root style-profile="rhea" loop="false" a11y-label="Bounded actions">
    <wc-shadcn-toolbar-button style-profile="rhea" value="back">Back</wc-shadcn-toolbar-button>
    <wc-shadcn-toolbar-button style-profile="rhea" value="forward" disabled>Forward</wc-shadcn-toolbar-button>
    <wc-shadcn-toolbar-button style-profile="rhea" value="reload">Reload</wc-shadcn-toolbar-button>
  </wc-shadcn-toolbar-root>
</div>
    `),
    'demo-brutalist-toolbar': formatCode(`
<wc-brutalist-toolbar-root a11y-label="Document actions">
  <wc-brutalist-toolbar-button value="undo">Undo</wc-brutalist-toolbar-button>
  <wc-brutalist-toolbar-button value="redo">Redo</wc-brutalist-toolbar-button>
  <wc-brutalist-toolbar-separator></wc-brutalist-toolbar-separator>
  <wc-brutalist-toolbar-button value="cut">Cut</wc-brutalist-toolbar-button>
  <wc-brutalist-toolbar-button value="copy">Copy</wc-brutalist-toolbar-button>
  <wc-brutalist-toolbar-button value="paste" disabled>Paste</wc-brutalist-toolbar-button>
  <wc-brutalist-toolbar-separator></wc-brutalist-toolbar-separator>
  <wc-brutalist-toolbar-button value="save" variant="solid">Save</wc-brutalist-toolbar-button>
</wc-brutalist-toolbar-root>
    `),
    'demo-brutalist-toolbar-variants': formatCode(`
<wc-brutalist-toolbar-root a11y-label="Brutalist toolbar variants">
  <wc-brutalist-toolbar-button value="bold" size="icon">
    <span aria-hidden="true">B</span><span class="sr-only">Bold</span>
  </wc-brutalist-toolbar-button>
  <wc-brutalist-toolbar-button value="preview" size="sm" variant="surface">Small</wc-brutalist-toolbar-button>
  <wc-brutalist-toolbar-separator></wc-brutalist-toolbar-separator>
  <wc-brutalist-toolbar-button value="publish" variant="solid">Publish</wc-brutalist-toolbar-button>
  <wc-brutalist-toolbar-button value="delete" variant="destructive">Delete</wc-brutalist-toolbar-button>
</wc-brutalist-toolbar-root>
    `),
    'demo-brutalist-toolbar-vertical': formatCode(`
<wc-brutalist-toolbar-root orientation="vertical" a11y-label="Canvas tools">
  <wc-brutalist-toolbar-button value="select">Select</wc-brutalist-toolbar-button>
  <wc-brutalist-toolbar-button value="frame">Frame</wc-brutalist-toolbar-button>
  <wc-brutalist-toolbar-separator></wc-brutalist-toolbar-separator>
  <wc-brutalist-toolbar-button value="zoom-in">Zoom In</wc-brutalist-toolbar-button>
  <wc-brutalist-toolbar-button value="zoom-out">Zoom Out</wc-brutalist-toolbar-button>
</wc-brutalist-toolbar-root>
    `),
    'demo-brutalist-toolbar-disabled': formatCode(`
<div class="grid justify-items-center gap-4">
  <wc-brutalist-toolbar-root disabled a11y-label="Read-only actions">
    <wc-brutalist-toolbar-button value="undo">Undo</wc-brutalist-toolbar-button>
    <wc-brutalist-toolbar-button value="redo">Redo</wc-brutalist-toolbar-button>
    <wc-brutalist-toolbar-separator></wc-brutalist-toolbar-separator>
    <wc-brutalist-toolbar-button value="save" variant="solid">Save</wc-brutalist-toolbar-button>
  </wc-brutalist-toolbar-root>

  <wc-brutalist-toolbar-root loop="false" a11y-label="Bounded actions">
    <wc-brutalist-toolbar-button value="back">Back</wc-brutalist-toolbar-button>
    <wc-brutalist-toolbar-button value="forward" disabled>Forward</wc-brutalist-toolbar-button>
    <wc-brutalist-toolbar-button value="reload">Reload</wc-brutalist-toolbar-button>
  </wc-brutalist-toolbar-root>
</div>
    `),
    'demo-bootstrap-2-3-2-toolbar': formatCode(`
<wc-bootstrap-2-3-2-toolbar-root a11y-label="Document actions">
  <wc-bootstrap-2-3-2-toolbar-button value="undo">Undo</wc-bootstrap-2-3-2-toolbar-button>
  <wc-bootstrap-2-3-2-toolbar-button value="redo">Redo</wc-bootstrap-2-3-2-toolbar-button>
  <wc-bootstrap-2-3-2-toolbar-separator></wc-bootstrap-2-3-2-toolbar-separator>
  <wc-bootstrap-2-3-2-toolbar-button value="cut">Cut</wc-bootstrap-2-3-2-toolbar-button>
  <wc-bootstrap-2-3-2-toolbar-button value="copy">Copy</wc-bootstrap-2-3-2-toolbar-button>
  <wc-bootstrap-2-3-2-toolbar-button value="paste" disabled>Paste</wc-bootstrap-2-3-2-toolbar-button>
  <wc-bootstrap-2-3-2-toolbar-separator></wc-bootstrap-2-3-2-toolbar-separator>
  <wc-bootstrap-2-3-2-toolbar-button value="save" variant="primary">Save</wc-bootstrap-2-3-2-toolbar-button>
</wc-bootstrap-2-3-2-toolbar-root>
    `),
    'demo-bootstrap-2-3-2-toolbar-variants': formatCode(`
<wc-bootstrap-2-3-2-toolbar-root a11y-label="Classic Bootstrap variants">
  <wc-bootstrap-2-3-2-toolbar-button value="default" variant="default">Default</wc-bootstrap-2-3-2-toolbar-button>
  <wc-bootstrap-2-3-2-toolbar-button value="primary" variant="primary">Primary</wc-bootstrap-2-3-2-toolbar-button>
  <wc-bootstrap-2-3-2-toolbar-button value="success" variant="success">Success</wc-bootstrap-2-3-2-toolbar-button>
  <wc-bootstrap-2-3-2-toolbar-separator></wc-bootstrap-2-3-2-toolbar-separator>
  <wc-bootstrap-2-3-2-toolbar-button value="warning" variant="warning">Warning</wc-bootstrap-2-3-2-toolbar-button>
  <wc-bootstrap-2-3-2-toolbar-button value="danger" variant="danger">Danger</wc-bootstrap-2-3-2-toolbar-button>
  <wc-bootstrap-2-3-2-toolbar-button value="inverse" variant="inverse" size="small">Small</wc-bootstrap-2-3-2-toolbar-button>
</wc-bootstrap-2-3-2-toolbar-root>
    `),
    'demo-bootstrap-2-3-2-toolbar-vertical': formatCode(`
<wc-bootstrap-2-3-2-toolbar-root orientation="vertical" a11y-label="Vertical command bar">
  <wc-bootstrap-2-3-2-toolbar-button value="align-left">Align Left</wc-bootstrap-2-3-2-toolbar-button>
  <wc-bootstrap-2-3-2-toolbar-button value="align-center">Align Center</wc-bootstrap-2-3-2-toolbar-button>
  <wc-bootstrap-2-3-2-toolbar-separator></wc-bootstrap-2-3-2-toolbar-separator>
  <wc-bootstrap-2-3-2-toolbar-button value="indent">Indent</wc-bootstrap-2-3-2-toolbar-button>
  <wc-bootstrap-2-3-2-toolbar-button value="outdent">Outdent</wc-bootstrap-2-3-2-toolbar-button>
</wc-bootstrap-2-3-2-toolbar-root>
    `),
    'demo-bootstrap-2-3-2-toolbar-disabled': formatCode(`
<div class="grid justify-items-center gap-4">
  <wc-bootstrap-2-3-2-toolbar-root disabled a11y-label="Read-only actions">
    <wc-bootstrap-2-3-2-toolbar-button value="undo">Undo</wc-bootstrap-2-3-2-toolbar-button>
    <wc-bootstrap-2-3-2-toolbar-button value="redo">Redo</wc-bootstrap-2-3-2-toolbar-button>
    <wc-bootstrap-2-3-2-toolbar-separator></wc-bootstrap-2-3-2-toolbar-separator>
    <wc-bootstrap-2-3-2-toolbar-button value="save" variant="primary">Save</wc-bootstrap-2-3-2-toolbar-button>
  </wc-bootstrap-2-3-2-toolbar-root>

  <wc-bootstrap-2-3-2-toolbar-root loop="false" a11y-label="Bounded actions">
    <wc-bootstrap-2-3-2-toolbar-button value="back">Back</wc-bootstrap-2-3-2-toolbar-button>
    <wc-bootstrap-2-3-2-toolbar-button value="forward" disabled>Forward</wc-bootstrap-2-3-2-toolbar-button>
    <wc-bootstrap-2-3-2-toolbar-button value="reload">Reload</wc-bootstrap-2-3-2-toolbar-button>
  </wc-bootstrap-2-3-2-toolbar-root>
</div>
    `),
    'demo-liquid-glass-toolbar': formatCode(`
<wc-liquid-glass-toolbar-root a11y-label="Document actions">
  <wc-liquid-glass-toolbar-button value="undo">Undo</wc-liquid-glass-toolbar-button>
  <wc-liquid-glass-toolbar-button value="redo">Redo</wc-liquid-glass-toolbar-button>
  <wc-liquid-glass-toolbar-separator></wc-liquid-glass-toolbar-separator>
  <wc-liquid-glass-toolbar-button value="share">Share</wc-liquid-glass-toolbar-button>
  <wc-liquid-glass-toolbar-button value="paste" disabled>Paste</wc-liquid-glass-toolbar-button>
  <wc-liquid-glass-toolbar-separator></wc-liquid-glass-toolbar-separator>
  <wc-liquid-glass-toolbar-button value="publish" variant="prominent">Publish</wc-liquid-glass-toolbar-button>
</wc-liquid-glass-toolbar-root>
    `),
    'demo-liquid-glass-toolbar-prominence': formatCode(`
<div class="grid justify-items-center gap-4">
  <wc-liquid-glass-toolbar-root a11y-label="Glass prominence toolbar">
    <wc-liquid-glass-toolbar-button value="reply" variant="regular">Reply</wc-liquid-glass-toolbar-button>
    <wc-liquid-glass-toolbar-button value="archive" variant="regular" size="sm">Archive</wc-liquid-glass-toolbar-button>
    <wc-liquid-glass-toolbar-separator></wc-liquid-glass-toolbar-separator>
    <wc-liquid-glass-toolbar-button value="send" variant="prominent">Send</wc-liquid-glass-toolbar-button>
    <wc-liquid-glass-toolbar-button value="trash" variant="destructive">Delete</wc-liquid-glass-toolbar-button>
  </wc-liquid-glass-toolbar-root>

  <wc-liquid-glass-toolbar-root material="opaque" a11y-label="Opaque fallback toolbar">
    <wc-liquid-glass-toolbar-button value="opaque-regular" variant="regular">Opaque Surface</wc-liquid-glass-toolbar-button>
    <wc-liquid-glass-toolbar-separator></wc-liquid-glass-toolbar-separator>
    <wc-liquid-glass-toolbar-button value="opaque-prominent" variant="prominent">Confirm</wc-liquid-glass-toolbar-button>
  </wc-liquid-glass-toolbar-root>
</div>
    `),
    'demo-liquid-glass-toolbar-vertical': formatCode(`
<wc-liquid-glass-toolbar-root orientation="vertical" a11y-label="Floating canvas tools">
  <wc-liquid-glass-toolbar-button value="select">Select</wc-liquid-glass-toolbar-button>
  <wc-liquid-glass-toolbar-button value="crop">Crop</wc-liquid-glass-toolbar-button>
  <wc-liquid-glass-toolbar-separator></wc-liquid-glass-toolbar-separator>
  <wc-liquid-glass-toolbar-button value="adjust">Adjust</wc-liquid-glass-toolbar-button>
  <wc-liquid-glass-toolbar-button value="done" variant="prominent">Done</wc-liquid-glass-toolbar-button>
</wc-liquid-glass-toolbar-root>
    `),
    'demo-liquid-glass-toolbar-disabled': formatCode(`
<div class="grid justify-items-center gap-4">
  <wc-liquid-glass-toolbar-root disabled a11y-label="Read-only actions">
    <wc-liquid-glass-toolbar-button value="undo">Undo</wc-liquid-glass-toolbar-button>
    <wc-liquid-glass-toolbar-button value="redo">Redo</wc-liquid-glass-toolbar-button>
    <wc-liquid-glass-toolbar-separator></wc-liquid-glass-toolbar-separator>
    <wc-liquid-glass-toolbar-button value="publish" variant="prominent">Publish</wc-liquid-glass-toolbar-button>
  </wc-liquid-glass-toolbar-root>

  <wc-liquid-glass-toolbar-root loop="false" a11y-label="Bounded actions">
    <wc-liquid-glass-toolbar-button value="back">Back</wc-liquid-glass-toolbar-button>
    <wc-liquid-glass-toolbar-button value="forward" disabled>Forward</wc-liquid-glass-toolbar-button>
    <wc-liquid-glass-toolbar-button value="reload">Reload</wc-liquid-glass-toolbar-button>
  </wc-liquid-glass-toolbar-root>
</div>
    `),
  },
  react: {
    'demo-shadcn-toolbar': formatCode(`
import { useState } from 'react';
import {
  ShadcnToolbarButton,
  ShadcnToolbarRoot,
  ShadcnToolbarSeparator,
} from '../proto-ui/components/react';

export function ToolbarDemo() {
  const [status, setStatus] = useState('Use Arrow keys to navigate commands, or activate a button.');

  return (
    <div className="grid justify-items-center gap-3">
      <ShadcnToolbarRoot styleProfile="rhea" a11yLabel="Document actions">
        <ShadcnToolbarButton styleProfile="rhea" value="undo" onAction={() => setStatus('Undo last edit')}>
          Undo
        </ShadcnToolbarButton>
        <ShadcnToolbarButton styleProfile="rhea" value="redo" onAction={() => setStatus('Redo edit')}>
          Redo
        </ShadcnToolbarButton>
        <ShadcnToolbarSeparator styleProfile="rhea" />
        <ShadcnToolbarButton styleProfile="rhea" value="cut" onAction={() => setStatus('Cut selection')}>
          Cut
        </ShadcnToolbarButton>
        <ShadcnToolbarButton styleProfile="rhea" value="copy" onAction={() => setStatus('Copy selection')}>
          Copy
        </ShadcnToolbarButton>
        <ShadcnToolbarButton styleProfile="rhea" value="paste" disabled>
          Paste
        </ShadcnToolbarButton>
        <ShadcnToolbarSeparator styleProfile="rhea" />
        <ShadcnToolbarButton
          styleProfile="rhea"
          value="save"
          variant="default"
          onAction={() => setStatus('Document saved')}
        >
          Save
        </ShadcnToolbarButton>
      </ShadcnToolbarRoot>
      <div role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {status}
      </div>
    </div>
  );
}
    `),
    'demo-shadcn-toolbar-variants': formatCode(`
import {
  ShadcnToolbarButton,
  ShadcnToolbarRoot,
  ShadcnToolbarSeparator,
} from '../proto-ui/components/react';

export function ToolbarVariantsDemo() {
  return (
    <ShadcnToolbarRoot styleProfile="rhea" a11yLabel="Button variants">
      <ShadcnToolbarButton styleProfile="rhea" value="ghost" variant="ghost">Ghost</ShadcnToolbarButton>
      <ShadcnToolbarButton styleProfile="rhea" value="outline" variant="outline">Outline</ShadcnToolbarButton>
      <ShadcnToolbarButton styleProfile="rhea" value="secondary" variant="secondary">Secondary</ShadcnToolbarButton>
      <ShadcnToolbarSeparator styleProfile="rhea" />
      <ShadcnToolbarButton styleProfile="rhea" value="default" variant="default">Publish</ShadcnToolbarButton>
      <ShadcnToolbarButton styleProfile="rhea" value="delete" variant="destructive">Delete</ShadcnToolbarButton>
    </ShadcnToolbarRoot>
  );
}
    `),
    'demo-shadcn-toolbar-sizes': formatCode(`
import {
  ShadcnToolbarButton,
  ShadcnToolbarRoot,
  ShadcnToolbarSeparator,
} from '../proto-ui/components/react';

export function ToolbarSizesDemo() {
  return (
    <ShadcnToolbarRoot styleProfile="rhea" a11yLabel="Compact formatting toolbar">
      <ShadcnToolbarButton styleProfile="rhea" value="bold" size="icon">
        <span aria-hidden="true">B</span>
        <span className="sr-only">Bold</span>
      </ShadcnToolbarButton>
      <ShadcnToolbarButton styleProfile="rhea" value="italic" size="icon">
        <span aria-hidden="true">I</span>
        <span className="sr-only">Italic</span>
      </ShadcnToolbarButton>
      <ShadcnToolbarSeparator styleProfile="rhea" />
      <ShadcnToolbarButton styleProfile="rhea" value="comment" size="sm">Small</ShadcnToolbarButton>
      <ShadcnToolbarButton styleProfile="rhea" value="share" size="default" variant="outline">Default</ShadcnToolbarButton>
      <ShadcnToolbarButton styleProfile="rhea" value="export" size="lg" variant="secondary">Large</ShadcnToolbarButton>
    </ShadcnToolbarRoot>
  );
}
    `),
    'demo-shadcn-toolbar-vertical': formatCode(`
import {
  ShadcnToolbarButton,
  ShadcnToolbarRoot,
  ShadcnToolbarSeparator,
} from '../proto-ui/components/react';

export function ToolbarVerticalDemo() {
  return (
    <ShadcnToolbarRoot styleProfile="rhea" orientation="vertical" a11yLabel="Canvas tools">
      <ShadcnToolbarButton styleProfile="rhea" value="select">Select</ShadcnToolbarButton>
      <ShadcnToolbarButton styleProfile="rhea" value="frame">Frame</ShadcnToolbarButton>
      <ShadcnToolbarButton styleProfile="rhea" value="text">Text</ShadcnToolbarButton>
      <ShadcnToolbarSeparator styleProfile="rhea" />
      <ShadcnToolbarButton styleProfile="rhea" value="zoom-in">Zoom In</ShadcnToolbarButton>
      <ShadcnToolbarButton styleProfile="rhea" value="zoom-out">Zoom Out</ShadcnToolbarButton>
    </ShadcnToolbarRoot>
  );
}
    `),
    'demo-shadcn-toolbar-disabled': formatCode(`
import {
  ShadcnToolbarButton,
  ShadcnToolbarRoot,
  ShadcnToolbarSeparator,
} from '../proto-ui/components/react';

export function ToolbarDisabledDemo() {
  return (
    <div className="grid justify-items-center gap-4">
      <ShadcnToolbarRoot styleProfile="rhea" disabled a11yLabel="Read-only actions">
        <ShadcnToolbarButton styleProfile="rhea" value="undo">Undo</ShadcnToolbarButton>
        <ShadcnToolbarButton styleProfile="rhea" value="redo">Redo</ShadcnToolbarButton>
        <ShadcnToolbarSeparator styleProfile="rhea" />
        <ShadcnToolbarButton styleProfile="rhea" value="save" variant="default">Save</ShadcnToolbarButton>
      </ShadcnToolbarRoot>

      <ShadcnToolbarRoot styleProfile="rhea" loop={false} a11yLabel="Bounded actions">
        <ShadcnToolbarButton styleProfile="rhea" value="back">Back</ShadcnToolbarButton>
        <ShadcnToolbarButton styleProfile="rhea" value="forward" disabled>Forward</ShadcnToolbarButton>
        <ShadcnToolbarButton styleProfile="rhea" value="reload">Reload</ShadcnToolbarButton>
      </ShadcnToolbarRoot>
    </div>
  );
}
    `),
    'demo-brutalist-toolbar': formatCode(`
import {
  BrutalistToolbarButton,
  BrutalistToolbarRoot,
  BrutalistToolbarSeparator,
} from '../proto-ui/components/react';

export function BrutalistToolbarDemo() {
  return (
    <BrutalistToolbarRoot a11yLabel="Document actions">
      <BrutalistToolbarButton value="undo">Undo</BrutalistToolbarButton>
      <BrutalistToolbarButton value="redo">Redo</BrutalistToolbarButton>
      <BrutalistToolbarSeparator />
      <BrutalistToolbarButton value="cut">Cut</BrutalistToolbarButton>
      <BrutalistToolbarButton value="copy">Copy</BrutalistToolbarButton>
      <BrutalistToolbarButton value="paste" disabled>Paste</BrutalistToolbarButton>
      <BrutalistToolbarSeparator />
      <BrutalistToolbarButton value="save" variant="solid">Save</BrutalistToolbarButton>
    </BrutalistToolbarRoot>
  );
}
    `),
    'demo-brutalist-toolbar-variants': formatCode(`
import {
  BrutalistToolbarButton,
  BrutalistToolbarRoot,
  BrutalistToolbarSeparator,
} from '../proto-ui/components/react';

export function BrutalistToolbarVariantsDemo() {
  return (
    <BrutalistToolbarRoot a11yLabel="Brutalist toolbar variants">
      <BrutalistToolbarButton value="bold" size="icon">
        <span aria-hidden="true">B</span>
        <span className="sr-only">Bold</span>
      </BrutalistToolbarButton>
      <BrutalistToolbarButton value="preview" size="sm" variant="surface">Small</BrutalistToolbarButton>
      <BrutalistToolbarSeparator />
      <BrutalistToolbarButton value="publish" variant="solid">Publish</BrutalistToolbarButton>
      <BrutalistToolbarButton value="delete" variant="destructive">Delete</BrutalistToolbarButton>
    </BrutalistToolbarRoot>
  );
}
    `),
    'demo-brutalist-toolbar-vertical': formatCode(`
import {
  BrutalistToolbarButton,
  BrutalistToolbarRoot,
  BrutalistToolbarSeparator,
} from '../proto-ui/components/react';

export function BrutalistToolbarVerticalDemo() {
  return (
    <BrutalistToolbarRoot orientation="vertical" a11yLabel="Canvas tools">
      <BrutalistToolbarButton value="select">Select</BrutalistToolbarButton>
      <BrutalistToolbarButton value="frame">Frame</BrutalistToolbarButton>
      <BrutalistToolbarSeparator />
      <BrutalistToolbarButton value="zoom-in">Zoom In</BrutalistToolbarButton>
      <BrutalistToolbarButton value="zoom-out">Zoom Out</BrutalistToolbarButton>
    </BrutalistToolbarRoot>
  );
}
    `),
    'demo-brutalist-toolbar-disabled': formatCode(`
import {
  BrutalistToolbarButton,
  BrutalistToolbarRoot,
  BrutalistToolbarSeparator,
} from '../proto-ui/components/react';

export function BrutalistToolbarDisabledDemo() {
  return (
    <div className="grid justify-items-center gap-4">
      <BrutalistToolbarRoot disabled a11yLabel="Read-only actions">
        <BrutalistToolbarButton value="undo">Undo</BrutalistToolbarButton>
        <BrutalistToolbarButton value="redo">Redo</BrutalistToolbarButton>
        <BrutalistToolbarSeparator />
        <BrutalistToolbarButton value="save" variant="solid">Save</BrutalistToolbarButton>
      </BrutalistToolbarRoot>

      <BrutalistToolbarRoot loop={false} a11yLabel="Bounded actions">
        <BrutalistToolbarButton value="back">Back</BrutalistToolbarButton>
        <BrutalistToolbarButton value="forward" disabled>Forward</BrutalistToolbarButton>
        <BrutalistToolbarButton value="reload">Reload</BrutalistToolbarButton>
      </BrutalistToolbarRoot>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-toolbar': formatCode(`
import {
  BootstrapToolbarButton,
  BootstrapToolbarRoot,
  BootstrapToolbarSeparator,
} from '../proto-ui/components/react';

export function BootstrapToolbarDemo() {
  return (
    <BootstrapToolbarRoot a11yLabel="Document actions">
      <BootstrapToolbarButton value="undo">Undo</BootstrapToolbarButton>
      <BootstrapToolbarButton value="redo">Redo</BootstrapToolbarButton>
      <BootstrapToolbarSeparator />
      <BootstrapToolbarButton value="cut">Cut</BootstrapToolbarButton>
      <BootstrapToolbarButton value="copy">Copy</BootstrapToolbarButton>
      <BootstrapToolbarButton value="paste" disabled>Paste</BootstrapToolbarButton>
      <BootstrapToolbarSeparator />
      <BootstrapToolbarButton value="save" variant="primary">Save</BootstrapToolbarButton>
    </BootstrapToolbarRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-toolbar-variants': formatCode(`
import {
  BootstrapToolbarButton,
  BootstrapToolbarRoot,
  BootstrapToolbarSeparator,
} from '../proto-ui/components/react';

export function BootstrapToolbarVariantsDemo() {
  return (
    <BootstrapToolbarRoot a11yLabel="Classic Bootstrap variants">
      <BootstrapToolbarButton value="default" variant="default">Default</BootstrapToolbarButton>
      <BootstrapToolbarButton value="primary" variant="primary">Primary</BootstrapToolbarButton>
      <BootstrapToolbarButton value="success" variant="success">Success</BootstrapToolbarButton>
      <BootstrapToolbarSeparator />
      <BootstrapToolbarButton value="warning" variant="warning">Warning</BootstrapToolbarButton>
      <BootstrapToolbarButton value="danger" variant="danger">Danger</BootstrapToolbarButton>
      <BootstrapToolbarButton value="inverse" variant="inverse" size="small">Small</BootstrapToolbarButton>
    </BootstrapToolbarRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-toolbar-vertical': formatCode(`
import {
  BootstrapToolbarButton,
  BootstrapToolbarRoot,
  BootstrapToolbarSeparator,
} from '../proto-ui/components/react';

export function BootstrapToolbarVerticalDemo() {
  return (
    <BootstrapToolbarRoot orientation="vertical" a11yLabel="Vertical command bar">
      <BootstrapToolbarButton value="align-left">Align Left</BootstrapToolbarButton>
      <BootstrapToolbarButton value="align-center">Align Center</BootstrapToolbarButton>
      <BootstrapToolbarSeparator />
      <BootstrapToolbarButton value="indent">Indent</BootstrapToolbarButton>
      <BootstrapToolbarButton value="outdent">Outdent</BootstrapToolbarButton>
    </BootstrapToolbarRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-toolbar-disabled': formatCode(`
import {
  BootstrapToolbarButton,
  BootstrapToolbarRoot,
  BootstrapToolbarSeparator,
} from '../proto-ui/components/react';

export function BootstrapToolbarDisabledDemo() {
  return (
    <div className="grid justify-items-center gap-4">
      <BootstrapToolbarRoot disabled a11yLabel="Read-only actions">
        <BootstrapToolbarButton value="undo">Undo</BootstrapToolbarButton>
        <BootstrapToolbarButton value="redo">Redo</BootstrapToolbarButton>
        <BootstrapToolbarSeparator />
        <BootstrapToolbarButton value="save" variant="primary">Save</BootstrapToolbarButton>
      </BootstrapToolbarRoot>

      <BootstrapToolbarRoot loop={false} a11yLabel="Bounded actions">
        <BootstrapToolbarButton value="back">Back</BootstrapToolbarButton>
        <BootstrapToolbarButton value="forward" disabled>Forward</BootstrapToolbarButton>
        <BootstrapToolbarButton value="reload">Reload</BootstrapToolbarButton>
      </BootstrapToolbarRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-toolbar': formatCode(`
import {
  LiquidGlassToolbarButton,
  LiquidGlassToolbarRoot,
  LiquidGlassToolbarSeparator,
} from '../proto-ui/components/react';

export function LiquidGlassToolbarDemo() {
  return (
    <LiquidGlassToolbarRoot a11yLabel="Document actions">
      <LiquidGlassToolbarButton value="undo">Undo</LiquidGlassToolbarButton>
      <LiquidGlassToolbarButton value="redo">Redo</LiquidGlassToolbarButton>
      <LiquidGlassToolbarSeparator />
      <LiquidGlassToolbarButton value="share">Share</LiquidGlassToolbarButton>
      <LiquidGlassToolbarButton value="paste" disabled>Paste</LiquidGlassToolbarButton>
      <LiquidGlassToolbarSeparator />
      <LiquidGlassToolbarButton value="publish" variant="prominent">Publish</LiquidGlassToolbarButton>
    </LiquidGlassToolbarRoot>
  );
}
    `),
    'demo-liquid-glass-toolbar-prominence': formatCode(`
import {
  LiquidGlassToolbarButton,
  LiquidGlassToolbarRoot,
  LiquidGlassToolbarSeparator,
} from '../proto-ui/components/react';

export function LiquidGlassToolbarProminenceDemo() {
  return (
    <div className="grid justify-items-center gap-4">
      <LiquidGlassToolbarRoot a11yLabel="Glass prominence toolbar">
        <LiquidGlassToolbarButton value="reply" variant="regular">Reply</LiquidGlassToolbarButton>
        <LiquidGlassToolbarButton value="archive" variant="regular" size="sm">Archive</LiquidGlassToolbarButton>
        <LiquidGlassToolbarSeparator />
        <LiquidGlassToolbarButton value="send" variant="prominent">Send</LiquidGlassToolbarButton>
        <LiquidGlassToolbarButton value="trash" variant="destructive">Delete</LiquidGlassToolbarButton>
      </LiquidGlassToolbarRoot>

      <LiquidGlassToolbarRoot material="opaque" a11yLabel="Opaque fallback toolbar">
        <LiquidGlassToolbarButton value="opaque-regular" variant="regular">Opaque Surface</LiquidGlassToolbarButton>
        <LiquidGlassToolbarSeparator />
        <LiquidGlassToolbarButton value="opaque-prominent" variant="prominent">Confirm</LiquidGlassToolbarButton>
      </LiquidGlassToolbarRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-toolbar-vertical': formatCode(`
import {
  LiquidGlassToolbarButton,
  LiquidGlassToolbarRoot,
  LiquidGlassToolbarSeparator,
} from '../proto-ui/components/react';

export function LiquidGlassToolbarVerticalDemo() {
  return (
    <LiquidGlassToolbarRoot orientation="vertical" a11yLabel="Floating canvas tools">
      <LiquidGlassToolbarButton value="select">Select</LiquidGlassToolbarButton>
      <LiquidGlassToolbarButton value="crop">Crop</LiquidGlassToolbarButton>
      <LiquidGlassToolbarSeparator />
      <LiquidGlassToolbarButton value="adjust">Adjust</LiquidGlassToolbarButton>
      <LiquidGlassToolbarButton value="done" variant="prominent">Done</LiquidGlassToolbarButton>
    </LiquidGlassToolbarRoot>
  );
}
    `),
    'demo-liquid-glass-toolbar-disabled': formatCode(`
import {
  LiquidGlassToolbarButton,
  LiquidGlassToolbarRoot,
  LiquidGlassToolbarSeparator,
} from '../proto-ui/components/react';

export function LiquidGlassToolbarDisabledDemo() {
  return (
    <div className="grid justify-items-center gap-4">
      <LiquidGlassToolbarRoot disabled a11yLabel="Read-only actions">
        <LiquidGlassToolbarButton value="undo">Undo</LiquidGlassToolbarButton>
        <LiquidGlassToolbarButton value="redo">Redo</LiquidGlassToolbarButton>
        <LiquidGlassToolbarSeparator />
        <LiquidGlassToolbarButton value="publish" variant="prominent">Publish</LiquidGlassToolbarButton>
      </LiquidGlassToolbarRoot>

      <LiquidGlassToolbarRoot loop={false} a11yLabel="Bounded actions">
        <LiquidGlassToolbarButton value="back">Back</LiquidGlassToolbarButton>
        <LiquidGlassToolbarButton value="forward" disabled>Forward</LiquidGlassToolbarButton>
        <LiquidGlassToolbarButton value="reload">Reload</LiquidGlassToolbarButton>
      </LiquidGlassToolbarRoot>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-toolbar': formatCode(`
<script setup lang="ts">
import {
  ShadcnToolbarButton,
  ShadcnToolbarRoot,
  ShadcnToolbarSeparator,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnToolbarRoot styleProfile="rhea" a11yLabel="Document actions">
    <ShadcnToolbarButton styleProfile="rhea" value="undo">Undo</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="redo">Redo</ShadcnToolbarButton>
    <ShadcnToolbarSeparator styleProfile="rhea" />
    <ShadcnToolbarButton styleProfile="rhea" value="cut">Cut</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="copy">Copy</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="paste" :disabled="true">Paste</ShadcnToolbarButton>
    <ShadcnToolbarSeparator styleProfile="rhea" />
    <ShadcnToolbarButton styleProfile="rhea" value="save" variant="default">Save</ShadcnToolbarButton>
  </ShadcnToolbarRoot>
</template>
    `),
    'demo-shadcn-toolbar-variants': formatCode(`
<script setup lang="ts">
import {
  ShadcnToolbarButton,
  ShadcnToolbarRoot,
  ShadcnToolbarSeparator,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnToolbarRoot styleProfile="rhea" a11yLabel="Button variants">
    <ShadcnToolbarButton styleProfile="rhea" value="ghost" variant="ghost">Ghost</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="outline" variant="outline">Outline</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="secondary" variant="secondary">Secondary</ShadcnToolbarButton>
    <ShadcnToolbarSeparator styleProfile="rhea" />
    <ShadcnToolbarButton styleProfile="rhea" value="default" variant="default">Publish</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="delete" variant="destructive">Delete</ShadcnToolbarButton>
  </ShadcnToolbarRoot>
</template>
    `),
    'demo-shadcn-toolbar-sizes': formatCode(`
<script setup lang="ts">
import {
  ShadcnToolbarButton,
  ShadcnToolbarRoot,
  ShadcnToolbarSeparator,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnToolbarRoot styleProfile="rhea" a11yLabel="Compact formatting toolbar">
    <ShadcnToolbarButton styleProfile="rhea" value="bold" size="icon">
      <span aria-hidden="true">B</span><span class="sr-only">Bold</span>
    </ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="italic" size="icon">
      <span aria-hidden="true">I</span><span class="sr-only">Italic</span>
    </ShadcnToolbarButton>
    <ShadcnToolbarSeparator styleProfile="rhea" />
    <ShadcnToolbarButton styleProfile="rhea" value="comment" size="sm">Small</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="share" size="default" variant="outline">Default</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="export" size="lg" variant="secondary">Large</ShadcnToolbarButton>
  </ShadcnToolbarRoot>
</template>
    `),
    'demo-shadcn-toolbar-vertical': formatCode(`
<script setup lang="ts">
import {
  ShadcnToolbarButton,
  ShadcnToolbarRoot,
  ShadcnToolbarSeparator,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnToolbarRoot styleProfile="rhea" orientation="vertical" a11yLabel="Canvas tools">
    <ShadcnToolbarButton styleProfile="rhea" value="select">Select</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="frame">Frame</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="text">Text</ShadcnToolbarButton>
    <ShadcnToolbarSeparator styleProfile="rhea" />
    <ShadcnToolbarButton styleProfile="rhea" value="zoom-in">Zoom In</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="zoom-out">Zoom Out</ShadcnToolbarButton>
  </ShadcnToolbarRoot>
</template>
    `),
    'demo-shadcn-toolbar-disabled': formatCode(`
<script setup lang="ts">
import {
  ShadcnToolbarButton,
  ShadcnToolbarRoot,
  ShadcnToolbarSeparator,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid justify-items-center gap-4">
    <ShadcnToolbarRoot styleProfile="rhea" :disabled="true" a11yLabel="Read-only actions">
      <ShadcnToolbarButton styleProfile="rhea" value="undo">Undo</ShadcnToolbarButton>
      <ShadcnToolbarButton styleProfile="rhea" value="redo">Redo</ShadcnToolbarButton>
      <ShadcnToolbarSeparator styleProfile="rhea" />
      <ShadcnToolbarButton styleProfile="rhea" value="save" variant="default">Save</ShadcnToolbarButton>
    </ShadcnToolbarRoot>

    <ShadcnToolbarRoot styleProfile="rhea" :loop="false" a11yLabel="Bounded actions">
      <ShadcnToolbarButton styleProfile="rhea" value="back">Back</ShadcnToolbarButton>
      <ShadcnToolbarButton styleProfile="rhea" value="forward" :disabled="true">Forward</ShadcnToolbarButton>
      <ShadcnToolbarButton styleProfile="rhea" value="reload">Reload</ShadcnToolbarButton>
    </ShadcnToolbarRoot>
  </div>
</template>
    `),
    'demo-brutalist-toolbar': formatCode(`
<script setup lang="ts">
import {
  BrutalistToolbarButton,
  BrutalistToolbarRoot,
  BrutalistToolbarSeparator,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistToolbarRoot a11yLabel="Document actions">
    <BrutalistToolbarButton value="undo">Undo</BrutalistToolbarButton>
    <BrutalistToolbarButton value="redo">Redo</BrutalistToolbarButton>
    <BrutalistToolbarSeparator />
    <BrutalistToolbarButton value="cut">Cut</BrutalistToolbarButton>
    <BrutalistToolbarButton value="copy">Copy</BrutalistToolbarButton>
    <BrutalistToolbarButton value="paste" :disabled="true">Paste</BrutalistToolbarButton>
    <BrutalistToolbarSeparator />
    <BrutalistToolbarButton value="save" variant="solid">Save</BrutalistToolbarButton>
  </BrutalistToolbarRoot>
</template>
    `),
    'demo-brutalist-toolbar-variants': formatCode(`
<script setup lang="ts">
import {
  BrutalistToolbarButton,
  BrutalistToolbarRoot,
  BrutalistToolbarSeparator,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistToolbarRoot a11yLabel="Brutalist toolbar variants">
    <BrutalistToolbarButton value="bold" size="icon">
      <span aria-hidden="true">B</span><span class="sr-only">Bold</span>
    </BrutalistToolbarButton>
    <BrutalistToolbarButton value="preview" size="sm" variant="surface">Small</BrutalistToolbarButton>
    <BrutalistToolbarSeparator />
    <BrutalistToolbarButton value="publish" variant="solid">Publish</BrutalistToolbarButton>
    <BrutalistToolbarButton value="delete" variant="destructive">Delete</BrutalistToolbarButton>
  </BrutalistToolbarRoot>
</template>
    `),
    'demo-brutalist-toolbar-vertical': formatCode(`
<script setup lang="ts">
import {
  BrutalistToolbarButton,
  BrutalistToolbarRoot,
  BrutalistToolbarSeparator,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistToolbarRoot orientation="vertical" a11yLabel="Canvas tools">
    <BrutalistToolbarButton value="select">Select</BrutalistToolbarButton>
    <BrutalistToolbarButton value="frame">Frame</BrutalistToolbarButton>
    <BrutalistToolbarSeparator />
    <BrutalistToolbarButton value="zoom-in">Zoom In</BrutalistToolbarButton>
    <BrutalistToolbarButton value="zoom-out">Zoom Out</BrutalistToolbarButton>
  </BrutalistToolbarRoot>
</template>
    `),
    'demo-brutalist-toolbar-disabled': formatCode(`
<script setup lang="ts">
import {
  BrutalistToolbarButton,
  BrutalistToolbarRoot,
  BrutalistToolbarSeparator,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid justify-items-center gap-4">
    <BrutalistToolbarRoot :disabled="true" a11yLabel="Read-only actions">
      <BrutalistToolbarButton value="undo">Undo</BrutalistToolbarButton>
      <BrutalistToolbarButton value="redo">Redo</BrutalistToolbarButton>
      <BrutalistToolbarSeparator />
      <BrutalistToolbarButton value="save" variant="solid">Save</BrutalistToolbarButton>
    </BrutalistToolbarRoot>

    <BrutalistToolbarRoot :loop="false" a11yLabel="Bounded actions">
      <BrutalistToolbarButton value="back">Back</BrutalistToolbarButton>
      <BrutalistToolbarButton value="forward" :disabled="true">Forward</BrutalistToolbarButton>
      <BrutalistToolbarButton value="reload">Reload</BrutalistToolbarButton>
    </BrutalistToolbarRoot>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-toolbar': formatCode(`
<script setup lang="ts">
import {
  BootstrapToolbarButton,
  BootstrapToolbarRoot,
  BootstrapToolbarSeparator,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapToolbarRoot a11yLabel="Document actions">
    <BootstrapToolbarButton value="undo">Undo</BootstrapToolbarButton>
    <BootstrapToolbarButton value="redo">Redo</BootstrapToolbarButton>
    <BootstrapToolbarSeparator />
    <BootstrapToolbarButton value="cut">Cut</BootstrapToolbarButton>
    <BootstrapToolbarButton value="copy">Copy</BootstrapToolbarButton>
    <BootstrapToolbarButton value="paste" :disabled="true">Paste</BootstrapToolbarButton>
    <BootstrapToolbarSeparator />
    <BootstrapToolbarButton value="save" variant="primary">Save</BootstrapToolbarButton>
  </BootstrapToolbarRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-toolbar-variants': formatCode(`
<script setup lang="ts">
import {
  BootstrapToolbarButton,
  BootstrapToolbarRoot,
  BootstrapToolbarSeparator,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapToolbarRoot a11yLabel="Classic Bootstrap variants">
    <BootstrapToolbarButton value="default" variant="default">Default</BootstrapToolbarButton>
    <BootstrapToolbarButton value="primary" variant="primary">Primary</BootstrapToolbarButton>
    <BootstrapToolbarButton value="success" variant="success">Success</BootstrapToolbarButton>
    <BootstrapToolbarSeparator />
    <BootstrapToolbarButton value="warning" variant="warning">Warning</BootstrapToolbarButton>
    <BootstrapToolbarButton value="danger" variant="danger">Danger</BootstrapToolbarButton>
    <BootstrapToolbarButton value="inverse" variant="inverse" size="small">Small</BootstrapToolbarButton>
  </BootstrapToolbarRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-toolbar-vertical': formatCode(`
<script setup lang="ts">
import {
  BootstrapToolbarButton,
  BootstrapToolbarRoot,
  BootstrapToolbarSeparator,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapToolbarRoot orientation="vertical" a11yLabel="Vertical command bar">
    <BootstrapToolbarButton value="align-left">Align Left</BootstrapToolbarButton>
    <BootstrapToolbarButton value="align-center">Align Center</BootstrapToolbarButton>
    <BootstrapToolbarSeparator />
    <BootstrapToolbarButton value="indent">Indent</BootstrapToolbarButton>
    <BootstrapToolbarButton value="outdent">Outdent</BootstrapToolbarButton>
  </BootstrapToolbarRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-toolbar-disabled': formatCode(`
<script setup lang="ts">
import {
  BootstrapToolbarButton,
  BootstrapToolbarRoot,
  BootstrapToolbarSeparator,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid justify-items-center gap-4">
    <BootstrapToolbarRoot :disabled="true" a11yLabel="Read-only actions">
      <BootstrapToolbarButton value="undo">Undo</BootstrapToolbarButton>
      <BootstrapToolbarButton value="redo">Redo</BootstrapToolbarButton>
      <BootstrapToolbarSeparator />
      <BootstrapToolbarButton value="save" variant="primary">Save</BootstrapToolbarButton>
    </BootstrapToolbarRoot>

    <BootstrapToolbarRoot :loop="false" a11yLabel="Bounded actions">
      <BootstrapToolbarButton value="back">Back</BootstrapToolbarButton>
      <BootstrapToolbarButton value="forward" :disabled="true">Forward</BootstrapToolbarButton>
      <BootstrapToolbarButton value="reload">Reload</BootstrapToolbarButton>
    </BootstrapToolbarRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-toolbar': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassToolbarButton,
  LiquidGlassToolbarRoot,
  LiquidGlassToolbarSeparator,
} from '../proto-ui/components/vue';
</script>

<template>
  <LiquidGlassToolbarRoot a11yLabel="Document actions">
    <LiquidGlassToolbarButton value="undo">Undo</LiquidGlassToolbarButton>
    <LiquidGlassToolbarButton value="redo">Redo</LiquidGlassToolbarButton>
    <LiquidGlassToolbarSeparator />
    <LiquidGlassToolbarButton value="share">Share</LiquidGlassToolbarButton>
    <LiquidGlassToolbarButton value="paste" :disabled="true">Paste</LiquidGlassToolbarButton>
    <LiquidGlassToolbarSeparator />
    <LiquidGlassToolbarButton value="publish" variant="prominent">Publish</LiquidGlassToolbarButton>
  </LiquidGlassToolbarRoot>
</template>
    `),
    'demo-liquid-glass-toolbar-prominence': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassToolbarButton,
  LiquidGlassToolbarRoot,
  LiquidGlassToolbarSeparator,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid justify-items-center gap-4">
    <LiquidGlassToolbarRoot a11yLabel="Glass prominence toolbar">
      <LiquidGlassToolbarButton value="reply" variant="regular">Reply</LiquidGlassToolbarButton>
      <LiquidGlassToolbarButton value="archive" variant="regular" size="sm">Archive</LiquidGlassToolbarButton>
      <LiquidGlassToolbarSeparator />
      <LiquidGlassToolbarButton value="send" variant="prominent">Send</LiquidGlassToolbarButton>
      <LiquidGlassToolbarButton value="trash" variant="destructive">Delete</LiquidGlassToolbarButton>
    </LiquidGlassToolbarRoot>

    <LiquidGlassToolbarRoot material="opaque" a11yLabel="Opaque fallback toolbar">
      <LiquidGlassToolbarButton value="opaque-regular" variant="regular">Opaque Surface</LiquidGlassToolbarButton>
      <LiquidGlassToolbarSeparator />
      <LiquidGlassToolbarButton value="opaque-prominent" variant="prominent">Confirm</LiquidGlassToolbarButton>
    </LiquidGlassToolbarRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-toolbar-vertical': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassToolbarButton,
  LiquidGlassToolbarRoot,
  LiquidGlassToolbarSeparator,
} from '../proto-ui/components/vue';
</script>

<template>
  <LiquidGlassToolbarRoot orientation="vertical" a11yLabel="Floating canvas tools">
    <LiquidGlassToolbarButton value="select">Select</LiquidGlassToolbarButton>
    <LiquidGlassToolbarButton value="crop">Crop</LiquidGlassToolbarButton>
    <LiquidGlassToolbarSeparator />
    <LiquidGlassToolbarButton value="adjust">Adjust</LiquidGlassToolbarButton>
    <LiquidGlassToolbarButton value="done" variant="prominent">Done</LiquidGlassToolbarButton>
  </LiquidGlassToolbarRoot>
</template>
    `),
    'demo-liquid-glass-toolbar-disabled': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassToolbarButton,
  LiquidGlassToolbarRoot,
  LiquidGlassToolbarSeparator,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid justify-items-center gap-4">
    <LiquidGlassToolbarRoot :disabled="true" a11yLabel="Read-only actions">
      <LiquidGlassToolbarButton value="undo">Undo</LiquidGlassToolbarButton>
      <LiquidGlassToolbarButton value="redo">Redo</LiquidGlassToolbarButton>
      <LiquidGlassToolbarSeparator />
      <LiquidGlassToolbarButton value="publish" variant="prominent">Publish</LiquidGlassToolbarButton>
    </LiquidGlassToolbarRoot>

    <LiquidGlassToolbarRoot :loop="false" a11yLabel="Bounded actions">
      <LiquidGlassToolbarButton value="back">Back</LiquidGlassToolbarButton>
      <LiquidGlassToolbarButton value="forward" :disabled="true">Forward</LiquidGlassToolbarButton>
      <LiquidGlassToolbarButton value="reload">Reload</LiquidGlassToolbarButton>
    </LiquidGlassToolbarRoot>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-toolbar': formatCode(`
<template>
  <ShadcnToolbarRoot styleProfile="rhea" a11yLabel="Document actions">
    <ShadcnToolbarButton styleProfile="rhea" value="undo">Undo</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="redo">Redo</ShadcnToolbarButton>
    <ShadcnToolbarSeparator styleProfile="rhea" />
    <ShadcnToolbarButton styleProfile="rhea" value="cut">Cut</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="copy">Copy</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="paste" :disabled="true">Paste</ShadcnToolbarButton>
    <ShadcnToolbarSeparator styleProfile="rhea" />
    <ShadcnToolbarButton styleProfile="rhea" value="save" variant="default">Save</ShadcnToolbarButton>
  </ShadcnToolbarRoot>
</template>

<script>
import {
  ShadcnToolbarButton,
  ShadcnToolbarRoot,
  ShadcnToolbarSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnToolbarButton,
    ShadcnToolbarRoot,
    ShadcnToolbarSeparator,
  },
};
</script>
    `),
    'demo-shadcn-toolbar-variants': formatCode(`
<template>
  <ShadcnToolbarRoot styleProfile="rhea" a11yLabel="Button variants">
    <ShadcnToolbarButton styleProfile="rhea" value="ghost" variant="ghost">Ghost</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="outline" variant="outline">Outline</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="secondary" variant="secondary">Secondary</ShadcnToolbarButton>
    <ShadcnToolbarSeparator styleProfile="rhea" />
    <ShadcnToolbarButton styleProfile="rhea" value="default" variant="default">Publish</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="delete" variant="destructive">Delete</ShadcnToolbarButton>
  </ShadcnToolbarRoot>
</template>

<script>
import {
  ShadcnToolbarButton,
  ShadcnToolbarRoot,
  ShadcnToolbarSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnToolbarButton,
    ShadcnToolbarRoot,
    ShadcnToolbarSeparator,
  },
};
</script>
    `),
    'demo-shadcn-toolbar-sizes': formatCode(`
<template>
  <ShadcnToolbarRoot styleProfile="rhea" a11yLabel="Compact formatting toolbar">
    <ShadcnToolbarButton styleProfile="rhea" value="bold" size="icon">
      <span aria-hidden="true">B</span><span class="sr-only">Bold</span>
    </ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="italic" size="icon">
      <span aria-hidden="true">I</span><span class="sr-only">Italic</span>
    </ShadcnToolbarButton>
    <ShadcnToolbarSeparator styleProfile="rhea" />
    <ShadcnToolbarButton styleProfile="rhea" value="comment" size="sm">Small</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="share" size="default" variant="outline">Default</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="export" size="lg" variant="secondary">Large</ShadcnToolbarButton>
  </ShadcnToolbarRoot>
</template>

<script>
import {
  ShadcnToolbarButton,
  ShadcnToolbarRoot,
  ShadcnToolbarSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnToolbarButton,
    ShadcnToolbarRoot,
    ShadcnToolbarSeparator,
  },
};
</script>
    `),
    'demo-shadcn-toolbar-vertical': formatCode(`
<template>
  <ShadcnToolbarRoot styleProfile="rhea" orientation="vertical" a11yLabel="Canvas tools">
    <ShadcnToolbarButton styleProfile="rhea" value="select">Select</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="frame">Frame</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="text">Text</ShadcnToolbarButton>
    <ShadcnToolbarSeparator styleProfile="rhea" />
    <ShadcnToolbarButton styleProfile="rhea" value="zoom-in">Zoom In</ShadcnToolbarButton>
    <ShadcnToolbarButton styleProfile="rhea" value="zoom-out">Zoom Out</ShadcnToolbarButton>
  </ShadcnToolbarRoot>
</template>

<script>
import {
  ShadcnToolbarButton,
  ShadcnToolbarRoot,
  ShadcnToolbarSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnToolbarButton,
    ShadcnToolbarRoot,
    ShadcnToolbarSeparator,
  },
};
</script>
    `),
    'demo-shadcn-toolbar-disabled': formatCode(`
<template>
  <div class="grid justify-items-center gap-4">
    <ShadcnToolbarRoot styleProfile="rhea" :disabled="true" a11yLabel="Read-only actions">
      <ShadcnToolbarButton styleProfile="rhea" value="undo">Undo</ShadcnToolbarButton>
      <ShadcnToolbarButton styleProfile="rhea" value="redo">Redo</ShadcnToolbarButton>
      <ShadcnToolbarSeparator styleProfile="rhea" />
      <ShadcnToolbarButton styleProfile="rhea" value="save" variant="default">Save</ShadcnToolbarButton>
    </ShadcnToolbarRoot>

    <ShadcnToolbarRoot styleProfile="rhea" :loop="false" a11yLabel="Bounded actions">
      <ShadcnToolbarButton styleProfile="rhea" value="back">Back</ShadcnToolbarButton>
      <ShadcnToolbarButton styleProfile="rhea" value="forward" :disabled="true">Forward</ShadcnToolbarButton>
      <ShadcnToolbarButton styleProfile="rhea" value="reload">Reload</ShadcnToolbarButton>
    </ShadcnToolbarRoot>
  </div>
</template>

<script>
import {
  ShadcnToolbarButton,
  ShadcnToolbarRoot,
  ShadcnToolbarSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnToolbarButton,
    ShadcnToolbarRoot,
    ShadcnToolbarSeparator,
  },
};
</script>
    `),
    'demo-brutalist-toolbar': formatCode(`
<template>
  <BrutalistToolbarRoot a11yLabel="Document actions">
    <BrutalistToolbarButton value="undo">Undo</BrutalistToolbarButton>
    <BrutalistToolbarButton value="redo">Redo</BrutalistToolbarButton>
    <BrutalistToolbarSeparator />
    <BrutalistToolbarButton value="cut">Cut</BrutalistToolbarButton>
    <BrutalistToolbarButton value="copy">Copy</BrutalistToolbarButton>
    <BrutalistToolbarButton value="paste" :disabled="true">Paste</BrutalistToolbarButton>
    <BrutalistToolbarSeparator />
    <BrutalistToolbarButton value="save" variant="solid">Save</BrutalistToolbarButton>
  </BrutalistToolbarRoot>
</template>

<script>
import {
  BrutalistToolbarButton,
  BrutalistToolbarRoot,
  BrutalistToolbarSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistToolbarButton,
    BrutalistToolbarRoot,
    BrutalistToolbarSeparator,
  },
};
</script>
    `),
    'demo-brutalist-toolbar-variants': formatCode(`
<template>
  <BrutalistToolbarRoot a11yLabel="Brutalist toolbar variants">
    <BrutalistToolbarButton value="bold" size="icon">
      <span aria-hidden="true">B</span><span class="sr-only">Bold</span>
    </BrutalistToolbarButton>
    <BrutalistToolbarButton value="preview" size="sm" variant="surface">Small</BrutalistToolbarButton>
    <BrutalistToolbarSeparator />
    <BrutalistToolbarButton value="publish" variant="solid">Publish</BrutalistToolbarButton>
    <BrutalistToolbarButton value="delete" variant="destructive">Delete</BrutalistToolbarButton>
  </BrutalistToolbarRoot>
</template>

<script>
import {
  BrutalistToolbarButton,
  BrutalistToolbarRoot,
  BrutalistToolbarSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistToolbarButton,
    BrutalistToolbarRoot,
    BrutalistToolbarSeparator,
  },
};
</script>
    `),
    'demo-brutalist-toolbar-vertical': formatCode(`
<template>
  <BrutalistToolbarRoot orientation="vertical" a11yLabel="Canvas tools">
    <BrutalistToolbarButton value="select">Select</BrutalistToolbarButton>
    <BrutalistToolbarButton value="frame">Frame</BrutalistToolbarButton>
    <BrutalistToolbarSeparator />
    <BrutalistToolbarButton value="zoom-in">Zoom In</BrutalistToolbarButton>
    <BrutalistToolbarButton value="zoom-out">Zoom Out</BrutalistToolbarButton>
  </BrutalistToolbarRoot>
</template>

<script>
import {
  BrutalistToolbarButton,
  BrutalistToolbarRoot,
  BrutalistToolbarSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistToolbarButton,
    BrutalistToolbarRoot,
    BrutalistToolbarSeparator,
  },
};
</script>
    `),
    'demo-brutalist-toolbar-disabled': formatCode(`
<template>
  <div class="grid justify-items-center gap-4">
    <BrutalistToolbarRoot :disabled="true" a11yLabel="Read-only actions">
      <BrutalistToolbarButton value="undo">Undo</BrutalistToolbarButton>
      <BrutalistToolbarButton value="redo">Redo</BrutalistToolbarButton>
      <BrutalistToolbarSeparator />
      <BrutalistToolbarButton value="save" variant="solid">Save</BrutalistToolbarButton>
    </BrutalistToolbarRoot>

    <BrutalistToolbarRoot :loop="false" a11yLabel="Bounded actions">
      <BrutalistToolbarButton value="back">Back</BrutalistToolbarButton>
      <BrutalistToolbarButton value="forward" :disabled="true">Forward</BrutalistToolbarButton>
      <BrutalistToolbarButton value="reload">Reload</BrutalistToolbarButton>
    </BrutalistToolbarRoot>
  </div>
</template>

<script>
import {
  BrutalistToolbarButton,
  BrutalistToolbarRoot,
  BrutalistToolbarSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistToolbarButton,
    BrutalistToolbarRoot,
    BrutalistToolbarSeparator,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toolbar': formatCode(`
<template>
  <BootstrapToolbarRoot a11yLabel="Document actions">
    <BootstrapToolbarButton value="undo">Undo</BootstrapToolbarButton>
    <BootstrapToolbarButton value="redo">Redo</BootstrapToolbarButton>
    <BootstrapToolbarSeparator />
    <BootstrapToolbarButton value="cut">Cut</BootstrapToolbarButton>
    <BootstrapToolbarButton value="copy">Copy</BootstrapToolbarButton>
    <BootstrapToolbarButton value="paste" :disabled="true">Paste</BootstrapToolbarButton>
    <BootstrapToolbarSeparator />
    <BootstrapToolbarButton value="save" variant="primary">Save</BootstrapToolbarButton>
  </BootstrapToolbarRoot>
</template>

<script>
import {
  BootstrapToolbarButton,
  BootstrapToolbarRoot,
  BootstrapToolbarSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapToolbarButton,
    BootstrapToolbarRoot,
    BootstrapToolbarSeparator,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toolbar-variants': formatCode(`
<template>
  <BootstrapToolbarRoot a11yLabel="Classic Bootstrap variants">
    <BootstrapToolbarButton value="default" variant="default">Default</BootstrapToolbarButton>
    <BootstrapToolbarButton value="primary" variant="primary">Primary</BootstrapToolbarButton>
    <BootstrapToolbarButton value="success" variant="success">Success</BootstrapToolbarButton>
    <BootstrapToolbarSeparator />
    <BootstrapToolbarButton value="warning" variant="warning">Warning</BootstrapToolbarButton>
    <BootstrapToolbarButton value="danger" variant="danger">Danger</BootstrapToolbarButton>
    <BootstrapToolbarButton value="inverse" variant="inverse" size="small">Small</BootstrapToolbarButton>
  </BootstrapToolbarRoot>
</template>

<script>
import {
  BootstrapToolbarButton,
  BootstrapToolbarRoot,
  BootstrapToolbarSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapToolbarButton,
    BootstrapToolbarRoot,
    BootstrapToolbarSeparator,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toolbar-vertical': formatCode(`
<template>
  <BootstrapToolbarRoot orientation="vertical" a11yLabel="Vertical command bar">
    <BootstrapToolbarButton value="align-left">Align Left</BootstrapToolbarButton>
    <BootstrapToolbarButton value="align-center">Align Center</BootstrapToolbarButton>
    <BootstrapToolbarSeparator />
    <BootstrapToolbarButton value="indent">Indent</BootstrapToolbarButton>
    <BootstrapToolbarButton value="outdent">Outdent</BootstrapToolbarButton>
  </BootstrapToolbarRoot>
</template>

<script>
import {
  BootstrapToolbarButton,
  BootstrapToolbarRoot,
  BootstrapToolbarSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapToolbarButton,
    BootstrapToolbarRoot,
    BootstrapToolbarSeparator,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toolbar-disabled': formatCode(`
<template>
  <div class="grid justify-items-center gap-4">
    <BootstrapToolbarRoot :disabled="true" a11yLabel="Read-only actions">
      <BootstrapToolbarButton value="undo">Undo</BootstrapToolbarButton>
      <BootstrapToolbarButton value="redo">Redo</BootstrapToolbarButton>
      <BootstrapToolbarSeparator />
      <BootstrapToolbarButton value="save" variant="primary">Save</BootstrapToolbarButton>
    </BootstrapToolbarRoot>

    <BootstrapToolbarRoot :loop="false" a11yLabel="Bounded actions">
      <BootstrapToolbarButton value="back">Back</BootstrapToolbarButton>
      <BootstrapToolbarButton value="forward" :disabled="true">Forward</BootstrapToolbarButton>
      <BootstrapToolbarButton value="reload">Reload</BootstrapToolbarButton>
    </BootstrapToolbarRoot>
  </div>
</template>

<script>
import {
  BootstrapToolbarButton,
  BootstrapToolbarRoot,
  BootstrapToolbarSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapToolbarButton,
    BootstrapToolbarRoot,
    BootstrapToolbarSeparator,
  },
};
</script>
    `),
    'demo-liquid-glass-toolbar': formatCode(`
<template>
  <LiquidGlassToolbarRoot a11yLabel="Document actions">
    <LiquidGlassToolbarButton value="undo">Undo</LiquidGlassToolbarButton>
    <LiquidGlassToolbarButton value="redo">Redo</LiquidGlassToolbarButton>
    <LiquidGlassToolbarSeparator />
    <LiquidGlassToolbarButton value="share">Share</LiquidGlassToolbarButton>
    <LiquidGlassToolbarButton value="paste" :disabled="true">Paste</LiquidGlassToolbarButton>
    <LiquidGlassToolbarSeparator />
    <LiquidGlassToolbarButton value="publish" variant="prominent">Publish</LiquidGlassToolbarButton>
  </LiquidGlassToolbarRoot>
</template>

<script>
import {
  LiquidGlassToolbarButton,
  LiquidGlassToolbarRoot,
  LiquidGlassToolbarSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassToolbarButton,
    LiquidGlassToolbarRoot,
    LiquidGlassToolbarSeparator,
  },
};
</script>
    `),
    'demo-liquid-glass-toolbar-prominence': formatCode(`
<template>
  <div class="grid justify-items-center gap-4">
    <LiquidGlassToolbarRoot a11yLabel="Glass prominence toolbar">
      <LiquidGlassToolbarButton value="reply" variant="regular">Reply</LiquidGlassToolbarButton>
      <LiquidGlassToolbarButton value="archive" variant="regular" size="sm">Archive</LiquidGlassToolbarButton>
      <LiquidGlassToolbarSeparator />
      <LiquidGlassToolbarButton value="send" variant="prominent">Send</LiquidGlassToolbarButton>
      <LiquidGlassToolbarButton value="trash" variant="destructive">Delete</LiquidGlassToolbarButton>
    </LiquidGlassToolbarRoot>

    <LiquidGlassToolbarRoot material="opaque" a11yLabel="Opaque fallback toolbar">
      <LiquidGlassToolbarButton value="opaque-regular" variant="regular">Opaque Surface</LiquidGlassToolbarButton>
      <LiquidGlassToolbarSeparator />
      <LiquidGlassToolbarButton value="opaque-prominent" variant="prominent">Confirm</LiquidGlassToolbarButton>
    </LiquidGlassToolbarRoot>
  </div>
</template>

<script>
import {
  LiquidGlassToolbarButton,
  LiquidGlassToolbarRoot,
  LiquidGlassToolbarSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassToolbarButton,
    LiquidGlassToolbarRoot,
    LiquidGlassToolbarSeparator,
  },
};
</script>
    `),
    'demo-liquid-glass-toolbar-vertical': formatCode(`
<template>
  <LiquidGlassToolbarRoot orientation="vertical" a11yLabel="Floating canvas tools">
    <LiquidGlassToolbarButton value="select">Select</LiquidGlassToolbarButton>
    <LiquidGlassToolbarButton value="crop">Crop</LiquidGlassToolbarButton>
    <LiquidGlassToolbarSeparator />
    <LiquidGlassToolbarButton value="adjust">Adjust</LiquidGlassToolbarButton>
    <LiquidGlassToolbarButton value="done" variant="prominent">Done</LiquidGlassToolbarButton>
  </LiquidGlassToolbarRoot>
</template>

<script>
import {
  LiquidGlassToolbarButton,
  LiquidGlassToolbarRoot,
  LiquidGlassToolbarSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassToolbarButton,
    LiquidGlassToolbarRoot,
    LiquidGlassToolbarSeparator,
  },
};
</script>
    `),
    'demo-liquid-glass-toolbar-disabled': formatCode(`
<template>
  <div class="grid justify-items-center gap-4">
    <LiquidGlassToolbarRoot :disabled="true" a11yLabel="Read-only actions">
      <LiquidGlassToolbarButton value="undo">Undo</LiquidGlassToolbarButton>
      <LiquidGlassToolbarButton value="redo">Redo</LiquidGlassToolbarButton>
      <LiquidGlassToolbarSeparator />
      <LiquidGlassToolbarButton value="publish" variant="prominent">Publish</LiquidGlassToolbarButton>
    </LiquidGlassToolbarRoot>

    <LiquidGlassToolbarRoot :loop="false" a11yLabel="Bounded actions">
      <LiquidGlassToolbarButton value="back">Back</LiquidGlassToolbarButton>
      <LiquidGlassToolbarButton value="forward" :disabled="true">Forward</LiquidGlassToolbarButton>
      <LiquidGlassToolbarButton value="reload">Reload</LiquidGlassToolbarButton>
    </LiquidGlassToolbarRoot>
  </div>
</template>

<script>
import {
  LiquidGlassToolbarButton,
  LiquidGlassToolbarRoot,
  LiquidGlassToolbarSeparator,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassToolbarButton,
    LiquidGlassToolbarRoot,
    LiquidGlassToolbarSeparator,
  },
};
</script>
    `),
  },
};
