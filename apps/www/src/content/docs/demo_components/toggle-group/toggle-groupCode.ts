import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-toggle-group': formatCode(`
<wc-shadcn-toggle-group-root id="shadcn-tg-hero" style-profile="rhea" variant="outline" multiple a11y-label="Text formatting">
  <wc-shadcn-toggle-group-item style-profile="rhea" value="bold">
    <wc-lucide-bold-icon aria-hidden="true"></wc-lucide-bold-icon>
    <span class="sr-only">Toggle bold</span>
  </wc-shadcn-toggle-group-item>
  <wc-shadcn-toggle-group-item style-profile="rhea" value="italic">
    <wc-lucide-italic-icon aria-hidden="true"></wc-lucide-italic-icon>
    <span class="sr-only">Toggle italic</span>
  </wc-shadcn-toggle-group-item>
  <wc-shadcn-toggle-group-item style-profile="rhea" value="underline">
    <wc-lucide-underline-icon aria-hidden="true"></wc-lucide-underline-icon>
    <span class="sr-only">Toggle underline</span>
  </wc-shadcn-toggle-group-item>
</wc-shadcn-toggle-group-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#shadcn-tg-hero'), {
    styleProfile: 'rhea',
    variant: 'outline',
    multiple: true,
    defaultValue: ['bold'],
  });
</script>
    `),
    'demo-shadcn-toggle-group-outline': formatCode(`
<wc-shadcn-toggle-group-root id="shadcn-tg-outline" style-profile="rhea" variant="outline" a11y-label="Message filter">
  <wc-shadcn-toggle-group-item style-profile="rhea" value="all">All</wc-shadcn-toggle-group-item>
  <wc-shadcn-toggle-group-item style-profile="rhea" value="missed">Missed</wc-shadcn-toggle-group-item>
</wc-shadcn-toggle-group-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#shadcn-tg-outline'), {
    styleProfile: 'rhea',
    variant: 'outline',
    defaultValue: ['all'],
  });
</script>
    `),
    'demo-shadcn-toggle-group-sizes': formatCode(`
<div class="flex flex-col items-start gap-4">
  <wc-shadcn-toggle-group-root style-profile="rhea" size="sm" variant="outline" a11y-label="Small position selector">
    <wc-shadcn-toggle-group-item style-profile="rhea" value="top">Top</wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="bottom">Bottom</wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="left">Left</wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="right">Right</wc-shadcn-toggle-group-item>
  </wc-shadcn-toggle-group-root>
  <wc-shadcn-toggle-group-root style-profile="rhea" size="default" variant="outline" a11y-label="Default position selector">
    <wc-shadcn-toggle-group-item style-profile="rhea" value="top">Top</wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="bottom">Bottom</wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="left">Left</wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="right">Right</wc-shadcn-toggle-group-item>
  </wc-shadcn-toggle-group-root>
  <wc-shadcn-toggle-group-root style-profile="rhea" size="lg" variant="outline" a11y-label="Large position selector">
    <wc-shadcn-toggle-group-item style-profile="rhea" value="top">Top</wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="bottom">Bottom</wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="left">Left</wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="right">Right</wc-shadcn-toggle-group-item>
  </wc-shadcn-toggle-group-root>
</div>
    `),
    'demo-shadcn-toggle-group-spacing': formatCode(`
<div class="flex flex-col items-start gap-4">
  <wc-shadcn-toggle-group-root style-profile="rhea" size="sm" variant="outline" spacing="2" a11y-label="Spaced position selector">
    <wc-shadcn-toggle-group-item style-profile="rhea" value="top">Top</wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="bottom">Bottom</wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="left">Left</wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="right">Right</wc-shadcn-toggle-group-item>
  </wc-shadcn-toggle-group-root>
  <wc-shadcn-toggle-group-root style-profile="rhea" size="sm" variant="outline" spacing="0" a11y-label="Joined position selector">
    <wc-shadcn-toggle-group-item style-profile="rhea" value="top">Top</wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="bottom">Bottom</wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="left">Left</wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="right">Right</wc-shadcn-toggle-group-item>
  </wc-shadcn-toggle-group-root>
</div>
    `),
    'demo-shadcn-toggle-group-vertical': formatCode(`
<wc-shadcn-toggle-group-root id="shadcn-tg-vertical" style-profile="rhea" orientation="vertical" spacing="1" multiple a11y-label="Vertical text formatting">
  <wc-shadcn-toggle-group-item style-profile="rhea" value="bold">
    <wc-lucide-bold-icon aria-hidden="true"></wc-lucide-bold-icon>
    <span class="sr-only">Toggle bold</span>
  </wc-shadcn-toggle-group-item>
  <wc-shadcn-toggle-group-item style-profile="rhea" value="italic">
    <wc-lucide-italic-icon aria-hidden="true"></wc-lucide-italic-icon>
    <span class="sr-only">Toggle italic</span>
  </wc-shadcn-toggle-group-item>
  <wc-shadcn-toggle-group-item style-profile="rhea" value="underline">
    <wc-lucide-underline-icon aria-hidden="true"></wc-lucide-underline-icon>
    <span class="sr-only">Toggle underline</span>
  </wc-shadcn-toggle-group-item>
</wc-shadcn-toggle-group-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#shadcn-tg-vertical'), {
    styleProfile: 'rhea',
    orientation: 'vertical',
    spacing: 1,
    multiple: true,
    defaultValue: ['bold', 'italic'],
  });
</script>
    `),
    'demo-shadcn-toggle-group-disabled': formatCode(`
<wc-shadcn-toggle-group-root style-profile="rhea" variant="outline" disabled a11y-label="Disabled formatting controls">
  <wc-shadcn-toggle-group-item style-profile="rhea" value="bold">
    <wc-lucide-bold-icon aria-hidden="true"></wc-lucide-bold-icon>
    <span class="sr-only">Toggle bold</span>
  </wc-shadcn-toggle-group-item>
  <wc-shadcn-toggle-group-item style-profile="rhea" value="italic">
    <wc-lucide-italic-icon aria-hidden="true"></wc-lucide-italic-icon>
    <span class="sr-only">Toggle italic</span>
  </wc-shadcn-toggle-group-item>
  <wc-shadcn-toggle-group-item style-profile="rhea" value="underline">
    <wc-lucide-underline-icon aria-hidden="true"></wc-lucide-underline-icon>
    <span class="sr-only">Toggle underline</span>
  </wc-shadcn-toggle-group-item>
</wc-shadcn-toggle-group-root>
    `),
    'demo-shadcn-toggle-group-custom': formatCode(`
<wc-shadcn-field-root style-profile="rhea" class="w-fit">
  <wc-shadcn-field-label style-profile="rhea">Font Weight</wc-shadcn-field-label>
  <wc-shadcn-toggle-group-root id="font-weight-group" style-profile="rhea" variant="outline" spacing="2" size="lg" a11y-label="Font weight">
    <wc-shadcn-toggle-group-item style-profile="rhea" value="light" class="flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl">
      <span class="text-2xl leading-none font-light">Aa</span>
      <span class="text-xs text-muted-foreground">Light</span>
    </wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="normal" class="flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl">
      <span class="text-2xl leading-none font-normal">Aa</span>
      <span class="text-xs text-muted-foreground">Normal</span>
    </wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="medium" class="flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl">
      <span class="text-2xl leading-none font-medium">Aa</span>
      <span class="text-xs text-muted-foreground">Medium</span>
    </wc-shadcn-toggle-group-item>
    <wc-shadcn-toggle-group-item style-profile="rhea" value="bold" class="flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl">
      <span class="text-2xl leading-none font-bold">Aa</span>
      <span class="text-xs text-muted-foreground">Bold</span>
    </wc-shadcn-toggle-group-item>
  </wc-shadcn-toggle-group-root>
  <wc-shadcn-field-description style-profile="rhea">
    Use <span id="weight-token" class="rounded-md bg-muted px-1 py-0.5 font-mono text-xs">font-normal</span> to set the font weight.
  </wc-shadcn-field-description>
</wc-shadcn-field-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const group = document.querySelector('#font-weight-group');
  const token = document.querySelector('#weight-token');
  let selected = 'normal';
  setElementProps(group, { styleProfile: 'rhea', value: [selected] });
  group.addEventListener('valueChange', (event) => {
    const next = event.detail.value[0];
    if (!next) return;
    selected = next;
    setElementProps(group, { styleProfile: 'rhea', value: [selected] });
    token.textContent = 'font-' + selected;
  });
</script>
    `),
    'demo-brutalist-toggle-group': formatCode(`
<wc-brutalist-toggle-group-root id="brutalist-tg-hero" multiple a11y-label="Text formatting">
  <wc-brutalist-toggle-group-item value="bold">
    <wc-lucide-bold-icon aria-hidden="true"></wc-lucide-bold-icon>
    <span class="sr-only">Toggle bold</span>
  </wc-brutalist-toggle-group-item>
  <wc-brutalist-toggle-group-item value="italic">
    <wc-lucide-italic-icon aria-hidden="true"></wc-lucide-italic-icon>
    <span class="sr-only">Toggle italic</span>
  </wc-brutalist-toggle-group-item>
  <wc-brutalist-toggle-group-item value="underline">
    <wc-lucide-underline-icon aria-hidden="true"></wc-lucide-underline-icon>
    <span class="sr-only">Toggle underline</span>
  </wc-brutalist-toggle-group-item>
</wc-brutalist-toggle-group-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#brutalist-tg-hero'), {
    multiple: true,
    defaultValue: ['bold'],
  });
</script>
    `),
    'demo-brutalist-toggle-group-outline': formatCode(`
<wc-brutalist-toggle-group-root id="brutalist-tg-outline" variant="outline" a11y-label="Message filter">
  <wc-brutalist-toggle-group-item value="all">All</wc-brutalist-toggle-group-item>
  <wc-brutalist-toggle-group-item value="missed">Missed</wc-brutalist-toggle-group-item>
  <wc-brutalist-toggle-group-item value="archived">Archived</wc-brutalist-toggle-group-item>
</wc-brutalist-toggle-group-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#brutalist-tg-outline'), {
    variant: 'outline',
    defaultValue: ['all'],
  });
</script>
    `),
    'demo-brutalist-toggle-group-sizes': formatCode(`
