import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-toast': formatCode(`
<proto-ui-shadcn-style-scope id="toast-scope">
  <proto-ui-shadcn-button id="toast-trigger">Show Toast</proto-ui-shadcn-button>
  <proto-ui-shadcn-toast-viewport id="toast-viewport">
    <proto-ui-shadcn-toast-root id="toast-root">
      <div class="flex items-start justify-between gap-4">
        <div class="grid gap-1">
          <proto-ui-shadcn-toast-title>Event has been created</proto-ui-shadcn-toast-title>
          <proto-ui-shadcn-toast-description>Sunday, December 03, 2023 at 9:00 AM</proto-ui-shadcn-toast-description>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <proto-ui-shadcn-toast-action id="toast-action">Undo</proto-ui-shadcn-toast-action>
          <proto-ui-shadcn-toast-close>Dismiss</proto-ui-shadcn-toast-close>
        </div>
      </div>
    </proto-ui-shadcn-toast-root>
  </proto-ui-shadcn-toast-viewport>
</proto-ui-shadcn-style-scope>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#toast-scope'), { styleProfile: 'rhea' });
  setElementProps(document.querySelector('#toast-trigger'), { variant: 'outline' });
  setElementProps(document.querySelector('#toast-viewport'), { a11yLabel: 'Notifications' });
  setElementProps(document.querySelector('#toast-root'), { defaultOpen: false, duration: 5000 });
  setElementProps(document.querySelector('#toast-action'), { a11yLabel: 'Undo event creation' });
  document.querySelector('#toast-trigger').addEventListener('click', () => {
    document.querySelector('#toast-root').getExposes().openToast();
  });
</script>
    `),
    'demo-shadcn-toast-types': formatCode(`
<proto-ui-shadcn-style-scope id="toast-types-scope">
  <div class="flex flex-wrap gap-2">
    <proto-ui-shadcn-button data-toast-open="default">Default</proto-ui-shadcn-button>
    <proto-ui-shadcn-button data-toast-open="success">Success</proto-ui-shadcn-button>
    <proto-ui-shadcn-button data-toast-open="info">Info</proto-ui-shadcn-button>
    <proto-ui-shadcn-button data-toast-open="warning">Warning</proto-ui-shadcn-button>
    <proto-ui-shadcn-button data-toast-open="error">Error</proto-ui-shadcn-button>
  </div>
  <proto-ui-shadcn-toast-viewport id="toast-types-viewport">
    <proto-ui-shadcn-toast-root id="toast-default">
      <proto-ui-shadcn-toast-title>Event has been created</proto-ui-shadcn-toast-title>
      <proto-ui-shadcn-toast-description>Sunday, December 03, 2023 at 9:00 AM</proto-ui-shadcn-toast-description>
    </proto-ui-shadcn-toast-root>
    <proto-ui-shadcn-toast-root id="toast-error">
      <proto-ui-shadcn-toast-title>Request failed</proto-ui-shadcn-toast-title>
      <proto-ui-shadcn-toast-description>Event could not be created.</proto-ui-shadcn-toast-description>
    </proto-ui-shadcn-toast-root>
  </proto-ui-shadcn-toast-viewport>
</proto-ui-shadcn-style-scope>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#toast-types-scope'), { styleProfile: 'rhea' });
  setElementProps(document.querySelector('#toast-default'), { defaultOpen: false, type: 'default' });
  setElementProps(document.querySelector('#toast-error'), { defaultOpen: false, type: 'error', politeness: 'assertive' });
</script>
    `),
    'demo-shadcn-toast-action': formatCode(`
<proto-ui-shadcn-style-scope id="toast-action-scope">
  <proto-ui-shadcn-button id="schedule-btn">Schedule Meeting</proto-ui-shadcn-button>
  <proto-ui-shadcn-toast-viewport>
    <proto-ui-shadcn-toast-root id="scheduled-toast">
      <div class="flex items-start justify-between gap-4">
        <div class="grid gap-1">
          <proto-ui-shadcn-toast-title>Meeting scheduled</proto-ui-shadcn-toast-title>
          <proto-ui-shadcn-toast-description>Design review set for Tuesday at 2:00 PM.</proto-ui-shadcn-toast-description>
        </div>
        <proto-ui-shadcn-toast-action id="undo-action">Undo</proto-ui-shadcn-toast-action>
      </div>
    </proto-ui-shadcn-toast-root>
  </proto-ui-shadcn-toast-viewport>
</proto-ui-shadcn-style-scope>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#toast-action-scope'), { styleProfile: 'rhea' });
  setElementProps(document.querySelector('#schedule-btn'), { variant: 'outline' });
  setElementProps(document.querySelector('#scheduled-toast'), { defaultOpen: false, duration: 6000 });
  document.querySelector('#schedule-btn').addEventListener('click', () => {
    document.querySelector('#scheduled-toast').getExposes().openToast();
  });
</script>
    `),
    'demo-shadcn-toast-promise': formatCode(`
<proto-ui-shadcn-style-scope id="toast-promise-scope">
  <proto-ui-shadcn-button id="create-event-btn">Create Event</proto-ui-shadcn-button>
  <proto-ui-shadcn-toast-viewport>
    <proto-ui-shadcn-toast-root id="loading-toast">
      <proto-ui-shadcn-toast-title>Creating event…</proto-ui-shadcn-toast-title>
      <proto-ui-shadcn-toast-description>Syncing calendar details with participants.</proto-ui-shadcn-toast-description>
    </proto-ui-shadcn-toast-root>
    <proto-ui-shadcn-toast-root id="done-toast">
      <proto-ui-shadcn-toast-title>Event created</proto-ui-shadcn-toast-title>
      <proto-ui-shadcn-toast-description>Invitations have been sent to all attendees.</proto-ui-shadcn-toast-description>
    </proto-ui-shadcn-toast-root>
  </proto-ui-shadcn-toast-viewport>
</proto-ui-shadcn-style-scope>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const loading = document.querySelector('#loading-toast');
  const done = document.querySelector('#done-toast');
  setElementProps(document.querySelector('#toast-promise-scope'), { styleProfile: 'rhea' });
  setElementProps(loading, { defaultOpen: false, duration: 0, type: 'loading' });
  setElementProps(done, { defaultOpen: false, duration: 4000, type: 'success' });
  document.querySelector('#create-event-btn').addEventListener('click', () => {
    loading.getExposes().openToast();
    setTimeout(() => {
      loading.getExposes().close('programmatic');
      done.getExposes().openToast();
    }, 1500);
  });
</script>
    `),
    'demo-shadcn-toast-persistent': formatCode(`
<proto-ui-shadcn-style-scope id="toast-persistent-scope">
  <proto-ui-shadcn-button id="open-persistent">Show Persistent Toast</proto-ui-shadcn-button>
  <proto-ui-shadcn-toast-viewport>
    <proto-ui-shadcn-toast-root id="persistent-toast">
      <div class="flex items-start justify-between gap-4">
        <div class="grid gap-1">
          <proto-ui-shadcn-toast-title>Connection lost</proto-ui-shadcn-toast-title>
          <proto-ui-shadcn-toast-description>Changes are paused until you reconnect or dismiss this notice.</proto-ui-shadcn-toast-description>
        </div>
        <proto-ui-shadcn-toast-close>Dismiss</proto-ui-shadcn-toast-close>
      </div>
    </proto-ui-shadcn-toast-root>
  </proto-ui-shadcn-toast-viewport>
</proto-ui-shadcn-style-scope>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#persistent-toast');
  setElementProps(document.querySelector('#toast-persistent-scope'), { styleProfile: 'rhea' });
  setElementProps(root, { open: false, duration: 0, politeness: 'assertive', type: 'warning' });
  document.querySelector('#open-persistent').addEventListener('click', () => setElementProps(root, { open: true }));
  root.addEventListener('openChange', (event) => setElementProps(root, { open: event.detail.open }));
</script>
    `),
    'demo-brutalist-toast': formatCode(`
<proto-ui-brutalist-button id="brutalist-toast-trigger">Show Toast</proto-ui-brutalist-button>
<proto-ui-brutalist-toast-viewport>
  <proto-ui-brutalist-toast-root id="brutalist-toast-root">
    <div class="flex items-start justify-between gap-4">
      <div class="grid gap-1">
        <proto-ui-brutalist-toast-title>Event has been created</proto-ui-brutalist-toast-title>
        <proto-ui-brutalist-toast-description>Sunday, December 03, 2023 at 9:00 AM</proto-ui-brutalist-toast-description>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <proto-ui-brutalist-toast-action>Undo</proto-ui-brutalist-toast-action>
        <proto-ui-brutalist-toast-close>Dismiss</proto-ui-brutalist-toast-close>
      </div>
    </div>
  </proto-ui-brutalist-toast-root>
</proto-ui-brutalist-toast-viewport>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#brutalist-toast-root');
  setElementProps(root, { defaultOpen: false, duration: 5000 });
  document.querySelector('#brutalist-toast-trigger').addEventListener('click', () => root.getExposes().openToast());
</script>
    `),
    'demo-brutalist-toast-types': formatCode(`
<div class="flex flex-wrap gap-2">
  <proto-ui-brutalist-button id="btn-success">Success</proto-ui-brutalist-button>
  <proto-ui-brutalist-button id="btn-warning">Warning</proto-ui-brutalist-button>
  <proto-ui-brutalist-button id="btn-error">Error</proto-ui-brutalist-button>
</div>
<proto-ui-brutalist-toast-viewport>
  <proto-ui-brutalist-toast-root id="toast-success">
    <proto-ui-brutalist-toast-title>Saved</proto-ui-brutalist-toast-title>
    <proto-ui-brutalist-toast-description>Event has been created.</proto-ui-brutalist-toast-description>
  </proto-ui-brutalist-toast-root>
</proto-ui-brutalist-toast-viewport>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const toast = document.querySelector('#toast-success');
  setElementProps(toast, { defaultOpen: false, type: 'success' });
  document.querySelector('#btn-success').addEventListener('click', () => toast.getExposes().openToast());
</script>
    `),
    'demo-brutalist-toast-action': formatCode(`
<proto-ui-brutalist-button id="brutalist-schedule">Schedule Meeting</proto-ui-brutalist-button>
<proto-ui-brutalist-toast-viewport>
  <proto-ui-brutalist-toast-root id="brutalist-scheduled">
    <proto-ui-brutalist-toast-title>Meeting scheduled</proto-ui-brutalist-toast-title>
    <proto-ui-brutalist-toast-description>Design review set for Tuesday at 2:00 PM.</proto-ui-brutalist-toast-description>
    <proto-ui-brutalist-toast-action>Undo</proto-ui-brutalist-toast-action>
  </proto-ui-brutalist-toast-root>
