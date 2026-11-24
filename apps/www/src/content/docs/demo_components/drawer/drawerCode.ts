import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-drawer': formatCode(`
<wc-shadcn-drawer-root style-profile="rhea" a11y-label="Daily activity goal">
  <wc-shadcn-drawer-trigger style-profile="rhea">
    <wc-shadcn-button style-profile="rhea" variant="outline">Open Drawer</wc-shadcn-button>
  </wc-shadcn-drawer-trigger>
  <wc-shadcn-drawer-mask style-profile="rhea"></wc-shadcn-drawer-mask>
  <wc-shadcn-drawer-content style-profile="rhea" side="bottom">
    <wc-shadcn-drawer-handle style-profile="rhea" a11y-label="Resize drawer"></wc-shadcn-drawer-handle>
    <div class="mx-auto w-full max-w-sm">
      <wc-shadcn-drawer-header style-profile="rhea">
        <wc-shadcn-drawer-title style-profile="rhea">Move Goal</wc-shadcn-drawer-title>
        <wc-shadcn-drawer-description style-profile="rhea">
          Set your daily activity goal.
        </wc-shadcn-drawer-description>
      </wc-shadcn-drawer-header>
      <div class="px-4 py-3 text-center">
        <div class="text-4xl font-bold tabular-nums">350</div>
        <div class="text-xs uppercase text-muted-foreground">Calories / day</div>
      </div>
      <wc-shadcn-drawer-footer style-profile="rhea">
        <wc-shadcn-button style-profile="rhea">Submit</wc-shadcn-button>
        <wc-shadcn-drawer-close style-profile="rhea">
          <wc-shadcn-button style-profile="rhea" variant="outline">Cancel</wc-shadcn-button>
        </wc-shadcn-drawer-close>
      </wc-shadcn-drawer-footer>
    </div>
  </wc-shadcn-drawer-content>
</wc-shadcn-drawer-root>
    `),
    'demo-shadcn-drawer-sides': formatCode(`
<div class="flex flex-wrap gap-3">
  <wc-shadcn-drawer-root style-profile="rhea" a11y-label="Right Drawer">
    <wc-shadcn-drawer-trigger style-profile="rhea">
      <wc-shadcn-button style-profile="rhea" variant="outline">Right</wc-shadcn-button>
    </wc-shadcn-drawer-trigger>
    <wc-shadcn-drawer-mask style-profile="rhea"></wc-shadcn-drawer-mask>
    <wc-shadcn-drawer-content style-profile="rhea" side="right">
      <wc-shadcn-drawer-handle style-profile="rhea"></wc-shadcn-drawer-handle>
      <wc-shadcn-drawer-header style-profile="rhea">
        <wc-shadcn-drawer-title style-profile="rhea">Right Drawer</wc-shadcn-drawer-title>
        <wc-shadcn-drawer-description style-profile="rhea">
          Slides in from the right edge.
        </wc-shadcn-drawer-description>
      </wc-shadcn-drawer-header>
      <wc-shadcn-drawer-footer style-profile="rhea">
        <wc-shadcn-drawer-close style-profile="rhea">
          <wc-shadcn-button style-profile="rhea" variant="outline">Close</wc-shadcn-button>
        </wc-shadcn-drawer-close>
      </wc-shadcn-drawer-footer>
    </wc-shadcn-drawer-content>
  </wc-shadcn-drawer-root>
</div>
    `),
    'demo-shadcn-drawer-scroll': formatCode(`
<wc-shadcn-drawer-root style-profile="rhea" a11y-label="Release notes">
  <wc-shadcn-drawer-trigger style-profile="rhea">
    <wc-shadcn-button style-profile="rhea" variant="outline">Scrollable Content</wc-shadcn-button>
  </wc-shadcn-drawer-trigger>
  <wc-shadcn-drawer-mask style-profile="rhea"></wc-shadcn-drawer-mask>
  <wc-shadcn-drawer-content style-profile="rhea" side="bottom">
    <wc-shadcn-drawer-handle style-profile="rhea"></wc-shadcn-drawer-handle>
    <wc-shadcn-drawer-header style-profile="rhea">
      <wc-shadcn-drawer-title style-profile="rhea">Release Highlights</wc-shadcn-drawer-title>
      <wc-shadcn-drawer-description style-profile="rhea">
        Scroll through the notes while keeping header and footer anchored.
      </wc-shadcn-drawer-description>
    </wc-shadcn-drawer-header>
    <div class="flex-1 overflow-y-auto px-4 py-2 space-y-3">
      <!-- Scrollable body items -->
    </div>
    <wc-shadcn-drawer-footer style-profile="rhea">
      <wc-shadcn-drawer-close style-profile="rhea">
        <wc-shadcn-button style-profile="rhea" variant="outline">Close</wc-shadcn-button>
      </wc-shadcn-drawer-close>
    </wc-shadcn-drawer-footer>
  </wc-shadcn-drawer-content>
</wc-shadcn-drawer-root>
    `),
    'demo-shadcn-drawer-snap': formatCode(`
<wc-shadcn-drawer-root style-profile="rhea" a11y-label="Snap points drawer">
  <wc-shadcn-drawer-trigger style-profile="rhea">
    <wc-shadcn-button style-profile="rhea" variant="outline">Open Snap Drawer</wc-shadcn-button>
  </wc-shadcn-drawer-trigger>
  <wc-shadcn-drawer-mask style-profile="rhea"></wc-shadcn-drawer-mask>
  <wc-shadcn-drawer-content id="snap-drawer-content" style-profile="rhea" side="bottom">
    <wc-shadcn-drawer-handle style-profile="rhea" a11y-label="Resize drawer height"></wc-shadcn-drawer-handle>
    <wc-shadcn-drawer-header style-profile="rhea">
      <wc-shadcn-drawer-title style-profile="rhea">Snap Points</wc-shadcn-drawer-title>
      <wc-shadcn-drawer-description style-profile="rhea">
        Drag the handle or press Arrow Up / Down to switch between 50% and full height.
      </wc-shadcn-drawer-description>
    </wc-shadcn-drawer-header>
    <wc-shadcn-drawer-footer style-profile="rhea">
      <wc-shadcn-drawer-close style-profile="rhea">
        <wc-shadcn-button style-profile="rhea" variant="outline">Close</wc-shadcn-button>
      </wc-shadcn-drawer-close>
    </wc-shadcn-drawer-footer>
  </wc-shadcn-drawer-content>
</wc-shadcn-drawer-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#snap-drawer-content'), {
    styleProfile: 'rhea',
    side: 'bottom',
    snapPoints: [0.5, 1],
    defaultSnapPoint: 0.5,
  });
</script>
    `),
    'demo-shadcn-drawer-sizing': formatCode(`
<wc-shadcn-drawer-root style-profile="rhea" a11y-label="Custom sized drawer">
  <wc-shadcn-drawer-trigger style-profile="rhea">
    <wc-shadcn-button style-profile="rhea" variant="outline">Custom Size &amp; Locked Drag</wc-shadcn-button>
  </wc-shadcn-drawer-trigger>
  <wc-shadcn-drawer-mask style-profile="rhea"></wc-shadcn-drawer-mask>
  <wc-shadcn-drawer-content id="sized-drawer-content" style-profile="rhea" side="right">
    <wc-shadcn-drawer-header style-profile="rhea">
      <wc-shadcn-drawer-title style-profile="rhea">Inspector Panel</wc-shadcn-drawer-title>
      <wc-shadcn-drawer-description style-profile="rhea">
        Capped at 420px with drag dismissal disabled.
      </wc-shadcn-drawer-description>
    </wc-shadcn-drawer-header>
    <wc-shadcn-drawer-footer style-profile="rhea">
      <wc-shadcn-drawer-close style-profile="rhea">
        <wc-shadcn-button style-profile="rhea" variant="outline">Close</wc-shadcn-button>
      </wc-shadcn-drawer-close>
    </wc-shadcn-drawer-footer>
  </wc-shadcn-drawer-content>
</wc-shadcn-drawer-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#sized-drawer-content'), {
    styleProfile: 'rhea',
    side: 'right',
    maxExtent: { unit: 'logical', value: 420 },
    dragDismissible: false,
  });
</script>
    `),
    'demo-brutalist-drawer': formatCode(`
<wc-brutalist-drawer-root a11y-label="Confirm deployment">
  <wc-brutalist-drawer-trigger>Open Drawer</wc-brutalist-drawer-trigger>
  <wc-brutalist-drawer-mask></wc-brutalist-drawer-mask>
  <wc-brutalist-drawer-content side="bottom">
    <wc-brutalist-drawer-handle a11y-label="Resize drawer"></wc-brutalist-drawer-handle>
    <wc-brutalist-drawer-title>Are you absolutely sure?</wc-brutalist-drawer-title>
    <wc-brutalist-drawer-description>
      Publish the latest build to the staging environment.
    </wc-brutalist-drawer-description>
    <wc-brutalist-drawer-close>Cancel</wc-brutalist-drawer-close>
  </wc-brutalist-drawer-content>
</wc-brutalist-drawer-root>
    `),
    'demo-brutalist-drawer-sides': formatCode(`
<wc-brutalist-drawer-root a11y-label="Right Drawer">
  <wc-brutalist-drawer-trigger>Right</wc-brutalist-drawer-trigger>
  <wc-brutalist-drawer-mask></wc-brutalist-drawer-mask>
  <wc-brutalist-drawer-content side="right">
    <wc-brutalist-drawer-handle></wc-brutalist-drawer-handle>
    <wc-brutalist-drawer-title>Right Drawer</wc-brutalist-drawer-title>
    <wc-brutalist-drawer-description>Slides in from the right edge.</wc-brutalist-drawer-description>
    <wc-brutalist-drawer-close>Close</wc-brutalist-drawer-close>
  </wc-brutalist-drawer-content>
</wc-brutalist-drawer-root>
    `),
    'demo-brutalist-drawer-scroll': formatCode(`
<wc-brutalist-drawer-root a11y-label="Activity log">
  <wc-brutalist-drawer-trigger>Scrollable Content</wc-brutalist-drawer-trigger>
  <wc-brutalist-drawer-mask></wc-brutalist-drawer-mask>
  <wc-brutalist-drawer-content side="bottom">
    <wc-brutalist-drawer-handle></wc-brutalist-drawer-handle>
    <wc-brutalist-drawer-title>Activity Log</wc-brutalist-drawer-title>
    <div class="flex-1 overflow-y-auto space-y-2">
      <!-- Scrollable activity entries -->
    </div>
    <wc-brutalist-drawer-close>Close</wc-brutalist-drawer-close>
  </wc-brutalist-drawer-content>
</wc-brutalist-drawer-root>
    `),
    'demo-brutalist-drawer-snap': formatCode(`
<wc-brutalist-drawer-root a11y-label="Snap points drawer">
  <wc-brutalist-drawer-trigger>Open Snap Drawer</wc-brutalist-drawer-trigger>
  <wc-brutalist-drawer-mask></wc-brutalist-drawer-mask>
  <wc-brutalist-drawer-content id="brutalist-snap-content" side="bottom">
    <wc-brutalist-drawer-handle a11y-label="Resize drawer height"></wc-brutalist-drawer-handle>
    <wc-brutalist-drawer-title>Snap Points</wc-brutalist-drawer-title>
    <wc-brutalist-drawer-description>
      Drag the handle or use Arrow Up / Down to change height.
    </wc-brutalist-drawer-description>
    <wc-brutalist-drawer-close>Close</wc-brutalist-drawer-close>
  </wc-brutalist-drawer-content>
</wc-brutalist-drawer-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#brutalist-snap-content'), {
    side: 'bottom',
    snapPoints: [0.5, 1],
    defaultSnapPoint: 0.5,
  });
</script>
    `),
    'demo-brutalist-drawer-sizing': formatCode(`
<wc-brutalist-drawer-root a11y-label="Custom sized drawer">
  <wc-brutalist-drawer-trigger>Custom Size &amp; Locked Drag</wc-brutalist-drawer-trigger>
  <wc-brutalist-drawer-mask></wc-brutalist-drawer-mask>
  <wc-brutalist-drawer-content id="brutalist-sized-content" side="right">
    <wc-brutalist-drawer-title>Inspector Panel</wc-brutalist-drawer-title>
    <wc-brutalist-drawer-description>
      Capped at 420px with drag dismissal disabled.
    </wc-brutalist-drawer-description>
    <wc-brutalist-drawer-close>Close</wc-brutalist-drawer-close>
  </wc-brutalist-drawer-content>
</wc-brutalist-drawer-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#brutalist-sized-content'), {
    side: 'right',
    maxExtent: { unit: 'logical', value: 420 },
    dragDismissible: false,
  });
</script>
    `),
    'demo-bootstrap-2-3-2-drawer': formatCode(`
<wc-bootstrap-2-3-2-drawer-root a11y-label="Workspace preferences">
  <wc-bootstrap-2-3-2-drawer-trigger>Open Drawer</wc-bootstrap-2-3-2-drawer-trigger>
  <wc-bootstrap-2-3-2-drawer-mask></wc-bootstrap-2-3-2-drawer-mask>
  <wc-bootstrap-2-3-2-drawer-content side="bottom">
    <wc-bootstrap-2-3-2-drawer-handle></wc-bootstrap-2-3-2-drawer-handle>
    <wc-bootstrap-2-3-2-drawer-header>
      <wc-bootstrap-2-3-2-drawer-title>Workspace Preferences</wc-bootstrap-2-3-2-drawer-title>
      <wc-bootstrap-2-3-2-drawer-description>
        Review default notification and digest rules for this project.
      </wc-bootstrap-2-3-2-drawer-description>
    </wc-bootstrap-2-3-2-drawer-header>
    <div class="p-[15px]">Daily digest: Enabled at 09:00 UTC</div>
    <wc-bootstrap-2-3-2-drawer-footer>
      <wc-bootstrap-2-3-2-drawer-close>Close</wc-bootstrap-2-3-2-drawer-close>
    </wc-bootstrap-2-3-2-drawer-footer>
  </wc-bootstrap-2-3-2-drawer-content>