<div class="flex flex-col items-start gap-4">
  <wc-brutalist-toggle-group-root size="sm" variant="outline" a11y-label="Small position selector">
    <wc-brutalist-toggle-group-item value="top">Top</wc-brutalist-toggle-group-item>
    <wc-brutalist-toggle-group-item value="bottom">Bottom</wc-brutalist-toggle-group-item>
    <wc-brutalist-toggle-group-item value="left">Left</wc-brutalist-toggle-group-item>
    <wc-brutalist-toggle-group-item value="right">Right</wc-brutalist-toggle-group-item>
  </wc-brutalist-toggle-group-root>
  <wc-brutalist-toggle-group-root size="default" variant="outline" a11y-label="Default position selector">
    <wc-brutalist-toggle-group-item value="top">Top</wc-brutalist-toggle-group-item>
    <wc-brutalist-toggle-group-item value="bottom">Bottom</wc-brutalist-toggle-group-item>
    <wc-brutalist-toggle-group-item value="left">Left</wc-brutalist-toggle-group-item>
    <wc-brutalist-toggle-group-item value="right">Right</wc-brutalist-toggle-group-item>
  </wc-brutalist-toggle-group-root>
  <wc-brutalist-toggle-group-root size="lg" variant="outline" a11y-label="Large position selector">
    <wc-brutalist-toggle-group-item value="top">Top</wc-brutalist-toggle-group-item>
    <wc-brutalist-toggle-group-item value="bottom">Bottom</wc-brutalist-toggle-group-item>
    <wc-brutalist-toggle-group-item value="left">Left</wc-brutalist-toggle-group-item>
    <wc-brutalist-toggle-group-item value="right">Right</wc-brutalist-toggle-group-item>
  </wc-brutalist-toggle-group-root>
</div>
    `),
    'demo-brutalist-toggle-group-spacing': formatCode(`
<div class="flex flex-col items-start gap-4">
  <wc-brutalist-toggle-group-root variant="outline" spacing="2" a11y-label="Spaced position selector">
    <wc-brutalist-toggle-group-item value="top">Top</wc-brutalist-toggle-group-item>
    <wc-brutalist-toggle-group-item value="bottom">Bottom</wc-brutalist-toggle-group-item>
    <wc-brutalist-toggle-group-item value="left">Left</wc-brutalist-toggle-group-item>
    <wc-brutalist-toggle-group-item value="right">Right</wc-brutalist-toggle-group-item>
  </wc-brutalist-toggle-group-root>
  <wc-brutalist-toggle-group-root variant="outline" spacing="0" a11y-label="Joined bar position selector">
    <wc-brutalist-toggle-group-item value="top">Top</wc-brutalist-toggle-group-item>
    <wc-brutalist-toggle-group-item value="bottom">Bottom</wc-brutalist-toggle-group-item>
    <wc-brutalist-toggle-group-item value="left">Left</wc-brutalist-toggle-group-item>
    <wc-brutalist-toggle-group-item value="right">Right</wc-brutalist-toggle-group-item>
  </wc-brutalist-toggle-group-root>
</div>
    `),
    'demo-brutalist-toggle-group-vertical': formatCode(`
<wc-brutalist-toggle-group-root id="brutalist-tg-vertical" orientation="vertical" multiple a11y-label="Vertical text formatting">
  <wc-brutalist-toggle-group-item value="bold">
    <wc-lucide-bold-icon aria-hidden="true"></wc-lucide-bold-icon>
    <span class="sr-only">Toggle bold</span>
  </wc-brutalist-toggle-group-item>
  <wc-brutalist-toggle-group-item value="italic">
    <wc-lucide-italic-icon aria-hidden="true"></wc-lucide-italic-icon>
    <span class="sr-only">Toggle italic</span>
  </wc-brutalist-toggle-group-item>
  <wc-brutalist-toggle-group-item value="underline">
    <wc-lucide-underline-icon aria-hidden="true"></wc-lucide-underline-icon>
    <span class="sr-only">Toggle underline</span>
  </wc-brutalist-toggle-group-item>
</wc-brutalist-toggle-group-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#brutalist-tg-vertical'), {
    orientation: 'vertical',
    multiple: true,
    defaultValue: ['bold', 'italic'],
  });
</script>
    `),
    'demo-brutalist-toggle-group-disabled': formatCode(`
<wc-brutalist-toggle-group-root variant="outline" disabled a11y-label="Disabled formatting controls">
  <wc-brutalist-toggle-group-item value="bold">
    <wc-lucide-bold-icon aria-hidden="true"></wc-lucide-bold-icon>
    <span class="sr-only">Toggle bold</span>
  </wc-brutalist-toggle-group-item>
  <wc-brutalist-toggle-group-item value="italic">
    <wc-lucide-italic-icon aria-hidden="true"></wc-lucide-italic-icon>
    <span class="sr-only">Toggle italic</span>
  </wc-brutalist-toggle-group-item>
  <wc-brutalist-toggle-group-item value="underline">
    <wc-lucide-underline-icon aria-hidden="true"></wc-lucide-underline-icon>
    <span class="sr-only">Toggle underline</span>
  </wc-brutalist-toggle-group-item>
</wc-brutalist-toggle-group-root>
    `),
    'demo-bootstrap-2-3-2-toggle-group': formatCode(`
<wc-bootstrap-2-3-2-toggle-group-root id="bs-tg-hero" multiple a11y-label="Text formatting">
  <wc-bootstrap-2-3-2-toggle-group-item value="bold">Bold</wc-bootstrap-2-3-2-toggle-group-item>
  <wc-bootstrap-2-3-2-toggle-group-item value="italic">Italic</wc-bootstrap-2-3-2-toggle-group-item>
  <wc-bootstrap-2-3-2-toggle-group-item value="underline">Underline</wc-bootstrap-2-3-2-toggle-group-item>
</wc-bootstrap-2-3-2-toggle-group-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bs-tg-hero'), {
    multiple: true,
    defaultValue: ['bold'],
  });
</script>
    `),
    'demo-bootstrap-2-3-2-toggle-group-single': formatCode(`
<wc-bootstrap-2-3-2-toggle-group-root id="bs-tg-single" a11y-label="Text alignment">
  <wc-bootstrap-2-3-2-toggle-group-item value="left">Left</wc-bootstrap-2-3-2-toggle-group-item>
  <wc-bootstrap-2-3-2-toggle-group-item value="middle">Middle</wc-bootstrap-2-3-2-toggle-group-item>
  <wc-bootstrap-2-3-2-toggle-group-item value="right">Right</wc-bootstrap-2-3-2-toggle-group-item>
</wc-bootstrap-2-3-2-toggle-group-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bs-tg-single'), { defaultValue: ['left'] });
</script>
    `),
    'demo-bootstrap-2-3-2-toggle-group-sizes': formatCode(`
<div class="flex flex-col items-start gap-4">
  <wc-bootstrap-2-3-2-toggle-group-root size="mini" a11y-label="Mini alignment group">
    <wc-bootstrap-2-3-2-toggle-group-item value="left">Left</wc-bootstrap-2-3-2-toggle-group-item>
    <wc-bootstrap-2-3-2-toggle-group-item value="middle">Middle</wc-bootstrap-2-3-2-toggle-group-item>
    <wc-bootstrap-2-3-2-toggle-group-item value="right">Right</wc-bootstrap-2-3-2-toggle-group-item>
  </wc-bootstrap-2-3-2-toggle-group-root>
  <wc-bootstrap-2-3-2-toggle-group-root size="small" variant="primary" a11y-label="Small primary alignment group">
    <wc-bootstrap-2-3-2-toggle-group-item value="left">Left</wc-bootstrap-2-3-2-toggle-group-item>
    <wc-bootstrap-2-3-2-toggle-group-item value="middle">Middle</wc-bootstrap-2-3-2-toggle-group-item>
    <wc-bootstrap-2-3-2-toggle-group-item value="right">Right</wc-bootstrap-2-3-2-toggle-group-item>
  </wc-bootstrap-2-3-2-toggle-group-root>
  <wc-bootstrap-2-3-2-toggle-group-root size="large" variant="danger" a11y-label="Large danger alignment group">
    <wc-bootstrap-2-3-2-toggle-group-item value="left">Left</wc-bootstrap-2-3-2-toggle-group-item>
    <wc-bootstrap-2-3-2-toggle-group-item value="middle">Middle</wc-bootstrap-2-3-2-toggle-group-item>
    <wc-bootstrap-2-3-2-toggle-group-item value="right">Right</wc-bootstrap-2-3-2-toggle-group-item>
  </wc-bootstrap-2-3-2-toggle-group-root>
</div>
    `),
    'demo-bootstrap-2-3-2-toggle-group-vertical': formatCode(`
<wc-bootstrap-2-3-2-toggle-group-root id="bs-tg-vertical" orientation="vertical" multiple a11y-label="Vertical text formatting">
  <wc-bootstrap-2-3-2-toggle-group-item value="bold">Bold</wc-bootstrap-2-3-2-toggle-group-item>
  <wc-bootstrap-2-3-2-toggle-group-item value="italic">Italic</wc-bootstrap-2-3-2-toggle-group-item>
  <wc-bootstrap-2-3-2-toggle-group-item value="underline">Underline</wc-bootstrap-2-3-2-toggle-group-item>
</wc-bootstrap-2-3-2-toggle-group-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bs-tg-vertical'), {
    orientation: 'vertical',
    multiple: true,
    defaultValue: ['bold', 'italic'],
  });
</script>
    `),
    'demo-bootstrap-2-3-2-toggle-group-disabled': formatCode(`
<wc-bootstrap-2-3-2-toggle-group-root disabled a11y-label="Disabled formatting controls">
  <wc-bootstrap-2-3-2-toggle-group-item value="bold">Bold</wc-bootstrap-2-3-2-toggle-group-item>
  <wc-bootstrap-2-3-2-toggle-group-item value="italic">Italic</wc-bootstrap-2-3-2-toggle-group-item>
  <wc-bootstrap-2-3-2-toggle-group-item value="underline">Underline</wc-bootstrap-2-3-2-toggle-group-item>
</wc-bootstrap-2-3-2-toggle-group-root>
    `),
    'demo-liquid-glass-toggle-group': formatCode(`
<wc-liquid-glass-toggle-group-root id="lg-tg-hero" multiple a11y-label="Text formatting">
  <wc-liquid-glass-toggle-group-item value="bold">
    <wc-lucide-bold-icon aria-hidden="true"></wc-lucide-bold-icon>
    <span class="sr-only">Toggle bold</span>
  </wc-liquid-glass-toggle-group-item>
  <wc-liquid-glass-toggle-group-item value="italic">
    <wc-lucide-italic-icon aria-hidden="true"></wc-lucide-italic-icon>
    <span class="sr-only">Toggle italic</span>
  </wc-liquid-glass-toggle-group-item>
  <wc-liquid-glass-toggle-group-item value="underline">
    <wc-lucide-underline-icon aria-hidden="true"></wc-lucide-underline-icon>
    <span class="sr-only">Toggle underline</span>
  </wc-liquid-glass-toggle-group-item>