</proto-ui-brutalist-toast-viewport>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const toast = document.querySelector('#brutalist-scheduled');
  setElementProps(toast, { defaultOpen: false, duration: 6000 });
  document.querySelector('#brutalist-schedule').addEventListener('click', () => toast.getExposes().openToast());
</script>
    `),
    'demo-brutalist-toast-persistent': formatCode(`
<proto-ui-brutalist-button id="brutalist-open">Show Persistent Toast</proto-ui-brutalist-button>
<proto-ui-brutalist-toast-viewport>
  <proto-ui-brutalist-toast-root id="brutalist-persistent">
    <proto-ui-brutalist-toast-title>Connection lost</proto-ui-brutalist-toast-title>
    <proto-ui-brutalist-toast-description>Changes are paused until you reconnect or dismiss this notice.</proto-ui-brutalist-toast-description>
    <proto-ui-brutalist-toast-close>Dismiss</proto-ui-brutalist-toast-close>
  </proto-ui-brutalist-toast-root>
</proto-ui-brutalist-toast-viewport>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const toast = document.querySelector('#brutalist-persistent');
  setElementProps(toast, { open: false, duration: 0, politeness: 'assertive', type: 'warning' });
  document.querySelector('#brutalist-open').addEventListener('click', () => setElementProps(toast, { open: true }));
  toast.addEventListener('openChange', (e) => setElementProps(toast, { open: e.detail.open }));
</script>
    `),
    'demo-bootstrap-2-3-2-toast': formatCode(`
<proto-ui-bootstrap-2-3-2-button id="bs-toast-trigger">Show Toast</proto-ui-bootstrap-2-3-2-button>
<proto-ui-bootstrap-2-3-2-toast-viewport>
  <proto-ui-bootstrap-2-3-2-toast-root id="bs-toast-root">
    <proto-ui-bootstrap-2-3-2-toast-close>×</proto-ui-bootstrap-2-3-2-toast-close>
    <proto-ui-bootstrap-2-3-2-toast-title>Event has been created</proto-ui-bootstrap-2-3-2-toast-title>
    <proto-ui-bootstrap-2-3-2-toast-description>Sunday, December 03, 2023 at 9:00 AM</proto-ui-bootstrap-2-3-2-toast-description>
    <proto-ui-bootstrap-2-3-2-toast-action>Undo</proto-ui-bootstrap-2-3-2-toast-action>
  </proto-ui-bootstrap-2-3-2-toast-root>
</proto-ui-bootstrap-2-3-2-toast-viewport>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#bs-toast-root');
  setElementProps(root, { defaultOpen: false, duration: 5000 });
  document.querySelector('#bs-toast-trigger').addEventListener('click', () => root.getExposes().openToast());
</script>
    `),
    'demo-bootstrap-2-3-2-toast-variants': formatCode(`
<proto-ui-bootstrap-2-3-2-button id="bs-info-btn">Info</proto-ui-bootstrap-2-3-2-button>
<proto-ui-bootstrap-2-3-2-toast-viewport>
  <proto-ui-bootstrap-2-3-2-toast-root id="bs-info-toast">
    <proto-ui-bootstrap-2-3-2-toast-close>×</proto-ui-bootstrap-2-3-2-toast-close>
    <proto-ui-bootstrap-2-3-2-toast-title>Heads up!</proto-ui-bootstrap-2-3-2-toast-title>
    <proto-ui-bootstrap-2-3-2-toast-description>Arrive 10 minutes before the session starts.</proto-ui-bootstrap-2-3-2-toast-description>
  </proto-ui-bootstrap-2-3-2-toast-root>
</proto-ui-bootstrap-2-3-2-toast-viewport>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const toast = document.querySelector('#bs-info-toast');
  setElementProps(toast, { defaultOpen: false, variant: 'info' });
  document.querySelector('#bs-info-btn').addEventListener('click', () => toast.getExposes().openToast());
</script>
    `),
    'demo-bootstrap-2-3-2-toast-action': formatCode(`
<proto-ui-bootstrap-2-3-2-button id="bs-schedule">Schedule Meeting</proto-ui-bootstrap-2-3-2-button>
<proto-ui-bootstrap-2-3-2-toast-viewport>
  <proto-ui-bootstrap-2-3-2-toast-root id="bs-scheduled">
    <proto-ui-bootstrap-2-3-2-toast-close>×</proto-ui-bootstrap-2-3-2-toast-close>
    <proto-ui-bootstrap-2-3-2-toast-title>Meeting scheduled</proto-ui-bootstrap-2-3-2-toast-title>
    <proto-ui-bootstrap-2-3-2-toast-description>Design review set for Tuesday at 2:00 PM.</proto-ui-bootstrap-2-3-2-toast-description>
    <proto-ui-bootstrap-2-3-2-toast-action>Undo</proto-ui-bootstrap-2-3-2-toast-action>
  </proto-ui-bootstrap-2-3-2-toast-root>
</proto-ui-bootstrap-2-3-2-toast-viewport>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const toast = document.querySelector('#bs-scheduled');
  setElementProps(toast, { defaultOpen: false, duration: 6000, variant: 'info' });
  document.querySelector('#bs-schedule').addEventListener('click', () => toast.getExposes().openToast());
</script>
    `),
    'demo-bootstrap-2-3-2-toast-persistent': formatCode(`
<proto-ui-bootstrap-2-3-2-button id="bs-open">Show Persistent Toast</proto-ui-bootstrap-2-3-2-button>
<proto-ui-bootstrap-2-3-2-toast-viewport>
  <proto-ui-bootstrap-2-3-2-toast-root id="bs-persistent">
    <proto-ui-bootstrap-2-3-2-toast-close>×</proto-ui-bootstrap-2-3-2-toast-close>
    <proto-ui-bootstrap-2-3-2-toast-title>Connection lost</proto-ui-bootstrap-2-3-2-toast-title>
    <proto-ui-bootstrap-2-3-2-toast-description>Changes are paused until you reconnect or dismiss this notice.</proto-ui-bootstrap-2-3-2-toast-description>
  </proto-ui-bootstrap-2-3-2-toast-root>
</proto-ui-bootstrap-2-3-2-toast-viewport>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const toast = document.querySelector('#bs-persistent');
  setElementProps(toast, { open: false, duration: 0, politeness: 'assertive', variant: 'error' });
  document.querySelector('#bs-open').addEventListener('click', () => setElementProps(toast, { open: true }));
  toast.addEventListener('openChange', (e) => setElementProps(toast, { open: e.detail.open }));
</script>
    `),
    'demo-liquid-glass-toast': formatCode(`
<proto-ui-liquid-glass-button id="lg-toast-trigger">Show Toast</proto-ui-liquid-glass-button>
<proto-ui-liquid-glass-toast-viewport>
  <proto-ui-liquid-glass-toast-root id="lg-toast-root">
    <div class="flex items-start justify-between gap-4">
      <div class="grid gap-1">
        <proto-ui-liquid-glass-toast-title>Event has been created</proto-ui-liquid-glass-toast-title>
        <proto-ui-liquid-glass-toast-description>Sunday, December 03, 2023 at 9:00 AM</proto-ui-liquid-glass-toast-description>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <proto-ui-liquid-glass-toast-action>Undo</proto-ui-liquid-glass-toast-action>
        <proto-ui-liquid-glass-toast-close>Dismiss</proto-ui-liquid-glass-toast-close>
      </div>
    </div>
  </proto-ui-liquid-glass-toast-root>
</proto-ui-liquid-glass-toast-viewport>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#lg-toast-root');
  setElementProps(root, { defaultOpen: false, duration: 5000 });
  document.querySelector('#lg-toast-trigger').addEventListener('click', () => root.getExposes().openToast());
</script>
    `),
    'demo-liquid-glass-toast-prominence': formatCode(`
<proto-ui-liquid-glass-button id="lg-prominent-btn">Prominent</proto-ui-liquid-glass-button>
<proto-ui-liquid-glass-toast-viewport>
  <proto-ui-liquid-glass-toast-root id="lg-prominent-toast">
    <proto-ui-liquid-glass-toast-title>Software update ready</proto-ui-liquid-glass-toast-title>
    <proto-ui-liquid-glass-toast-description>Restart tonight to install the latest release.</proto-ui-liquid-glass-toast-description>
    <proto-ui-liquid-glass-toast-close>Dismiss</proto-ui-liquid-glass-toast-close>
  </proto-ui-liquid-glass-toast-root>
</proto-ui-liquid-glass-toast-viewport>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const toast = document.querySelector('#lg-prominent-toast');
  setElementProps(toast, { defaultOpen: false, prominence: 'prominent', material: 'auto' });
  document.querySelector('#lg-prominent-btn').addEventListener('click', () => toast.getExposes().openToast());
</script>
    `),
    'demo-liquid-glass-toast-action': formatCode(`
<proto-ui-liquid-glass-button id="lg-schedule">Schedule Meeting</proto-ui-liquid-glass-button>
<proto-ui-liquid-glass-toast-viewport>
  <proto-ui-liquid-glass-toast-root id="lg-scheduled">
    <proto-ui-liquid-glass-toast-title>Meeting scheduled</proto-ui-liquid-glass-toast-title>
    <proto-ui-liquid-glass-toast-description>Design review set for Tuesday at 2:00 PM.</proto-ui-liquid-glass-toast-description>
    <proto-ui-liquid-glass-toast-action>Undo</proto-ui-liquid-glass-toast-action>
  </proto-ui-liquid-glass-toast-root>
</proto-ui-liquid-glass-toast-viewport>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const toast = document.querySelector('#lg-scheduled');
  setElementProps(toast, { defaultOpen: false, duration: 6000, prominence: 'prominent' });
  document.querySelector('#lg-schedule').addEventListener('click', () => toast.getExposes().openToast());
</script>
    `),
    'demo-liquid-glass-toast-persistent': formatCode(`
<proto-ui-liquid-glass-button id="lg-open">Show Persistent Toast</proto-ui-liquid-glass-button>
<proto-ui-liquid-glass-toast-viewport>
  <proto-ui-liquid-glass-toast-root id="lg-persistent">
    <proto-ui-liquid-glass-toast-title>Connection lost</proto-ui-liquid-glass-toast-title>
    <proto-ui-liquid-glass-toast-description>Changes are paused until you reconnect or dismiss this notice.</proto-ui-liquid-glass-toast-description>
    <proto-ui-liquid-glass-toast-close>Dismiss</proto-ui-liquid-glass-toast-close>
  </proto-ui-liquid-glass-toast-root>