</wc-bootstrap-2-3-2-drawer-root>
    `),
    'demo-bootstrap-2-3-2-drawer-sides': formatCode(`
<wc-bootstrap-2-3-2-drawer-root a11y-label="Right Drawer">
  <wc-bootstrap-2-3-2-drawer-trigger>Right</wc-bootstrap-2-3-2-drawer-trigger>
  <wc-bootstrap-2-3-2-drawer-mask></wc-bootstrap-2-3-2-drawer-mask>
  <wc-bootstrap-2-3-2-drawer-content side="right">
    <wc-bootstrap-2-3-2-drawer-handle></wc-bootstrap-2-3-2-drawer-handle>
    <wc-bootstrap-2-3-2-drawer-header>
      <wc-bootstrap-2-3-2-drawer-title>Right Drawer</wc-bootstrap-2-3-2-drawer-title>
      <wc-bootstrap-2-3-2-drawer-description>Slides in from the right edge.</wc-bootstrap-2-3-2-drawer-description>
    </wc-bootstrap-2-3-2-drawer-header>
    <wc-bootstrap-2-3-2-drawer-footer>
      <wc-bootstrap-2-3-2-drawer-close>Close</wc-bootstrap-2-3-2-drawer-close>
    </wc-bootstrap-2-3-2-drawer-footer>
  </wc-bootstrap-2-3-2-drawer-content>
</wc-bootstrap-2-3-2-drawer-root>
    `),
    'demo-bootstrap-2-3-2-drawer-scroll': formatCode(`
<wc-bootstrap-2-3-2-drawer-root a11y-label="System activity log">
  <wc-bootstrap-2-3-2-drawer-trigger>Scrollable Content</wc-bootstrap-2-3-2-drawer-trigger>
  <wc-bootstrap-2-3-2-drawer-mask></wc-bootstrap-2-3-2-drawer-mask>
  <wc-bootstrap-2-3-2-drawer-content side="bottom">
    <wc-bootstrap-2-3-2-drawer-handle></wc-bootstrap-2-3-2-drawer-handle>
    <wc-bootstrap-2-3-2-drawer-header>
      <wc-bootstrap-2-3-2-drawer-title>System Activity Log</wc-bootstrap-2-3-2-drawer-title>
    </wc-bootstrap-2-3-2-drawer-header>
    <div class="flex-1 overflow-y-auto p-[15px] space-y-2">
      <!-- Scrollable log entries -->
    </div>
    <wc-bootstrap-2-3-2-drawer-footer>
      <wc-bootstrap-2-3-2-drawer-close>Close</wc-bootstrap-2-3-2-drawer-close>
    </wc-bootstrap-2-3-2-drawer-footer>
  </wc-bootstrap-2-3-2-drawer-content>
</wc-bootstrap-2-3-2-drawer-root>
    `),
    'demo-bootstrap-2-3-2-drawer-snap': formatCode(`
<wc-bootstrap-2-3-2-drawer-root a11y-label="Snap points drawer">
  <wc-bootstrap-2-3-2-drawer-trigger>Open Snap Drawer</wc-bootstrap-2-3-2-drawer-trigger>
  <wc-bootstrap-2-3-2-drawer-mask></wc-bootstrap-2-3-2-drawer-mask>
  <wc-bootstrap-2-3-2-drawer-content id="bootstrap-snap-content" side="bottom">
    <wc-bootstrap-2-3-2-drawer-handle a11y-label="Resize drawer height"></wc-bootstrap-2-3-2-drawer-handle>
    <wc-bootstrap-2-3-2-drawer-header>
      <wc-bootstrap-2-3-2-drawer-title>Snap Points</wc-bootstrap-2-3-2-drawer-title>
    </wc-bootstrap-2-3-2-drawer-header>
    <wc-bootstrap-2-3-2-drawer-footer>
      <wc-bootstrap-2-3-2-drawer-close>Close</wc-bootstrap-2-3-2-drawer-close>
    </wc-bootstrap-2-3-2-drawer-footer>
  </wc-bootstrap-2-3-2-drawer-content>
</wc-bootstrap-2-3-2-drawer-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bootstrap-snap-content'), {
    side: 'bottom',
    snapPoints: [0.5, 1],
    defaultSnapPoint: 0.5,
  });
</script>
    `),
    'demo-bootstrap-2-3-2-drawer-sizing': formatCode(`
<wc-bootstrap-2-3-2-drawer-root a11y-label="Custom sized drawer">
  <wc-bootstrap-2-3-2-drawer-trigger>Custom Size &amp; Locked Drag</wc-bootstrap-2-3-2-drawer-trigger>
  <wc-bootstrap-2-3-2-drawer-mask></wc-bootstrap-2-3-2-drawer-mask>
  <wc-bootstrap-2-3-2-drawer-content id="bootstrap-sized-content" side="right">
    <wc-bootstrap-2-3-2-drawer-header>
      <wc-bootstrap-2-3-2-drawer-title>Inspector Panel</wc-bootstrap-2-3-2-drawer-title>
    </wc-bootstrap-2-3-2-drawer-header>
    <wc-bootstrap-2-3-2-drawer-footer>
      <wc-bootstrap-2-3-2-drawer-close>Close</wc-bootstrap-2-3-2-drawer-close>
    </wc-bootstrap-2-3-2-drawer-footer>
  </wc-bootstrap-2-3-2-drawer-content>
</wc-bootstrap-2-3-2-drawer-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bootstrap-sized-content'), {
    side: 'right',
    maxExtent: { unit: 'logical', value: 420 },
    dragDismissible: false,
  });
</script>
    `),
    'demo-liquid-glass-drawer': formatCode(`
<wc-liquid-glass-drawer-root a11y-label="Audio output settings">
  <wc-liquid-glass-drawer-trigger variant="prominent">Open Drawer</wc-liquid-glass-drawer-trigger>
  <wc-liquid-glass-drawer-mask></wc-liquid-glass-drawer-mask>
  <wc-liquid-glass-drawer-content side="bottom">
    <wc-liquid-glass-drawer-handle a11y-label="Resize drawer"></wc-liquid-glass-drawer-handle>
    <wc-liquid-glass-drawer-header>
      <wc-liquid-glass-drawer-title>Spatial Audio</wc-liquid-glass-drawer-title>
      <wc-liquid-glass-drawer-description>
        Adaptive head tracking and studio clarity for nearby devices.
      </wc-liquid-glass-drawer-description>
    </wc-liquid-glass-drawer-header>
    <wc-liquid-glass-drawer-footer>
      <wc-liquid-glass-drawer-close variant="prominent">Done</wc-liquid-glass-drawer-close>
    </wc-liquid-glass-drawer-footer>
  </wc-liquid-glass-drawer-content>
</wc-liquid-glass-drawer-root>
    `),
    'demo-liquid-glass-drawer-sides': formatCode(`
<wc-liquid-glass-drawer-root a11y-label="Right Sheet">
  <wc-liquid-glass-drawer-trigger>Right</wc-liquid-glass-drawer-trigger>
  <wc-liquid-glass-drawer-mask></wc-liquid-glass-drawer-mask>
  <wc-liquid-glass-drawer-content side="right">
    <wc-liquid-glass-drawer-handle></wc-liquid-glass-drawer-handle>
    <wc-liquid-glass-drawer-header>
      <wc-liquid-glass-drawer-title>Right Sheet</wc-liquid-glass-drawer-title>
      <wc-liquid-glass-drawer-description>Slides in from the right edge.</wc-liquid-glass-drawer-description>
    </wc-liquid-glass-drawer-header>
    <wc-liquid-glass-drawer-footer>
      <wc-liquid-glass-drawer-close variant="prominent">Done</wc-liquid-glass-drawer-close>
    </wc-liquid-glass-drawer-footer>
  </wc-liquid-glass-drawer-content>
</wc-liquid-glass-drawer-root>
    `),
    'demo-liquid-glass-drawer-scroll': formatCode(`
<wc-liquid-glass-drawer-root a11y-label="Equalizer presets">
  <wc-liquid-glass-drawer-trigger>Scrollable Content</wc-liquid-glass-drawer-trigger>
  <wc-liquid-glass-drawer-mask></wc-liquid-glass-drawer-mask>
  <wc-liquid-glass-drawer-content side="bottom">
    <wc-liquid-glass-drawer-handle></wc-liquid-glass-drawer-handle>
    <wc-liquid-glass-drawer-header>
      <wc-liquid-glass-drawer-title>Sound Presets</wc-liquid-glass-drawer-title>
    </wc-liquid-glass-drawer-header>
    <div class="flex-1 overflow-y-auto px-4 py-2 space-y-2">
      <!-- Scrollable presets -->
    </div>
    <wc-liquid-glass-drawer-footer>
      <wc-liquid-glass-drawer-close>Close</wc-liquid-glass-drawer-close>
    </wc-liquid-glass-drawer-footer>
  </wc-liquid-glass-drawer-content>
</wc-liquid-glass-drawer-root>
    `),
    'demo-liquid-glass-drawer-snap': formatCode(`
<wc-liquid-glass-drawer-root a11y-label="Route overview">
  <wc-liquid-glass-drawer-trigger>Open Snap Drawer</wc-liquid-glass-drawer-trigger>
  <wc-liquid-glass-drawer-mask></wc-liquid-glass-drawer-mask>
  <wc-liquid-glass-drawer-content id="lg-snap-content" side="bottom">
    <wc-liquid-glass-drawer-handle a11y-label="Resize sheet height"></wc-liquid-glass-drawer-handle>
    <wc-liquid-glass-drawer-header>
      <wc-liquid-glass-drawer-title>Route Stops</wc-liquid-glass-drawer-title>
    </wc-liquid-glass-drawer-header>
    <wc-liquid-glass-drawer-footer>
      <wc-liquid-glass-drawer-close variant="prominent">Done</wc-liquid-glass-drawer-close>
    </wc-liquid-glass-drawer-footer>
  </wc-liquid-glass-drawer-content>
</wc-liquid-glass-drawer-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-snap-content'), {
    side: 'bottom',
    snapPoints: [0.5, 1],
    defaultSnapPoint: 0.5,
  });
</script>
    `),
    'demo-liquid-glass-drawer-sizing': formatCode(`
<wc-liquid-glass-drawer-root a11y-label="Inspector panel">
  <wc-liquid-glass-drawer-trigger>Opaque &amp; Locked Drag</wc-liquid-glass-drawer-trigger>
  <wc-liquid-glass-drawer-mask></wc-liquid-glass-drawer-mask>
  <wc-liquid-glass-drawer-content id="lg-sized-content" side="right" material="opaque">
    <wc-liquid-glass-drawer-header>
      <wc-liquid-glass-drawer-title>Inspector Panel</wc-liquid-glass-drawer-title>
    </wc-liquid-glass-drawer-header>
    <wc-liquid-glass-drawer-footer>
      <wc-liquid-glass-drawer-close variant="prominent">Close</wc-liquid-glass-drawer-close>
    </wc-liquid-glass-drawer-footer>
  </wc-liquid-glass-drawer-content>
</wc-liquid-glass-drawer-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-sized-content'), {
    side: 'right',
    material: 'opaque',
    maxExtent: { unit: 'logical', value: 420 },
    dragDismissible: false,
  });
</script>
    `),
  },
  react: {
    'demo-shadcn-drawer': formatCode(`
import { useState } from 'react';
import {
  ShadcnButton,
  ShadcnDrawerRoot,
  ShadcnDrawerTrigger,
  ShadcnDrawerMask,
  ShadcnDrawerContent,
  ShadcnDrawerHandle,
  ShadcnDrawerHeader,
  ShadcnDrawerTitle,
  ShadcnDrawerDescription,
  ShadcnDrawerFooter,
  ShadcnDrawerClose,
} from '../proto-ui/components/react';

export function DrawerDemo() {
  const [goal, setGoal] = useState(350);

  return (
    <ShadcnDrawerRoot styleProfile="rhea" a11yLabel="Daily activity goal">
      <ShadcnDrawerTrigger styleProfile="rhea">
        <ShadcnButton styleProfile="rhea" variant="outline">Open Drawer</ShadcnButton>
      </ShadcnDrawerTrigger>
      <ShadcnDrawerMask styleProfile="rhea" />
      <ShadcnDrawerContent styleProfile="rhea" side="bottom">
        <ShadcnDrawerHandle styleProfile="rhea" a11yLabel="Resize drawer" />
        <div className="mx-auto w-full max-w-sm">
          <ShadcnDrawerHeader styleProfile="rhea">
            <ShadcnDrawerTitle styleProfile="rhea">Move Goal</ShadcnDrawerTitle>
            <ShadcnDrawerDescription styleProfile="rhea">
              Set your daily activity goal.
            </ShadcnDrawerDescription>
          </ShadcnDrawerHeader>
          <div className="flex items-center justify-center gap-4 px-4 py-3">
            <ShadcnButton styleProfile="rhea" variant="outline" size="icon" onClick={() => setGoal((v) => Math.max(200, v - 10))}>-</ShadcnButton>
            <div className="flex-1 text-center">
              <div className="text-4xl font-bold tabular-nums">{goal}</div>
              <div className="text-xs uppercase text-muted-foreground">Calories / day</div>
            </div>
            <ShadcnButton styleProfile="rhea" variant="outline" size="icon" onClick={() => setGoal((v) => Math.min(600, v + 10))}>+</ShadcnButton>
          </div>
          <ShadcnDrawerFooter styleProfile="rhea">
            <ShadcnButton styleProfile="rhea">Submit</ShadcnButton>
            <ShadcnDrawerClose styleProfile="rhea">
              <ShadcnButton styleProfile="rhea" variant="outline">Cancel</ShadcnButton>
            </ShadcnDrawerClose>
          </ShadcnDrawerFooter>
        </div>
      </ShadcnDrawerContent>
    </ShadcnDrawerRoot>
  );
}
    `),
    'demo-shadcn-drawer-sides': formatCode(`