</wc-liquid-glass-toggle-group-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-tg-hero'), {
    multiple: true,
    defaultValue: ['bold'],
  });
</script>
    `),
    'demo-liquid-glass-toggle-group-single': formatCode(`
<div class="flex flex-col items-center gap-4">
  <wc-liquid-glass-toggle-group-root variant="regular" a11y-label="Calendar range regular">
    <wc-liquid-glass-toggle-group-item value="day">Day</wc-liquid-glass-toggle-group-item>
    <wc-liquid-glass-toggle-group-item value="week">Week</wc-liquid-glass-toggle-group-item>
    <wc-liquid-glass-toggle-group-item value="month">Month</wc-liquid-glass-toggle-group-item>
  </wc-liquid-glass-toggle-group-root>
  <wc-liquid-glass-toggle-group-root variant="prominent" a11y-label="Calendar range prominent">
    <wc-liquid-glass-toggle-group-item value="day">Day</wc-liquid-glass-toggle-group-item>
    <wc-liquid-glass-toggle-group-item value="week">Week</wc-liquid-glass-toggle-group-item>
    <wc-liquid-glass-toggle-group-item value="month">Month</wc-liquid-glass-toggle-group-item>
  </wc-liquid-glass-toggle-group-root>
</div>
    `),
    'demo-liquid-glass-toggle-group-sizes': formatCode(`
<div class="flex flex-col items-center gap-4">
  <wc-liquid-glass-toggle-group-root size="sm" a11y-label="Small position selector">
    <wc-liquid-glass-toggle-group-item value="top">Top</wc-liquid-glass-toggle-group-item>
    <wc-liquid-glass-toggle-group-item value="bottom">Bottom</wc-liquid-glass-toggle-group-item>
    <wc-liquid-glass-toggle-group-item value="left">Left</wc-liquid-glass-toggle-group-item>
    <wc-liquid-glass-toggle-group-item value="right">Right</wc-liquid-glass-toggle-group-item>
  </wc-liquid-glass-toggle-group-root>
  <wc-liquid-glass-toggle-group-root size="default" a11y-label="Default position selector">
    <wc-liquid-glass-toggle-group-item value="top">Top</wc-liquid-glass-toggle-group-item>
    <wc-liquid-glass-toggle-group-item value="bottom">Bottom</wc-liquid-glass-toggle-group-item>
    <wc-liquid-glass-toggle-group-item value="left">Left</wc-liquid-glass-toggle-group-item>
    <wc-liquid-glass-toggle-group-item value="right">Right</wc-liquid-glass-toggle-group-item>
  </wc-liquid-glass-toggle-group-root>
  <wc-liquid-glass-toggle-group-root size="lg" a11y-label="Large position selector">
    <wc-liquid-glass-toggle-group-item value="top">Top</wc-liquid-glass-toggle-group-item>
    <wc-liquid-glass-toggle-group-item value="bottom">Bottom</wc-liquid-glass-toggle-group-item>
    <wc-liquid-glass-toggle-group-item value="left">Left</wc-liquid-glass-toggle-group-item>
    <wc-liquid-glass-toggle-group-item value="right">Right</wc-liquid-glass-toggle-group-item>
  </wc-liquid-glass-toggle-group-root>
</div>
    `),
    'demo-liquid-glass-toggle-group-vertical': formatCode(`
<wc-liquid-glass-toggle-group-root id="lg-tg-vertical" orientation="vertical" multiple a11y-label="Vertical text formatting">
  <wc-liquid-glass-toggle-group-item value="bold">Bold</wc-liquid-glass-toggle-group-item>
  <wc-liquid-glass-toggle-group-item value="italic">Italic</wc-liquid-glass-toggle-group-item>
  <wc-liquid-glass-toggle-group-item value="underline">Underline</wc-liquid-glass-toggle-group-item>
</wc-liquid-glass-toggle-group-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-tg-vertical'), {
    orientation: 'vertical',
    multiple: true,
    defaultValue: ['bold', 'italic'],
  });
</script>
    `),
    'demo-liquid-glass-toggle-group-disabled': formatCode(`
<div class="flex flex-col items-center gap-4">
  <wc-liquid-glass-toggle-group-root material="opaque" a11y-label="Opaque surface fallback">
    <wc-liquid-glass-toggle-group-item value="day">Day</wc-liquid-glass-toggle-group-item>
    <wc-liquid-glass-toggle-group-item value="week">Week</wc-liquid-glass-toggle-group-item>
    <wc-liquid-glass-toggle-group-item value="month">Month</wc-liquid-glass-toggle-group-item>
  </wc-liquid-glass-toggle-group-root>
  <wc-liquid-glass-toggle-group-root disabled a11y-label="Disabled toggle group">
    <wc-liquid-glass-toggle-group-item value="day">Day</wc-liquid-glass-toggle-group-item>
    <wc-liquid-glass-toggle-group-item value="week">Week</wc-liquid-glass-toggle-group-item>
    <wc-liquid-glass-toggle-group-item value="month">Month</wc-liquid-glass-toggle-group-item>
  </wc-liquid-glass-toggle-group-root>
</div>
    `),
  },
  react: {
    'demo-shadcn-toggle-group': formatCode(`
import { Bold, Italic, Underline } from 'lucide-react';
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/react';

export function ToggleGroupDemo() {
  return (
    <ShadcnToggleGroupRoot
      styleProfile="rhea"
      variant="outline"
      multiple
      defaultValue={['bold']}
      a11yLabel="Text formatting"
    >
      <ShadcnToggleGroupItem styleProfile="rhea" value="bold">
        <Bold className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle bold</span>
      </ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="italic">
        <Italic className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle italic</span>
      </ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="underline">
        <Underline className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle underline</span>
      </ShadcnToggleGroupItem>
    </ShadcnToggleGroupRoot>
  );
}
    `),
    'demo-shadcn-toggle-group-outline': formatCode(`
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/react';

export function ToggleGroupOutlineDemo() {
  return (
    <ShadcnToggleGroupRoot
      styleProfile="rhea"
      variant="outline"
      defaultValue={['all']}
      a11yLabel="Message filter"
    >
      <ShadcnToggleGroupItem styleProfile="rhea" value="all">All</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="missed">Missed</ShadcnToggleGroupItem>
    </ShadcnToggleGroupRoot>
  );
}
    `),
    'demo-shadcn-toggle-group-sizes': formatCode(`
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/react';

export function ToggleGroupSizesDemo() {
  return (
    <div className="flex flex-col items-start gap-4">
      <ShadcnToggleGroupRoot styleProfile="rhea" size="sm" variant="outline" defaultValue={['top']}>
        <ShadcnToggleGroupItem styleProfile="rhea" value="top">Top</ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="bottom">Bottom</ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="left">Left</ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="right">Right</ShadcnToggleGroupItem>
      </ShadcnToggleGroupRoot>
      <ShadcnToggleGroupRoot styleProfile="rhea" size="default" variant="outline" defaultValue={['top']}>
        <ShadcnToggleGroupItem styleProfile="rhea" value="top">Top</ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="bottom">Bottom</ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="left">Left</ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="right">Right</ShadcnToggleGroupItem>
      </ShadcnToggleGroupRoot>
      <ShadcnToggleGroupRoot styleProfile="rhea" size="lg" variant="outline" defaultValue={['top']}>
        <ShadcnToggleGroupItem styleProfile="rhea" value="top">Top</ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="bottom">Bottom</ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="left">Left</ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="right">Right</ShadcnToggleGroupItem>
      </ShadcnToggleGroupRoot>
    </div>
  );
}
    `),
    'demo-shadcn-toggle-group-spacing': formatCode(`
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/react';

export function ToggleGroupSpacingDemo() {
  return (
    <div className="flex flex-col items-start gap-4">
      <ShadcnToggleGroupRoot styleProfile="rhea" size="sm" variant="outline" spacing={2} defaultValue={['top']}>
        <ShadcnToggleGroupItem styleProfile="rhea" value="top">Top</ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="bottom">Bottom</ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="left">Left</ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="right">Right</ShadcnToggleGroupItem>
      </ShadcnToggleGroupRoot>
      <ShadcnToggleGroupRoot styleProfile="rhea" size="sm" variant="outline" spacing={0} defaultValue={['top']}>
        <ShadcnToggleGroupItem styleProfile="rhea" value="top">Top</ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="bottom">Bottom</ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="left">Left</ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="right">Right</ShadcnToggleGroupItem>
      </ShadcnToggleGroupRoot>
    </div>
  );
}
    `),
    'demo-shadcn-toggle-group-vertical': formatCode(`
import { Bold, Italic, Underline } from 'lucide-react';
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/react';

export function ToggleGroupVerticalDemo() {
  return (
    <ShadcnToggleGroupRoot
      styleProfile="rhea"
      multiple
      orientation="vertical"
      spacing={1}
      defaultValue={['bold', 'italic']}
      a11yLabel="Vertical text formatting"
    >
      <ShadcnToggleGroupItem styleProfile="rhea" value="bold">
        <Bold className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle bold</span>
      </ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="italic">
        <Italic className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle italic</span>
      </ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="underline">
        <Underline className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle underline</span>
      </ShadcnToggleGroupItem>
    </ShadcnToggleGroupRoot>
  );
}
    `),
    'demo-shadcn-toggle-group-disabled': formatCode(`
import { Bold, Italic, Underline } from 'lucide-react';
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/react';

export function ToggleGroupDisabledDemo() {
  return (
    <ShadcnToggleGroupRoot
      styleProfile="rhea"
      variant="outline"
      disabled
      defaultValue={['bold']}
      a11yLabel="Disabled formatting controls"
    >
      <ShadcnToggleGroupItem styleProfile="rhea" value="bold">
        <Bold className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle bold</span>
      </ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="italic">
        <Italic className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle italic</span>
      </ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="underline">
        <Underline className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle underline</span>
      </ShadcnToggleGroupItem>
    </ShadcnToggleGroupRoot>
  );
}
    `),
    'demo-shadcn-toggle-group-custom': formatCode(`