</proto-ui-liquid-glass-toast-viewport>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const toast = document.querySelector('#lg-persistent');
  setElementProps(toast, { open: false, duration: 0, politeness: 'assertive', prominence: 'destructive' });
  document.querySelector('#lg-open').addEventListener('click', () => setElementProps(toast, { open: true }));
  toast.addEventListener('openChange', (e) => setElementProps(toast, { open: e.detail.open }));
</script>
    `),
  },
  react: {
    'demo-shadcn-toast': formatCode(`
import { useRef } from 'react';
import {
  ShadcnStyleScope,
  ShadcnButton,
  ShadcnToastViewport,
  ShadcnToastRoot,
  ShadcnToastTitle,
  ShadcnToastDescription,
  ShadcnToastAction,
  ShadcnToastClose,
} from '../proto-ui/components/react';

export function ToastDemo() {
  const toastRef = useRef<{ openToast?: () => void }>(null);

  return (
    <ShadcnStyleScope styleProfile="rhea">
      <ShadcnButton variant="outline" onClick={() => toastRef.current?.openToast?.()}>
        Show Toast
      </ShadcnButton>
      <ShadcnToastViewport a11yLabel="Notifications">
        <ShadcnToastRoot ref={toastRef} defaultOpen={false} duration={5000}>
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <ShadcnToastTitle>Event has been created</ShadcnToastTitle>
              <ShadcnToastDescription>Sunday, December 03, 2023 at 9:00 AM</ShadcnToastDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ShadcnToastAction a11yLabel="Undo event creation">Undo</ShadcnToastAction>
              <ShadcnToastClose>Dismiss</ShadcnToastClose>
            </div>
          </div>
        </ShadcnToastRoot>
      </ShadcnToastViewport>
    </ShadcnStyleScope>
  );
}
    `),
    'demo-shadcn-toast-types': formatCode(`
import { useState } from 'react';
import {
  ShadcnStyleScope,
  ShadcnButton,
  ShadcnToastViewport,
  ShadcnToastRoot,
  ShadcnToastTitle,
  ShadcnToastDescription,
  ShadcnToastClose,
} from '../proto-ui/components/react';

export function ToastTypesDemo() {
  const [openType, setOpenType] = useState<'default' | 'success' | 'info' | 'warning' | 'error' | null>(null);

  return (
    <ShadcnStyleScope styleProfile="rhea">
      <div className="flex flex-wrap gap-2">
        {(['default', 'success', 'info', 'warning', 'error'] as const).map((type) => (
          <ShadcnButton key={type} variant="outline" onClick={() => setOpenType(type)}>
            {type[0].toUpperCase() + type.slice(1)}
          </ShadcnButton>
        ))}
      </div>
      <ShadcnToastViewport a11yLabel="Status notifications">
        <ShadcnToastRoot
          open={openType !== null}
          type={openType ?? 'default'}
          politeness={openType === 'error' ? 'assertive' : 'polite'}
          onOpenChange={({ open }) => !open && setOpenType(null)}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <ShadcnToastTitle>{openType === 'error' ? 'Request failed' : 'Status update'}</ShadcnToastTitle>
              <ShadcnToastDescription>Notification type: {openType ?? 'default'}</ShadcnToastDescription>
            </div>
            <ShadcnToastClose>Dismiss</ShadcnToastClose>
          </div>
        </ShadcnToastRoot>
      </ShadcnToastViewport>
    </ShadcnStyleScope>
  );
}
    `),
    'demo-shadcn-toast-action': formatCode(`
import { useState } from 'react';
import {
  ShadcnStyleScope,
  ShadcnButton,
  ShadcnToastViewport,
  ShadcnToastRoot,
  ShadcnToastTitle,
  ShadcnToastDescription,
  ShadcnToastAction,
} from '../proto-ui/components/react';

export function ToastActionDemo() {
  const [open, setOpen] = useState(false);

  return (
    <ShadcnStyleScope styleProfile="rhea">
      <ShadcnButton variant="outline" onClick={() => setOpen(true)}>
        Schedule Meeting
      </ShadcnButton>
      <ShadcnToastViewport a11yLabel="Action notifications">
        <ShadcnToastRoot open={open} duration={6000} onOpenChange={({ open: next }) => setOpen(next)}>
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <ShadcnToastTitle>Meeting scheduled</ShadcnToastTitle>
              <ShadcnToastDescription>Design review set for Tuesday at 2:00 PM.</ShadcnToastDescription>
            </div>
            <ShadcnToastAction a11yLabel="Undo meeting schedule" onAction={() => setOpen(false)}>
              Undo
            </ShadcnToastAction>
          </div>
        </ShadcnToastRoot>
      </ShadcnToastViewport>
    </ShadcnStyleScope>
  );
}
    `),
    'demo-shadcn-toast-promise': formatCode(`
import { useState } from 'react';
import {
  ShadcnStyleScope,
  ShadcnButton,
  ShadcnToastViewport,
  ShadcnToastRoot,
  ShadcnToastTitle,
  ShadcnToastDescription,
  ShadcnToastClose,
} from '../proto-ui/components/react';

export function ToastPromiseDemo() {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'success'>('idle');

  function createEvent() {
    setPhase('loading');
    window.setTimeout(() => setPhase('success'), 1500);
  }

  return (
    <ShadcnStyleScope styleProfile="rhea">
      <ShadcnButton variant="outline" onClick={createEvent}>
        Create Event
      </ShadcnButton>
      <ShadcnToastViewport a11yLabel="Async notifications">
        <ShadcnToastRoot
          open={phase !== 'idle'}
          duration={phase === 'loading' ? 0 : 4000}
          type={phase === 'loading' ? 'loading' : 'success'}
          onOpenChange={({ open }) => !open && setPhase('idle')}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <ShadcnToastTitle>{phase === 'loading' ? 'Creating event…' : 'Event created'}</ShadcnToastTitle>
              <ShadcnToastDescription>
                {phase === 'loading'
                  ? 'Syncing calendar details with participants.'
                  : 'Invitations have been sent to all attendees.'}
              </ShadcnToastDescription>
            </div>
            {phase === 'success' && <ShadcnToastClose>Dismiss</ShadcnToastClose>}
          </div>
        </ShadcnToastRoot>
      </ShadcnToastViewport>
    </ShadcnStyleScope>
  );
}
    `),
    'demo-shadcn-toast-persistent': formatCode(`
import { useState } from 'react';
import {
  ShadcnStyleScope,
  ShadcnButton,
  ShadcnToastViewport,
  ShadcnToastRoot,
  ShadcnToastTitle,
  ShadcnToastDescription,
  ShadcnToastClose,
} from '../proto-ui/components/react';

export function ToastPersistentDemo() {
  const [open, setOpen] = useState(false);

  return (
    <ShadcnStyleScope styleProfile="rhea">
      <div className="flex gap-2">
        <ShadcnButton variant="outline" onClick={() => setOpen(true)}>
          Show Persistent Toast
        </ShadcnButton>
        <ShadcnButton variant="ghost" onClick={() => setOpen(false)}>
          Close
        </ShadcnButton>
      </div>
      <ShadcnToastViewport a11yLabel="Persistent notifications">
        <ShadcnToastRoot
          open={open}
          duration={0}
          politeness="assertive"
          type="warning"
          onOpenChange={({ open: next }) => setOpen(next)}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <ShadcnToastTitle>Connection lost</ShadcnToastTitle>
              <ShadcnToastDescription>
                Changes are paused until you reconnect or dismiss this notice.
              </ShadcnToastDescription>
            </div>
            <ShadcnToastClose>Dismiss</ShadcnToastClose>
          </div>
        </ShadcnToastRoot>
      </ShadcnToastViewport>
    </ShadcnStyleScope>
  );
}
    `),
    'demo-brutalist-toast': formatCode(`
import { useState } from 'react';
import {
  BrutalistButton,
  BrutalistToastViewport,
  BrutalistToastRoot,
  BrutalistToastTitle,
  BrutalistToastDescription,
  BrutalistToastAction,
  BrutalistToastClose,
} from '../proto-ui/components/react';

export function BrutalistToastDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <BrutalistButton onClick={() => setOpen(true)}>Show Toast</BrutalistButton>
      <BrutalistToastViewport a11yLabel="Notifications">
        <BrutalistToastRoot open={open} duration={5000} onOpenChange={({ open: next }) => setOpen(next)}>
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <BrutalistToastTitle>Event has been created</BrutalistToastTitle>
              <BrutalistToastDescription>Sunday, December 03, 2023 at 9:00 AM</BrutalistToastDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <BrutalistToastAction>Undo</BrutalistToastAction>
              <BrutalistToastClose>Dismiss</BrutalistToastClose>
            </div>
          </div>
        </BrutalistToastRoot>
      </BrutalistToastViewport>
    </>
  );
}
    `),
    'demo-brutalist-toast-types': formatCode(`
import { useState } from 'react';
import {
  BrutalistButton,
  BrutalistToastViewport,
  BrutalistToastRoot,
  BrutalistToastTitle,
  BrutalistToastDescription,
  BrutalistToastClose,
} from '../proto-ui/components/react';

export function BrutalistToastTypesDemo() {
  const [type, setType] = useState<'default' | 'success' | 'info' | 'warning' | 'error' | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {(['default', 'success', 'info', 'warning', 'error'] as const).map((item) => (
          <BrutalistButton key={item} onClick={() => setType(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </BrutalistButton>
        ))}
      </div>
      <BrutalistToastViewport a11yLabel="Status notifications">
        <BrutalistToastRoot
          open={type !== null}
          type={type ?? 'default'}
          politeness={type === 'error' ? 'assertive' : 'polite'}
          onOpenChange={({ open }) => !open && setType(null)}
        >
          <BrutalistToastTitle>Status update</BrutalistToastTitle>
          <BrutalistToastDescription>Notification tone: {type ?? 'default'}</BrutalistToastDescription>
          <BrutalistToastClose>Dismiss</BrutalistToastClose>
        </BrutalistToastRoot>
      </BrutalistToastViewport>
    </>
  );
}
    `),
    'demo-brutalist-toast-action': formatCode(`
import { useState } from 'react';
import {
  BrutalistButton,
  BrutalistToastViewport,
  BrutalistToastRoot,
  BrutalistToastTitle,
  BrutalistToastDescription,
  BrutalistToastAction,
} from '../proto-ui/components/react';

export function BrutalistToastActionDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <BrutalistButton onClick={() => setOpen(true)}>Schedule Meeting</BrutalistButton>
      <BrutalistToastViewport>
        <BrutalistToastRoot open={open} duration={6000} onOpenChange={({ open: next }) => setOpen(next)}>
          <BrutalistToastTitle>Meeting scheduled</BrutalistToastTitle>
          <BrutalistToastDescription>Design review set for Tuesday at 2:00 PM.</BrutalistToastDescription>
          <BrutalistToastAction onAction={() => setOpen(false)}>Undo</BrutalistToastAction>
        </BrutalistToastRoot>
      </BrutalistToastViewport>
    </>
  );
}
    `),
    'demo-brutalist-toast-persistent': formatCode(`