import {
  ShadcnButton,
  ShadcnDrawerRoot,
  ShadcnDrawerTrigger,
  ShadcnDrawerMask,
  ShadcnDrawerContent,
  ShadcnDrawerHandle,
  ShadcnDrawerHeader,
  ShadcnDrawerTitle,
  ShadcnDrawerDescription,
  ShadcnDrawerFooter,
  ShadcnDrawerClose,
} from '../proto-ui/components/react';

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

export function DrawerSidesDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      {SIDES.map((side) => (
        <ShadcnDrawerRoot key={side} styleProfile="rhea" a11yLabel={\`\${side} drawer\`}>
          <ShadcnDrawerTrigger styleProfile="rhea">
            <ShadcnButton styleProfile="rhea" variant="outline">{side}</ShadcnButton>
          </ShadcnDrawerTrigger>
          <ShadcnDrawerMask styleProfile="rhea" />
          <ShadcnDrawerContent styleProfile="rhea" side={side}>
            <ShadcnDrawerHandle styleProfile="rhea" />
            <ShadcnDrawerHeader styleProfile="rhea">
              <ShadcnDrawerTitle styleProfile="rhea">{side} Drawer</ShadcnDrawerTitle>
              <ShadcnDrawerDescription styleProfile="rhea">
                Slides in from the {side} edge.
              </ShadcnDrawerDescription>
            </ShadcnDrawerHeader>
            <ShadcnDrawerFooter styleProfile="rhea">
              <ShadcnDrawerClose styleProfile="rhea">
                <ShadcnButton styleProfile="rhea" variant="outline">Close</ShadcnButton>
              </ShadcnDrawerClose>
            </ShadcnDrawerFooter>
          </ShadcnDrawerContent>
        </ShadcnDrawerRoot>
      ))}
    </div>
  );
}
    `),
    'demo-shadcn-drawer-scroll': formatCode(`
import {
  ShadcnButton,
  ShadcnDrawerRoot,
  ShadcnDrawerTrigger,
  ShadcnDrawerMask,
  ShadcnDrawerContent,
  ShadcnDrawerHandle,
  ShadcnDrawerHeader,
  ShadcnDrawerTitle,
  ShadcnDrawerDescription,
  ShadcnDrawerFooter,
  ShadcnDrawerClose,
} from '../proto-ui/components/react';

export function DrawerScrollDemo() {
  return (
    <ShadcnDrawerRoot styleProfile="rhea" a11yLabel="Release notes">
      <ShadcnDrawerTrigger styleProfile="rhea">
        <ShadcnButton styleProfile="rhea" variant="outline">Scrollable Content</ShadcnButton>
      </ShadcnDrawerTrigger>
      <ShadcnDrawerMask styleProfile="rhea" />
      <ShadcnDrawerContent styleProfile="rhea" side="bottom" maxExtent={{ unit: 'logical', value: 420 }}>
        <ShadcnDrawerHandle styleProfile="rhea" />
        <ShadcnDrawerHeader styleProfile="rhea">
          <ShadcnDrawerTitle styleProfile="rhea">Release Highlights</ShadcnDrawerTitle>
          <ShadcnDrawerDescription styleProfile="rhea">
            Scroll through the notes while keeping header and footer anchored.
          </ShadcnDrawerDescription>
        </ShadcnDrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
          {/* Scrollable content */}
        </div>
        <ShadcnDrawerFooter styleProfile="rhea">
          <ShadcnDrawerClose styleProfile="rhea">
            <ShadcnButton styleProfile="rhea" variant="outline">Close</ShadcnButton>
          </ShadcnDrawerClose>
        </ShadcnDrawerFooter>
      </ShadcnDrawerContent>
    </ShadcnDrawerRoot>
  );
}
    `),
    'demo-shadcn-drawer-snap': formatCode(`
import {
  ShadcnButton,
  ShadcnDrawerRoot,
  ShadcnDrawerTrigger,
  ShadcnDrawerMask,
  ShadcnDrawerContent,
  ShadcnDrawerHandle,
  ShadcnDrawerHeader,
  ShadcnDrawerTitle,
  ShadcnDrawerDescription,
  ShadcnDrawerFooter,
  ShadcnDrawerClose,
} from '../proto-ui/components/react';

export function DrawerSnapDemo() {
  return (
    <ShadcnDrawerRoot styleProfile="rhea" a11yLabel="Snap points drawer">
      <ShadcnDrawerTrigger styleProfile="rhea">
        <ShadcnButton styleProfile="rhea" variant="outline">Open Snap Drawer</ShadcnButton>
      </ShadcnDrawerTrigger>
      <ShadcnDrawerMask styleProfile="rhea" />
      <ShadcnDrawerContent styleProfile="rhea" side="bottom" snapPoints={[0.5, 1]} defaultSnapPoint={0.5}>
        <ShadcnDrawerHandle styleProfile="rhea" a11yLabel="Resize drawer height" />
        <ShadcnDrawerHeader styleProfile="rhea">
          <ShadcnDrawerTitle styleProfile="rhea">Snap Points</ShadcnDrawerTitle>
          <ShadcnDrawerDescription styleProfile="rhea">
            Drag the handle or press Arrow Up / Down to switch between 50% and full height.
          </ShadcnDrawerDescription>
        </ShadcnDrawerHeader>
        <ShadcnDrawerFooter styleProfile="rhea">
          <ShadcnDrawerClose styleProfile="rhea">
            <ShadcnButton styleProfile="rhea" variant="outline">Close</ShadcnButton>
          </ShadcnDrawerClose>
        </ShadcnDrawerFooter>
      </ShadcnDrawerContent>
    </ShadcnDrawerRoot>
  );
}
    `),
    'demo-shadcn-drawer-sizing': formatCode(`
import {
  ShadcnButton,
  ShadcnDrawerRoot,
  ShadcnDrawerTrigger,
  ShadcnDrawerMask,
  ShadcnDrawerContent,
  ShadcnDrawerHeader,
  ShadcnDrawerTitle,
  ShadcnDrawerDescription,
  ShadcnDrawerFooter,
  ShadcnDrawerClose,
} from '../proto-ui/components/react';

export function DrawerSizingDemo() {
  return (
    <ShadcnDrawerRoot styleProfile="rhea" a11yLabel="Custom sized drawer">
      <ShadcnDrawerTrigger styleProfile="rhea">
        <ShadcnButton styleProfile="rhea" variant="outline">Custom Size &amp; Locked Drag</ShadcnButton>
      </ShadcnDrawerTrigger>
      <ShadcnDrawerMask styleProfile="rhea" />
      <ShadcnDrawerContent
        styleProfile="rhea"
        side="right"
        maxExtent={{ unit: 'logical', value: 420 }}
        dragDismissible={false}
      >
        <ShadcnDrawerHeader styleProfile="rhea">
          <ShadcnDrawerTitle styleProfile="rhea">Inspector Panel</ShadcnDrawerTitle>
          <ShadcnDrawerDescription styleProfile="rhea">
            Capped at 420px via maxExtent with dragDismissible disabled.
          </ShadcnDrawerDescription>
        </ShadcnDrawerHeader>
        <ShadcnDrawerFooter styleProfile="rhea">
          <ShadcnDrawerClose styleProfile="rhea">
            <ShadcnButton styleProfile="rhea" variant="outline">Close</ShadcnButton>
          </ShadcnDrawerClose>
        </ShadcnDrawerFooter>
      </ShadcnDrawerContent>
    </ShadcnDrawerRoot>
  );
}
    `),
    'demo-brutalist-drawer': formatCode(`
import {
  BrutalistDrawerRoot,
  BrutalistDrawerTrigger,
  BrutalistDrawerMask,
  BrutalistDrawerContent,
  BrutalistDrawerHandle,
  BrutalistDrawerTitle,
  BrutalistDrawerDescription,
  BrutalistDrawerClose,
} from '../proto-ui/components/react';

export function BrutalistDrawerDemo() {
  return (
    <BrutalistDrawerRoot a11yLabel="Confirm deployment">
      <BrutalistDrawerTrigger>Open Drawer</BrutalistDrawerTrigger>
      <BrutalistDrawerMask />
      <BrutalistDrawerContent side="bottom">
        <BrutalistDrawerHandle a11yLabel="Resize drawer" />
        <BrutalistDrawerTitle>Are you absolutely sure?</BrutalistDrawerTitle>
        <BrutalistDrawerDescription>
          Publish the latest build to the staging environment.
        </BrutalistDrawerDescription>
        <BrutalistDrawerClose>Cancel</BrutalistDrawerClose>
      </BrutalistDrawerContent>
    </BrutalistDrawerRoot>
  );
}
    `),
    'demo-brutalist-drawer-sides': formatCode(`
import {
  BrutalistDrawerRoot,
  BrutalistDrawerTrigger,
  BrutalistDrawerMask,
  BrutalistDrawerContent,
  BrutalistDrawerHandle,
  BrutalistDrawerTitle,
  BrutalistDrawerDescription,
  BrutalistDrawerClose,
} from '../proto-ui/components/react';

export function BrutalistDrawerSidesDemo() {
  return (
    <BrutalistDrawerRoot a11yLabel="Right Drawer">
      <BrutalistDrawerTrigger>Right</BrutalistDrawerTrigger>
      <BrutalistDrawerMask />
      <BrutalistDrawerContent side="right">
        <BrutalistDrawerHandle />
        <BrutalistDrawerTitle>Right Drawer</BrutalistDrawerTitle>
        <BrutalistDrawerDescription>Slides in from the right edge.</BrutalistDrawerDescription>
        <BrutalistDrawerClose>Close</BrutalistDrawerClose>
      </BrutalistDrawerContent>
    </BrutalistDrawerRoot>
  );
}
    `),
    'demo-brutalist-drawer-scroll': formatCode(`
import {
  BrutalistDrawerRoot,
  BrutalistDrawerTrigger,
  BrutalistDrawerMask,
  BrutalistDrawerContent,
  BrutalistDrawerHandle,
  BrutalistDrawerTitle,
  BrutalistDrawerClose,
} from '../proto-ui/components/react';

export function BrutalistDrawerScrollDemo() {
  return (
    <BrutalistDrawerRoot a11yLabel="Activity log">
      <BrutalistDrawerTrigger>Scrollable Content</BrutalistDrawerTrigger>
      <BrutalistDrawerMask />
      <BrutalistDrawerContent side="bottom" maxExtent={{ unit: 'logical', value: 400 }}>
        <BrutalistDrawerHandle />
        <BrutalistDrawerTitle>Activity Log</BrutalistDrawerTitle>
        <div className="flex-1 overflow-y-auto space-y-2">{/* Activity items */}</div>
        <BrutalistDrawerClose>Close</BrutalistDrawerClose>
      </BrutalistDrawerContent>
    </BrutalistDrawerRoot>
  );
}
    `),
    'demo-brutalist-drawer-snap': formatCode(`
import {
  BrutalistDrawerRoot,
  BrutalistDrawerTrigger,
  BrutalistDrawerMask,
  BrutalistDrawerContent,
  BrutalistDrawerHandle,
  BrutalistDrawerTitle,
  BrutalistDrawerDescription,
  BrutalistDrawerClose,
} from '../proto-ui/components/react';

export function BrutalistDrawerSnapDemo() {
  return (
    <BrutalistDrawerRoot a11yLabel="Snap points drawer">
      <BrutalistDrawerTrigger>Open Snap Drawer</BrutalistDrawerTrigger>
      <BrutalistDrawerMask />
      <BrutalistDrawerContent side="bottom" snapPoints={[0.5, 1]} defaultSnapPoint={0.5}>
        <BrutalistDrawerHandle a11yLabel="Resize drawer height" />
        <BrutalistDrawerTitle>Snap Points</BrutalistDrawerTitle>
        <BrutalistDrawerDescription>
          Drag the handle or use Arrow Up / Down to change height.
        </BrutalistDrawerDescription>
        <BrutalistDrawerClose>Close</BrutalistDrawerClose>
      </BrutalistDrawerContent>
    </BrutalistDrawerRoot>
  );
}
    `),
    'demo-brutalist-drawer-sizing': formatCode(`
import {
  BrutalistDrawerRoot,
  BrutalistDrawerTrigger,
  BrutalistDrawerMask,
  BrutalistDrawerContent,
  BrutalistDrawerTitle,
  BrutalistDrawerDescription,
  BrutalistDrawerClose,
} from '../proto-ui/components/react';

export function BrutalistDrawerSizingDemo() {
  return (
    <BrutalistDrawerRoot a11yLabel="Custom sized drawer">
      <BrutalistDrawerTrigger>Custom Size &amp; Locked Drag</BrutalistDrawerTrigger>
      <BrutalistDrawerMask />
      <BrutalistDrawerContent side="right" maxExtent={{ unit: 'logical', value: 420 }} dragDismissible={false}>
        <BrutalistDrawerTitle>Inspector Panel</BrutalistDrawerTitle>
        <BrutalistDrawerDescription>Capped at 420px with drag dismissal disabled.</BrutalistDrawerDescription>
        <BrutalistDrawerClose>Close</BrutalistDrawerClose>
      </BrutalistDrawerContent>
    </BrutalistDrawerRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-drawer': formatCode(`
import {
  BootstrapDrawerRoot,
  BootstrapDrawerTrigger,
  BootstrapDrawerMask,
  BootstrapDrawerContent,
  BootstrapDrawerHandle,
  BootstrapDrawerHeader,
  BootstrapDrawerTitle,
  BootstrapDrawerDescription,
  BootstrapDrawerFooter,
  BootstrapDrawerClose,
} from '../proto-ui/components/react';

export function BootstrapDrawerDemo() {
  return (
    <BootstrapDrawerRoot a11yLabel="Workspace preferences">
      <BootstrapDrawerTrigger>Open Drawer</BootstrapDrawerTrigger>
      <BootstrapDrawerMask />
      <BootstrapDrawerContent side="bottom">
        <BootstrapDrawerHandle />
        <BootstrapDrawerHeader>
          <BootstrapDrawerTitle>Workspace Preferences</BootstrapDrawerTitle>
          <BootstrapDrawerDescription>
            Review default notification and digest rules for this project.
          </BootstrapDrawerDescription>
        </BootstrapDrawerHeader>
        <div className="p-[15px]">Daily digest: Enabled at 09:00 UTC</div>
        <BootstrapDrawerFooter>
          <BootstrapDrawerClose>Close</BootstrapDrawerClose>
        </BootstrapDrawerFooter>
      </BootstrapDrawerContent>
    </BootstrapDrawerRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-drawer-sides': formatCode(`
import {
  BootstrapDrawerRoot,
  BootstrapDrawerTrigger,
  BootstrapDrawerMask,
  BootstrapDrawerContent,
  BootstrapDrawerHandle,
  BootstrapDrawerHeader,
  BootstrapDrawerTitle,
  BootstrapDrawerFooter,
  BootstrapDrawerClose,
} from '../proto-ui/components/react';

export function BootstrapDrawerSidesDemo() {
  return (
    <BootstrapDrawerRoot a11yLabel="Right Drawer">
      <BootstrapDrawerTrigger>Right</BootstrapDrawerTrigger>
      <BootstrapDrawerMask />
      <BootstrapDrawerContent side="right">
        <BootstrapDrawerHandle />
        <BootstrapDrawerHeader>
          <BootstrapDrawerTitle>Right Drawer</BootstrapDrawerTitle>
        </BootstrapDrawerHeader>
        <BootstrapDrawerFooter>
          <BootstrapDrawerClose>Close</BootstrapDrawerClose>
        </BootstrapDrawerFooter>
      </BootstrapDrawerContent>
    </BootstrapDrawerRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-drawer-scroll': formatCode(`
import {
  BootstrapDrawerRoot,
  BootstrapDrawerTrigger,
  BootstrapDrawerMask,
  BootstrapDrawerContent,
  BootstrapDrawerHandle,
  BootstrapDrawerHeader,
  BootstrapDrawerTitle,
  BootstrapDrawerFooter,
  BootstrapDrawerClose,
} from '../proto-ui/components/react';

export function BootstrapDrawerScrollDemo() {
  return (
    <BootstrapDrawerRoot a11yLabel="System activity log">
      <BootstrapDrawerTrigger>Scrollable Content</BootstrapDrawerTrigger>
      <BootstrapDrawerMask />
      <BootstrapDrawerContent side="bottom" maxExtent={{ unit: 'logical', value: 380 }}>
        <BootstrapDrawerHandle />
        <BootstrapDrawerHeader>
          <BootstrapDrawerTitle>System Activity Log</BootstrapDrawerTitle>
        </BootstrapDrawerHeader>
        <div className="flex-1 overflow-y-auto p-[15px]">{/* Log entries */}</div>
        <BootstrapDrawerFooter>
          <BootstrapDrawerClose>Close</BootstrapDrawerClose>
        </BootstrapDrawerFooter>
      </BootstrapDrawerContent>
    </BootstrapDrawerRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-drawer-snap': formatCode(`
import {
  BootstrapDrawerRoot,
  BootstrapDrawerTrigger,
  BootstrapDrawerMask,
  BootstrapDrawerContent,
  BootstrapDrawerHandle,
  BootstrapDrawerHeader,
  BootstrapDrawerTitle,
  BootstrapDrawerFooter,
  BootstrapDrawerClose,
} from '../proto-ui/components/react';

export function BootstrapDrawerSnapDemo() {
  return (
    <BootstrapDrawerRoot a11yLabel="Snap points drawer">
      <BootstrapDrawerTrigger>Open Snap Drawer</BootstrapDrawerTrigger>
      <BootstrapDrawerMask />
      <BootstrapDrawerContent side="bottom" snapPoints={[0.5, 1]} defaultSnapPoint={0.5}>
        <BootstrapDrawerHandle a11yLabel="Resize drawer height" />
        <BootstrapDrawerHeader>
          <BootstrapDrawerTitle>Snap Points</BootstrapDrawerTitle>
        </BootstrapDrawerHeader>
        <BootstrapDrawerFooter>
          <BootstrapDrawerClose>Close</BootstrapDrawerClose>
        </BootstrapDrawerFooter>
      </BootstrapDrawerContent>
    </BootstrapDrawerRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-drawer-sizing': formatCode(`
import {
  BootstrapDrawerRoot,
  BootstrapDrawerTrigger,
  BootstrapDrawerMask,
  BootstrapDrawerContent,
  BootstrapDrawerHeader,
  BootstrapDrawerTitle,
  BootstrapDrawerFooter,
  BootstrapDrawerClose,
} from '../proto-ui/components/react';

export function BootstrapDrawerSizingDemo() {
  return (
    <BootstrapDrawerRoot a11yLabel="Custom sized drawer">
      <BootstrapDrawerTrigger>Custom Size &amp; Locked Drag</BootstrapDrawerTrigger>
      <BootstrapDrawerMask />
      <BootstrapDrawerContent side="right" maxExtent={{ unit: 'logical', value: 420 }} dragDismissible={false}>
        <BootstrapDrawerHeader>
          <BootstrapDrawerTitle>Inspector Panel</BootstrapDrawerTitle>
        </BootstrapDrawerHeader>
        <BootstrapDrawerFooter>
          <BootstrapDrawerClose>Close</BootstrapDrawerClose>
        </BootstrapDrawerFooter>
      </BootstrapDrawerContent>
    </BootstrapDrawerRoot>
  );
}
    `),
    'demo-liquid-glass-drawer': formatCode(`
import {
  LiquidGlassDrawerRoot,
  LiquidGlassDrawerTrigger,
  LiquidGlassDrawerMask,
  LiquidGlassDrawerContent,
  LiquidGlassDrawerHandle,
  LiquidGlassDrawerHeader,
  LiquidGlassDrawerTitle,
  LiquidGlassDrawerDescription,
  LiquidGlassDrawerFooter,
  LiquidGlassDrawerClose,
} from '../proto-ui/components/react';

export function LiquidGlassDrawerDemo() {
  return (
    <LiquidGlassDrawerRoot a11yLabel="Audio output settings">
      <LiquidGlassDrawerTrigger variant="prominent">Open Drawer</LiquidGlassDrawerTrigger>
      <LiquidGlassDrawerMask />
      <LiquidGlassDrawerContent side="bottom">
        <LiquidGlassDrawerHandle a11yLabel="Resize drawer" />
        <LiquidGlassDrawerHeader>
          <LiquidGlassDrawerTitle>Spatial Audio</LiquidGlassDrawerTitle>
          <LiquidGlassDrawerDescription>
            Adaptive head tracking and studio clarity for nearby devices.
          </LiquidGlassDrawerDescription>
        </LiquidGlassDrawerHeader>
        <LiquidGlassDrawerFooter>
          <LiquidGlassDrawerClose variant="prominent">Done</LiquidGlassDrawerClose>
        </LiquidGlassDrawerFooter>
      </LiquidGlassDrawerContent>
    </LiquidGlassDrawerRoot>
  );
}
    `),
    'demo-liquid-glass-drawer-sides': formatCode(`
import {
  LiquidGlassDrawerRoot,
  LiquidGlassDrawerTrigger,
  LiquidGlassDrawerMask,
  LiquidGlassDrawerContent,
  LiquidGlassDrawerHandle,
  LiquidGlassDrawerHeader,
  LiquidGlassDrawerTitle,
  LiquidGlassDrawerFooter,
  LiquidGlassDrawerClose,
} from '../proto-ui/components/react';

export function LiquidGlassDrawerSidesDemo() {
  return (
    <LiquidGlassDrawerRoot a11yLabel="Right Sheet">
      <LiquidGlassDrawerTrigger>Right</LiquidGlassDrawerTrigger>
      <LiquidGlassDrawerMask />
      <LiquidGlassDrawerContent side="right">
        <LiquidGlassDrawerHandle />
        <LiquidGlassDrawerHeader>
          <LiquidGlassDrawerTitle>Right Sheet</LiquidGlassDrawerTitle>
        </LiquidGlassDrawerHeader>
        <LiquidGlassDrawerFooter>
          <LiquidGlassDrawerClose variant="prominent">Done</LiquidGlassDrawerClose>
        </LiquidGlassDrawerFooter>
      </LiquidGlassDrawerContent>
    </LiquidGlassDrawerRoot>
  );
}
    `),
    'demo-liquid-glass-drawer-scroll': formatCode(`
import {
  LiquidGlassDrawerRoot,
  LiquidGlassDrawerTrigger,
  LiquidGlassDrawerMask,
  LiquidGlassDrawerContent,
  LiquidGlassDrawerHandle,
  LiquidGlassDrawerHeader,
  LiquidGlassDrawerTitle,
  LiquidGlassDrawerFooter,
  LiquidGlassDrawerClose,
} from '../proto-ui/components/react';

export function LiquidGlassDrawerScrollDemo() {
  return (
    <LiquidGlassDrawerRoot a11yLabel="Equalizer presets">
      <LiquidGlassDrawerTrigger>Scrollable Content</LiquidGlassDrawerTrigger>
      <LiquidGlassDrawerMask />
      <LiquidGlassDrawerContent side="bottom" maxExtent={{ unit: 'logical', value: 420 }}>
        <LiquidGlassDrawerHandle />
        <LiquidGlassDrawerHeader>
          <LiquidGlassDrawerTitle>Sound Presets</LiquidGlassDrawerTitle>
        </LiquidGlassDrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 py-2">{/* Presets */}</div>
        <LiquidGlassDrawerFooter>
          <LiquidGlassDrawerClose>Close</LiquidGlassDrawerClose>
        </LiquidGlassDrawerFooter>
      </LiquidGlassDrawerContent>
    </LiquidGlassDrawerRoot>
  );
}
    `),
    'demo-liquid-glass-drawer-snap': formatCode(`
import {
  LiquidGlassDrawerRoot,
  LiquidGlassDrawerTrigger,
  LiquidGlassDrawerMask,
  LiquidGlassDrawerContent,
  LiquidGlassDrawerHandle,
  LiquidGlassDrawerHeader,
  LiquidGlassDrawerTitle,
  LiquidGlassDrawerFooter,
  LiquidGlassDrawerClose,
} from '../proto-ui/components/react';

export function LiquidGlassDrawerSnapDemo() {
  return (
    <LiquidGlassDrawerRoot a11yLabel="Route overview">
      <LiquidGlassDrawerTrigger>Open Snap Drawer</LiquidGlassDrawerTrigger>
      <LiquidGlassDrawerMask />
      <LiquidGlassDrawerContent side="bottom" snapPoints={[0.5, 1]} defaultSnapPoint={0.5}>
        <LiquidGlassDrawerHandle a11yLabel="Resize sheet height" />
        <LiquidGlassDrawerHeader>
          <LiquidGlassDrawerTitle>Route Stops</LiquidGlassDrawerTitle>
        </LiquidGlassDrawerHeader>
        <LiquidGlassDrawerFooter>
          <LiquidGlassDrawerClose variant="prominent">Done</LiquidGlassDrawerClose>
        </LiquidGlassDrawerFooter>
      </LiquidGlassDrawerContent>
    </LiquidGlassDrawerRoot>
  );
}
    `),
    'demo-liquid-glass-drawer-sizing': formatCode(`
import {
  LiquidGlassDrawerRoot,
  LiquidGlassDrawerTrigger,
  LiquidGlassDrawerMask,
  LiquidGlassDrawerContent,
  LiquidGlassDrawerHeader,
  LiquidGlassDrawerTitle,
  LiquidGlassDrawerFooter,
  LiquidGlassDrawerClose,
} from '../proto-ui/components/react';

export function LiquidGlassDrawerSizingDemo() {
  return (
    <LiquidGlassDrawerRoot a11yLabel="Inspector panel">
      <LiquidGlassDrawerTrigger>Opaque &amp; Locked Drag</LiquidGlassDrawerTrigger>
      <LiquidGlassDrawerMask />
      <LiquidGlassDrawerContent
        side="right"
        material="opaque"
        maxExtent={{ unit: 'logical', value: 420 }}
        dragDismissible={false}
      >
        <LiquidGlassDrawerHeader>
          <LiquidGlassDrawerTitle>Inspector Panel</LiquidGlassDrawerTitle>
        </LiquidGlassDrawerHeader>
        <LiquidGlassDrawerFooter>
          <LiquidGlassDrawerClose variant="prominent">Close</LiquidGlassDrawerClose>
        </LiquidGlassDrawerFooter>
      </LiquidGlassDrawerContent>
    </LiquidGlassDrawerRoot>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-drawer': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  ShadcnDrawerRoot,
  ShadcnDrawerTrigger,
  ShadcnDrawerMask,
  ShadcnDrawerContent,
  ShadcnDrawerHandle,
  ShadcnDrawerHeader,
  ShadcnDrawerTitle,
  ShadcnDrawerDescription,
  ShadcnDrawerFooter,
  ShadcnDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnDrawerRoot styleProfile="rhea" a11yLabel="Daily activity goal">
    <ShadcnDrawerTrigger styleProfile="rhea">
      <ShadcnButton styleProfile="rhea" variant="outline">Open Drawer</ShadcnButton>
    </ShadcnDrawerTrigger>
    <ShadcnDrawerMask styleProfile="rhea" />
    <ShadcnDrawerContent styleProfile="rhea" side="bottom">
      <ShadcnDrawerHandle styleProfile="rhea" a11yLabel="Resize drawer" />
      <ShadcnDrawerHeader styleProfile="rhea">
        <ShadcnDrawerTitle styleProfile="rhea">Move Goal</ShadcnDrawerTitle>
        <ShadcnDrawerDescription styleProfile="rhea">Set your daily activity goal.</ShadcnDrawerDescription>
      </ShadcnDrawerHeader>
      <ShadcnDrawerFooter styleProfile="rhea">
        <ShadcnButton styleProfile="rhea">Submit</ShadcnButton>
        <ShadcnDrawerClose styleProfile="rhea">
          <ShadcnButton styleProfile="rhea" variant="outline">Cancel</ShadcnButton>
        </ShadcnDrawerClose>
      </ShadcnDrawerFooter>
    </ShadcnDrawerContent>
  </ShadcnDrawerRoot>
</template>
    `),
    'demo-shadcn-drawer-sides': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  ShadcnDrawerRoot,
  ShadcnDrawerTrigger,
  ShadcnDrawerMask,
  ShadcnDrawerContent,
  ShadcnDrawerHandle,
  ShadcnDrawerHeader,
  ShadcnDrawerTitle,
  ShadcnDrawerFooter,
  ShadcnDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnDrawerRoot styleProfile="rhea" a11yLabel="Right Drawer">
    <ShadcnDrawerTrigger styleProfile="rhea">
      <ShadcnButton styleProfile="rhea" variant="outline">Right</ShadcnButton>
    </ShadcnDrawerTrigger>
    <ShadcnDrawerMask styleProfile="rhea" />
    <ShadcnDrawerContent styleProfile="rhea" side="right">
      <ShadcnDrawerHandle styleProfile="rhea" />
      <ShadcnDrawerHeader styleProfile="rhea">
        <ShadcnDrawerTitle styleProfile="rhea">Right Drawer</ShadcnDrawerTitle>
      </ShadcnDrawerHeader>
      <ShadcnDrawerFooter styleProfile="rhea">
        <ShadcnDrawerClose styleProfile="rhea">
          <ShadcnButton styleProfile="rhea" variant="outline">Close</ShadcnButton>
        </ShadcnDrawerClose>
      </ShadcnDrawerFooter>
    </ShadcnDrawerContent>
  </ShadcnDrawerRoot>
</template>
    `),
    'demo-shadcn-drawer-scroll': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  ShadcnDrawerRoot,
  ShadcnDrawerTrigger,
  ShadcnDrawerMask,
  ShadcnDrawerContent,
  ShadcnDrawerHandle,
  ShadcnDrawerHeader,
  ShadcnDrawerTitle,
  ShadcnDrawerFooter,
  ShadcnDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnDrawerRoot styleProfile="rhea" a11yLabel="Release notes">
    <ShadcnDrawerTrigger styleProfile="rhea">
      <ShadcnButton styleProfile="rhea" variant="outline">Scrollable Content</ShadcnButton>
    </ShadcnDrawerTrigger>
    <ShadcnDrawerMask styleProfile="rhea" />
    <ShadcnDrawerContent styleProfile="rhea" side="bottom" :maxExtent="{ unit: 'logical', value: 420 }">
      <ShadcnDrawerHandle styleProfile="rhea" />
      <ShadcnDrawerHeader styleProfile="rhea">
        <ShadcnDrawerTitle styleProfile="rhea">Release Highlights</ShadcnDrawerTitle>
      </ShadcnDrawerHeader>
      <div class="flex-1 overflow-y-auto px-4 py-2"><!-- Scrollable content --></div>
      <ShadcnDrawerFooter styleProfile="rhea">
        <ShadcnDrawerClose styleProfile="rhea">
          <ShadcnButton styleProfile="rhea" variant="outline">Close</ShadcnButton>
        </ShadcnDrawerClose>
      </ShadcnDrawerFooter>
    </ShadcnDrawerContent>
  </ShadcnDrawerRoot>
</template>
    `),
    'demo-shadcn-drawer-snap': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  ShadcnDrawerRoot,
  ShadcnDrawerTrigger,
  ShadcnDrawerMask,
  ShadcnDrawerContent,
  ShadcnDrawerHandle,
  ShadcnDrawerHeader,
  ShadcnDrawerTitle,
  ShadcnDrawerFooter,
  ShadcnDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnDrawerRoot styleProfile="rhea" a11yLabel="Snap points drawer">
    <ShadcnDrawerTrigger styleProfile="rhea">
      <ShadcnButton styleProfile="rhea" variant="outline">Open Snap Drawer</ShadcnButton>
    </ShadcnDrawerTrigger>
    <ShadcnDrawerMask styleProfile="rhea" />
    <ShadcnDrawerContent styleProfile="rhea" side="bottom" :snapPoints="[0.5, 1]" :defaultSnapPoint="0.5">
      <ShadcnDrawerHandle styleProfile="rhea" a11yLabel="Resize drawer height" />
      <ShadcnDrawerHeader styleProfile="rhea">
        <ShadcnDrawerTitle styleProfile="rhea">Snap Points</ShadcnDrawerTitle>
      </ShadcnDrawerHeader>
      <ShadcnDrawerFooter styleProfile="rhea">
        <ShadcnDrawerClose styleProfile="rhea">
          <ShadcnButton styleProfile="rhea" variant="outline">Close</ShadcnButton>
        </ShadcnDrawerClose>
      </ShadcnDrawerFooter>
    </ShadcnDrawerContent>
  </ShadcnDrawerRoot>
</template>
    `),
    'demo-shadcn-drawer-sizing': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  ShadcnDrawerRoot,
  ShadcnDrawerTrigger,
  ShadcnDrawerMask,
  ShadcnDrawerContent,
  ShadcnDrawerHeader,
  ShadcnDrawerTitle,
  ShadcnDrawerFooter,
  ShadcnDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnDrawerRoot styleProfile="rhea" a11yLabel="Custom sized drawer">
    <ShadcnDrawerTrigger styleProfile="rhea">
      <ShadcnButton styleProfile="rhea" variant="outline">Custom Size &amp; Locked Drag</ShadcnButton>
    </ShadcnDrawerTrigger>
    <ShadcnDrawerMask styleProfile="rhea" />
    <ShadcnDrawerContent
      styleProfile="rhea"
      side="right"
      :maxExtent="{ unit: 'logical', value: 420 }"
      :dragDismissible="false"
    >
      <ShadcnDrawerHeader styleProfile="rhea">
        <ShadcnDrawerTitle styleProfile="rhea">Inspector Panel</ShadcnDrawerTitle>
      </ShadcnDrawerHeader>
      <ShadcnDrawerFooter styleProfile="rhea">
        <ShadcnDrawerClose styleProfile="rhea">
          <ShadcnButton styleProfile="rhea" variant="outline">Close</ShadcnButton>
        </ShadcnDrawerClose>
      </ShadcnDrawerFooter>
    </ShadcnDrawerContent>
  </ShadcnDrawerRoot>
</template>
    `),
    'demo-brutalist-drawer': formatCode(`
<script setup lang="ts">
import {
  BrutalistDrawerRoot,
  BrutalistDrawerTrigger,
  BrutalistDrawerMask,
  BrutalistDrawerContent,
  BrutalistDrawerHandle,
  BrutalistDrawerTitle,
  BrutalistDrawerDescription,
  BrutalistDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistDrawerRoot a11yLabel="Confirm deployment">
    <BrutalistDrawerTrigger>Open Drawer</BrutalistDrawerTrigger>
    <BrutalistDrawerMask />
    <BrutalistDrawerContent side="bottom">
      <BrutalistDrawerHandle a11yLabel="Resize drawer" />
      <BrutalistDrawerTitle>Are you absolutely sure?</BrutalistDrawerTitle>
      <BrutalistDrawerDescription>Publish the latest build to staging.</BrutalistDrawerDescription>
      <BrutalistDrawerClose>Cancel</BrutalistDrawerClose>
    </BrutalistDrawerContent>
  </BrutalistDrawerRoot>
</template>
    `),
    'demo-brutalist-drawer-sides': formatCode(`
<script setup lang="ts">
import {
  BrutalistDrawerRoot,
  BrutalistDrawerTrigger,
  BrutalistDrawerMask,
  BrutalistDrawerContent,
  BrutalistDrawerHandle,
  BrutalistDrawerTitle,
  BrutalistDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistDrawerRoot a11yLabel="Right Drawer">
    <BrutalistDrawerTrigger>Right</BrutalistDrawerTrigger>
    <BrutalistDrawerMask />
    <BrutalistDrawerContent side="right">
      <BrutalistDrawerHandle />
      <BrutalistDrawerTitle>Right Drawer</BrutalistDrawerTitle>
      <BrutalistDrawerClose>Close</BrutalistDrawerClose>
    </BrutalistDrawerContent>
  </BrutalistDrawerRoot>
</template>
    `),
    'demo-brutalist-drawer-scroll': formatCode(`
<script setup lang="ts">
import {
  BrutalistDrawerRoot,
  BrutalistDrawerTrigger,
  BrutalistDrawerMask,
  BrutalistDrawerContent,
  BrutalistDrawerHandle,
  BrutalistDrawerTitle,
  BrutalistDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistDrawerRoot a11yLabel="Activity log">
    <BrutalistDrawerTrigger>Scrollable Content</BrutalistDrawerTrigger>
    <BrutalistDrawerMask />
    <BrutalistDrawerContent side="bottom" :maxExtent="{ unit: 'logical', value: 400 }">
      <BrutalistDrawerHandle />
      <BrutalistDrawerTitle>Activity Log</BrutalistDrawerTitle>
      <div class="flex-1 overflow-y-auto space-y-2"><!-- Activity items --></div>
      <BrutalistDrawerClose>Close</BrutalistDrawerClose>
    </BrutalistDrawerContent>
  </BrutalistDrawerRoot>
</template>
    `),
    'demo-brutalist-drawer-snap': formatCode(`
<script setup lang="ts">
import {
  BrutalistDrawerRoot,
  BrutalistDrawerTrigger,
  BrutalistDrawerMask,
  BrutalistDrawerContent,
  BrutalistDrawerHandle,
  BrutalistDrawerTitle,
  BrutalistDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistDrawerRoot a11yLabel="Snap points drawer">
    <BrutalistDrawerTrigger>Open Snap Drawer</BrutalistDrawerTrigger>
    <BrutalistDrawerMask />
    <BrutalistDrawerContent side="bottom" :snapPoints="[0.5, 1]" :defaultSnapPoint="0.5">
      <BrutalistDrawerHandle a11yLabel="Resize drawer height" />
      <BrutalistDrawerTitle>Snap Points</BrutalistDrawerTitle>
      <BrutalistDrawerClose>Close</BrutalistDrawerClose>
    </BrutalistDrawerContent>
  </BrutalistDrawerRoot>
</template>
    `),
    'demo-brutalist-drawer-sizing': formatCode(`
<script setup lang="ts">
import {
  BrutalistDrawerRoot,
  BrutalistDrawerTrigger,
  BrutalistDrawerMask,
  BrutalistDrawerContent,
  BrutalistDrawerTitle,
  BrutalistDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistDrawerRoot a11yLabel="Custom sized drawer">
    <BrutalistDrawerTrigger>Custom Size &amp; Locked Drag</BrutalistDrawerTrigger>
    <BrutalistDrawerMask />
    <BrutalistDrawerContent side="right" :maxExtent="{ unit: 'logical', value: 420 }" :dragDismissible="false">
      <BrutalistDrawerTitle>Inspector Panel</BrutalistDrawerTitle>
      <BrutalistDrawerClose>Close</BrutalistDrawerClose>
    </BrutalistDrawerContent>
  </BrutalistDrawerRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-drawer': formatCode(`
<script setup lang="ts">
import {
  BootstrapDrawerRoot,
  BootstrapDrawerTrigger,
  BootstrapDrawerMask,
  BootstrapDrawerContent,
  BootstrapDrawerHandle,
  BootstrapDrawerHeader,
  BootstrapDrawerTitle,
  BootstrapDrawerFooter,
  BootstrapDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapDrawerRoot a11yLabel="Workspace preferences">
    <BootstrapDrawerTrigger>Open Drawer</BootstrapDrawerTrigger>
    <BootstrapDrawerMask />
    <BootstrapDrawerContent side="bottom">
      <BootstrapDrawerHandle />
      <BootstrapDrawerHeader>
        <BootstrapDrawerTitle>Workspace Preferences</BootstrapDrawerTitle>
      </BootstrapDrawerHeader>
      <BootstrapDrawerFooter>
        <BootstrapDrawerClose>Close</BootstrapDrawerClose>
      </BootstrapDrawerFooter>
    </BootstrapDrawerContent>
  </BootstrapDrawerRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-drawer-sides': formatCode(`
<script setup lang="ts">
import {
  BootstrapDrawerRoot,
  BootstrapDrawerTrigger,
  BootstrapDrawerMask,
  BootstrapDrawerContent,
  BootstrapDrawerHeader,
  BootstrapDrawerTitle,
  BootstrapDrawerFooter,
  BootstrapDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapDrawerRoot a11yLabel="Right Drawer">
    <BootstrapDrawerTrigger>Right</BootstrapDrawerTrigger>
    <BootstrapDrawerMask />
    <BootstrapDrawerContent side="right">
      <BootstrapDrawerHeader>
        <BootstrapDrawerTitle>Right Drawer</BootstrapDrawerTitle>
      </BootstrapDrawerHeader>
      <BootstrapDrawerFooter>
        <BootstrapDrawerClose>Close</BootstrapDrawerClose>
      </BootstrapDrawerFooter>
    </BootstrapDrawerContent>
  </BootstrapDrawerRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-drawer-scroll': formatCode(`
<script setup lang="ts">
import {
  BootstrapDrawerRoot,
  BootstrapDrawerTrigger,
  BootstrapDrawerMask,
  BootstrapDrawerContent,
  BootstrapDrawerHeader,
  BootstrapDrawerTitle,
  BootstrapDrawerFooter,
  BootstrapDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapDrawerRoot a11yLabel="System activity log">
    <BootstrapDrawerTrigger>Scrollable Content</BootstrapDrawerTrigger>
    <BootstrapDrawerMask />
    <BootstrapDrawerContent side="bottom" :maxExtent="{ unit: 'logical', value: 380 }">
      <BootstrapDrawerHeader>
        <BootstrapDrawerTitle>System Activity Log</BootstrapDrawerTitle>
      </BootstrapDrawerHeader>
      <div class="flex-1 overflow-y-auto p-[15px]"><!-- Log entries --></div>
      <BootstrapDrawerFooter>
        <BootstrapDrawerClose>Close</BootstrapDrawerClose>
      </BootstrapDrawerFooter>
    </BootstrapDrawerContent>
  </BootstrapDrawerRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-drawer-snap': formatCode(`
<script setup lang="ts">
import {
  BootstrapDrawerRoot,
  BootstrapDrawerTrigger,
  BootstrapDrawerMask,
  BootstrapDrawerContent,
  BootstrapDrawerHandle,
  BootstrapDrawerHeader,
  BootstrapDrawerTitle,
  BootstrapDrawerFooter,
  BootstrapDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapDrawerRoot a11yLabel="Snap points drawer">
    <BootstrapDrawerTrigger>Open Snap Drawer</BootstrapDrawerTrigger>
    <BootstrapDrawerMask />
    <BootstrapDrawerContent side="bottom" :snapPoints="[0.5, 1]" :defaultSnapPoint="0.5">
      <BootstrapDrawerHandle a11yLabel="Resize drawer height" />
      <BootstrapDrawerHeader>
        <BootstrapDrawerTitle>Snap Points</BootstrapDrawerTitle>
      </BootstrapDrawerHeader>
      <BootstrapDrawerFooter>
        <BootstrapDrawerClose>Close</BootstrapDrawerClose>
      </BootstrapDrawerFooter>
    </BootstrapDrawerContent>
  </BootstrapDrawerRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-drawer-sizing': formatCode(`
<script setup lang="ts">
import {
  BootstrapDrawerRoot,
  BootstrapDrawerTrigger,
  BootstrapDrawerMask,
  BootstrapDrawerContent,
  BootstrapDrawerHeader,
  BootstrapDrawerTitle,
  BootstrapDrawerFooter,
  BootstrapDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapDrawerRoot a11yLabel="Custom sized drawer">
    <BootstrapDrawerTrigger>Custom Size &amp; Locked Drag</BootstrapDrawerTrigger>
    <BootstrapDrawerMask />
    <BootstrapDrawerContent side="right" :maxExtent="{ unit: 'logical', value: 420 }" :dragDismissible="false">
      <BootstrapDrawerHeader>
        <BootstrapDrawerTitle>Inspector Panel</BootstrapDrawerTitle>
      </BootstrapDrawerHeader>
      <BootstrapDrawerFooter>
        <BootstrapDrawerClose>Close</BootstrapDrawerClose>
      </BootstrapDrawerFooter>
    </BootstrapDrawerContent>
  </BootstrapDrawerRoot>
</template>
    `),
    'demo-liquid-glass-drawer': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassDrawerRoot,
  LiquidGlassDrawerTrigger,
  LiquidGlassDrawerMask,
  LiquidGlassDrawerContent,
  LiquidGlassDrawerHandle,
  LiquidGlassDrawerHeader,
  LiquidGlassDrawerTitle,
  LiquidGlassDrawerFooter,
  LiquidGlassDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <LiquidGlassDrawerRoot a11yLabel="Audio output settings">
    <LiquidGlassDrawerTrigger variant="prominent">Open Drawer</LiquidGlassDrawerTrigger>
    <LiquidGlassDrawerMask />
    <LiquidGlassDrawerContent side="bottom">
      <LiquidGlassDrawerHandle a11yLabel="Resize drawer" />
      <LiquidGlassDrawerHeader>
        <LiquidGlassDrawerTitle>Spatial Audio</LiquidGlassDrawerTitle>
      </LiquidGlassDrawerHeader>
      <LiquidGlassDrawerFooter>
        <LiquidGlassDrawerClose variant="prominent">Done</LiquidGlassDrawerClose>
      </LiquidGlassDrawerFooter>
    </LiquidGlassDrawerContent>
  </LiquidGlassDrawerRoot>
</template>
    `),
    'demo-liquid-glass-drawer-sides': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassDrawerRoot,
  LiquidGlassDrawerTrigger,
  LiquidGlassDrawerMask,
  LiquidGlassDrawerContent,
  LiquidGlassDrawerHeader,
  LiquidGlassDrawerTitle,
  LiquidGlassDrawerFooter,
  LiquidGlassDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <LiquidGlassDrawerRoot a11yLabel="Right Sheet">
    <LiquidGlassDrawerTrigger>Right</LiquidGlassDrawerTrigger>
    <LiquidGlassDrawerMask />
    <LiquidGlassDrawerContent side="right">
      <LiquidGlassDrawerHeader>
        <LiquidGlassDrawerTitle>Right Sheet</LiquidGlassDrawerTitle>
      </LiquidGlassDrawerHeader>
      <LiquidGlassDrawerFooter>
        <LiquidGlassDrawerClose variant="prominent">Done</LiquidGlassDrawerClose>
      </LiquidGlassDrawerFooter>
    </LiquidGlassDrawerContent>
  </LiquidGlassDrawerRoot>
</template>
    `),
    'demo-liquid-glass-drawer-scroll': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassDrawerRoot,
  LiquidGlassDrawerTrigger,
  LiquidGlassDrawerMask,
  LiquidGlassDrawerContent,
  LiquidGlassDrawerHeader,
  LiquidGlassDrawerTitle,
  LiquidGlassDrawerFooter,
  LiquidGlassDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <LiquidGlassDrawerRoot a11yLabel="Equalizer presets">
    <LiquidGlassDrawerTrigger>Scrollable Content</LiquidGlassDrawerTrigger>
    <LiquidGlassDrawerMask />
    <LiquidGlassDrawerContent side="bottom" :maxExtent="{ unit: 'logical', value: 420 }">
      <LiquidGlassDrawerHeader>
        <LiquidGlassDrawerTitle>Sound Presets</LiquidGlassDrawerTitle>
      </LiquidGlassDrawerHeader>
      <div class="flex-1 overflow-y-auto px-4 py-2"><!-- Presets --></div>
      <LiquidGlassDrawerFooter>
        <LiquidGlassDrawerClose>Close</LiquidGlassDrawerClose>
      </LiquidGlassDrawerFooter>
    </LiquidGlassDrawerContent>
  </LiquidGlassDrawerRoot>
</template>
    `),
    'demo-liquid-glass-drawer-snap': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassDrawerRoot,
  LiquidGlassDrawerTrigger,
  LiquidGlassDrawerMask,
  LiquidGlassDrawerContent,
  LiquidGlassDrawerHandle,
  LiquidGlassDrawerHeader,
  LiquidGlassDrawerTitle,
  LiquidGlassDrawerFooter,
  LiquidGlassDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <LiquidGlassDrawerRoot a11yLabel="Route overview">
    <LiquidGlassDrawerTrigger>Open Snap Drawer</LiquidGlassDrawerTrigger>
    <LiquidGlassDrawerMask />
    <LiquidGlassDrawerContent side="bottom" :snapPoints="[0.5, 1]" :defaultSnapPoint="0.5">
      <LiquidGlassDrawerHandle a11yLabel="Resize sheet height" />
      <LiquidGlassDrawerHeader>
        <LiquidGlassDrawerTitle>Route Stops</LiquidGlassDrawerTitle>
      </LiquidGlassDrawerHeader>
      <LiquidGlassDrawerFooter>
        <LiquidGlassDrawerClose variant="prominent">Done</LiquidGlassDrawerClose>
      </LiquidGlassDrawerFooter>
    </LiquidGlassDrawerContent>
  </LiquidGlassDrawerRoot>
</template>
    `),
    'demo-liquid-glass-drawer-sizing': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassDrawerRoot,
  LiquidGlassDrawerTrigger,
  LiquidGlassDrawerMask,
  LiquidGlassDrawerContent,
  LiquidGlassDrawerHeader,
  LiquidGlassDrawerTitle,
  LiquidGlassDrawerFooter,
  LiquidGlassDrawerClose,
} from '../proto-ui/components/vue';
</script>

<template>
  <LiquidGlassDrawerRoot a11yLabel="Inspector panel">
    <LiquidGlassDrawerTrigger>Opaque &amp; Locked Drag</LiquidGlassDrawerTrigger>
    <LiquidGlassDrawerMask />
    <LiquidGlassDrawerContent
      side="right"
      material="opaque"
      :maxExtent="{ unit: 'logical', value: 420 }"
      :dragDismissible="false"
    >
      <LiquidGlassDrawerHeader>
        <LiquidGlassDrawerTitle>Inspector Panel</LiquidGlassDrawerTitle>
      </LiquidGlassDrawerHeader>
      <LiquidGlassDrawerFooter>
        <LiquidGlassDrawerClose variant="prominent">Close</LiquidGlassDrawerClose>
      </LiquidGlassDrawerFooter>
    </LiquidGlassDrawerContent>
  </LiquidGlassDrawerRoot>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-drawer': formatCode(`
<template>
  <ShadcnDrawerRoot styleProfile="rhea" a11yLabel="Daily activity goal">
    <ShadcnDrawerTrigger styleProfile="rhea">
      <ShadcnButton styleProfile="rhea" variant="outline">Open Drawer</ShadcnButton>
    </ShadcnDrawerTrigger>
    <ShadcnDrawerMask styleProfile="rhea" />
    <ShadcnDrawerContent styleProfile="rhea" side="bottom">
      <ShadcnDrawerHandle styleProfile="rhea" a11yLabel="Resize drawer" />
      <ShadcnDrawerHeader styleProfile="rhea">
        <ShadcnDrawerTitle styleProfile="rhea">Move Goal</ShadcnDrawerTitle>
        <ShadcnDrawerDescription styleProfile="rhea">Set your daily activity goal.</ShadcnDrawerDescription>
      </ShadcnDrawerHeader>
      <ShadcnDrawerFooter styleProfile="rhea">
        <ShadcnButton styleProfile="rhea">Submit</ShadcnButton>
        <ShadcnDrawerClose styleProfile="rhea">
          <ShadcnButton styleProfile="rhea" variant="outline">Cancel</ShadcnButton>
        </ShadcnDrawerClose>
      </ShadcnDrawerFooter>
    </ShadcnDrawerContent>
  </ShadcnDrawerRoot>
</template>

<script>
import {
  ShadcnButton,
  ShadcnDrawerRoot,
  ShadcnDrawerTrigger,
  ShadcnDrawerMask,
  ShadcnDrawerContent,
  ShadcnDrawerHandle,
  ShadcnDrawerHeader,
  ShadcnDrawerTitle,
  ShadcnDrawerDescription,
  ShadcnDrawerFooter,
  ShadcnDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnDrawerRoot,
    ShadcnDrawerTrigger,
    ShadcnDrawerMask,
    ShadcnDrawerContent,
    ShadcnDrawerHandle,
    ShadcnDrawerHeader,
    ShadcnDrawerTitle,
    ShadcnDrawerDescription,
    ShadcnDrawerFooter,
    ShadcnDrawerClose,
  },
};
</script>
    `),
    'demo-shadcn-drawer-sides': formatCode(`
<template>
  <ShadcnDrawerRoot styleProfile="rhea" a11yLabel="Right Drawer">
    <ShadcnDrawerTrigger styleProfile="rhea">
      <ShadcnButton styleProfile="rhea" variant="outline">Right</ShadcnButton>
    </ShadcnDrawerTrigger>
    <ShadcnDrawerMask styleProfile="rhea" />
    <ShadcnDrawerContent styleProfile="rhea" side="right">
      <ShadcnDrawerHeader styleProfile="rhea">
        <ShadcnDrawerTitle styleProfile="rhea">Right Drawer</ShadcnDrawerTitle>
      </ShadcnDrawerHeader>
      <ShadcnDrawerFooter styleProfile="rhea">
        <ShadcnDrawerClose styleProfile="rhea">
          <ShadcnButton styleProfile="rhea" variant="outline">Close</ShadcnButton>
        </ShadcnDrawerClose>
      </ShadcnDrawerFooter>
    </ShadcnDrawerContent>
  </ShadcnDrawerRoot>
</template>

<script>
import {
  ShadcnButton,
  ShadcnDrawerRoot,
  ShadcnDrawerTrigger,
  ShadcnDrawerMask,
  ShadcnDrawerContent,
  ShadcnDrawerHeader,
  ShadcnDrawerTitle,
  ShadcnDrawerFooter,
  ShadcnDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnDrawerRoot,
    ShadcnDrawerTrigger,
    ShadcnDrawerMask,
    ShadcnDrawerContent,
    ShadcnDrawerHeader,
    ShadcnDrawerTitle,
    ShadcnDrawerFooter,
    ShadcnDrawerClose,
  },
};
</script>
    `),
    'demo-shadcn-drawer-scroll': formatCode(`
<template>
  <ShadcnDrawerRoot styleProfile="rhea" a11yLabel="Release notes">
    <ShadcnDrawerTrigger styleProfile="rhea">
      <ShadcnButton styleProfile="rhea" variant="outline">Scrollable Content</ShadcnButton>
    </ShadcnDrawerTrigger>
    <ShadcnDrawerMask styleProfile="rhea" />
    <ShadcnDrawerContent styleProfile="rhea" side="bottom" :maxExtent="{ unit: 'logical', value: 420 }">
      <ShadcnDrawerHeader styleProfile="rhea">
        <ShadcnDrawerTitle styleProfile="rhea">Release Highlights</ShadcnDrawerTitle>
      </ShadcnDrawerHeader>
      <div class="flex-1 overflow-y-auto px-4 py-2"><!-- Scrollable content --></div>
      <ShadcnDrawerFooter styleProfile="rhea">
        <ShadcnDrawerClose styleProfile="rhea">
          <ShadcnButton styleProfile="rhea" variant="outline">Close</ShadcnButton>
        </ShadcnDrawerClose>
      </ShadcnDrawerFooter>
    </ShadcnDrawerContent>
  </ShadcnDrawerRoot>
</template>

<script>
import {
  ShadcnButton,
  ShadcnDrawerRoot,
  ShadcnDrawerTrigger,
  ShadcnDrawerMask,
  ShadcnDrawerContent,
  ShadcnDrawerHeader,
  ShadcnDrawerTitle,
  ShadcnDrawerFooter,
  ShadcnDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnDrawerRoot,
    ShadcnDrawerTrigger,
    ShadcnDrawerMask,
    ShadcnDrawerContent,
    ShadcnDrawerHeader,
    ShadcnDrawerTitle,
    ShadcnDrawerFooter,
    ShadcnDrawerClose,
  },
};
</script>
    `),
    'demo-shadcn-drawer-snap': formatCode(`
<template>
  <ShadcnDrawerRoot styleProfile="rhea" a11yLabel="Snap points drawer">
    <ShadcnDrawerTrigger styleProfile="rhea">
      <ShadcnButton styleProfile="rhea" variant="outline">Open Snap Drawer</ShadcnButton>
    </ShadcnDrawerTrigger>
    <ShadcnDrawerMask styleProfile="rhea" />
    <ShadcnDrawerContent styleProfile="rhea" side="bottom" :snapPoints="[0.5, 1]" :defaultSnapPoint="0.5">
      <ShadcnDrawerHandle styleProfile="rhea" a11yLabel="Resize drawer height" />
      <ShadcnDrawerHeader styleProfile="rhea">
        <ShadcnDrawerTitle styleProfile="rhea">Snap Points</ShadcnDrawerTitle>
      </ShadcnDrawerHeader>
      <ShadcnDrawerFooter styleProfile="rhea">
        <ShadcnDrawerClose styleProfile="rhea">
          <ShadcnButton styleProfile="rhea" variant="outline">Close</ShadcnButton>
        </ShadcnDrawerClose>
      </ShadcnDrawerFooter>
    </ShadcnDrawerContent>
  </ShadcnDrawerRoot>
</template>

<script>
import {
  ShadcnButton,
  ShadcnDrawerRoot,
  ShadcnDrawerTrigger,
  ShadcnDrawerMask,
  ShadcnDrawerContent,
  ShadcnDrawerHandle,
  ShadcnDrawerHeader,
  ShadcnDrawerTitle,
  ShadcnDrawerFooter,
  ShadcnDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnDrawerRoot,
    ShadcnDrawerTrigger,
    ShadcnDrawerMask,
    ShadcnDrawerContent,
    ShadcnDrawerHandle,
    ShadcnDrawerHeader,
    ShadcnDrawerTitle,
    ShadcnDrawerFooter,
    ShadcnDrawerClose,
  },
};
</script>
    `),
    'demo-shadcn-drawer-sizing': formatCode(`
<template>
  <ShadcnDrawerRoot styleProfile="rhea" a11yLabel="Custom sized drawer">
    <ShadcnDrawerTrigger styleProfile="rhea">
      <ShadcnButton styleProfile="rhea" variant="outline">Custom Size &amp; Locked Drag</ShadcnButton>
    </ShadcnDrawerTrigger>
    <ShadcnDrawerMask styleProfile="rhea" />
    <ShadcnDrawerContent
      styleProfile="rhea"
      side="right"
      :maxExtent="{ unit: 'logical', value: 420 }"
      :dragDismissible="false"
    >
      <ShadcnDrawerHeader styleProfile="rhea">
        <ShadcnDrawerTitle styleProfile="rhea">Inspector Panel</ShadcnDrawerTitle>
      </ShadcnDrawerHeader>
      <ShadcnDrawerFooter styleProfile="rhea">
        <ShadcnDrawerClose styleProfile="rhea">
          <ShadcnButton styleProfile="rhea" variant="outline">Close</ShadcnButton>
        </ShadcnDrawerClose>
      </ShadcnDrawerFooter>
    </ShadcnDrawerContent>
  </ShadcnDrawerRoot>
</template>

<script>
import {
  ShadcnButton,
  ShadcnDrawerRoot,
  ShadcnDrawerTrigger,
  ShadcnDrawerMask,
  ShadcnDrawerContent,
  ShadcnDrawerHeader,
  ShadcnDrawerTitle,
  ShadcnDrawerFooter,
  ShadcnDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnButton,
    ShadcnDrawerRoot,
    ShadcnDrawerTrigger,
    ShadcnDrawerMask,
    ShadcnDrawerContent,
    ShadcnDrawerHeader,
    ShadcnDrawerTitle,
    ShadcnDrawerFooter,
    ShadcnDrawerClose,
  },
};
</script>
    `),
    'demo-brutalist-drawer': formatCode(`
<template>
  <BrutalistDrawerRoot a11yLabel="Confirm deployment">
    <BrutalistDrawerTrigger>Open Drawer</BrutalistDrawerTrigger>
    <BrutalistDrawerMask />
    <BrutalistDrawerContent side="bottom">
      <BrutalistDrawerHandle a11yLabel="Resize drawer" />
      <BrutalistDrawerTitle>Are you absolutely sure?</BrutalistDrawerTitle>
      <BrutalistDrawerClose>Cancel</BrutalistDrawerClose>
    </BrutalistDrawerContent>
  </BrutalistDrawerRoot>
</template>

<script>
import {
  BrutalistDrawerRoot,
  BrutalistDrawerTrigger,
  BrutalistDrawerMask,
  BrutalistDrawerContent,
  BrutalistDrawerHandle,
  BrutalistDrawerTitle,
  BrutalistDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistDrawerRoot,
    BrutalistDrawerTrigger,
    BrutalistDrawerMask,
    BrutalistDrawerContent,
    BrutalistDrawerHandle,
    BrutalistDrawerTitle,
    BrutalistDrawerClose,
  },
};
</script>
    `),
    'demo-brutalist-drawer-sides': formatCode(`
<template>
  <BrutalistDrawerRoot a11yLabel="Right Drawer">
    <BrutalistDrawerTrigger>Right</BrutalistDrawerTrigger>
    <BrutalistDrawerMask />
    <BrutalistDrawerContent side="right">
      <BrutalistDrawerTitle>Right Drawer</BrutalistDrawerTitle>
      <BrutalistDrawerClose>Close</BrutalistDrawerClose>
    </BrutalistDrawerContent>
  </BrutalistDrawerRoot>
</template>

<script>
import {
  BrutalistDrawerRoot,
  BrutalistDrawerTrigger,
  BrutalistDrawerMask,
  BrutalistDrawerContent,
  BrutalistDrawerTitle,
  BrutalistDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistDrawerRoot,
    BrutalistDrawerTrigger,
    BrutalistDrawerMask,
    BrutalistDrawerContent,
    BrutalistDrawerTitle,
    BrutalistDrawerClose,
  },
};
</script>
    `),
    'demo-brutalist-drawer-scroll': formatCode(`
<template>
  <BrutalistDrawerRoot a11yLabel="Activity log">
    <BrutalistDrawerTrigger>Scrollable Content</BrutalistDrawerTrigger>
    <BrutalistDrawerMask />
    <BrutalistDrawerContent side="bottom" :maxExtent="{ unit: 'logical', value: 400 }">
      <BrutalistDrawerTitle>Activity Log</BrutalistDrawerTitle>
      <div class="flex-1 overflow-y-auto"><!-- Activity items --></div>
      <BrutalistDrawerClose>Close</BrutalistDrawerClose>
    </BrutalistDrawerContent>
  </BrutalistDrawerRoot>
</template>

<script>
import {
  BrutalistDrawerRoot,
  BrutalistDrawerTrigger,
  BrutalistDrawerMask,
  BrutalistDrawerContent,
  BrutalistDrawerTitle,
  BrutalistDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistDrawerRoot,
    BrutalistDrawerTrigger,
    BrutalistDrawerMask,
    BrutalistDrawerContent,
    BrutalistDrawerTitle,
    BrutalistDrawerClose,
  },
};
</script>
    `),
    'demo-brutalist-drawer-snap': formatCode(`
<template>
  <BrutalistDrawerRoot a11yLabel="Snap points drawer">
    <BrutalistDrawerTrigger>Open Snap Drawer</BrutalistDrawerTrigger>
    <BrutalistDrawerMask />
    <BrutalistDrawerContent side="bottom" :snapPoints="[0.5, 1]" :defaultSnapPoint="0.5">
      <BrutalistDrawerHandle a11yLabel="Resize drawer height" />
      <BrutalistDrawerTitle>Snap Points</BrutalistDrawerTitle>
      <BrutalistDrawerClose>Close</BrutalistDrawerClose>
    </BrutalistDrawerContent>
  </BrutalistDrawerRoot>
</template>

<script>
import {
  BrutalistDrawerRoot,
  BrutalistDrawerTrigger,
  BrutalistDrawerMask,
  BrutalistDrawerContent,
  BrutalistDrawerHandle,
  BrutalistDrawerTitle,
  BrutalistDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistDrawerRoot,
    BrutalistDrawerTrigger,
    BrutalistDrawerMask,
    BrutalistDrawerContent,
    BrutalistDrawerHandle,
    BrutalistDrawerTitle,
    BrutalistDrawerClose,
  },
};
</script>
    `),
    'demo-brutalist-drawer-sizing': formatCode(`
<template>
  <BrutalistDrawerRoot a11yLabel="Custom sized drawer">
    <BrutalistDrawerTrigger>Custom Size &amp; Locked Drag</BrutalistDrawerTrigger>
    <BrutalistDrawerMask />
    <BrutalistDrawerContent side="right" :maxExtent="{ unit: 'logical', value: 420 }" :dragDismissible="false">
      <BrutalistDrawerTitle>Inspector Panel</BrutalistDrawerTitle>
      <BrutalistDrawerClose>Close</BrutalistDrawerClose>
    </BrutalistDrawerContent>
  </BrutalistDrawerRoot>
</template>

<script>
import {
  BrutalistDrawerRoot,
  BrutalistDrawerTrigger,
  BrutalistDrawerMask,
  BrutalistDrawerContent,
  BrutalistDrawerTitle,
  BrutalistDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistDrawerRoot,
    BrutalistDrawerTrigger,
    BrutalistDrawerMask,
    BrutalistDrawerContent,
    BrutalistDrawerTitle,
    BrutalistDrawerClose,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-drawer': formatCode(`
<template>
  <BootstrapDrawerRoot a11yLabel="Workspace preferences">
    <BootstrapDrawerTrigger>Open Drawer</BootstrapDrawerTrigger>
    <BootstrapDrawerMask />
    <BootstrapDrawerContent side="bottom">
      <BootstrapDrawerHeader>
        <BootstrapDrawerTitle>Workspace Preferences</BootstrapDrawerTitle>
      </BootstrapDrawerHeader>
      <BootstrapDrawerFooter>
        <BootstrapDrawerClose>Close</BootstrapDrawerClose>
      </BootstrapDrawerFooter>
    </BootstrapDrawerContent>
  </BootstrapDrawerRoot>
</template>

<script>
import {
  BootstrapDrawerRoot,
  BootstrapDrawerTrigger,
  BootstrapDrawerMask,
  BootstrapDrawerContent,
  BootstrapDrawerHeader,
  BootstrapDrawerTitle,
  BootstrapDrawerFooter,
  BootstrapDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapDrawerRoot,
    BootstrapDrawerTrigger,
    BootstrapDrawerMask,
    BootstrapDrawerContent,
    BootstrapDrawerHeader,
    BootstrapDrawerTitle,
    BootstrapDrawerFooter,
    BootstrapDrawerClose,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-drawer-sides': formatCode(`
<template>
  <BootstrapDrawerRoot a11yLabel="Right Drawer">
    <BootstrapDrawerTrigger>Right</BootstrapDrawerTrigger>
    <BootstrapDrawerMask />
    <BootstrapDrawerContent side="right">
      <BootstrapDrawerHeader>
        <BootstrapDrawerTitle>Right Drawer</BootstrapDrawerTitle>
      </BootstrapDrawerHeader>
      <BootstrapDrawerFooter>
        <BootstrapDrawerClose>Close</BootstrapDrawerClose>
      </BootstrapDrawerFooter>
    </BootstrapDrawerContent>
  </BootstrapDrawerRoot>
</template>

<script>
import {
  BootstrapDrawerRoot,
  BootstrapDrawerTrigger,
  BootstrapDrawerMask,
  BootstrapDrawerContent,
  BootstrapDrawerHeader,
  BootstrapDrawerTitle,
  BootstrapDrawerFooter,
  BootstrapDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapDrawerRoot,
    BootstrapDrawerTrigger,
    BootstrapDrawerMask,
    BootstrapDrawerContent,
    BootstrapDrawerHeader,
    BootstrapDrawerTitle,
    BootstrapDrawerFooter,
    BootstrapDrawerClose,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-drawer-scroll': formatCode(`
<template>
  <BootstrapDrawerRoot a11yLabel="System activity log">
    <BootstrapDrawerTrigger>Scrollable Content</BootstrapDrawerTrigger>
    <BootstrapDrawerMask />
    <BootstrapDrawerContent side="bottom" :maxExtent="{ unit: 'logical', value: 380 }">
      <BootstrapDrawerHeader>
        <BootstrapDrawerTitle>System Activity Log</BootstrapDrawerTitle>
      </BootstrapDrawerHeader>
      <div class="flex-1 overflow-y-auto p-[15px]"><!-- Log entries --></div>
      <BootstrapDrawerFooter>
        <BootstrapDrawerClose>Close</BootstrapDrawerClose>
      </BootstrapDrawerFooter>
    </BootstrapDrawerContent>
  </BootstrapDrawerRoot>
</template>

<script>
import {
  BootstrapDrawerRoot,
  BootstrapDrawerTrigger,
  BootstrapDrawerMask,
  BootstrapDrawerContent,
  BootstrapDrawerHeader,
  BootstrapDrawerTitle,
  BootstrapDrawerFooter,
  BootstrapDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapDrawerRoot,
    BootstrapDrawerTrigger,
    BootstrapDrawerMask,
    BootstrapDrawerContent,
    BootstrapDrawerHeader,
    BootstrapDrawerTitle,
    BootstrapDrawerFooter,
    BootstrapDrawerClose,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-drawer-snap': formatCode(`
<template>
  <BootstrapDrawerRoot a11yLabel="Snap points drawer">
    <BootstrapDrawerTrigger>Open Snap Drawer</BootstrapDrawerTrigger>
    <BootstrapDrawerMask />
    <BootstrapDrawerContent side="bottom" :snapPoints="[0.5, 1]" :defaultSnapPoint="0.5">
      <BootstrapDrawerHandle a11yLabel="Resize drawer height" />
      <BootstrapDrawerHeader>
        <BootstrapDrawerTitle>Snap Points</BootstrapDrawerTitle>
      </BootstrapDrawerHeader>
      <BootstrapDrawerFooter>
        <BootstrapDrawerClose>Close</BootstrapDrawerClose>
      </BootstrapDrawerFooter>
    </BootstrapDrawerContent>
  </BootstrapDrawerRoot>
</template>

<script>
import {
  BootstrapDrawerRoot,
  BootstrapDrawerTrigger,
  BootstrapDrawerMask,
  BootstrapDrawerContent,
  BootstrapDrawerHandle,
  BootstrapDrawerHeader,
  BootstrapDrawerTitle,
  BootstrapDrawerFooter,
  BootstrapDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapDrawerRoot,
    BootstrapDrawerTrigger,
    BootstrapDrawerMask,
    BootstrapDrawerContent,
    BootstrapDrawerHandle,
    BootstrapDrawerHeader,
    BootstrapDrawerTitle,
    BootstrapDrawerFooter,
    BootstrapDrawerClose,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-drawer-sizing': formatCode(`
<template>
  <BootstrapDrawerRoot a11yLabel="Custom sized drawer">
    <BootstrapDrawerTrigger>Custom Size &amp; Locked Drag</BootstrapDrawerTrigger>
    <BootstrapDrawerMask />
    <BootstrapDrawerContent side="right" :maxExtent="{ unit: 'logical', value: 420 }" :dragDismissible="false">
      <BootstrapDrawerHeader>
        <BootstrapDrawerTitle>Inspector Panel</BootstrapDrawerTitle>
      </BootstrapDrawerHeader>
      <BootstrapDrawerFooter>
        <BootstrapDrawerClose>Close</BootstrapDrawerClose>
      </BootstrapDrawerFooter>
    </BootstrapDrawerContent>
  </BootstrapDrawerRoot>
</template>

<script>
import {
  BootstrapDrawerRoot,
  BootstrapDrawerTrigger,
  BootstrapDrawerMask,
  BootstrapDrawerContent,
  BootstrapDrawerHeader,
  BootstrapDrawerTitle,
  BootstrapDrawerFooter,
  BootstrapDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapDrawerRoot,
    BootstrapDrawerTrigger,
    BootstrapDrawerMask,
    BootstrapDrawerContent,
    BootstrapDrawerHeader,
    BootstrapDrawerTitle,
    BootstrapDrawerFooter,
    BootstrapDrawerClose,
  },
};
</script>
    `),
    'demo-liquid-glass-drawer': formatCode(`
<template>
  <LiquidGlassDrawerRoot a11yLabel="Audio output settings">
    <LiquidGlassDrawerTrigger variant="prominent">Open Drawer</LiquidGlassDrawerTrigger>
    <LiquidGlassDrawerMask />
    <LiquidGlassDrawerContent side="bottom">
      <LiquidGlassDrawerHeader>
        <LiquidGlassDrawerTitle>Spatial Audio</LiquidGlassDrawerTitle>
      </LiquidGlassDrawerHeader>
      <LiquidGlassDrawerFooter>
        <LiquidGlassDrawerClose variant="prominent">Done</LiquidGlassDrawerClose>
      </LiquidGlassDrawerFooter>
    </LiquidGlassDrawerContent>
  </LiquidGlassDrawerRoot>
</template>

<script>
import {
  LiquidGlassDrawerRoot,
  LiquidGlassDrawerTrigger,
  LiquidGlassDrawerMask,
  LiquidGlassDrawerContent,
  LiquidGlassDrawerHeader,
  LiquidGlassDrawerTitle,
  LiquidGlassDrawerFooter,
  LiquidGlassDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassDrawerRoot,
    LiquidGlassDrawerTrigger,
    LiquidGlassDrawerMask,
    LiquidGlassDrawerContent,
    LiquidGlassDrawerHeader,
    LiquidGlassDrawerTitle,
    LiquidGlassDrawerFooter,
    LiquidGlassDrawerClose,
  },
};
</script>
    `),
    'demo-liquid-glass-drawer-sides': formatCode(`
<template>
  <LiquidGlassDrawerRoot a11yLabel="Right Sheet">
    <LiquidGlassDrawerTrigger>Right</LiquidGlassDrawerTrigger>
    <LiquidGlassDrawerMask />
    <LiquidGlassDrawerContent side="right">
      <LiquidGlassDrawerHeader>
        <LiquidGlassDrawerTitle>Right Sheet</LiquidGlassDrawerTitle>
      </LiquidGlassDrawerHeader>
      <LiquidGlassDrawerFooter>
        <LiquidGlassDrawerClose variant="prominent">Done</LiquidGlassDrawerClose>
      </LiquidGlassDrawerFooter>
    </LiquidGlassDrawerContent>
  </LiquidGlassDrawerRoot>
</template>

<script>
import {
  LiquidGlassDrawerRoot,
  LiquidGlassDrawerTrigger,
  LiquidGlassDrawerMask,
  LiquidGlassDrawerContent,
  LiquidGlassDrawerHeader,
  LiquidGlassDrawerTitle,
  LiquidGlassDrawerFooter,
  LiquidGlassDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassDrawerRoot,
    LiquidGlassDrawerTrigger,
    LiquidGlassDrawerMask,
    LiquidGlassDrawerContent,
    LiquidGlassDrawerHeader,
    LiquidGlassDrawerTitle,
    LiquidGlassDrawerFooter,
    LiquidGlassDrawerClose,
  },
};
</script>
    `),
    'demo-liquid-glass-drawer-scroll': formatCode(`
<template>
  <LiquidGlassDrawerRoot a11yLabel="Equalizer presets">
    <LiquidGlassDrawerTrigger>Scrollable Content</LiquidGlassDrawerTrigger>
    <LiquidGlassDrawerMask />
    <LiquidGlassDrawerContent side="bottom" :maxExtent="{ unit: 'logical', value: 420 }">
      <LiquidGlassDrawerHeader>
        <LiquidGlassDrawerTitle>Sound Presets</LiquidGlassDrawerTitle>
      </LiquidGlassDrawerHeader>
      <div class="flex-1 overflow-y-auto px-4 py-2"><!-- Presets --></div>
      <LiquidGlassDrawerFooter>
        <LiquidGlassDrawerClose>Close</LiquidGlassDrawerClose>
      </LiquidGlassDrawerFooter>
    </LiquidGlassDrawerContent>
  </LiquidGlassDrawerRoot>
</template>

<script>
import {
  LiquidGlassDrawerRoot,
  LiquidGlassDrawerTrigger,
  LiquidGlassDrawerMask,
  LiquidGlassDrawerContent,
  LiquidGlassDrawerHeader,
  LiquidGlassDrawerTitle,
  LiquidGlassDrawerFooter,
  LiquidGlassDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassDrawerRoot,
    LiquidGlassDrawerTrigger,
    LiquidGlassDrawerMask,
    LiquidGlassDrawerContent,
    LiquidGlassDrawerHeader,
    LiquidGlassDrawerTitle,
    LiquidGlassDrawerFooter,
    LiquidGlassDrawerClose,
  },
};
</script>
    `),
    'demo-liquid-glass-drawer-snap': formatCode(`
<template>
  <LiquidGlassDrawerRoot a11yLabel="Route overview">
    <LiquidGlassDrawerTrigger>Open Snap Drawer</LiquidGlassDrawerTrigger>
    <LiquidGlassDrawerMask />
    <LiquidGlassDrawerContent side="bottom" :snapPoints="[0.5, 1]" :defaultSnapPoint="0.5">
      <LiquidGlassDrawerHandle a11yLabel="Resize sheet height" />
      <LiquidGlassDrawerHeader>
        <LiquidGlassDrawerTitle>Route Stops</LiquidGlassDrawerTitle>
      </LiquidGlassDrawerHeader>
      <LiquidGlassDrawerFooter>
        <LiquidGlassDrawerClose variant="prominent">Done</LiquidGlassDrawerClose>
      </LiquidGlassDrawerFooter>
    </LiquidGlassDrawerContent>
  </LiquidGlassDrawerRoot>
</template>

<script>
import {
  LiquidGlassDrawerRoot,
  LiquidGlassDrawerTrigger,
  LiquidGlassDrawerMask,
  LiquidGlassDrawerContent,
  LiquidGlassDrawerHandle,
  LiquidGlassDrawerHeader,
  LiquidGlassDrawerTitle,
  LiquidGlassDrawerFooter,
  LiquidGlassDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassDrawerRoot,
    LiquidGlassDrawerTrigger,
    LiquidGlassDrawerMask,
    LiquidGlassDrawerContent,
    LiquidGlassDrawerHandle,
    LiquidGlassDrawerHeader,
    LiquidGlassDrawerTitle,
    LiquidGlassDrawerFooter,
    LiquidGlassDrawerClose,
  },
};
</script>
    `),
    'demo-liquid-glass-drawer-sizing': formatCode(`
<template>
  <LiquidGlassDrawerRoot a11yLabel="Inspector panel">
    <LiquidGlassDrawerTrigger>Opaque &amp; Locked Drag</LiquidGlassDrawerTrigger>
    <LiquidGlassDrawerMask />
    <LiquidGlassDrawerContent
      side="right"
      material="opaque"
      :maxExtent="{ unit: 'logical', value: 420 }"
      :dragDismissible="false"
    >
      <LiquidGlassDrawerHeader>
        <LiquidGlassDrawerTitle>Inspector Panel</LiquidGlassDrawerTitle>
      </LiquidGlassDrawerHeader>
      <LiquidGlassDrawerFooter>
        <LiquidGlassDrawerClose variant="prominent">Close</LiquidGlassDrawerClose>
      </LiquidGlassDrawerFooter>
    </LiquidGlassDrawerContent>
  </LiquidGlassDrawerRoot>
</template>

<script>
import {
  LiquidGlassDrawerRoot,
  LiquidGlassDrawerTrigger,
  LiquidGlassDrawerMask,
  LiquidGlassDrawerContent,
  LiquidGlassDrawerHeader,
  LiquidGlassDrawerTitle,
  LiquidGlassDrawerFooter,
  LiquidGlassDrawerClose,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassDrawerRoot,
    LiquidGlassDrawerTrigger,
    LiquidGlassDrawerMask,
    LiquidGlassDrawerContent,
    LiquidGlassDrawerHeader,
    LiquidGlassDrawerTitle,
    LiquidGlassDrawerFooter,
    LiquidGlassDrawerClose,
  },
};
</script>
    `),
  },
};