import { useState } from 'react';
import {
  ShadcnFieldDescription,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/react';

export function ToggleGroupFontWeightDemo() {
  const [fontWeight, setFontWeight] = useState('normal');
  return (
    <ShadcnFieldRoot styleProfile="rhea" className="w-fit">
      <ShadcnFieldLabel styleProfile="rhea">Font Weight</ShadcnFieldLabel>
      <ShadcnToggleGroupRoot
        styleProfile="rhea"
        value={[fontWeight]}
        onValueChange={({ value }) => {
          if (value[0]) setFontWeight(value[0]);
        }}
        variant="outline"
        spacing={2}
        size="lg"
        a11yLabel="Font weight"
      >
        <ShadcnToggleGroupItem styleProfile="rhea" value="light" className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl">
          <span className="text-2xl leading-none font-light">Aa</span>
          <span className="text-xs text-muted-foreground">Light</span>
        </ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="normal" className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl">
          <span className="text-2xl leading-none font-normal">Aa</span>
          <span className="text-xs text-muted-foreground">Normal</span>
        </ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="medium" className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl">
          <span className="text-2xl leading-none font-medium">Aa</span>
          <span className="text-xs text-muted-foreground">Medium</span>
        </ShadcnToggleGroupItem>
        <ShadcnToggleGroupItem styleProfile="rhea" value="bold" className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl">
          <span className="text-2xl leading-none font-bold">Aa</span>
          <span className="text-xs text-muted-foreground">Bold</span>
        </ShadcnToggleGroupItem>
      </ShadcnToggleGroupRoot>
      <ShadcnFieldDescription styleProfile="rhea">
        Use <span className="rounded-md bg-muted px-1 py-0.5 font-mono text-xs">font-{fontWeight}</span> to set the font weight.
      </ShadcnFieldDescription>
    </ShadcnFieldRoot>
  );
}
    `),
    'demo-brutalist-toggle-group': formatCode(`
import { Bold, Italic, Underline } from 'lucide-react';
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/react';

export function BrutalistToggleGroupDemo() {
  return (
    <BrutalistToggleGroupRoot multiple defaultValue={['bold']} a11yLabel="Text formatting">
      <BrutalistToggleGroupItem value="bold">
        <Bold className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle bold</span>
      </BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="italic">
        <Italic className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle italic</span>
      </BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="underline">
        <Underline className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle underline</span>
      </BrutalistToggleGroupItem>
    </BrutalistToggleGroupRoot>
  );
}
    `),
    'demo-brutalist-toggle-group-outline': formatCode(`
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/react';

export function BrutalistToggleGroupOutlineDemo() {
  return (
    <BrutalistToggleGroupRoot variant="outline" defaultValue={['all']} a11yLabel="Message filter">
      <BrutalistToggleGroupItem value="all">All</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="missed">Missed</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="archived">Archived</BrutalistToggleGroupItem>
    </BrutalistToggleGroupRoot>
  );
}
    `),
    'demo-brutalist-toggle-group-sizes': formatCode(`
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/react';

export function BrutalistToggleGroupSizesDemo() {
  return (
    <div className="flex flex-col items-start gap-4">
      <BrutalistToggleGroupRoot size="sm" variant="outline" defaultValue={['top']}>
        <BrutalistToggleGroupItem value="top">Top</BrutalistToggleGroupItem>
        <BrutalistToggleGroupItem value="bottom">Bottom</BrutalistToggleGroupItem>
        <BrutalistToggleGroupItem value="left">Left</BrutalistToggleGroupItem>
        <BrutalistToggleGroupItem value="right">Right</BrutalistToggleGroupItem>
      </BrutalistToggleGroupRoot>
      <BrutalistToggleGroupRoot size="default" variant="outline" defaultValue={['top']}>
        <BrutalistToggleGroupItem value="top">Top</BrutalistToggleGroupItem>
        <BrutalistToggleGroupItem value="bottom">Bottom</BrutalistToggleGroupItem>
        <BrutalistToggleGroupItem value="left">Left</BrutalistToggleGroupItem>
        <BrutalistToggleGroupItem value="right">Right</BrutalistToggleGroupItem>
      </BrutalistToggleGroupRoot>
      <BrutalistToggleGroupRoot size="lg" variant="outline" defaultValue={['top']}>
        <BrutalistToggleGroupItem value="top">Top</BrutalistToggleGroupItem>
        <BrutalistToggleGroupItem value="bottom">Bottom</BrutalistToggleGroupItem>
        <BrutalistToggleGroupItem value="left">Left</BrutalistToggleGroupItem>
        <BrutalistToggleGroupItem value="right">Right</BrutalistToggleGroupItem>
      </BrutalistToggleGroupRoot>
    </div>
  );
}
    `),
    'demo-brutalist-toggle-group-spacing': formatCode(`
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/react';

export function BrutalistToggleGroupSpacingDemo() {
  return (
    <div className="flex flex-col items-start gap-4">
      <BrutalistToggleGroupRoot variant="outline" spacing={2} defaultValue={['top']}>
        <BrutalistToggleGroupItem value="top">Top</BrutalistToggleGroupItem>
        <BrutalistToggleGroupItem value="bottom">Bottom</BrutalistToggleGroupItem>
        <BrutalistToggleGroupItem value="left">Left</BrutalistToggleGroupItem>
        <BrutalistToggleGroupItem value="right">Right</BrutalistToggleGroupItem>
      </BrutalistToggleGroupRoot>
      <BrutalistToggleGroupRoot variant="outline" spacing={0} defaultValue={['top']}>
        <BrutalistToggleGroupItem value="top">Top</BrutalistToggleGroupItem>
        <BrutalistToggleGroupItem value="bottom">Bottom</BrutalistToggleGroupItem>
        <BrutalistToggleGroupItem value="left">Left</BrutalistToggleGroupItem>
        <BrutalistToggleGroupItem value="right">Right</BrutalistToggleGroupItem>
      </BrutalistToggleGroupRoot>
    </div>
  );
}
    `),
    'demo-brutalist-toggle-group-vertical': formatCode(`
import { Bold, Italic, Underline } from 'lucide-react';
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/react';

export function BrutalistToggleGroupVerticalDemo() {
  return (
    <BrutalistToggleGroupRoot
      multiple
      orientation="vertical"
      defaultValue={['bold', 'italic']}
      a11yLabel="Vertical text formatting"
    >
      <BrutalistToggleGroupItem value="bold">
        <Bold className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle bold</span>
      </BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="italic">
        <Italic className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle italic</span>
      </BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="underline">
        <Underline className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle underline</span>
      </BrutalistToggleGroupItem>
    </BrutalistToggleGroupRoot>
  );
}
    `),
    'demo-brutalist-toggle-group-disabled': formatCode(`
import { Bold, Italic, Underline } from 'lucide-react';
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/react';

export function BrutalistToggleGroupDisabledDemo() {
  return (
    <BrutalistToggleGroupRoot variant="outline" disabled defaultValue={['bold']}>
      <BrutalistToggleGroupItem value="bold">
        <Bold className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle bold</span>
      </BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="italic">
        <Italic className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle italic</span>
      </BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="underline">
        <Underline className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle underline</span>
      </BrutalistToggleGroupItem>
    </BrutalistToggleGroupRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-toggle-group': formatCode(`
import {
  BootstrapToggleGroupItem,
  BootstrapToggleGroupRoot,
} from '../proto-ui/components/react';

export function BootstrapToggleGroupDemo() {
  return (
    <BootstrapToggleGroupRoot multiple defaultValue={['bold']} a11yLabel="Text formatting">
      <BootstrapToggleGroupItem value="bold">Bold</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="italic">Italic</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="underline">Underline</BootstrapToggleGroupItem>
    </BootstrapToggleGroupRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-toggle-group-single': formatCode(`
import {
  BootstrapToggleGroupItem,
  BootstrapToggleGroupRoot,
} from '../proto-ui/components/react';

export function BootstrapToggleGroupSingleDemo() {
  return (
    <BootstrapToggleGroupRoot defaultValue={['left']} a11yLabel="Text alignment">
      <BootstrapToggleGroupItem value="left">Left</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="middle">Middle</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="right">Right</BootstrapToggleGroupItem>
    </BootstrapToggleGroupRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-toggle-group-sizes': formatCode(`
import {
  BootstrapToggleGroupItem,
  BootstrapToggleGroupRoot,
} from '../proto-ui/components/react';

export function BootstrapToggleGroupSizesDemo() {
  return (
    <div className="flex flex-col items-start gap-4">
      <BootstrapToggleGroupRoot size="mini" defaultValue={['left']}>
        <BootstrapToggleGroupItem value="left">Left</BootstrapToggleGroupItem>
        <BootstrapToggleGroupItem value="middle">Middle</BootstrapToggleGroupItem>
        <BootstrapToggleGroupItem value="right">Right</BootstrapToggleGroupItem>
      </BootstrapToggleGroupRoot>
      <BootstrapToggleGroupRoot size="small" variant="primary" defaultValue={['left']}>
        <BootstrapToggleGroupItem value="left">Left</BootstrapToggleGroupItem>
        <BootstrapToggleGroupItem value="middle">Middle</BootstrapToggleGroupItem>
        <BootstrapToggleGroupItem value="right">Right</BootstrapToggleGroupItem>
      </BootstrapToggleGroupRoot>
      <BootstrapToggleGroupRoot size="large" variant="danger" defaultValue={['left']}>
        <BootstrapToggleGroupItem value="left">Left</BootstrapToggleGroupItem>
        <BootstrapToggleGroupItem value="middle">Middle</BootstrapToggleGroupItem>
        <BootstrapToggleGroupItem value="right">Right</BootstrapToggleGroupItem>
      </BootstrapToggleGroupRoot>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-toggle-group-vertical': formatCode(`
import {
  BootstrapToggleGroupItem,
  BootstrapToggleGroupRoot,
} from '../proto-ui/components/react';

export function BootstrapToggleGroupVerticalDemo() {
  return (
    <BootstrapToggleGroupRoot
      multiple
      orientation="vertical"
      defaultValue={['bold', 'italic']}
      a11yLabel="Vertical text formatting"
    >
      <BootstrapToggleGroupItem value="bold">Bold</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="italic">Italic</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="underline">Underline</BootstrapToggleGroupItem>
    </BootstrapToggleGroupRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-toggle-group-disabled': formatCode(`
import {
  BootstrapToggleGroupItem,
  BootstrapToggleGroupRoot,
} from '../proto-ui/components/react';

export function BootstrapToggleGroupDisabledDemo() {
  return (
    <BootstrapToggleGroupRoot disabled defaultValue={['bold']}>
      <BootstrapToggleGroupItem value="bold">Bold</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="italic">Italic</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="underline">Underline</BootstrapToggleGroupItem>
    </BootstrapToggleGroupRoot>
  );
}
    `),
    'demo-liquid-glass-toggle-group': formatCode(`
import { Bold, Italic, Underline } from 'lucide-react';
import {
  LiquidGlassToggleGroupItem,
  LiquidGlassToggleGroupRoot,
} from '../proto-ui/components/react';

export function LiquidGlassToggleGroupDemo() {
  return (
    <LiquidGlassToggleGroupRoot multiple defaultValue={['bold']} a11yLabel="Text formatting">
      <LiquidGlassToggleGroupItem value="bold">
        <Bold className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle bold</span>
      </LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="italic">
        <Italic className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle italic</span>
      </LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="underline">
        <Underline className="size-4" aria-hidden="true" />
        <span className="sr-only">Toggle underline</span>
      </LiquidGlassToggleGroupItem>
    </LiquidGlassToggleGroupRoot>
  );
}
    `),
    'demo-liquid-glass-toggle-group-single': formatCode(`
import {
  LiquidGlassToggleGroupItem,
  LiquidGlassToggleGroupRoot,
} from '../proto-ui/components/react';

export function LiquidGlassToggleGroupSingleDemo() {
  return (
    <div className="flex flex-col items-center gap-4">
      <LiquidGlassToggleGroupRoot variant="regular" defaultValue={['week']}>
        <LiquidGlassToggleGroupItem value="day">Day</LiquidGlassToggleGroupItem>
        <LiquidGlassToggleGroupItem value="week">Week</LiquidGlassToggleGroupItem>
        <LiquidGlassToggleGroupItem value="month">Month</LiquidGlassToggleGroupItem>
      </LiquidGlassToggleGroupRoot>
      <LiquidGlassToggleGroupRoot variant="prominent" defaultValue={['week']}>
        <LiquidGlassToggleGroupItem value="day">Day</LiquidGlassToggleGroupItem>
        <LiquidGlassToggleGroupItem value="week">Week</LiquidGlassToggleGroupItem>
        <LiquidGlassToggleGroupItem value="month">Month</LiquidGlassToggleGroupItem>
      </LiquidGlassToggleGroupRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-toggle-group-sizes': formatCode(`
import {
  LiquidGlassToggleGroupItem,
  LiquidGlassToggleGroupRoot,
} from '../proto-ui/components/react';

export function LiquidGlassToggleGroupSizesDemo() {
  return (
    <div className="flex flex-col items-center gap-4">
      <LiquidGlassToggleGroupRoot size="sm" defaultValue={['top']}>
        <LiquidGlassToggleGroupItem value="top">Top</LiquidGlassToggleGroupItem>
        <LiquidGlassToggleGroupItem value="bottom">Bottom</LiquidGlassToggleGroupItem>
        <LiquidGlassToggleGroupItem value="left">Left</LiquidGlassToggleGroupItem>
        <LiquidGlassToggleGroupItem value="right">Right</LiquidGlassToggleGroupItem>
      </LiquidGlassToggleGroupRoot>
      <LiquidGlassToggleGroupRoot size="default" defaultValue={['top']}>
        <LiquidGlassToggleGroupItem value="top">Top</LiquidGlassToggleGroupItem>
        <LiquidGlassToggleGroupItem value="bottom">Bottom</LiquidGlassToggleGroupItem>
        <LiquidGlassToggleGroupItem value="left">Left</LiquidGlassToggleGroupItem>
        <LiquidGlassToggleGroupItem value="right">Right</LiquidGlassToggleGroupItem>
      </LiquidGlassToggleGroupRoot>
      <LiquidGlassToggleGroupRoot size="lg" defaultValue={['top']}>
        <LiquidGlassToggleGroupItem value="top">Top</LiquidGlassToggleGroupItem>
        <LiquidGlassToggleGroupItem value="bottom">Bottom</LiquidGlassToggleGroupItem>
        <LiquidGlassToggleGroupItem value="left">Left</LiquidGlassToggleGroupItem>
        <LiquidGlassToggleGroupItem value="right">Right</LiquidGlassToggleGroupItem>
      </LiquidGlassToggleGroupRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-toggle-group-vertical': formatCode(`
import {
  LiquidGlassToggleGroupItem,
  LiquidGlassToggleGroupRoot,
} from '../proto-ui/components/react';

export function LiquidGlassToggleGroupVerticalDemo() {
  return (
    <LiquidGlassToggleGroupRoot
      multiple
      orientation="vertical"
      defaultValue={['bold', 'italic']}
      a11yLabel="Vertical text formatting"
    >
      <LiquidGlassToggleGroupItem value="bold">Bold</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="italic">Italic</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="underline">Underline</LiquidGlassToggleGroupItem>
    </LiquidGlassToggleGroupRoot>
  );
}
    `),
    'demo-liquid-glass-toggle-group-disabled': formatCode(`
import {
  LiquidGlassToggleGroupItem,
  LiquidGlassToggleGroupRoot,
} from '../proto-ui/components/react';

export function LiquidGlassToggleGroupDisabledDemo() {
  return (
    <div className="flex flex-col items-center gap-4">
      <LiquidGlassToggleGroupRoot material="opaque" defaultValue={['day']}>
        <LiquidGlassToggleGroupItem value="day">Day</LiquidGlassToggleGroupItem>
        <LiquidGlassToggleGroupItem value="week">Week</LiquidGlassToggleGroupItem>
        <LiquidGlassToggleGroupItem value="month">Month</LiquidGlassToggleGroupItem>
      </LiquidGlassToggleGroupRoot>
      <LiquidGlassToggleGroupRoot disabled defaultValue={['day']}>
        <LiquidGlassToggleGroupItem value="day">Day</LiquidGlassToggleGroupItem>
        <LiquidGlassToggleGroupItem value="week">Week</LiquidGlassToggleGroupItem>
        <LiquidGlassToggleGroupItem value="month">Month</LiquidGlassToggleGroupItem>
      </LiquidGlassToggleGroupRoot>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-toggle-group': formatCode(`
<script setup lang="ts">
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnToggleGroupRoot
    styleProfile="rhea"
    variant="outline"
    :multiple="true"
    :defaultValue="['bold']"
    a11yLabel="Text formatting"
  >
    <ShadcnToggleGroupItem styleProfile="rhea" value="bold">B</ShadcnToggleGroupItem>
    <ShadcnToggleGroupItem styleProfile="rhea" value="italic">I</ShadcnToggleGroupItem>
    <ShadcnToggleGroupItem styleProfile="rhea" value="underline">U</ShadcnToggleGroupItem>
  </ShadcnToggleGroupRoot>
</template>
    `),
    'demo-shadcn-toggle-group-outline': formatCode(`
<script setup lang="ts">
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnToggleGroupRoot styleProfile="rhea" variant="outline" :defaultValue="['all']" a11yLabel="Message filter">
    <ShadcnToggleGroupItem styleProfile="rhea" value="all">All</ShadcnToggleGroupItem>
    <ShadcnToggleGroupItem styleProfile="rhea" value="missed">Missed</ShadcnToggleGroupItem>
  </ShadcnToggleGroupRoot>
</template>
    `),
    'demo-shadcn-toggle-group-sizes': formatCode(`
<script setup lang="ts">
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-col items-start gap-4">
    <ShadcnToggleGroupRoot styleProfile="rhea" size="sm" variant="outline" :defaultValue="['top']">
      <ShadcnToggleGroupItem styleProfile="rhea" value="top">Top</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="bottom">Bottom</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="left">Left</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="right">Right</ShadcnToggleGroupItem>
    </ShadcnToggleGroupRoot>
    <ShadcnToggleGroupRoot styleProfile="rhea" size="default" variant="outline" :defaultValue="['top']">
      <ShadcnToggleGroupItem styleProfile="rhea" value="top">Top</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="bottom">Bottom</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="left">Left</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="right">Right</ShadcnToggleGroupItem>
    </ShadcnToggleGroupRoot>
    <ShadcnToggleGroupRoot styleProfile="rhea" size="lg" variant="outline" :defaultValue="['top']">
      <ShadcnToggleGroupItem styleProfile="rhea" value="top">Top</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="bottom">Bottom</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="left">Left</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="right">Right</ShadcnToggleGroupItem>
    </ShadcnToggleGroupRoot>
  </div>
</template>
    `),
    'demo-shadcn-toggle-group-spacing': formatCode(`
<script setup lang="ts">
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-col items-start gap-4">
    <ShadcnToggleGroupRoot styleProfile="rhea" size="sm" variant="outline" :spacing="2" :defaultValue="['top']">
      <ShadcnToggleGroupItem styleProfile="rhea" value="top">Top</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="bottom">Bottom</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="left">Left</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="right">Right</ShadcnToggleGroupItem>
    </ShadcnToggleGroupRoot>
    <ShadcnToggleGroupRoot styleProfile="rhea" size="sm" variant="outline" :spacing="0" :defaultValue="['top']">
      <ShadcnToggleGroupItem styleProfile="rhea" value="top">Top</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="bottom">Bottom</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="left">Left</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="right">Right</ShadcnToggleGroupItem>
    </ShadcnToggleGroupRoot>
  </div>
</template>
    `),
    'demo-shadcn-toggle-group-vertical': formatCode(`
<script setup lang="ts">
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnToggleGroupRoot
    styleProfile="rhea"
    :multiple="true"
    orientation="vertical"
    :spacing="1"
    :defaultValue="['bold', 'italic']"
  >
    <ShadcnToggleGroupItem styleProfile="rhea" value="bold">B</ShadcnToggleGroupItem>
    <ShadcnToggleGroupItem styleProfile="rhea" value="italic">I</ShadcnToggleGroupItem>
    <ShadcnToggleGroupItem styleProfile="rhea" value="underline">U</ShadcnToggleGroupItem>
  </ShadcnToggleGroupRoot>
</template>
    `),
    'demo-shadcn-toggle-group-disabled': formatCode(`
<script setup lang="ts">
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnToggleGroupRoot styleProfile="rhea" variant="outline" :disabled="true" :defaultValue="['bold']">
    <ShadcnToggleGroupItem styleProfile="rhea" value="bold">B</ShadcnToggleGroupItem>
    <ShadcnToggleGroupItem styleProfile="rhea" value="italic">I</ShadcnToggleGroupItem>
    <ShadcnToggleGroupItem styleProfile="rhea" value="underline">U</ShadcnToggleGroupItem>
  </ShadcnToggleGroupRoot>
</template>
    `),
    'demo-shadcn-toggle-group-custom': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnFieldDescription,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/vue';

const fontWeight = ref('normal');
function onChange(detail: { value: string[] }) {
  if (detail.value[0]) fontWeight.value = detail.value[0];
}
</script>

<template>
  <ShadcnFieldRoot styleProfile="rhea" class="w-fit">
    <ShadcnFieldLabel styleProfile="rhea">Font Weight</ShadcnFieldLabel>
    <ShadcnToggleGroupRoot
      styleProfile="rhea"
      :value="[fontWeight]"
      variant="outline"
      :spacing="2"
      size="lg"
      @valueChange="onChange"
    >
      <ShadcnToggleGroupItem styleProfile="rhea" value="light" class="flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl">
        <span class="text-2xl leading-none font-light">Aa</span>
        <span class="text-xs text-muted-foreground">Light</span>
      </ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="normal" class="flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl">
        <span class="text-2xl leading-none font-normal">Aa</span>
        <span class="text-xs text-muted-foreground">Normal</span>
      </ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="medium" class="flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl">
        <span class="text-2xl leading-none font-medium">Aa</span>
        <span class="text-xs text-muted-foreground">Medium</span>
      </ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="bold" class="flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl">
        <span class="text-2xl leading-none font-bold">Aa</span>
        <span class="text-xs text-muted-foreground">Bold</span>
      </ShadcnToggleGroupItem>
    </ShadcnToggleGroupRoot>
    <ShadcnFieldDescription styleProfile="rhea">
      Use <span class="rounded-md bg-muted px-1 py-0.5 font-mono text-xs">font-{{ fontWeight }}</span> to set the font weight.
    </ShadcnFieldDescription>
  </ShadcnFieldRoot>
</template>
    `),
    'demo-brutalist-toggle-group': formatCode(`
<script setup lang="ts">
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistToggleGroupRoot :multiple="true" :defaultValue="['bold']" a11yLabel="Text formatting">
    <BrutalistToggleGroupItem value="bold">B</BrutalistToggleGroupItem>
    <BrutalistToggleGroupItem value="italic">I</BrutalistToggleGroupItem>
    <BrutalistToggleGroupItem value="underline">U</BrutalistToggleGroupItem>
  </BrutalistToggleGroupRoot>
</template>
    `),
    'demo-brutalist-toggle-group-outline': formatCode(`
<script setup lang="ts">
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistToggleGroupRoot variant="outline" :defaultValue="['all']" a11yLabel="Message filter">
    <BrutalistToggleGroupItem value="all">All</BrutalistToggleGroupItem>
    <BrutalistToggleGroupItem value="missed">Missed</BrutalistToggleGroupItem>
    <BrutalistToggleGroupItem value="archived">Archived</BrutalistToggleGroupItem>
  </BrutalistToggleGroupRoot>
</template>
    `),
    'demo-brutalist-toggle-group-sizes': formatCode(`
<script setup lang="ts">
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-col items-start gap-4">
    <BrutalistToggleGroupRoot size="sm" variant="outline" :defaultValue="['top']">
      <BrutalistToggleGroupItem value="top">Top</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="bottom">Bottom</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="left">Left</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="right">Right</BrutalistToggleGroupItem>
    </BrutalistToggleGroupRoot>
    <BrutalistToggleGroupRoot size="default" variant="outline" :defaultValue="['top']">
      <BrutalistToggleGroupItem value="top">Top</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="bottom">Bottom</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="left">Left</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="right">Right</BrutalistToggleGroupItem>
    </BrutalistToggleGroupRoot>
    <BrutalistToggleGroupRoot size="lg" variant="outline" :defaultValue="['top']">
      <BrutalistToggleGroupItem value="top">Top</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="bottom">Bottom</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="left">Left</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="right">Right</BrutalistToggleGroupItem>
    </BrutalistToggleGroupRoot>
  </div>
</template>
    `),
    'demo-brutalist-toggle-group-spacing': formatCode(`
<script setup lang="ts">
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-col items-start gap-4">
    <BrutalistToggleGroupRoot variant="outline" :spacing="2" :defaultValue="['top']">
      <BrutalistToggleGroupItem value="top">Top</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="bottom">Bottom</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="left">Left</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="right">Right</BrutalistToggleGroupItem>
    </BrutalistToggleGroupRoot>
    <BrutalistToggleGroupRoot variant="outline" :spacing="0" :defaultValue="['top']">
      <BrutalistToggleGroupItem value="top">Top</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="bottom">Bottom</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="left">Left</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="right">Right</BrutalistToggleGroupItem>
    </BrutalistToggleGroupRoot>
  </div>
</template>
    `),
    'demo-brutalist-toggle-group-vertical': formatCode(`
<script setup lang="ts">
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistToggleGroupRoot :multiple="true" orientation="vertical" :defaultValue="['bold', 'italic']">
    <BrutalistToggleGroupItem value="bold">B</BrutalistToggleGroupItem>
    <BrutalistToggleGroupItem value="italic">I</BrutalistToggleGroupItem>
    <BrutalistToggleGroupItem value="underline">U</BrutalistToggleGroupItem>
  </BrutalistToggleGroupRoot>
</template>
    `),
    'demo-brutalist-toggle-group-disabled': formatCode(`
<script setup lang="ts">
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistToggleGroupRoot variant="outline" :disabled="true" :defaultValue="['bold']">
    <BrutalistToggleGroupItem value="bold">B</BrutalistToggleGroupItem>
    <BrutalistToggleGroupItem value="italic">I</BrutalistToggleGroupItem>
    <BrutalistToggleGroupItem value="underline">U</BrutalistToggleGroupItem>
  </BrutalistToggleGroupRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-toggle-group': formatCode(`
<script setup lang="ts">
import {
  BootstrapToggleGroupItem,
  BootstrapToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapToggleGroupRoot :multiple="true" :defaultValue="['bold']" a11yLabel="Text formatting">
    <BootstrapToggleGroupItem value="bold">Bold</BootstrapToggleGroupItem>
    <BootstrapToggleGroupItem value="italic">Italic</BootstrapToggleGroupItem>
    <BootstrapToggleGroupItem value="underline">Underline</BootstrapToggleGroupItem>
  </BootstrapToggleGroupRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-toggle-group-single': formatCode(`
<script setup lang="ts">
import {
  BootstrapToggleGroupItem,
  BootstrapToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapToggleGroupRoot :defaultValue="['left']" a11yLabel="Text alignment">
    <BootstrapToggleGroupItem value="left">Left</BootstrapToggleGroupItem>
    <BootstrapToggleGroupItem value="middle">Middle</BootstrapToggleGroupItem>
    <BootstrapToggleGroupItem value="right">Right</BootstrapToggleGroupItem>
  </BootstrapToggleGroupRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-toggle-group-sizes': formatCode(`
<script setup lang="ts">
import {
  BootstrapToggleGroupItem,
  BootstrapToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-col items-start gap-4">
    <BootstrapToggleGroupRoot size="mini" :defaultValue="['left']">
      <BootstrapToggleGroupItem value="left">Left</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="middle">Middle</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="right">Right</BootstrapToggleGroupItem>
    </BootstrapToggleGroupRoot>
    <BootstrapToggleGroupRoot size="small" variant="primary" :defaultValue="['left']">
      <BootstrapToggleGroupItem value="left">Left</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="middle">Middle</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="right">Right</BootstrapToggleGroupItem>
    </BootstrapToggleGroupRoot>
    <BootstrapToggleGroupRoot size="large" variant="danger" :defaultValue="['left']">
      <BootstrapToggleGroupItem value="left">Left</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="middle">Middle</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="right">Right</BootstrapToggleGroupItem>
    </BootstrapToggleGroupRoot>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-toggle-group-vertical': formatCode(`
<script setup lang="ts">
import {
  BootstrapToggleGroupItem,
  BootstrapToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapToggleGroupRoot :multiple="true" orientation="vertical" :defaultValue="['bold', 'italic']">
    <BootstrapToggleGroupItem value="bold">Bold</BootstrapToggleGroupItem>
    <BootstrapToggleGroupItem value="italic">Italic</BootstrapToggleGroupItem>
    <BootstrapToggleGroupItem value="underline">Underline</BootstrapToggleGroupItem>
  </BootstrapToggleGroupRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-toggle-group-disabled': formatCode(`
<script setup lang="ts">
import {
  BootstrapToggleGroupItem,
  BootstrapToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapToggleGroupRoot :disabled="true" :defaultValue="['bold']">
    <BootstrapToggleGroupItem value="bold">Bold</BootstrapToggleGroupItem>
    <BootstrapToggleGroupItem value="italic">Italic</BootstrapToggleGroupItem>
    <BootstrapToggleGroupItem value="underline">Underline</BootstrapToggleGroupItem>
  </BootstrapToggleGroupRoot>
</template>
    `),
    'demo-liquid-glass-toggle-group': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassToggleGroupItem,
  LiquidGlassToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <LiquidGlassToggleGroupRoot :multiple="true" :defaultValue="['bold']" a11yLabel="Text formatting">
    <LiquidGlassToggleGroupItem value="bold">B</LiquidGlassToggleGroupItem>
    <LiquidGlassToggleGroupItem value="italic">I</LiquidGlassToggleGroupItem>
    <LiquidGlassToggleGroupItem value="underline">U</LiquidGlassToggleGroupItem>
  </LiquidGlassToggleGroupRoot>
</template>
    `),
    'demo-liquid-glass-toggle-group-single': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassToggleGroupItem,
  LiquidGlassToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <LiquidGlassToggleGroupRoot variant="regular" :defaultValue="['week']">
      <LiquidGlassToggleGroupItem value="day">Day</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="week">Week</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="month">Month</LiquidGlassToggleGroupItem>
    </LiquidGlassToggleGroupRoot>
    <LiquidGlassToggleGroupRoot variant="prominent" :defaultValue="['week']">
      <LiquidGlassToggleGroupItem value="day">Day</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="week">Week</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="month">Month</LiquidGlassToggleGroupItem>
    </LiquidGlassToggleGroupRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-toggle-group-sizes': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassToggleGroupItem,
  LiquidGlassToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <LiquidGlassToggleGroupRoot size="sm" :defaultValue="['top']">
      <LiquidGlassToggleGroupItem value="top">Top</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="bottom">Bottom</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="left">Left</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="right">Right</LiquidGlassToggleGroupItem>
    </LiquidGlassToggleGroupRoot>
    <LiquidGlassToggleGroupRoot size="default" :defaultValue="['top']">
      <LiquidGlassToggleGroupItem value="top">Top</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="bottom">Bottom</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="left">Left</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="right">Right</LiquidGlassToggleGroupItem>
    </LiquidGlassToggleGroupRoot>
    <LiquidGlassToggleGroupRoot size="lg" :defaultValue="['top']">
      <LiquidGlassToggleGroupItem value="top">Top</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="bottom">Bottom</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="left">Left</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="right">Right</LiquidGlassToggleGroupItem>
    </LiquidGlassToggleGroupRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-toggle-group-vertical': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassToggleGroupItem,
  LiquidGlassToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <LiquidGlassToggleGroupRoot :multiple="true" orientation="vertical" :defaultValue="['bold', 'italic']">
    <LiquidGlassToggleGroupItem value="bold">Bold</LiquidGlassToggleGroupItem>
    <LiquidGlassToggleGroupItem value="italic">Italic</LiquidGlassToggleGroupItem>
    <LiquidGlassToggleGroupItem value="underline">Underline</LiquidGlassToggleGroupItem>
  </LiquidGlassToggleGroupRoot>
</template>
    `),
    'demo-liquid-glass-toggle-group-disabled': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassToggleGroupItem,
  LiquidGlassToggleGroupRoot,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <LiquidGlassToggleGroupRoot material="opaque" :defaultValue="['day']">
      <LiquidGlassToggleGroupItem value="day">Day</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="week">Week</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="month">Month</LiquidGlassToggleGroupItem>
    </LiquidGlassToggleGroupRoot>
    <LiquidGlassToggleGroupRoot :disabled="true" :defaultValue="['day']">
      <LiquidGlassToggleGroupItem value="day">Day</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="week">Week</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="month">Month</LiquidGlassToggleGroupItem>
    </LiquidGlassToggleGroupRoot>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-toggle-group': formatCode(`
<template>
  <ShadcnToggleGroupRoot
    styleProfile="rhea"
    variant="outline"
    :multiple="true"
    :defaultValue="['bold']"
    a11yLabel="Text formatting"
  >
    <ShadcnToggleGroupItem styleProfile="rhea" value="bold">B</ShadcnToggleGroupItem>
    <ShadcnToggleGroupItem styleProfile="rhea" value="italic">I</ShadcnToggleGroupItem>
    <ShadcnToggleGroupItem styleProfile="rhea" value="underline">U</ShadcnToggleGroupItem>
  </ShadcnToggleGroupRoot>
</template>

<script>
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnToggleGroupItem,
    ShadcnToggleGroupRoot,
  },
};
</script>
    `),
    'demo-shadcn-toggle-group-outline': formatCode(`
<template>
  <ShadcnToggleGroupRoot styleProfile="rhea" variant="outline" :defaultValue="['all']" a11yLabel="Message filter">
    <ShadcnToggleGroupItem styleProfile="rhea" value="all">All</ShadcnToggleGroupItem>
    <ShadcnToggleGroupItem styleProfile="rhea" value="missed">Missed</ShadcnToggleGroupItem>
  </ShadcnToggleGroupRoot>
</template>

<script>
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnToggleGroupItem,
    ShadcnToggleGroupRoot,
  },
};
</script>
    `),
    'demo-shadcn-toggle-group-sizes': formatCode(`
<template>
  <div class="flex flex-col items-start gap-4">
    <ShadcnToggleGroupRoot styleProfile="rhea" size="sm" variant="outline" :defaultValue="['top']">
      <ShadcnToggleGroupItem styleProfile="rhea" value="top">Top</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="bottom">Bottom</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="left">Left</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="right">Right</ShadcnToggleGroupItem>
    </ShadcnToggleGroupRoot>
    <ShadcnToggleGroupRoot styleProfile="rhea" size="default" variant="outline" :defaultValue="['top']">
      <ShadcnToggleGroupItem styleProfile="rhea" value="top">Top</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="bottom">Bottom</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="left">Left</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="right">Right</ShadcnToggleGroupItem>
    </ShadcnToggleGroupRoot>
    <ShadcnToggleGroupRoot styleProfile="rhea" size="lg" variant="outline" :defaultValue="['top']">
      <ShadcnToggleGroupItem styleProfile="rhea" value="top">Top</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="bottom">Bottom</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="left">Left</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="right">Right</ShadcnToggleGroupItem>
    </ShadcnToggleGroupRoot>
  </div>
</template>

<script>
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnToggleGroupItem,
    ShadcnToggleGroupRoot,
  },
};
</script>
    `),
    'demo-shadcn-toggle-group-spacing': formatCode(`
<template>
  <div class="flex flex-col items-start gap-4">
    <ShadcnToggleGroupRoot styleProfile="rhea" size="sm" variant="outline" :spacing="2" :defaultValue="['top']">
      <ShadcnToggleGroupItem styleProfile="rhea" value="top">Top</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="bottom">Bottom</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="left">Left</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="right">Right</ShadcnToggleGroupItem>
    </ShadcnToggleGroupRoot>
    <ShadcnToggleGroupRoot styleProfile="rhea" size="sm" variant="outline" :spacing="0" :defaultValue="['top']">
      <ShadcnToggleGroupItem styleProfile="rhea" value="top">Top</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="bottom">Bottom</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="left">Left</ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="right">Right</ShadcnToggleGroupItem>
    </ShadcnToggleGroupRoot>
  </div>
</template>

<script>
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnToggleGroupItem,
    ShadcnToggleGroupRoot,
  },
};
</script>
    `),
    'demo-shadcn-toggle-group-vertical': formatCode(`
<template>
  <ShadcnToggleGroupRoot
    styleProfile="rhea"
    :multiple="true"
    orientation="vertical"
    :spacing="1"
    :defaultValue="['bold', 'italic']"
  >
    <ShadcnToggleGroupItem styleProfile="rhea" value="bold">B</ShadcnToggleGroupItem>
    <ShadcnToggleGroupItem styleProfile="rhea" value="italic">I</ShadcnToggleGroupItem>
    <ShadcnToggleGroupItem styleProfile="rhea" value="underline">U</ShadcnToggleGroupItem>
  </ShadcnToggleGroupRoot>
</template>

<script>
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnToggleGroupItem,
    ShadcnToggleGroupRoot,
  },
};
</script>
    `),
    'demo-shadcn-toggle-group-disabled': formatCode(`
<template>
  <ShadcnToggleGroupRoot styleProfile="rhea" variant="outline" :disabled="true" :defaultValue="['bold']">
    <ShadcnToggleGroupItem styleProfile="rhea" value="bold">B</ShadcnToggleGroupItem>
    <ShadcnToggleGroupItem styleProfile="rhea" value="italic">I</ShadcnToggleGroupItem>
    <ShadcnToggleGroupItem styleProfile="rhea" value="underline">U</ShadcnToggleGroupItem>
  </ShadcnToggleGroupRoot>
</template>

<script>
import {
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnToggleGroupItem,
    ShadcnToggleGroupRoot,
  },
};
</script>
    `),
    'demo-shadcn-toggle-group-custom': formatCode(`
<template>
  <ShadcnFieldRoot styleProfile="rhea" class="w-fit">
    <ShadcnFieldLabel styleProfile="rhea">Font Weight</ShadcnFieldLabel>
    <ShadcnToggleGroupRoot
      styleProfile="rhea"
      :value="[fontWeight]"
      variant="outline"
      :spacing="2"
      size="lg"
      @valueChange="onChange"
    >
      <ShadcnToggleGroupItem styleProfile="rhea" value="light" class="flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl">
        <span class="text-2xl leading-none font-light">Aa</span>
        <span class="text-xs text-muted-foreground">Light</span>
      </ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="normal" class="flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl">
        <span class="text-2xl leading-none font-normal">Aa</span>
        <span class="text-xs text-muted-foreground">Normal</span>
      </ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="medium" class="flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl">
        <span class="text-2xl leading-none font-medium">Aa</span>
        <span class="text-xs text-muted-foreground">Medium</span>
      </ShadcnToggleGroupItem>
      <ShadcnToggleGroupItem styleProfile="rhea" value="bold" class="flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl">
        <span class="text-2xl leading-none font-bold">Aa</span>
        <span class="text-xs text-muted-foreground">Bold</span>
      </ShadcnToggleGroupItem>
    </ShadcnToggleGroupRoot>
    <ShadcnFieldDescription styleProfile="rhea">
      Use <span class="rounded-md bg-muted px-1 py-0.5 font-mono text-xs">font-{{ fontWeight }}</span> to set the font weight.
    </ShadcnFieldDescription>
  </ShadcnFieldRoot>
</template>

<script>
import {
  ShadcnFieldDescription,
  ShadcnFieldLabel,
  ShadcnFieldRoot,
  ShadcnToggleGroupItem,
  ShadcnToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnFieldDescription,
    ShadcnFieldLabel,
    ShadcnFieldRoot,
    ShadcnToggleGroupItem,
    ShadcnToggleGroupRoot,
  },
  data() {
    return { fontWeight: 'normal' };
  },
  methods: {
    onChange(detail) {
      if (detail.value[0]) this.fontWeight = detail.value[0];
    },
  },
};
</script>
    `),
    'demo-brutalist-toggle-group': formatCode(`
<template>
  <BrutalistToggleGroupRoot :multiple="true" :defaultValue="['bold']" a11yLabel="Text formatting">
    <BrutalistToggleGroupItem value="bold">B</BrutalistToggleGroupItem>
    <BrutalistToggleGroupItem value="italic">I</BrutalistToggleGroupItem>
    <BrutalistToggleGroupItem value="underline">U</BrutalistToggleGroupItem>
  </BrutalistToggleGroupRoot>
</template>

<script>
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistToggleGroupItem,
    BrutalistToggleGroupRoot,
  },
};
</script>
    `),
    'demo-brutalist-toggle-group-outline': formatCode(`
<template>
  <BrutalistToggleGroupRoot variant="outline" :defaultValue="['all']" a11yLabel="Message filter">
    <BrutalistToggleGroupItem value="all">All</BrutalistToggleGroupItem>
    <BrutalistToggleGroupItem value="missed">Missed</BrutalistToggleGroupItem>
    <BrutalistToggleGroupItem value="archived">Archived</BrutalistToggleGroupItem>
  </BrutalistToggleGroupRoot>
</template>

<script>
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistToggleGroupItem,
    BrutalistToggleGroupRoot,
  },
};
</script>
    `),
    'demo-brutalist-toggle-group-sizes': formatCode(`
<template>
  <div class="flex flex-col items-start gap-4">
    <BrutalistToggleGroupRoot size="sm" variant="outline" :defaultValue="['top']">
      <BrutalistToggleGroupItem value="top">Top</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="bottom">Bottom</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="left">Left</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="right">Right</BrutalistToggleGroupItem>
    </BrutalistToggleGroupRoot>
    <BrutalistToggleGroupRoot size="default" variant="outline" :defaultValue="['top']">
      <BrutalistToggleGroupItem value="top">Top</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="bottom">Bottom</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="left">Left</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="right">Right</BrutalistToggleGroupItem>
    </BrutalistToggleGroupRoot>
    <BrutalistToggleGroupRoot size="lg" variant="outline" :defaultValue="['top']">
      <BrutalistToggleGroupItem value="top">Top</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="bottom">Bottom</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="left">Left</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="right">Right</BrutalistToggleGroupItem>
    </BrutalistToggleGroupRoot>
  </div>
</template>

<script>
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistToggleGroupItem,
    BrutalistToggleGroupRoot,
  },
};
</script>
    `),
    'demo-brutalist-toggle-group-spacing': formatCode(`
<template>
  <div class="flex flex-col items-start gap-4">
    <BrutalistToggleGroupRoot variant="outline" :spacing="2" :defaultValue="['top']">
      <BrutalistToggleGroupItem value="top">Top</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="bottom">Bottom</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="left">Left</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="right">Right</BrutalistToggleGroupItem>
    </BrutalistToggleGroupRoot>
    <BrutalistToggleGroupRoot variant="outline" :spacing="0" :defaultValue="['top']">
      <BrutalistToggleGroupItem value="top">Top</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="bottom">Bottom</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="left">Left</BrutalistToggleGroupItem>
      <BrutalistToggleGroupItem value="right">Right</BrutalistToggleGroupItem>
    </BrutalistToggleGroupRoot>
  </div>
</template>

<script>
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistToggleGroupItem,
    BrutalistToggleGroupRoot,
  },
};
</script>
    `),
    'demo-brutalist-toggle-group-vertical': formatCode(`
<template>
  <BrutalistToggleGroupRoot :multiple="true" orientation="vertical" :defaultValue="['bold', 'italic']">
    <BrutalistToggleGroupItem value="bold">B</BrutalistToggleGroupItem>
    <BrutalistToggleGroupItem value="italic">I</BrutalistToggleGroupItem>
    <BrutalistToggleGroupItem value="underline">U</BrutalistToggleGroupItem>
  </BrutalistToggleGroupRoot>
</template>

<script>
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistToggleGroupItem,
    BrutalistToggleGroupRoot,
  },
};
</script>
    `),
    'demo-brutalist-toggle-group-disabled': formatCode(`