import { useState } from 'react';
import {
  BrutalistButton,
  BrutalistToastViewport,
  BrutalistToastRoot,
  BrutalistToastTitle,
  BrutalistToastDescription,
  BrutalistToastClose,
} from '../proto-ui/components/react';

export function BrutalistToastPersistentDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <BrutalistButton onClick={() => setOpen(true)}>Show Persistent Toast</BrutalistButton>
      <BrutalistToastViewport>
        <BrutalistToastRoot
          open={open}
          duration={0}
          politeness="assertive"
          type="warning"
          onOpenChange={({ open: next }) => setOpen(next)}
        >
          <BrutalistToastTitle>Connection lost</BrutalistToastTitle>
          <BrutalistToastDescription>Changes are paused until you reconnect or dismiss this notice.</BrutalistToastDescription>
          <BrutalistToastClose>Dismiss</BrutalistToastClose>
        </BrutalistToastRoot>
      </BrutalistToastViewport>
    </>
  );
}
    `),
    'demo-bootstrap-2-3-2-toast': formatCode(`
import { useState } from 'react';
import {
  Bootstrap232Button,
  Bootstrap232ToastViewport,
  Bootstrap232ToastRoot,
  Bootstrap232ToastClose,
  Bootstrap232ToastTitle,
  Bootstrap232ToastDescription,
  Bootstrap232ToastAction,
} from '../proto-ui/components/react';

export function BootstrapToastDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Bootstrap232Button onClick={() => setOpen(true)}>Show Toast</Bootstrap232Button>
      <Bootstrap232ToastViewport a11yLabel="Notifications">
        <Bootstrap232ToastRoot open={open} duration={5000} onOpenChange={({ open: next }) => setOpen(next)}>
          <Bootstrap232ToastClose>×</Bootstrap232ToastClose>
          <Bootstrap232ToastTitle>Event has been created</Bootstrap232ToastTitle>
          <Bootstrap232ToastDescription>Sunday, December 03, 2023 at 9:00 AM</Bootstrap232ToastDescription>
          <Bootstrap232ToastAction>Undo</Bootstrap232ToastAction>
        </Bootstrap232ToastRoot>
      </Bootstrap232ToastViewport>
    </>
  );
}
    `),
    'demo-bootstrap-2-3-2-toast-variants': formatCode(`
import { useState } from 'react';
import {
  Bootstrap232Button,
  Bootstrap232ToastViewport,
  Bootstrap232ToastRoot,
  Bootstrap232ToastClose,
  Bootstrap232ToastTitle,
  Bootstrap232ToastDescription,
} from '../proto-ui/components/react';

export function BootstrapToastVariantsDemo() {
  const [variant, setVariant] = useState<'default' | 'info' | 'success' | 'error' | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {(['default', 'info', 'success', 'error'] as const).map((item) => (
          <Bootstrap232Button key={item} onClick={() => setVariant(item)}>
            {item === 'default' ? 'Warning' : item[0].toUpperCase() + item.slice(1)}
          </Bootstrap232Button>
        ))}
      </div>
      <Bootstrap232ToastViewport a11yLabel="Alert notifications">
        <Bootstrap232ToastRoot
          open={variant !== null}
          variant={variant ?? 'default'}
          politeness={variant === 'error' ? 'assertive' : 'polite'}
          onOpenChange={({ open }) => !open && setVariant(null)}
        >
          <Bootstrap232ToastClose>×</Bootstrap232ToastClose>
          <Bootstrap232ToastTitle>Alert notice</Bootstrap232ToastTitle>
          <Bootstrap232ToastDescription>Bootstrap 2.3.2 variant: {variant ?? 'default'}</Bootstrap232ToastDescription>
        </Bootstrap232ToastRoot>
      </Bootstrap232ToastViewport>
    </>
  );
}
    `),
    'demo-bootstrap-2-3-2-toast-action': formatCode(`
import { useState } from 'react';
import {
  Bootstrap232Button,
  Bootstrap232ToastViewport,
  Bootstrap232ToastRoot,
  Bootstrap232ToastClose,
  Bootstrap232ToastTitle,
  Bootstrap232ToastDescription,
  Bootstrap232ToastAction,
} from '../proto-ui/components/react';

export function BootstrapToastActionDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Bootstrap232Button onClick={() => setOpen(true)}>Schedule Meeting</Bootstrap232Button>
      <Bootstrap232ToastViewport>
        <Bootstrap232ToastRoot open={open} duration={6000} variant="info" onOpenChange={({ open: next }) => setOpen(next)}>
          <Bootstrap232ToastClose>×</Bootstrap232ToastClose>
          <Bootstrap232ToastTitle>Meeting scheduled</Bootstrap232ToastTitle>
          <Bootstrap232ToastDescription>Design review set for Tuesday at 2:00 PM.</Bootstrap232ToastDescription>
          <Bootstrap232ToastAction onAction={() => setOpen(false)}>Undo</Bootstrap232ToastAction>
        </Bootstrap232ToastRoot>
      </Bootstrap232ToastViewport>
    </>
  );
}
    `),
    'demo-bootstrap-2-3-2-toast-persistent': formatCode(`
import { useState } from 'react';
import {
  Bootstrap232Button,
  Bootstrap232ToastViewport,
  Bootstrap232ToastRoot,
  Bootstrap232ToastClose,
  Bootstrap232ToastTitle,
  Bootstrap232ToastDescription,
} from '../proto-ui/components/react';

export function BootstrapToastPersistentDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Bootstrap232Button onClick={() => setOpen(true)}>Show Persistent Toast</Bootstrap232Button>
      <Bootstrap232ToastViewport>
        <Bootstrap232ToastRoot
          open={open}
          duration={0}
          politeness="assertive"
          variant="error"
          onOpenChange={({ open: next }) => setOpen(next)}
        >
          <Bootstrap232ToastClose>×</Bootstrap232ToastClose>
          <Bootstrap232ToastTitle>Connection lost</Bootstrap232ToastTitle>
          <Bootstrap232ToastDescription>Changes are paused until you reconnect or dismiss this notice.</Bootstrap232ToastDescription>
        </Bootstrap232ToastRoot>
      </Bootstrap232ToastViewport>
    </>
  );
}
    `),
    'demo-liquid-glass-toast': formatCode(`
import { useState } from 'react';
import {
  LiquidGlassButton,
  LiquidGlassToastViewport,
  LiquidGlassToastRoot,
  LiquidGlassToastTitle,
  LiquidGlassToastDescription,
  LiquidGlassToastAction,
  LiquidGlassToastClose,
} from '../proto-ui/components/react';

export function LiquidGlassToastDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <LiquidGlassButton onClick={() => setOpen(true)}>Show Toast</LiquidGlassButton>
      <LiquidGlassToastViewport a11yLabel="Notifications">
        <LiquidGlassToastRoot open={open} duration={5000} onOpenChange={({ open: next }) => setOpen(next)}>
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <LiquidGlassToastTitle>Event has been created</LiquidGlassToastTitle>
              <LiquidGlassToastDescription>Sunday, December 03, 2023 at 9:00 AM</LiquidGlassToastDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <LiquidGlassToastAction>Undo</LiquidGlassToastAction>
              <LiquidGlassToastClose>Dismiss</LiquidGlassToastClose>
            </div>
          </div>
        </LiquidGlassToastRoot>
      </LiquidGlassToastViewport>
    </>
  );
}
    `),
    'demo-liquid-glass-toast-prominence': formatCode(`
import { useState } from 'react';
import {
  LiquidGlassButton,
  LiquidGlassToastViewport,
  LiquidGlassToastRoot,
  LiquidGlassToastTitle,
  LiquidGlassToastDescription,
  LiquidGlassToastClose,
} from '../proto-ui/components/react';

export function LiquidGlassToastProminenceDemo() {
  const [mode, setMode] = useState<'regular' | 'prominent' | 'destructive' | 'opaque' | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <LiquidGlassButton onClick={() => setMode('regular')}>Regular</LiquidGlassButton>
        <LiquidGlassButton onClick={() => setMode('prominent')}>Prominent</LiquidGlassButton>
        <LiquidGlassButton onClick={() => setMode('destructive')}>Destructive</LiquidGlassButton>
        <LiquidGlassButton onClick={() => setMode('opaque')}>Opaque Fallback</LiquidGlassButton>
      </div>
      <LiquidGlassToastViewport a11yLabel="Liquid Glass notifications">
        <LiquidGlassToastRoot
          open={mode !== null}
          prominence={mode === 'opaque' || mode === null ? 'regular' : mode}
          material={mode === 'opaque' ? 'opaque' : 'auto'}
          politeness={mode === 'destructive' ? 'assertive' : 'polite'}
          onOpenChange={({ open }) => !open && setMode(null)}
        >
          <LiquidGlassToastTitle>Material hierarchy</LiquidGlassToastTitle>
          <LiquidGlassToastDescription>Active surface mode: {mode ?? 'regular'}</LiquidGlassToastDescription>
          <LiquidGlassToastClose>Dismiss</LiquidGlassToastClose>
        </LiquidGlassToastRoot>
      </LiquidGlassToastViewport>
    </>
  );
}
    `),
    'demo-liquid-glass-toast-action': formatCode(`
import { useState } from 'react';
import {
  LiquidGlassButton,
  LiquidGlassToastViewport,
  LiquidGlassToastRoot,
  LiquidGlassToastTitle,
  LiquidGlassToastDescription,
  LiquidGlassToastAction,
} from '../proto-ui/components/react';

export function LiquidGlassToastActionDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <LiquidGlassButton onClick={() => setOpen(true)}>Schedule Meeting</LiquidGlassButton>
      <LiquidGlassToastViewport>
        <LiquidGlassToastRoot open={open} duration={6000} prominence="prominent" onOpenChange={({ open: next }) => setOpen(next)}>
          <LiquidGlassToastTitle>Meeting scheduled</LiquidGlassToastTitle>
          <LiquidGlassToastDescription>Design review set for Tuesday at 2:00 PM.</LiquidGlassToastDescription>
          <LiquidGlassToastAction onAction={() => setOpen(false)}>Undo</LiquidGlassToastAction>
        </LiquidGlassToastRoot>
      </LiquidGlassToastViewport>
    </>
  );
}
    `),
    'demo-liquid-glass-toast-persistent': formatCode(`
import { useState } from 'react';
import {
  LiquidGlassButton,
  LiquidGlassToastViewport,
  LiquidGlassToastRoot,
  LiquidGlassToastTitle,
  LiquidGlassToastDescription,
  LiquidGlassToastClose,
} from '../proto-ui/components/react';

export function LiquidGlassToastPersistentDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <LiquidGlassButton onClick={() => setOpen(true)}>Show Persistent Toast</LiquidGlassButton>
      <LiquidGlassToastViewport>
        <LiquidGlassToastRoot
          open={open}
          duration={0}
          politeness="assertive"
          prominence="destructive"
          onOpenChange={({ open: next }) => setOpen(next)}
        >
          <LiquidGlassToastTitle>Connection lost</LiquidGlassToastTitle>
          <LiquidGlassToastDescription>Changes are paused until you reconnect or dismiss this notice.</LiquidGlassToastDescription>
          <LiquidGlassToastClose>Dismiss</LiquidGlassToastClose>
        </LiquidGlassToastRoot>
      </LiquidGlassToastViewport>
    </>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-toast': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnStyleScope,
  ShadcnButton,
  ShadcnToastViewport,
  ShadcnToastRoot,
  ShadcnToastTitle,
  ShadcnToastDescription,
  ShadcnToastAction,
  ShadcnToastClose,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <ShadcnStyleScope style-profile="rhea">
    <ShadcnButton variant="outline" @click="open = true">Show Toast</ShadcnButton>
    <ShadcnToastViewport a11y-label="Notifications">
      <ShadcnToastRoot :open="open" :duration="5000" @open-change="open = $event.open">
        <div class="flex items-start justify-between gap-4">
          <div class="grid gap-1">
            <ShadcnToastTitle>Event has been created</ShadcnToastTitle>
            <ShadcnToastDescription>Sunday, December 03, 2023 at 9:00 AM</ShadcnToastDescription>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <ShadcnToastAction a11y-label="Undo event creation">Undo</ShadcnToastAction>
            <ShadcnToastClose>Dismiss</ShadcnToastClose>
          </div>
        </div>
      </ShadcnToastRoot>
    </ShadcnToastViewport>
  </ShadcnStyleScope>
</template>
    `),
    'demo-shadcn-toast-types': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnStyleScope,
  ShadcnButton,
  ShadcnToastViewport,
  ShadcnToastRoot,
  ShadcnToastTitle,
  ShadcnToastDescription,
  ShadcnToastClose,
} from '../proto-ui/components/vue';

const activeType = ref<'default' | 'success' | 'info' | 'warning' | 'error' | null>(null);
</script>

<template>
  <ShadcnStyleScope style-profile="rhea">
    <div class="flex flex-wrap gap-2">
      <ShadcnButton variant="outline" @click="activeType = 'default'">Default</ShadcnButton>
      <ShadcnButton variant="outline" @click="activeType = 'success'">Success</ShadcnButton>
      <ShadcnButton variant="outline" @click="activeType = 'info'">Info</ShadcnButton>
      <ShadcnButton variant="outline" @click="activeType = 'warning'">Warning</ShadcnButton>
      <ShadcnButton variant="outline" @click="activeType = 'error'">Error</ShadcnButton>
    </div>
    <ShadcnToastViewport a11y-label="Status notifications">
      <ShadcnToastRoot
        :open="activeType !== null"
        :type="activeType ?? 'default'"
        :politeness="activeType === 'error' ? 'assertive' : 'polite'"
        @open-change="if (!$event.open) activeType = null"
      >
        <ShadcnToastTitle>Status update</ShadcnToastTitle>
        <ShadcnToastDescription>Notification type: {{ activeType ?? 'default' }}</ShadcnToastDescription>
        <ShadcnToastClose>Dismiss</ShadcnToastClose>
      </ShadcnToastRoot>
    </ShadcnToastViewport>
  </ShadcnStyleScope>
</template>
    `),
    'demo-shadcn-toast-action': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnStyleScope,
  ShadcnButton,
  ShadcnToastViewport,
  ShadcnToastRoot,
  ShadcnToastTitle,
  ShadcnToastDescription,
  ShadcnToastAction,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <ShadcnStyleScope style-profile="rhea">
    <ShadcnButton variant="outline" @click="open = true">Schedule Meeting</ShadcnButton>
    <ShadcnToastViewport>
      <ShadcnToastRoot :open="open" :duration="6000" @open-change="open = $event.open">
        <ShadcnToastTitle>Meeting scheduled</ShadcnToastTitle>
        <ShadcnToastDescription>Design review set for Tuesday at 2:00 PM.</ShadcnToastDescription>
        <ShadcnToastAction a11y-label="Undo meeting schedule" @action="open = false">Undo</ShadcnToastAction>
      </ShadcnToastRoot>
    </ShadcnToastViewport>
  </ShadcnStyleScope>
</template>
    `),
    'demo-shadcn-toast-promise': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnStyleScope,
  ShadcnButton,
  ShadcnToastViewport,
  ShadcnToastRoot,
  ShadcnToastTitle,
  ShadcnToastDescription,
  ShadcnToastClose,
} from '../proto-ui/components/vue';

const phase = ref<'idle' | 'loading' | 'success'>('idle');
function createEvent() {
  phase.value = 'loading';
  window.setTimeout(() => { phase.value = 'success'; }, 1500);
}
</script>

<template>
  <ShadcnStyleScope style-profile="rhea">
    <ShadcnButton variant="outline" @click="createEvent">Create Event</ShadcnButton>
    <ShadcnToastViewport>
      <ShadcnToastRoot
        :open="phase !== 'idle'"
        :duration="phase === 'loading' ? 0 : 4000"
        :type="phase === 'loading' ? 'loading' : 'success'"
        @open-change="if (!$event.open) phase = 'idle'"
      >
        <ShadcnToastTitle>{{ phase === 'loading' ? 'Creating event…' : 'Event created' }}</ShadcnToastTitle>
        <ShadcnToastDescription>
          {{ phase === 'loading' ? 'Syncing calendar details with participants.' : 'Invitations have been sent to all attendees.' }}
        </ShadcnToastDescription>
        <ShadcnToastClose v-if="phase === 'success'">Dismiss</ShadcnToastClose>
      </ShadcnToastRoot>
    </ShadcnToastViewport>
  </ShadcnStyleScope>
</template>
    `),
    'demo-shadcn-toast-persistent': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnStyleScope,
  ShadcnButton,
  ShadcnToastViewport,
  ShadcnToastRoot,
  ShadcnToastTitle,
  ShadcnToastDescription,
  ShadcnToastClose,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <ShadcnStyleScope style-profile="rhea">
    <ShadcnButton variant="outline" @click="open = true">Show Persistent Toast</ShadcnButton>
    <ShadcnToastViewport>
      <ShadcnToastRoot :open="open" :duration="0" politeness="assertive" type="warning" @open-change="open = $event.open">
        <ShadcnToastTitle>Connection lost</ShadcnToastTitle>
        <ShadcnToastDescription>Changes are paused until you reconnect or dismiss this notice.</ShadcnToastDescription>
        <ShadcnToastClose>Dismiss</ShadcnToastClose>
      </ShadcnToastRoot>
    </ShadcnToastViewport>
  </ShadcnStyleScope>
</template>
    `),
    'demo-brutalist-toast': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  BrutalistButton,
  BrutalistToastViewport,
  BrutalistToastRoot,
  BrutalistToastTitle,
  BrutalistToastDescription,
  BrutalistToastAction,
  BrutalistToastClose,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <BrutalistButton @click="open = true">Show Toast</BrutalistButton>
  <BrutalistToastViewport>
    <BrutalistToastRoot :open="open" :duration="5000" @open-change="open = $event.open">
      <BrutalistToastTitle>Event has been created</BrutalistToastTitle>
      <BrutalistToastDescription>Sunday, December 03, 2023 at 9:00 AM</BrutalistToastDescription>
      <BrutalistToastAction>Undo</BrutalistToastAction>
      <BrutalistToastClose>Dismiss</BrutalistToastClose>
    </BrutalistToastRoot>
  </BrutalistToastViewport>
</template>
    `),
    'demo-brutalist-toast-types': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  BrutalistButton,
  BrutalistToastViewport,
  BrutalistToastRoot,
  BrutalistToastTitle,
  BrutalistToastDescription,
  BrutalistToastClose,
} from '../proto-ui/components/vue';

const type = ref<'default' | 'success' | 'info' | 'warning' | 'error' | null>(null);
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <BrutalistButton @click="type = 'success'">Success</BrutalistButton>
    <BrutalistButton @click="type = 'warning'">Warning</BrutalistButton>
    <BrutalistButton @click="type = 'error'">Error</BrutalistButton>
  </div>
  <BrutalistToastViewport>
    <BrutalistToastRoot :open="type !== null" :type="type ?? 'default'" @open-change="if (!$event.open) type = null">
      <BrutalistToastTitle>Status update</BrutalistToastTitle>
      <BrutalistToastDescription>Notification tone: {{ type ?? 'default' }}</BrutalistToastDescription>
      <BrutalistToastClose>Dismiss</BrutalistToastClose>
    </BrutalistToastRoot>
  </BrutalistToastViewport>
</template>
    `),
    'demo-brutalist-toast-action': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  BrutalistButton,
  BrutalistToastViewport,
  BrutalistToastRoot,
  BrutalistToastTitle,
  BrutalistToastDescription,
  BrutalistToastAction,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <BrutalistButton @click="open = true">Schedule Meeting</BrutalistButton>
  <BrutalistToastViewport>
    <BrutalistToastRoot :open="open" :duration="6000" @open-change="open = $event.open">
      <BrutalistToastTitle>Meeting scheduled</BrutalistToastTitle>
      <BrutalistToastDescription>Design review set for Tuesday at 2:00 PM.</BrutalistToastDescription>
      <BrutalistToastAction @action="open = false">Undo</BrutalistToastAction>
    </BrutalistToastRoot>
  </BrutalistToastViewport>
</template>
    `),
    'demo-brutalist-toast-persistent': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  BrutalistButton,
  BrutalistToastViewport,
  BrutalistToastRoot,
  BrutalistToastTitle,
  BrutalistToastDescription,
  BrutalistToastClose,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <BrutalistButton @click="open = true">Show Persistent Toast</BrutalistButton>
  <BrutalistToastViewport>
    <BrutalistToastRoot :open="open" :duration="0" politeness="assertive" type="warning" @open-change="open = $event.open">
      <BrutalistToastTitle>Connection lost</BrutalistToastTitle>
      <BrutalistToastDescription>Changes are paused until you reconnect or dismiss this notice.</BrutalistToastDescription>
      <BrutalistToastClose>Dismiss</BrutalistToastClose>
    </BrutalistToastRoot>
  </BrutalistToastViewport>