<template>
  <BrutalistToggleGroupRoot variant="outline" :disabled="true" :defaultValue="['bold']">
    <BrutalistToggleGroupItem value="bold">B</BrutalistToggleGroupItem>
    <BrutalistToggleGroupItem value="italic">I</BrutalistToggleGroupItem>
    <BrutalistToggleGroupItem value="underline">U</BrutalistToggleGroupItem>
  </BrutalistToggleGroupRoot>
</template>

<script>
import {
  BrutalistToggleGroupItem,
  BrutalistToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistToggleGroupItem,
    BrutalistToggleGroupRoot,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toggle-group': formatCode(`
<template>
  <BootstrapToggleGroupRoot :multiple="true" :defaultValue="['bold']" a11yLabel="Text formatting">
    <BootstrapToggleGroupItem value="bold">Bold</BootstrapToggleGroupItem>
    <BootstrapToggleGroupItem value="italic">Italic</BootstrapToggleGroupItem>
    <BootstrapToggleGroupItem value="underline">Underline</BootstrapToggleGroupItem>
  </BootstrapToggleGroupRoot>
</template>

<script>
import {
  BootstrapToggleGroupItem,
  BootstrapToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapToggleGroupItem,
    BootstrapToggleGroupRoot,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toggle-group-single': formatCode(`
<template>
  <BootstrapToggleGroupRoot :defaultValue="['left']" a11yLabel="Text alignment">
    <BootstrapToggleGroupItem value="left">Left</BootstrapToggleGroupItem>
    <BootstrapToggleGroupItem value="middle">Middle</BootstrapToggleGroupItem>
    <BootstrapToggleGroupItem value="right">Right</BootstrapToggleGroupItem>
  </BootstrapToggleGroupRoot>
</template>

<script>
import {
  BootstrapToggleGroupItem,
  BootstrapToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapToggleGroupItem,
    BootstrapToggleGroupRoot,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toggle-group-sizes': formatCode(`
<template>
  <div class="flex flex-col items-start gap-4">
    <BootstrapToggleGroupRoot size="mini" :defaultValue="['left']">
      <BootstrapToggleGroupItem value="left">Left</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="middle">Middle</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="right">Right</BootstrapToggleGroupItem>
    </BootstrapToggleGroupRoot>
    <BootstrapToggleGroupRoot size="small" variant="primary" :defaultValue="['left']">
      <BootstrapToggleGroupItem value="left">Left</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="middle">Middle</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="right">Right</BootstrapToggleGroupItem>
    </BootstrapToggleGroupRoot>
    <BootstrapToggleGroupRoot size="large" variant="danger" :defaultValue="['left']">
      <BootstrapToggleGroupItem value="left">Left</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="middle">Middle</BootstrapToggleGroupItem>
      <BootstrapToggleGroupItem value="right">Right</BootstrapToggleGroupItem>
    </BootstrapToggleGroupRoot>
  </div>
</template>

<script>
import {
  BootstrapToggleGroupItem,
  BootstrapToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapToggleGroupItem,
    BootstrapToggleGroupRoot,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toggle-group-vertical': formatCode(`
<template>
  <BootstrapToggleGroupRoot :multiple="true" orientation="vertical" :defaultValue="['bold', 'italic']">
    <BootstrapToggleGroupItem value="bold">Bold</BootstrapToggleGroupItem>
    <BootstrapToggleGroupItem value="italic">Italic</BootstrapToggleGroupItem>
    <BootstrapToggleGroupItem value="underline">Underline</BootstrapToggleGroupItem>
  </BootstrapToggleGroupRoot>
</template>

<script>
import {
  BootstrapToggleGroupItem,
  BootstrapToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapToggleGroupItem,
    BootstrapToggleGroupRoot,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-toggle-group-disabled': formatCode(`
<template>
  <BootstrapToggleGroupRoot :disabled="true" :defaultValue="['bold']">
    <BootstrapToggleGroupItem value="bold">Bold</BootstrapToggleGroupItem>
    <BootstrapToggleGroupItem value="italic">Italic</BootstrapToggleGroupItem>
    <BootstrapToggleGroupItem value="underline">Underline</BootstrapToggleGroupItem>
  </BootstrapToggleGroupRoot>
</template>

<script>
import {
  BootstrapToggleGroupItem,
  BootstrapToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapToggleGroupItem,
    BootstrapToggleGroupRoot,
  },
};
</script>
    `),
    'demo-liquid-glass-toggle-group': formatCode(`
<template>
  <LiquidGlassToggleGroupRoot :multiple="true" :defaultValue="['bold']" a11yLabel="Text formatting">
    <LiquidGlassToggleGroupItem value="bold">B</LiquidGlassToggleGroupItem>
    <LiquidGlassToggleGroupItem value="italic">I</LiquidGlassToggleGroupItem>
    <LiquidGlassToggleGroupItem value="underline">U</LiquidGlassToggleGroupItem>
  </LiquidGlassToggleGroupRoot>
</template>

<script>
import {
  LiquidGlassToggleGroupItem,
  LiquidGlassToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassToggleGroupItem,
    LiquidGlassToggleGroupRoot,
  },
};
</script>
    `),
    'demo-liquid-glass-toggle-group-single': formatCode(`
<template>
  <div class="flex flex-col items-center gap-4">
    <LiquidGlassToggleGroupRoot variant="regular" :defaultValue="['week']">
      <LiquidGlassToggleGroupItem value="day">Day</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="week">Week</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="month">Month</LiquidGlassToggleGroupItem>
    </LiquidGlassToggleGroupRoot>
    <LiquidGlassToggleGroupRoot variant="prominent" :defaultValue="['week']">
      <LiquidGlassToggleGroupItem value="day">Day</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="week">Week</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="month">Month</LiquidGlassToggleGroupItem>
    </LiquidGlassToggleGroupRoot>
  </div>
</template>

<script>
import {
  LiquidGlassToggleGroupItem,
  LiquidGlassToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassToggleGroupItem,
    LiquidGlassToggleGroupRoot,
  },
};
</script>
    `),
    'demo-liquid-glass-toggle-group-sizes': formatCode(`
<template>
  <div class="flex flex-col items-center gap-4">
    <LiquidGlassToggleGroupRoot size="sm" :defaultValue="['top']">
      <LiquidGlassToggleGroupItem value="top">Top</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="bottom">Bottom</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="left">Left</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="right">Right</LiquidGlassToggleGroupItem>
    </LiquidGlassToggleGroupRoot>
    <LiquidGlassToggleGroupRoot size="default" :defaultValue="['top']">
      <LiquidGlassToggleGroupItem value="top">Top</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="bottom">Bottom</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="left">Left</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="right">Right</LiquidGlassToggleGroupItem>
    </LiquidGlassToggleGroupRoot>
    <LiquidGlassToggleGroupRoot size="lg" :defaultValue="['top']">
      <LiquidGlassToggleGroupItem value="top">Top</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="bottom">Bottom</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="left">Left</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="right">Right</LiquidGlassToggleGroupItem>
    </LiquidGlassToggleGroupRoot>
  </div>
</template>

<script>
import {
  LiquidGlassToggleGroupItem,
  LiquidGlassToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassToggleGroupItem,
    LiquidGlassToggleGroupRoot,
  },
};
</script>
    `),
    'demo-liquid-glass-toggle-group-vertical': formatCode(`
<template>
  <LiquidGlassToggleGroupRoot :multiple="true" orientation="vertical" :defaultValue="['bold', 'italic']">
    <LiquidGlassToggleGroupItem value="bold">Bold</LiquidGlassToggleGroupItem>
    <LiquidGlassToggleGroupItem value="italic">Italic</LiquidGlassToggleGroupItem>
    <LiquidGlassToggleGroupItem value="underline">Underline</LiquidGlassToggleGroupItem>
  </LiquidGlassToggleGroupRoot>
</template>

<script>
import {
  LiquidGlassToggleGroupItem,
  LiquidGlassToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassToggleGroupItem,
    LiquidGlassToggleGroupRoot,
  },
};
</script>
    `),
    'demo-liquid-glass-toggle-group-disabled': formatCode(`
<template>
  <div class="flex flex-col items-center gap-4">
    <LiquidGlassToggleGroupRoot material="opaque" :defaultValue="['day']">
      <LiquidGlassToggleGroupItem value="day">Day</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="week">Week</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="month">Month</LiquidGlassToggleGroupItem>
    </LiquidGlassToggleGroupRoot>
    <LiquidGlassToggleGroupRoot :disabled="true" :defaultValue="['day']">
      <LiquidGlassToggleGroupItem value="day">Day</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="week">Week</LiquidGlassToggleGroupItem>
      <LiquidGlassToggleGroupItem value="month">Month</LiquidGlassToggleGroupItem>
    </LiquidGlassToggleGroupRoot>
  </div>
</template>

<script>
import {
  LiquidGlassToggleGroupItem,
  LiquidGlassToggleGroupRoot,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassToggleGroupItem,
    LiquidGlassToggleGroupRoot,
  },
};
</script>
    `),
  },
};