</template>
    `),
    'demo-bootstrap-2-3-2-toast': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  Bootstrap232Button,
  Bootstrap232ToastViewport,
  Bootstrap232ToastRoot,
  Bootstrap232ToastClose,
  Bootstrap232ToastTitle,
  Bootstrap232ToastDescription,
  Bootstrap232ToastAction,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <Bootstrap232Button @click="open = true">Show Toast</Bootstrap232Button>
  <Bootstrap232ToastViewport>
    <Bootstrap232ToastRoot :open="open" :duration="5000" @open-change="open = $event.open">
      <Bootstrap232ToastClose>×</Bootstrap232ToastClose>
      <Bootstrap232ToastTitle>Event has been created</Bootstrap232ToastTitle>
      <Bootstrap232ToastDescription>Sunday, December 03, 2023 at 9:00 AM</Bootstrap232ToastDescription>
      <Bootstrap232ToastAction>Undo</Bootstrap232ToastAction>
    </Bootstrap232ToastRoot>
  </Bootstrap232ToastViewport>
</template>
    `),
    'demo-bootstrap-2-3-2-toast-variants': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  Bootstrap232Button,
  Bootstrap232ToastViewport,
  Bootstrap232ToastRoot,
  Bootstrap232ToastClose,
  Bootstrap232ToastTitle,
  Bootstrap232ToastDescription,
} from '../proto-ui/components/vue';

const variant = ref<'default' | 'info' | 'success' | 'error' | null>(null);
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <Bootstrap232Button @click="variant = 'default'">Warning</Bootstrap232Button>
    <Bootstrap232Button @click="variant = 'info'">Info</Bootstrap232Button>
    <Bootstrap232Button @click="variant = 'success'">Success</Bootstrap232Button>
    <Bootstrap232Button @click="variant = 'error'">Error</Bootstrap232Button>
  </div>
  <Bootstrap232ToastViewport>
    <Bootstrap232ToastRoot :open="variant !== null" :variant="variant ?? 'default'" @open-change="if (!$event.open) variant = null">
      <Bootstrap232ToastClose>×</Bootstrap232ToastClose>
      <Bootstrap232ToastTitle>Alert notice</Bootstrap232ToastTitle>
      <Bootstrap232ToastDescription>Variant: {{ variant ?? 'default' }}</Bootstrap232ToastDescription>
    </Bootstrap232ToastRoot>
  </Bootstrap232ToastViewport>
</template>
    `),
    'demo-bootstrap-2-3-2-toast-action': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  Bootstrap232Button,
  Bootstrap232ToastViewport,
  Bootstrap232ToastRoot,
  Bootstrap232ToastClose,
  Bootstrap232ToastTitle,
  Bootstrap232ToastDescription,
  Bootstrap232ToastAction,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <Bootstrap232Button @click="open = true">Schedule Meeting</Bootstrap232Button>
  <Bootstrap232ToastViewport>
    <Bootstrap232ToastRoot :open="open" :duration="6000" variant="info" @open-change="open = $event.open">
      <Bootstrap232ToastClose>×</Bootstrap232ToastClose>
      <Bootstrap232ToastTitle>Meeting scheduled</Bootstrap232ToastTitle>
      <Bootstrap232ToastDescription>Design review set for Tuesday at 2:00 PM.</Bootstrap232ToastDescription>
      <Bootstrap232ToastAction @action="open = false">Undo</Bootstrap232ToastAction>
    </Bootstrap232ToastRoot>
  </Bootstrap232ToastViewport>
</template>
    `),
    'demo-bootstrap-2-3-2-toast-persistent': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  Bootstrap232Button,
  Bootstrap232ToastViewport,
  Bootstrap232ToastRoot,
  Bootstrap232ToastClose,
  Bootstrap232ToastTitle,
  Bootstrap232ToastDescription,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <Bootstrap232Button @click="open = true">Show Persistent Toast</Bootstrap232Button>
  <Bootstrap232ToastViewport>
    <Bootstrap232ToastRoot :open="open" :duration="0" politeness="assertive" variant="error" @open-change="open = $event.open">
      <Bootstrap232ToastClose>×</Bootstrap232ToastClose>
      <Bootstrap232ToastTitle>Connection lost</Bootstrap232ToastTitle>
      <Bootstrap232ToastDescription>Changes are paused until you reconnect or dismiss this notice.</Bootstrap232ToastDescription>
    </Bootstrap232ToastRoot>
  </Bootstrap232ToastViewport>
</template>
    `),
    'demo-liquid-glass-toast': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  LiquidGlassButton,
  LiquidGlassToastViewport,
  LiquidGlassToastRoot,
  LiquidGlassToastTitle,
  LiquidGlassToastDescription,
  LiquidGlassToastAction,
  LiquidGlassToastClose,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <LiquidGlassButton @click="open = true">Show Toast</LiquidGlassButton>
  <LiquidGlassToastViewport>
    <LiquidGlassToastRoot :open="open" :duration="5000" @open-change="open = $event.open">
      <LiquidGlassToastTitle>Event has been created</LiquidGlassToastTitle>
      <LiquidGlassToastDescription>Sunday, December 03, 2023 at 9:00 AM</LiquidGlassToastDescription>
      <LiquidGlassToastAction>Undo</LiquidGlassToastAction>
      <LiquidGlassToastClose>Dismiss</LiquidGlassToastClose>
    </LiquidGlassToastRoot>
  </LiquidGlassToastViewport>
</template>
    `),
    'demo-liquid-glass-toast-prominence': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  LiquidGlassButton,
  LiquidGlassToastViewport,
  LiquidGlassToastRoot,
  LiquidGlassToastTitle,
  LiquidGlassToastDescription,
  LiquidGlassToastClose,
} from '../proto-ui/components/vue';

const mode = ref<'regular' | 'prominent' | 'destructive' | 'opaque' | null>(null);
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <LiquidGlassButton @click="mode = 'regular'">Regular</LiquidGlassButton>
    <LiquidGlassButton @click="mode = 'prominent'">Prominent</LiquidGlassButton>
    <LiquidGlassButton @click="mode = 'destructive'">Destructive</LiquidGlassButton>
    <LiquidGlassButton @click="mode = 'opaque'">Opaque Fallback</LiquidGlassButton>
  </div>
  <LiquidGlassToastViewport>
    <LiquidGlassToastRoot
      :open="mode !== null"
      :prominence="mode === 'opaque' || mode === null ? 'regular' : mode"
      :material="mode === 'opaque' ? 'opaque' : 'auto'"
      @open-change="if (!$event.open) mode = null"
    >
      <LiquidGlassToastTitle>Material hierarchy</LiquidGlassToastTitle>
      <LiquidGlassToastDescription>Active surface mode: {{ mode ?? 'regular' }}</LiquidGlassToastDescription>
      <LiquidGlassToastClose>Dismiss</LiquidGlassToastClose>
    </LiquidGlassToastRoot>
  </LiquidGlassToastViewport>
</template>
    `),
    'demo-liquid-glass-toast-action': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  LiquidGlassButton,
  LiquidGlassToastViewport,
  LiquidGlassToastRoot,
  LiquidGlassToastTitle,
  LiquidGlassToastDescription,
  LiquidGlassToastAction,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <LiquidGlassButton @click="open = true">Schedule Meeting</LiquidGlassButton>
  <LiquidGlassToastViewport>
    <LiquidGlassToastRoot :open="open" :duration="6000" prominence="prominent" @open-change="open = $event.open">
      <LiquidGlassToastTitle>Meeting scheduled</LiquidGlassToastTitle>
      <LiquidGlassToastDescription>Design review set for Tuesday at 2:00 PM.</LiquidGlassToastDescription>
      <LiquidGlassToastAction @action="open = false">Undo</LiquidGlassToastAction>
    </LiquidGlassToastRoot>
  </LiquidGlassToastViewport>
</template>
    `),
    'demo-liquid-glass-toast-persistent': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  LiquidGlassButton,
  LiquidGlassToastViewport,
  LiquidGlassToastRoot,
  LiquidGlassToastTitle,
  LiquidGlassToastDescription,
  LiquidGlassToastClose,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <LiquidGlassButton @click="open = true">Show Persistent Toast</LiquidGlassButton>
  <LiquidGlassToastViewport>
    <LiquidGlassToastRoot :open="open" :duration="0" politeness="assertive" prominence="destructive" @open-change="open = $event.open">
      <LiquidGlassToastTitle>Connection lost</LiquidGlassToastTitle>
      <LiquidGlassToastDescription>Changes are paused until you reconnect or dismiss this notice.</LiquidGlassToastDescription>
      <LiquidGlassToastClose>Dismiss</LiquidGlassToastClose>
    </LiquidGlassToastRoot>
  </LiquidGlassToastViewport>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-toast': formatCode(`
<template>
  <ShadcnStyleScope style-profile="rhea">
    <ShadcnButton variant="outline" @click="open = true">Show Toast</ShadcnButton>
    <ShadcnToastViewport a11y-label="Notifications">
      <ShadcnToastRoot :open="open" :duration="5000" @openChange="open = $event.open">
        <div class="flex items-start justify-between gap-4">
          <div class="grid gap-1">
            <ShadcnToastTitle>Event has been created</ShadcnToastTitle>
            <ShadcnToastDescription>Sunday, December 03, 2023 at 9:00 AM</ShadcnToastDescription>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <ShadcnToastAction a11y-label="Undo event creation">Undo</ShadcnToastAction>
            <ShadcnToastClose>Dismiss</ShadcnToastClose>
          </div>
        </div>
      </ShadcnToastRoot>
    </ShadcnToastViewport>
  </ShadcnStyleScope>
</template>

<script>
import {
  ShadcnStyleScope,
  ShadcnButton,
  ShadcnToastViewport,
  ShadcnToastRoot,
  ShadcnToastTitle,
  ShadcnToastDescription,
  ShadcnToastAction,
  ShadcnToastClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnStyleScope,
    ShadcnButton,
    ShadcnToastViewport,
    ShadcnToastRoot,
    ShadcnToastTitle,
    ShadcnToastDescription,
    ShadcnToastAction,
    ShadcnToastClose,
  },
  data() {
    return { open: false };
  },
};
</script>
    `),
    'demo-shadcn-toast-types': formatCode(`
<template>
  <ShadcnStyleScope style-profile="rhea">
    <div class="flex flex-wrap gap-2">
      <ShadcnButton variant="outline" @click="activeType = 'default'">Default</ShadcnButton>
      <ShadcnButton variant="outline" @click="activeType = 'success'">Success</ShadcnButton>
      <ShadcnButton variant="outline" @click="activeType = 'info'">Info</ShadcnButton>
      <ShadcnButton variant="outline" @click="activeType = 'warning'">Warning</ShadcnButton>
      <ShadcnButton variant="outline" @click="activeType = 'error'">Error</ShadcnButton>
    </div>
    <ShadcnToastViewport>
      <ShadcnToastRoot
        :open="activeType !== null"
        :type="activeType || 'default'"
        :politeness="activeType === 'error' ? 'assertive' : 'polite'"
        @openChange="if (!$event.open) activeType = null"
      >
        <ShadcnToastTitle>Status update</ShadcnToastTitle>
        <ShadcnToastDescription>Notification type: {{ activeType || 'default' }}</ShadcnToastDescription>
        <ShadcnToastClose>Dismiss</ShadcnToastClose>
      </ShadcnToastRoot>
    </ShadcnToastViewport>
  </ShadcnStyleScope>
</template>

<script>
import {
  ShadcnStyleScope,
  ShadcnButton,
  ShadcnToastViewport,
  ShadcnToastRoot,
  ShadcnToastTitle,
  ShadcnToastDescription,
  ShadcnToastClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnStyleScope,
    ShadcnButton,
    ShadcnToastViewport,
    ShadcnToastRoot,
    ShadcnToastTitle,
    ShadcnToastDescription,
    ShadcnToastClose,
  },
  data() {
    return { activeType: null };
  },
};
</script>
    `),
    'demo-shadcn-toast-action': formatCode(`
<template>
  <ShadcnStyleScope style-profile="rhea">
    <ShadcnButton variant="outline" @click="open = true">Schedule Meeting</ShadcnButton>
    <ShadcnToastViewport>
      <ShadcnToastRoot :open="open" :duration="6000" @openChange="open = $event.open">
        <ShadcnToastTitle>Meeting scheduled</ShadcnToastTitle>
        <ShadcnToastDescription>Design review set for Tuesday at 2:00 PM.</ShadcnToastDescription>
        <ShadcnToastAction a11y-label="Undo meeting schedule" @action="open = false">Undo</ShadcnToastAction>
      </ShadcnToastRoot>
    </ShadcnToastViewport>
  </ShadcnStyleScope>
</template>

<script>
import {
  ShadcnStyleScope,
  ShadcnButton,
  ShadcnToastViewport,
  ShadcnToastRoot,
  ShadcnToastTitle,
  ShadcnToastDescription,
  ShadcnToastAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnStyleScope,
    ShadcnButton,
    ShadcnToastViewport,
    ShadcnToastRoot,
    ShadcnToastTitle,
    ShadcnToastDescription,
    ShadcnToastAction,
  },
  data() {
    return { open: false };
  },
};
</script>
    `),
    'demo-shadcn-toast-promise': formatCode(`
<template>
  <ShadcnStyleScope style-profile="rhea">
    <ShadcnButton variant="outline" @click="createEvent">Create Event</ShadcnButton>
    <ShadcnToastViewport>
      <ShadcnToastRoot
        :open="phase !== 'idle'"
        :duration="phase === 'loading' ? 0 : 4000"
        :type="phase === 'loading' ? 'loading' : 'success'"
        @openChange="if (!$event.open) phase = 'idle'"
      >
        <ShadcnToastTitle>{{ phase === 'loading' ? 'Creating event…' : 'Event created' }}</ShadcnToastTitle>
        <ShadcnToastDescription>
          {{ phase === 'loading' ? 'Syncing calendar details with participants.' : 'Invitations have been sent to all attendees.' }}
        </ShadcnToastDescription>
        <ShadcnToastClose v-if="phase === 'success'">Dismiss</ShadcnToastClose>
      </ShadcnToastRoot>
    </ShadcnToastViewport>
  </ShadcnStyleScope>
</template>

<script>
import {
  ShadcnStyleScope,
  ShadcnButton,
  ShadcnToastViewport,
  ShadcnToastRoot,
  ShadcnToastTitle,
  ShadcnToastDescription,
  ShadcnToastClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnStyleScope,
    ShadcnButton,
    ShadcnToastViewport,
    ShadcnToastRoot,
    ShadcnToastTitle,
    ShadcnToastDescription,
    ShadcnToastClose,
  },
  data() {
    return { phase: 'idle' };
  },
  methods: {
    createEvent() {
      this.phase = 'loading';
      window.setTimeout(() => {
        this.phase = 'success';
      }, 1500);
    },
  },
};
</script>
    `),
    'demo-shadcn-toast-persistent': formatCode(`
<template>
  <ShadcnStyleScope style-profile="rhea">
    <ShadcnButton variant="outline" @click="open = true">Show Persistent Toast</ShadcnButton>
    <ShadcnToastViewport>
      <ShadcnToastRoot :open="open" :duration="0" politeness="assertive" type="warning" @openChange="open = $event.open">
        <ShadcnToastTitle>Connection lost</ShadcnToastTitle>
        <ShadcnToastDescription>Changes are paused until you reconnect or dismiss this notice.</ShadcnToastDescription>
        <ShadcnToastClose>Dismiss</ShadcnToastClose>
      </ShadcnToastRoot>
    </ShadcnToastViewport>
  </ShadcnStyleScope>
</template>

<script>
import {
  ShadcnStyleScope,
  ShadcnButton,
  ShadcnToastViewport,
  ShadcnToastRoot,
  ShadcnToastTitle,
  ShadcnToastDescription,
  ShadcnToastClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnStyleScope,
    ShadcnButton,
    ShadcnToastViewport,
    ShadcnToastRoot,
    ShadcnToastTitle,
    ShadcnToastDescription,
    ShadcnToastClose,
  },
  data() {
    return { open: false };
  },
};
</script>
    `),
    'demo-brutalist-toast': formatCode(`
<template>
  <div>
    <BrutalistButton @click="open = true">Show Toast</BrutalistButton>
    <BrutalistToastViewport>
      <BrutalistToastRoot :open="open" :duration="5000" @openChange="open = $event.open">
        <BrutalistToastTitle>Event has been created</BrutalistToastTitle>
        <BrutalistToastDescription>Sunday, December 03, 2023 at 9:00 AM</BrutalistToastDescription>
        <BrutalistToastAction>Undo</BrutalistToastAction>
        <BrutalistToastClose>Dismiss</BrutalistToastClose>
      </BrutalistToastRoot>
    </BrutalistToastViewport>
  </div>
</template>

<script>
import {
  BrutalistButton,
  BrutalistToastViewport,
  BrutalistToastRoot,
  BrutalistToastTitle,
  BrutalistToastDescription,
  BrutalistToastAction,
  BrutalistToastClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistButton,
    BrutalistToastViewport,
    BrutalistToastRoot,
    BrutalistToastTitle,
    BrutalistToastDescription,
    BrutalistToastAction,
    BrutalistToastClose,
  },
  data() {
    return { open: false };
  },
};
</script>
    `),
    'demo-brutalist-toast-types': formatCode(`
<template>
  <div>
    <BrutalistButton @click="type = 'success'">Success</BrutalistButton>
    <BrutalistToastViewport>
      <BrutalistToastRoot :open="type !== null" :type="type || 'default'" @openChange="if (!$event.open) type = null">
        <BrutalistToastTitle>Status update</BrutalistToastTitle>
        <BrutalistToastDescription>Notification tone: {{ type || 'default' }}</BrutalistToastDescription>
        <BrutalistToastClose>Dismiss</BrutalistToastClose>
      </BrutalistToastRoot>
    </BrutalistToastViewport>
  </div>
</template>

<script>
import {
  BrutalistButton,
  BrutalistToastViewport,
  BrutalistToastRoot,
  BrutalistToastTitle,
  BrutalistToastDescription,
  BrutalistToastClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistButton,
    BrutalistToastViewport,
    BrutalistToastRoot,
    BrutalistToastTitle,
    BrutalistToastDescription,
    BrutalistToastClose,
  },
  data() {
    return { type: null };
  },
};
</script>
    `),
    'demo-brutalist-toast-action': formatCode(`
<template>
  <div>
    <BrutalistButton @click="open = true">Schedule Meeting</BrutalistButton>
    <BrutalistToastViewport>
      <BrutalistToastRoot :open="open" :duration="6000" @openChange="open = $event.open">
        <BrutalistToastTitle>Meeting scheduled</BrutalistToastTitle>
        <BrutalistToastDescription>Design review set for Tuesday at 2:00 PM.</BrutalistToastDescription>
        <BrutalistToastAction @action="open = false">Undo</BrutalistToastAction>
      </BrutalistToastRoot>
    </BrutalistToastViewport>
  </div>
</template>

<script>
import {
  BrutalistButton,
  BrutalistToastViewport,
  BrutalistToastRoot,
  BrutalistToastTitle,
  BrutalistToastDescription,
  BrutalistToastAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistButton,
    BrutalistToastViewport,
    BrutalistToastRoot,
    BrutalistToastTitle,
    BrutalistToastDescription,
    BrutalistToastAction,
  },
  data() {
    return { open: false };
  },
};
</script>
    `),
    'demo-brutalist-toast-persistent': formatCode(`
<template>
  <div>
    <BrutalistButton @click="open = true">Show Persistent Toast</BrutalistButton>
    <BrutalistToastViewport>
      <BrutalistToastRoot :open="open" :duration="0" politeness="assertive" type="warning" @openChange="open = $event.open">
        <BrutalistToastTitle>Connection lost</BrutalistToastTitle>
        <BrutalistToastDescription>Changes are paused until you reconnect or dismiss this notice.</BrutalistToastDescription>
        <BrutalistToastClose>Dismiss</BrutalistToastClose>
      </BrutalistToastRoot>
    </BrutalistToastViewport>
  </div>
</template>

<script>
import {
  BrutalistButton,
  BrutalistToastViewport,
  BrutalistToastRoot,
  BrutalistToastTitle,
  BrutalistToastDescription,
  BrutalistToastClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistButton,
    BrutalistToastViewport,
    BrutalistToastRoot,
    BrutalistToastTitle,
    BrutalistToastDescription,
    BrutalistToastClose,
  },
  data() {
    return { open: false };
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toast': formatCode(`
<template>
  <div>
    <Bootstrap232Button @click="open = true">Show Toast</Bootstrap232Button>
    <Bootstrap232ToastViewport>
      <Bootstrap232ToastRoot :open="open" :duration="5000" @openChange="open = $event.open">
        <Bootstrap232ToastClose>×</Bootstrap232ToastClose>
        <Bootstrap232ToastTitle>Event has been created</Bootstrap232ToastTitle>
        <Bootstrap232ToastDescription>Sunday, December 03, 2023 at 9:00 AM</Bootstrap232ToastDescription>
        <Bootstrap232ToastAction>Undo</Bootstrap232ToastAction>
      </Bootstrap232ToastRoot>
    </Bootstrap232ToastViewport>
  </div>
</template>

<script>
import {
  Bootstrap232Button,
  Bootstrap232ToastViewport,
  Bootstrap232ToastRoot,
  Bootstrap232ToastClose,
  Bootstrap232ToastTitle,
  Bootstrap232ToastDescription,
  Bootstrap232ToastAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232Button,
    Bootstrap232ToastViewport,
    Bootstrap232ToastRoot,
    Bootstrap232ToastClose,
    Bootstrap232ToastTitle,
    Bootstrap232ToastDescription,
    Bootstrap232ToastAction,
  },
  data() {
    return { open: false };
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toast-variants': formatCode(`
<template>
  <div>
    <Bootstrap232Button @click="variant = 'info'">Info</Bootstrap232Button>
    <Bootstrap232ToastViewport>
      <Bootstrap232ToastRoot :open="variant !== null" :variant="variant || 'default'" @openChange="if (!$event.open) variant = null">
        <Bootstrap232ToastClose>×</Bootstrap232ToastClose>
        <Bootstrap232ToastTitle>Alert notice</Bootstrap232ToastTitle>
        <Bootstrap232ToastDescription>Variant: {{ variant || 'default' }}</Bootstrap232ToastDescription>
      </Bootstrap232ToastRoot>
    </Bootstrap232ToastViewport>
  </div>
</template>

<script>
import {
  Bootstrap232Button,
  Bootstrap232ToastViewport,
  Bootstrap232ToastRoot,
  Bootstrap232ToastClose,
  Bootstrap232ToastTitle,
  Bootstrap232ToastDescription,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232Button,
    Bootstrap232ToastViewport,
    Bootstrap232ToastRoot,
    Bootstrap232ToastClose,
    Bootstrap232ToastTitle,
    Bootstrap232ToastDescription,
  },
  data() {
    return { variant: null };
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toast-action': formatCode(`
<template>
  <div>
    <Bootstrap232Button @click="open = true">Schedule Meeting</Bootstrap232Button>
    <Bootstrap232ToastViewport>
      <Bootstrap232ToastRoot :open="open" :duration="6000" variant="info" @openChange="open = $event.open">
        <Bootstrap232ToastClose>×</Bootstrap232ToastClose>
        <Bootstrap232ToastTitle>Meeting scheduled</Bootstrap232ToastTitle>
        <Bootstrap232ToastDescription>Design review set for Tuesday at 2:00 PM.</Bootstrap232ToastDescription>
        <Bootstrap232ToastAction @action="open = false">Undo</Bootstrap232ToastAction>
      </Bootstrap232ToastRoot>
    </Bootstrap232ToastViewport>
  </div>
</template>

<script>
import {
  Bootstrap232Button,
  Bootstrap232ToastViewport,
  Bootstrap232ToastRoot,
  Bootstrap232ToastClose,
  Bootstrap232ToastTitle,
  Bootstrap232ToastDescription,
  Bootstrap232ToastAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232Button,
    Bootstrap232ToastViewport,
    Bootstrap232ToastRoot,
    Bootstrap232ToastClose,
    Bootstrap232ToastTitle,
    Bootstrap232ToastDescription,
    Bootstrap232ToastAction,
  },
  data() {
    return { open: false };
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toast-persistent': formatCode(`
<template>
  <div>
    <Bootstrap232Button @click="open = true">Show Persistent Toast</Bootstrap232Button>
    <Bootstrap232ToastViewport>
      <Bootstrap232ToastRoot :open="open" :duration="0" politeness="assertive" variant="error" @openChange="open = $event.open">
        <Bootstrap232ToastClose>×</Bootstrap232ToastClose>
        <Bootstrap232ToastTitle>Connection lost</Bootstrap232ToastTitle>
        <Bootstrap232ToastDescription>Changes are paused until you reconnect or dismiss this notice.</Bootstrap232ToastDescription>
      </Bootstrap232ToastRoot>
    </Bootstrap232ToastViewport>
  </div>
</template>

<script>
import {
  Bootstrap232Button,
  Bootstrap232ToastViewport,
  Bootstrap232ToastRoot,
  Bootstrap232ToastClose,
  Bootstrap232ToastTitle,
  Bootstrap232ToastDescription,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232Button,
    Bootstrap232ToastViewport,
    Bootstrap232ToastRoot,
    Bootstrap232ToastClose,
    Bootstrap232ToastTitle,
    Bootstrap232ToastDescription,
  },
  data() {
    return { open: false };
  },
};
</script>
    `),
    'demo-liquid-glass-toast': formatCode(`
<template>
  <div>
    <LiquidGlassButton @click="open = true">Show Toast</LiquidGlassButton>
    <LiquidGlassToastViewport>
      <LiquidGlassToastRoot :open="open" :duration="5000" @openChange="open = $event.open">
        <LiquidGlassToastTitle>Event has been created</LiquidGlassToastTitle>
        <LiquidGlassToastDescription>Sunday, December 03, 2023 at 9:00 AM</LiquidGlassToastDescription>
        <LiquidGlassToastAction>Undo</LiquidGlassToastAction>
        <LiquidGlassToastClose>Dismiss</LiquidGlassToastClose>
      </LiquidGlassToastRoot>
    </LiquidGlassToastViewport>
  </div>
</template>

<script>
import {
  LiquidGlassButton,
  LiquidGlassToastViewport,
  LiquidGlassToastRoot,
  LiquidGlassToastTitle,
  LiquidGlassToastDescription,
  LiquidGlassToastAction,
  LiquidGlassToastClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassButton,
    LiquidGlassToastViewport,
    LiquidGlassToastRoot,
    LiquidGlassToastTitle,
    LiquidGlassToastDescription,
    LiquidGlassToastAction,
    LiquidGlassToastClose,
  },
  data() {
    return { open: false };
  },
};
</script>
    `),
    'demo-liquid-glass-toast-prominence': formatCode(`
<template>
  <div>
    <LiquidGlassButton @click="mode = 'prominent'">Prominent</LiquidGlassButton>
    <LiquidGlassToastViewport>
      <LiquidGlassToastRoot
        :open="mode !== null"
        :prominence="mode === 'opaque' || mode === null ? 'regular' : mode"
        :material="mode === 'opaque' ? 'opaque' : 'auto'"
        @openChange="if (!$event.open) mode = null"
      >
        <LiquidGlassToastTitle>Material hierarchy</LiquidGlassToastTitle>
        <LiquidGlassToastDescription>Active surface mode: {{ mode || 'regular' }}</LiquidGlassToastDescription>
        <LiquidGlassToastClose>Dismiss</LiquidGlassToastClose>
      </LiquidGlassToastRoot>
    </LiquidGlassToastViewport>
  </div>
</template>

<script>
import {
  LiquidGlassButton,
  LiquidGlassToastViewport,
  LiquidGlassToastRoot,
  LiquidGlassToastTitle,
  LiquidGlassToastDescription,
  LiquidGlassToastClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassButton,
    LiquidGlassToastViewport,
    LiquidGlassToastRoot,
    LiquidGlassToastTitle,
    LiquidGlassToastDescription,
    LiquidGlassToastClose,
  },
  data() {
    return { mode: null };
  },
};
</script>
    `),
    'demo-liquid-glass-toast-action': formatCode(`
<template>
  <div>
    <LiquidGlassButton @click="open = true">Schedule Meeting</LiquidGlassButton>
    <LiquidGlassToastViewport>
      <LiquidGlassToastRoot :open="open" :duration="6000" prominence="prominent" @openChange="open = $event.open">
        <LiquidGlassToastTitle>Meeting scheduled</LiquidGlassToastTitle>
        <LiquidGlassToastDescription>Design review set for Tuesday at 2:00 PM.</LiquidGlassToastDescription>
        <LiquidGlassToastAction @action="open = false">Undo</LiquidGlassToastAction>
      </LiquidGlassToastRoot>
    </LiquidGlassToastViewport>
  </div>
</template>

<script>
import {
  LiquidGlassButton,
  LiquidGlassToastViewport,
  LiquidGlassToastRoot,
  LiquidGlassToastTitle,
  LiquidGlassToastDescription,
  LiquidGlassToastAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassButton,
    LiquidGlassToastViewport,
    LiquidGlassToastRoot,
    LiquidGlassToastTitle,
    LiquidGlassToastDescription,
    LiquidGlassToastAction,
  },
  data() {
    return { open: false };
  },
};
</script>
    `),
    'demo-liquid-glass-toast-persistent': formatCode(`
<template>
  <div>
    <LiquidGlassButton @click="open = true">Show Persistent Toast</LiquidGlassButton>
    <LiquidGlassToastViewport>
      <LiquidGlassToastRoot :open="open" :duration="0" politeness="assertive" prominence="destructive" @openChange="open = $event.open">
        <LiquidGlassToastTitle>Connection lost</LiquidGlassToastTitle>
        <LiquidGlassToastDescription>Changes are paused until you reconnect or dismiss this notice.</LiquidGlassToastDescription>
        <LiquidGlassToastClose>Dismiss</LiquidGlassToastClose>
      </LiquidGlassToastRoot>
    </LiquidGlassToastViewport>
  </div>
</template>

<script>
import {
  LiquidGlassButton,
  LiquidGlassToastViewport,
  LiquidGlassToastRoot,
  LiquidGlassToastTitle,
  LiquidGlassToastDescription,
  LiquidGlassToastClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassButton,
    LiquidGlassToastViewport,
    LiquidGlassToastRoot,
    LiquidGlassToastTitle,
    LiquidGlassToastDescription,
    LiquidGlassToastClose,
  },
  data() {
    return { open: false };
  },
};
</script>
    `),
  },
};
