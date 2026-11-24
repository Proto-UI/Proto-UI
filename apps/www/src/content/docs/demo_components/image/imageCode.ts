import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-image': formatCode(`
<div class="flex max-w-md flex-col gap-3">
  <div class="overflow-hidden rounded-xl border border-border bg-muted">
    <wc-shadcn-image-root
      style-profile="rhea"
      source="/images/base-image/landscape.svg"
      a11y-mode="informative"
      alternative-text="Mountain ridge bathed in morning sunlight"
      fit="cover"
      radius="default"
      style="width: 100%; height: 220px;"
    ></wc-shadcn-image-root>
  </div>
  <div class="flex items-center justify-between gap-2">
    <span class="text-sm text-muted-foreground">Mountain Ridge — 16:9 Landscape</span>
    <div class="flex gap-2">
      <wc-shadcn-button style-profile="rhea" size="sm" variant="outline">Landscape</wc-shadcn-button>
      <wc-shadcn-button style-profile="rhea" size="sm" variant="outline">Portrait</wc-shadcn-button>
    </div>
  </div>
</div>
    `),
    'demo-shadcn-image-fit': formatCode(`
<div class="grid max-w-2xl grid-cols-3 gap-4">
  <wc-shadcn-image-root style-profile="rhea" source="/images/base-image/landscape.svg" alternative-text="Mountain ridge (contain)" fit="contain" radius="lg"></wc-shadcn-image-root>
  <wc-shadcn-image-root style-profile="rhea" source="/images/base-image/landscape.svg" alternative-text="Mountain ridge (cover)" fit="cover" radius="lg"></wc-shadcn-image-root>
  <wc-shadcn-image-root style-profile="rhea" source="/images/base-image/landscape.svg" alternative-text="Mountain ridge (fill)" fit="fill" radius="lg"></wc-shadcn-image-root>
</div>
    `),
    'demo-shadcn-image-radius': formatCode(`
<div class="grid max-w-2xl grid-cols-4 gap-4">
  <wc-shadcn-image-root style-profile="rhea" source="/images/base-image/portrait.svg" alternative-text="No rounding" fit="cover" radius="none"></wc-shadcn-image-root>
  <wc-shadcn-image-root style-profile="rhea" source="/images/base-image/portrait.svg" alternative-text="Medium radius" fit="cover" radius="md"></wc-shadcn-image-root>
  <wc-shadcn-image-root style-profile="rhea" source="/images/base-image/portrait.svg" alternative-text="Rhea default radius" fit="cover" radius="default"></wc-shadcn-image-root>
  <wc-shadcn-image-root style-profile="rhea" source="/images/base-image/portrait.svg" alternative-text="Circular crop" fit="cover" radius="full"></wc-shadcn-image-root>
</div>
    `),
    'demo-shadcn-image-a11y': formatCode(`
<div class="flex max-w-xl flex-col gap-4">
  <wc-shadcn-image-root
    style-profile="rhea"
    source="/images/base-image/landscape.svg"
    a11y-mode="informative"
    alternative-text="Sunlit mountain ridge overlooking a calm alpine valley"
    fit="cover"
    radius="lg"
  ></wc-shadcn-image-root>
  <div class="flex items-center gap-3">
    <wc-shadcn-image-root
      style-profile="rhea"
      source="/images/base-image/portrait.svg"
      a11y-mode="decorative"
      fit="cover"
      radius="md"
    ></wc-shadcn-image-root>
    <span>Alpine Field Notes</span>
  </div>
</div>
    `),
    'demo-shadcn-image-loading': formatCode(`
<div class="flex max-w-lg flex-col gap-4">
  <wc-shadcn-image-root
    id="status-image"
    style-profile="rhea"
    source="/images/base-image/landscape.svg"
    a11y-mode="informative"
    alternative-text="Selected landscape scene"
    fit="cover"
  ></wc-shadcn-image-root>
  <div class="flex flex-wrap gap-2">
    <wc-shadcn-button style-profile="rhea" size="sm">Landscape</wc-shadcn-button>
    <wc-shadcn-button style-profile="rhea" size="sm" variant="outline">Portrait</wc-shadcn-button>
    <wc-shadcn-button style-profile="rhea" size="sm" variant="destructive">Broken URL</wc-shadcn-button>
    <wc-shadcn-button style-profile="rhea" size="sm" variant="outline">Clear</wc-shadcn-button>
  </div>
</div>
    `),
    'demo-brutalist-image': formatCode(`
<div class="flex max-w-xl flex-col gap-4">
  <wc-brutalist-image-root
    source="/images/base-image/landscape.svg"
    a11y-mode="informative"
    alternative-text="Sunlit mountain ridge illustration"
    fit="cover"
  ></wc-brutalist-image-root>
</div>
    `),
    'demo-brutalist-image-fit': formatCode(`
<div class="grid max-w-2xl grid-cols-3 gap-4">
  <wc-brutalist-image-root source="/images/base-image/landscape.svg" alternative-text="Mountain ridge (contain)" fit="contain"></wc-brutalist-image-root>
  <wc-brutalist-image-root source="/images/base-image/landscape.svg" alternative-text="Mountain ridge (cover)" fit="cover"></wc-brutalist-image-root>
  <wc-brutalist-image-root source="/images/base-image/landscape.svg" alternative-text="Mountain ridge (fill)" fit="fill"></wc-brutalist-image-root>
</div>
    `),
    'demo-brutalist-image-card': formatCode(`
<figure class="flex max-w-xl flex-col gap-3">
  <wc-brutalist-image-root
    source="/images/base-image/landscape.svg"
    a11y-mode="informative"
    alternative-text="Mountain ridge bathed in daylight"
    fit="cover"
  ></wc-brutalist-image-root>
  <figcaption>Field Edition #04 — High-contrast framed photo surface</figcaption>
</figure>
    `),
    'demo-brutalist-image-loading': formatCode(`
<div class="flex max-w-lg flex-col gap-4">
  <wc-brutalist-image-root
    source="/images/base-image/landscape.svg"
    a11y-mode="informative"
    alternative-text="Selected landscape scene"
    fit="cover"
  ></wc-brutalist-image-root>
  <div class="flex flex-wrap gap-2">
    <wc-brutalist-button size="sm">Landscape</wc-brutalist-button>
    <wc-brutalist-button size="sm" variant="neutral">Portrait</wc-brutalist-button>
    <wc-brutalist-button size="sm" variant="coral">Broken URL</wc-brutalist-button>
  </div>
</div>
    `),
    'demo-bootstrap-2-3-2-image': formatCode(`
<div class="grid max-w-2xl grid-cols-4 gap-4">
  <wc-bootstrap-2-3-2-image-root source="/images/base-image/portrait.svg" alternative-text="Default image" fit="cover" appearance="default"></wc-bootstrap-2-3-2-image-root>
  <wc-bootstrap-2-3-2-image-root source="/images/base-image/portrait.svg" alternative-text="Rounded image" fit="cover" appearance="rounded"></wc-bootstrap-2-3-2-image-root>
  <wc-bootstrap-2-3-2-image-root source="/images/base-image/portrait.svg" alternative-text="Polaroid image" fit="cover" appearance="polaroid"></wc-bootstrap-2-3-2-image-root>
  <wc-bootstrap-2-3-2-image-root source="/images/base-image/portrait.svg" alternative-text="Circle image" fit="cover" appearance="circle"></wc-bootstrap-2-3-2-image-root>
</div>
    `),
    'demo-bootstrap-2-3-2-image-fit': formatCode(`
<div class="grid max-w-2xl grid-cols-3 gap-4">
  <wc-bootstrap-2-3-2-image-root source="/images/base-image/landscape.svg" alternative-text="Mountain ridge (contain)" fit="contain" appearance="rounded"></wc-bootstrap-2-3-2-image-root>
  <wc-bootstrap-2-3-2-image-root source="/images/base-image/landscape.svg" alternative-text="Mountain ridge (cover)" fit="cover" appearance="rounded"></wc-bootstrap-2-3-2-image-root>
  <wc-bootstrap-2-3-2-image-root source="/images/base-image/landscape.svg" alternative-text="Mountain ridge (fill)" fit="fill" appearance="rounded"></wc-bootstrap-2-3-2-image-root>
</div>
    `),
    'demo-bootstrap-2-3-2-image-a11y': formatCode(`
<div class="flex max-w-xl flex-col gap-4">
  <wc-bootstrap-2-3-2-image-root source="/images/base-image/landscape.svg" a11y-mode="informative" alternative-text="Sunlit mountain ridge" fit="cover" appearance="polaroid"></wc-bootstrap-2-3-2-image-root>
  <wc-bootstrap-2-3-2-image-root source="/images/base-image/portrait.svg" a11y-mode="decorative" fit="cover" appearance="circle"></wc-bootstrap-2-3-2-image-root>
</div>
    `),
    'demo-bootstrap-2-3-2-image-loading': formatCode(`
<div class="flex max-w-lg flex-col gap-4">
  <wc-bootstrap-2-3-2-image-root source="/images/base-image/landscape.svg" a11y-mode="informative" alternative-text="Selected landscape scene" fit="cover" appearance="polaroid"></wc-bootstrap-2-3-2-image-root>
  <div class="flex flex-wrap gap-2">
    <wc-bootstrap-2-3-2-button variant="primary" size="small">Landscape</wc-bootstrap-2-3-2-button>
    <wc-bootstrap-2-3-2-button variant="default" size="small">Portrait</wc-bootstrap-2-3-2-button>
    <wc-bootstrap-2-3-2-button variant="danger" size="small">Broken URL</wc-bootstrap-2-3-2-button>
  </div>
</div>
    `),
    'demo-liquid-glass-image': formatCode(`
<div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <div class="relative overflow-hidden rounded-xl">
    <wc-liquid-glass-image-root
      source="/images/base-image/landscape.svg"
      a11y-mode="informative"
      alternative-text="Alpine ridge landscape"
      fit="cover"
      radius="xl"
    ></wc-liquid-glass-image-root>
    <div class="absolute inset-x-0 bottom-0 flex justify-end gap-2 p-3">
      <wc-liquid-glass-button variant="regular">Switch Photo</wc-liquid-glass-button>
      <wc-liquid-glass-button variant="prominent">Featured</wc-liquid-glass-button>
    </div>
  </div>
</div>
    `),
    'demo-liquid-glass-image-fit': formatCode(`
<div class="grid max-w-2xl grid-cols-3 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <wc-liquid-glass-image-root source="/images/base-image/landscape.svg" alternative-text="Mountain ridge (contain)" fit="contain" radius="lg"></wc-liquid-glass-image-root>
  <wc-liquid-glass-image-root source="/images/base-image/landscape.svg" alternative-text="Mountain ridge (cover)" fit="cover" radius="lg"></wc-liquid-glass-image-root>
  <wc-liquid-glass-image-root source="/images/base-image/landscape.svg" alternative-text="Mountain ridge (fill)" fit="fill" radius="lg"></wc-liquid-glass-image-root>
</div>
    `),
    'demo-liquid-glass-image-a11y': formatCode(`
<div class="flex max-w-xl flex-col gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <wc-liquid-glass-image-root source="/images/base-image/landscape.svg" a11y-mode="informative" alternative-text="Sunlit mountain ridge" fit="cover" radius="lg"></wc-liquid-glass-image-root>
  <wc-liquid-glass-image-root source="/images/base-image/portrait.svg" a11y-mode="decorative" fit="cover" radius="lg"></wc-liquid-glass-image-root>
</div>
    `),
    'demo-liquid-glass-image-loading': formatCode(`
<div class="flex max-w-lg flex-col gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <wc-liquid-glass-image-root source="/images/base-image/landscape.svg" a11y-mode="informative" alternative-text="Selected landscape scene" fit="cover" radius="lg"></wc-liquid-glass-image-root>
  <div class="flex flex-wrap gap-2">
    <wc-liquid-glass-button variant="prominent">Landscape</wc-liquid-glass-button>
    <wc-liquid-glass-button variant="regular">Portrait</wc-liquid-glass-button>
    <wc-liquid-glass-button variant="regular" material="opaque">Broken URL</wc-liquid-glass-button>
  </div>
</div>
    `),
  },
  react: {
    'demo-shadcn-image': formatCode(`
import { useState } from 'react';
import { ShadcnButton, ShadcnImageRoot } from '../proto-ui/components/react';

export function DemoShadcnImage() {
  const [scene, setScene] = useState<'landscape' | 'portrait'>('landscape');
  return (
    <div className="flex max-w-md flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-border bg-muted">
        <ShadcnImageRoot
          styleProfile="rhea"
          source={\`/images/base-image/\${scene}.svg\`}
          a11yMode="informative"
          alternativeText="Mountain ridge bathed in morning sunlight"
          fit="cover"
          radius="default"
          surfaceStyle={{ width: '100%', height: '220px' }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Mountain Ridge — 16:9 Landscape</span>
        <div className="flex gap-2">
          <ShadcnButton styleProfile="rhea" size="sm" variant="outline" onClick={() => setScene('landscape')}>
            Landscape
          </ShadcnButton>
          <ShadcnButton styleProfile="rhea" size="sm" variant="outline" onClick={() => setScene('portrait')}>
            Portrait
          </ShadcnButton>
        </div>
      </div>
    </div>
  );
}
    `),
    'demo-shadcn-image-fit': formatCode(`
import { ShadcnImageRoot } from '../proto-ui/components/react';

export function DemoShadcnImageFit() {
  return (
    <div className="grid max-w-2xl grid-cols-3 gap-4">
      {(['contain', 'cover', 'fill'] as const).map((fit) => (
        <ShadcnImageRoot
          key={fit}
          styleProfile="rhea"
          source="/images/base-image/landscape.svg"
          a11yMode="informative"
          alternativeText={\`Mountain ridge (\${fit})\`}
          fit={fit}
          radius="lg"
          surfaceStyle={{ width: '100%', height: '120px' }}
        />
      ))}
    </div>
  );
}
    `),
    'demo-shadcn-image-radius': formatCode(`
import { ShadcnImageRoot } from '../proto-ui/components/react';

export function DemoShadcnImageRadius() {
  return (
    <div className="grid max-w-2xl grid-cols-4 gap-4">
      <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/portrait.svg" alternativeText="No rounding" fit="cover" radius="none" surfaceStyle={{ width: '100%', height: '104px' }} />
      <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/portrait.svg" alternativeText="Medium radius" fit="cover" radius="md" surfaceStyle={{ width: '100%', height: '104px' }} />
      <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/portrait.svg" alternativeText="Rhea default radius" fit="cover" radius="default" surfaceStyle={{ width: '100%', height: '104px' }} />
      <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/portrait.svg" alternativeText="Circular crop" fit="cover" radius="full" surfaceStyle={{ width: '104px', height: '104px' }} />
    </div>
  );
}
    `),
    'demo-shadcn-image-a11y': formatCode(`
import { ShadcnImageRoot } from '../proto-ui/components/react';

export function DemoShadcnImageA11y() {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <ShadcnImageRoot
        styleProfile="rhea"
        source="/images/base-image/landscape.svg"
        a11yMode="informative"
        alternativeText="Sunlit mountain ridge overlooking a calm alpine valley"
        fit="cover"
        radius="lg"
        surfaceStyle={{ width: '100%', height: '160px' }}
      />
      <div className="flex items-center gap-3">
        <ShadcnImageRoot
          styleProfile="rhea"
          source="/images/base-image/portrait.svg"
          a11yMode="decorative"
          fit="cover"
          radius="md"
          surfaceStyle={{ width: '56px', height: '56px' }}
        />
        <span>Alpine Field Notes</span>
      </div>
    </div>
  );
}
    `),
    'demo-shadcn-image-loading': formatCode(`
import { useState } from 'react';
import { ShadcnButton, ShadcnImageRoot } from '../proto-ui/components/react';

export function DemoShadcnImageLoading() {
  const [source, setSource] = useState('/images/base-image/landscape.svg');
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('loaded');

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
        <ShadcnImageRoot
          styleProfile="rhea"
          source={source}
          a11yMode="informative"
          alternativeText="Selected scene"
          fit="cover"
          radius="none"
          surfaceStyle={{ width: '100%', height: '200px' }}
          onLoadingStatusChange={(event) => setStatus(event.status)}
        />
        {status !== 'loaded' && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/95 p-4 text-sm">
            {status === 'error' ? 'Unable to load image.' : 'No image loaded.'}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <ShadcnButton styleProfile="rhea" size="sm" onClick={() => setSource('/images/base-image/landscape.svg')}>Landscape</ShadcnButton>
        <ShadcnButton styleProfile="rhea" size="sm" variant="outline" onClick={() => setSource('/images/base-image/portrait.svg')}>Portrait</ShadcnButton>
        <ShadcnButton styleProfile="rhea" size="sm" variant="destructive" onClick={() => setSource('data:image/png;base64,invalid')}>Broken URL</ShadcnButton>
        <ShadcnButton styleProfile="rhea" size="sm" variant="outline" onClick={() => setSource('')}>Clear</ShadcnButton>
      </div>
    </div>
  );
}
    `),
    'demo-brutalist-image': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { BrutalistImageRoot } from '@proto.ui/prototypes-brutalist/image';

const Image = createReactAdapter(React)(BrutalistImageRoot);

export function DemoBrutalistImage() {
  return (
    <Image
      source="/images/base-image/landscape.svg"
      a11yMode="informative"
      alternativeText="Sunlit mountain ridge illustration"
      fit="cover"
      surfaceStyle={{ width: '100%', height: '200px' }}
    />
  );
}
    `),
    'demo-brutalist-image-fit': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { BrutalistImageRoot } from '@proto.ui/prototypes-brutalist/image';

const Image = createReactAdapter(React)(BrutalistImageRoot);

export function DemoBrutalistImageFit() {
  return (
    <div className="grid max-w-2xl grid-cols-3 gap-4">
      {(['contain', 'cover', 'fill'] as const).map((fit) => (
        <Image
          key={fit}
          source="/images/base-image/landscape.svg"
          alternativeText={\`Mountain ridge (\${fit})\`}
          fit={fit}
          surfaceStyle={{ width: '100%', height: '120px' }}
        />
      ))}
    </div>
  );
}
    `),
    'demo-brutalist-image-card': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { BrutalistImageRoot } from '@proto.ui/prototypes-brutalist/image';

const Image = createReactAdapter(React)(BrutalistImageRoot);

export function DemoBrutalistImageCard() {
  return (
    <figure className="flex max-w-xl flex-col gap-3">
      <Image
        source="/images/base-image/landscape.svg"
        a11yMode="informative"
        alternativeText="Mountain ridge bathed in daylight"
        fit="cover"
        surfaceStyle={{ width: '100%', height: '180px' }}
      />
      <figcaption>Field Edition #04 — High-contrast framed photo surface</figcaption>
    </figure>
  );
}
    `),
    'demo-brutalist-image-loading': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { BrutalistImageRoot } from '@proto.ui/prototypes-brutalist/image';

const Image = createReactAdapter(React)(BrutalistImageRoot);

export function DemoBrutalistImageLoading() {
  const [source, setSource] = React.useState('/images/base-image/landscape.svg');
  const [status, setStatus] = React.useState('loaded');

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <Image
        source={source}
        a11yMode="informative"
        alternativeText="Selected scene"
        fit="cover"
        surfaceStyle={{ width: '100%', height: '200px' }}
        onLoadingStatusChange={(event) => setStatus(event.status)}
      />
      <p role="status">Status: {status}</p>
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-image': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { bootstrap232ImageRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/image';

const BootstrapImage = createReactAdapter(React)(bootstrap232ImageRoot);

export function DemoBootstrapImage() {
  return (
    <div className="grid max-w-2xl grid-cols-4 gap-4">
      <BootstrapImage source="/images/base-image/portrait.svg" alternativeText="Default" fit="cover" appearance="default" surfaceStyle={{ width: '100%', height: '112px' }} />
      <BootstrapImage source="/images/base-image/portrait.svg" alternativeText="Rounded" fit="cover" appearance="rounded" surfaceStyle={{ width: '100%', height: '112px' }} />
      <BootstrapImage source="/images/base-image/portrait.svg" alternativeText="Polaroid" fit="cover" appearance="polaroid" surfaceStyle={{ width: '100%', height: '112px' }} />
      <BootstrapImage source="/images/base-image/portrait.svg" alternativeText="Circle" fit="cover" appearance="circle" surfaceStyle={{ width: '112px', height: '112px' }} />
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-image-fit': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { bootstrap232ImageRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/image';

const BootstrapImage = createReactAdapter(React)(bootstrap232ImageRoot);

export function DemoBootstrapImageFit() {
  return (
    <div className="grid max-w-2xl grid-cols-3 gap-4">
      {(['contain', 'cover', 'fill'] as const).map((fit) => (
        <BootstrapImage
          key={fit}
          source="/images/base-image/landscape.svg"
          alternativeText={\`Mountain ridge (\${fit})\`}
          fit={fit}
          appearance="rounded"
          surfaceStyle={{ width: '100%', height: '120px' }}
        />
      ))}
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-image-a11y': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { bootstrap232ImageRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/image';

const BootstrapImage = createReactAdapter(React)(bootstrap232ImageRoot);

export function DemoBootstrapImageA11y() {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <BootstrapImage source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Sunlit mountain ridge" fit="cover" appearance="polaroid" surfaceStyle={{ width: '100%', height: '160px' }} />
      <BootstrapImage source="/images/base-image/portrait.svg" a11yMode="decorative" fit="cover" appearance="circle" surfaceStyle={{ width: '56px', height: '56px' }} />
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-image-loading': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { bootstrap232ImageRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/image';

const BootstrapImage = createReactAdapter(React)(bootstrap232ImageRoot);

export function DemoBootstrapImageLoading() {
  const [status, setStatus] = React.useState('loaded');
  return (
    <div className="flex max-w-lg flex-col gap-4">
      <BootstrapImage
        source="/images/base-image/landscape.svg"
        a11yMode="informative"
        alternativeText="Selected landscape scene"
        fit="cover"
        appearance="polaroid"
        surfaceStyle={{ width: '100%', height: '200px' }}
        onLoadingStatusChange={(event) => setStatus(event.status)}
      />
      <p role="status">Status: {status}</p>
    </div>
  );
}
    `),
    'demo-liquid-glass-image': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { liquidGlassImageRoot } from '@proto.ui/prototypes-liquid-glass/image';
import { liquidGlassButton } from '@proto.ui/prototypes-liquid-glass/button';

const adapt = createReactAdapter(React);
const GlassImage = adapt(liquidGlassImageRoot);
const GlassButton = adapt(liquidGlassButton);

export function DemoLiquidGlassImage() {
  const [source, setSource] = React.useState('/images/base-image/landscape.svg');
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <div className="relative overflow-hidden rounded-xl">
        <GlassImage
          source={source}
          a11yMode="informative"
          alternativeText="Alpine ridge landscape"
          fit="cover"
          radius="xl"
          surfaceStyle={{ width: '100%', height: '240px' }}
        />
        <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 p-3">
          <GlassButton variant="regular" onClick={() => setSource('/images/base-image/portrait.svg')}>
            Switch Photo
          </GlassButton>
          <GlassButton variant="prominent" onClick={() => setSource('/images/base-image/landscape.svg')}>
            Featured
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
    `),
    'demo-liquid-glass-image-fit': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { liquidGlassImageRoot } from '@proto.ui/prototypes-liquid-glass/image';

const GlassImage = createReactAdapter(React)(liquidGlassImageRoot);

export function DemoLiquidGlassImageFit() {
  return (
    <div className="grid max-w-2xl grid-cols-3 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      {(['contain', 'cover', 'fill'] as const).map((fit) => (
        <GlassImage
          key={fit}
          source="/images/base-image/landscape.svg"
          alternativeText={\`Mountain ridge (\${fit})\`}
          fit={fit}
          radius="lg"
          surfaceStyle={{ width: '100%', height: '120px' }}
        />
      ))}
    </div>
  );
}
    `),
    'demo-liquid-glass-image-a11y': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { liquidGlassImageRoot } from '@proto.ui/prototypes-liquid-glass/image';

const GlassImage = createReactAdapter(React)(liquidGlassImageRoot);

export function DemoLiquidGlassImageA11y() {
  return (
    <div className="flex max-w-xl flex-col gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <GlassImage source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Sunlit mountain ridge" fit="cover" radius="lg" surfaceStyle={{ width: '100%', height: '160px' }} />
      <GlassImage source="/images/base-image/portrait.svg" a11yMode="decorative" fit="cover" radius="lg" surfaceStyle={{ width: '56px', height: '56px' }} />
    </div>
  );
}
    `),
    'demo-liquid-glass-image-loading': formatCode(`
import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { liquidGlassImageRoot } from '@proto.ui/prototypes-liquid-glass/image';

const GlassImage = createReactAdapter(React)(liquidGlassImageRoot);

export function DemoLiquidGlassImageLoading() {
  const [status, setStatus] = React.useState('loaded');
  return (
    <div className="flex max-w-lg flex-col gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <GlassImage
        source="/images/base-image/landscape.svg"
        a11yMode="informative"
        alternativeText="Selected landscape scene"
        fit="cover"
        radius="lg"
        surfaceStyle={{ width: '100%', height: '200px' }}
        onLoadingStatusChange={(event) => setStatus(event.status)}
      />
      <p role="status">Status: {status}</p>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-image': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ShadcnButton, ShadcnImageRoot } from '../proto-ui/components/vue';

const scene = ref<'landscape' | 'portrait'>('landscape');
</script>

<template>
  <div class="flex max-w-md flex-col gap-3">
    <div class="overflow-hidden rounded-xl border border-border bg-muted">
      <ShadcnImageRoot
        styleProfile="rhea"
        :source="\`/images/base-image/\${scene}.svg\`"
        a11yMode="informative"
        alternativeText="Mountain ridge bathed in morning sunlight"
        fit="cover"
        radius="default"
      />
    </div>
    <div class="flex items-center justify-between gap-2">
      <span class="text-sm text-muted-foreground">Mountain Ridge — 16:9 Landscape</span>
      <div class="flex gap-2">
        <ShadcnButton styleProfile="rhea" size="sm" variant="outline" @click="scene = 'landscape'">Landscape</ShadcnButton>
        <ShadcnButton styleProfile="rhea" size="sm" variant="outline" @click="scene = 'portrait'">Portrait</ShadcnButton>
      </div>
    </div>
  </div>
</template>
    `),
    'demo-shadcn-image-fit': formatCode(`
<script setup lang="ts">
import { ShadcnImageRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid max-w-2xl grid-cols-3 gap-4">
    <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (contain)" fit="contain" radius="lg" />
    <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (cover)" fit="cover" radius="lg" />
    <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (fill)" fit="fill" radius="lg" />
  </div>
</template>
    `),
    'demo-shadcn-image-radius': formatCode(`
<script setup lang="ts">
import { ShadcnImageRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid max-w-2xl grid-cols-4 gap-4">
    <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/portrait.svg" alternativeText="No rounding" fit="cover" radius="none" />
    <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/portrait.svg" alternativeText="Medium radius" fit="cover" radius="md" />
    <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/portrait.svg" alternativeText="Rhea default radius" fit="cover" radius="default" />
    <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/portrait.svg" alternativeText="Circular crop" fit="cover" radius="full" />
  </div>
</template>
    `),
    'demo-shadcn-image-a11y': formatCode(`
<script setup lang="ts">
import { ShadcnImageRoot } from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex max-w-xl flex-col gap-4">
    <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Sunlit mountain ridge overlooking a calm alpine valley" fit="cover" radius="lg" />
    <div class="flex items-center gap-3">
      <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/portrait.svg" a11yMode="decorative" fit="cover" radius="md" />
      <span>Alpine Field Notes</span>
    </div>
  </div>
</template>
    `),
    'demo-shadcn-image-loading': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import { ShadcnButton, ShadcnImageRoot } from '../proto-ui/components/vue';

const source = ref('/images/base-image/landscape.svg');
const status = ref('loaded');
</script>

<template>
  <div class="flex max-w-lg flex-col gap-4">
    <ShadcnImageRoot
      styleProfile="rhea"
      :source="source"
      a11yMode="informative"
      alternativeText="Selected scene"
      fit="cover"
      @loadingStatusChange="(event) => (status = event.status)"
    />
    <div class="flex flex-wrap gap-2">
      <ShadcnButton styleProfile="rhea" size="sm" @click="source = '/images/base-image/landscape.svg'">Landscape</ShadcnButton>
      <ShadcnButton styleProfile="rhea" size="sm" variant="outline" @click="source = '/images/base-image/portrait.svg'">Portrait</ShadcnButton>
      <ShadcnButton styleProfile="rhea" size="sm" variant="destructive" @click="source = 'data:image/png;base64,invalid'">Broken URL</ShadcnButton>
      <ShadcnButton styleProfile="rhea" size="sm" variant="outline" @click="source = ''">Clear</ShadcnButton>
    </div>
    <p role="status">Status: {{ status }}</p>
  </div>
</template>
    `),
    'demo-brutalist-image': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { BrutalistImageRoot } from '@proto.ui/prototypes-brutalist/image';

const BrutalistImage = createVueAdapter(Vue)(BrutalistImageRoot);
</script>

<template>
  <BrutalistImage source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Sunlit mountain ridge illustration" fit="cover" />
</template>
    `),
    'demo-brutalist-image-fit': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { BrutalistImageRoot } from '@proto.ui/prototypes-brutalist/image';

const BrutalistImage = createVueAdapter(Vue)(BrutalistImageRoot);
</script>

<template>
  <div class="grid max-w-2xl grid-cols-3 gap-4">
    <BrutalistImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (contain)" fit="contain" />
    <BrutalistImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (cover)" fit="cover" />
    <BrutalistImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (fill)" fit="fill" />
  </div>
</template>
    `),
    'demo-brutalist-image-card': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { BrutalistImageRoot } from '@proto.ui/prototypes-brutalist/image';

const BrutalistImage = createVueAdapter(Vue)(BrutalistImageRoot);
</script>

<template>
  <figure class="flex max-w-xl flex-col gap-3">
    <BrutalistImage source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Mountain ridge bathed in daylight" fit="cover" />
    <figcaption>Field Edition #04 — High-contrast framed photo surface</figcaption>
  </figure>
</template>
    `),
    'demo-brutalist-image-loading': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { ref } from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { BrutalistImageRoot } from '@proto.ui/prototypes-brutalist/image';

const BrutalistImage = createVueAdapter(Vue)(BrutalistImageRoot);
const status = ref('loaded');
</script>

<template>
  <div class="flex max-w-lg flex-col gap-4">
    <BrutalistImage source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Selected scene" fit="cover" @loadingStatusChange="(event) => (status = event.status)" />
    <p role="status">Status: {{ status }}</p>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-image': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { bootstrap232ImageRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/image';

const BootstrapImage = createVueAdapter(Vue)(bootstrap232ImageRoot);
</script>

<template>
  <div class="grid max-w-2xl grid-cols-4 gap-4">
    <BootstrapImage source="/images/base-image/portrait.svg" alternativeText="Default" fit="cover" appearance="default" />
    <BootstrapImage source="/images/base-image/portrait.svg" alternativeText="Rounded" fit="cover" appearance="rounded" />
    <BootstrapImage source="/images/base-image/portrait.svg" alternativeText="Polaroid" fit="cover" appearance="polaroid" />
    <BootstrapImage source="/images/base-image/portrait.svg" alternativeText="Circle" fit="cover" appearance="circle" />
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-image-fit': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { bootstrap232ImageRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/image';

const BootstrapImage = createVueAdapter(Vue)(bootstrap232ImageRoot);
</script>

<template>
  <div class="grid max-w-2xl grid-cols-3 gap-4">
    <BootstrapImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (contain)" fit="contain" appearance="rounded" />
    <BootstrapImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (cover)" fit="cover" appearance="rounded" />
    <BootstrapImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (fill)" fit="fill" appearance="rounded" />
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-image-a11y': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { bootstrap232ImageRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/image';

const BootstrapImage = createVueAdapter(Vue)(bootstrap232ImageRoot);
</script>

<template>
  <div class="flex max-w-xl flex-col gap-4">
    <BootstrapImage source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Sunlit mountain ridge" fit="cover" appearance="polaroid" />
    <BootstrapImage source="/images/base-image/portrait.svg" a11yMode="decorative" fit="cover" appearance="circle" />
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-image-loading': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { ref } from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { bootstrap232ImageRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/image';

const BootstrapImage = createVueAdapter(Vue)(bootstrap232ImageRoot);
const status = ref('loaded');
</script>

<template>
  <div class="flex max-w-lg flex-col gap-4">
    <BootstrapImage source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Selected scene" fit="cover" appearance="polaroid" @loadingStatusChange="(event) => (status = event.status)" />
    <p role="status">Status: {{ status }}</p>
  </div>
</template>
    `),
    'demo-liquid-glass-image': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { ref } from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { liquidGlassImageRoot } from '@proto.ui/prototypes-liquid-glass/image';
import { liquidGlassButton } from '@proto.ui/prototypes-liquid-glass/button';

const adapt = createVueAdapter(Vue);
const GlassImage = adapt(liquidGlassImageRoot);
const GlassButton = adapt(liquidGlassButton);
const source = ref('/images/base-image/landscape.svg');
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <div class="relative overflow-hidden rounded-xl">
      <GlassImage :source="source" a11yMode="informative" alternativeText="Alpine ridge landscape" fit="cover" radius="xl" />
      <div class="absolute inset-x-0 bottom-0 flex justify-end gap-2 p-3">
        <GlassButton variant="regular" @click="source = '/images/base-image/portrait.svg'">Switch Photo</GlassButton>
        <GlassButton variant="prominent" @click="source = '/images/base-image/landscape.svg'">Featured</GlassButton>
      </div>
    </div>
  </div>
</template>
    `),
    'demo-liquid-glass-image-fit': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { liquidGlassImageRoot } from '@proto.ui/prototypes-liquid-glass/image';

const GlassImage = createVueAdapter(Vue)(liquidGlassImageRoot);
</script>

<template>
  <div class="grid max-w-2xl grid-cols-3 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <GlassImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (contain)" fit="contain" radius="lg" />
    <GlassImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (cover)" fit="cover" radius="lg" />
    <GlassImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (fill)" fit="fill" radius="lg" />
  </div>
</template>
    `),
    'demo-liquid-glass-image-a11y': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { liquidGlassImageRoot } from '@proto.ui/prototypes-liquid-glass/image';

const GlassImage = createVueAdapter(Vue)(liquidGlassImageRoot);
</script>

<template>
  <div class="flex max-w-xl flex-col gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <GlassImage source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Sunlit mountain ridge" fit="cover" radius="lg" />
    <GlassImage source="/images/base-image/portrait.svg" a11yMode="decorative" fit="cover" radius="lg" />
  </div>
</template>
    `),
    'demo-liquid-glass-image-loading': formatCode(`
<script setup lang="ts">
import * as Vue from 'vue';
import { ref } from 'vue';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { liquidGlassImageRoot } from '@proto.ui/prototypes-liquid-glass/image';

const GlassImage = createVueAdapter(Vue)(liquidGlassImageRoot);
const status = ref('loaded');
</script>

<template>
  <div class="flex max-w-lg flex-col gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <GlassImage source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Selected scene" fit="cover" radius="lg" @loadingStatusChange="(event) => (status = event.status)" />
    <p role="status">Status: {{ status }}</p>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-image': formatCode(`
<template>
  <div class="flex max-w-md flex-col gap-3">
    <div class="overflow-hidden rounded-xl border border-border bg-muted">
      <ShadcnImageRoot
        styleProfile="rhea"
        :source="source"
        a11yMode="informative"
        alternativeText="Mountain ridge bathed in morning sunlight"
        fit="cover"
        radius="default"
      />
    </div>
    <div class="flex items-center justify-between gap-2">
      <span class="text-sm text-muted-foreground">Mountain Ridge — 16:9 Landscape</span>
      <div class="flex gap-2">
        <ShadcnButton styleProfile="rhea" size="sm" variant="outline" @click="source = '/images/base-image/landscape.svg'">Landscape</ShadcnButton>
        <ShadcnButton styleProfile="rhea" size="sm" variant="outline" @click="source = '/images/base-image/portrait.svg'">Portrait</ShadcnButton>
      </div>
    </div>
  </div>
</template>

<script>
import { ShadcnButton, ShadcnImageRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnButton, ShadcnImageRoot },
  data() {
    return { source: '/images/base-image/landscape.svg' };
  },
};
</script>
    `),
    'demo-shadcn-image-fit': formatCode(`
<template>
  <div class="grid max-w-2xl grid-cols-3 gap-4">
    <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (contain)" fit="contain" radius="lg" />
    <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (cover)" fit="cover" radius="lg" />
    <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (fill)" fit="fill" radius="lg" />
  </div>
</template>

<script>
import { ShadcnImageRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnImageRoot },
};
</script>
    `),
    'demo-shadcn-image-radius': formatCode(`
<template>
  <div class="grid max-w-2xl grid-cols-4 gap-4">
    <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/portrait.svg" alternativeText="No rounding" fit="cover" radius="none" />
    <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/portrait.svg" alternativeText="Medium radius" fit="cover" radius="md" />
    <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/portrait.svg" alternativeText="Rhea default radius" fit="cover" radius="default" />
    <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/portrait.svg" alternativeText="Circular crop" fit="cover" radius="full" />
  </div>
</template>

<script>
import { ShadcnImageRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnImageRoot },
};
</script>
    `),
    'demo-shadcn-image-a11y': formatCode(`
<template>
  <div class="flex max-w-xl flex-col gap-4">
    <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Sunlit mountain ridge overlooking a calm alpine valley" fit="cover" radius="lg" />
    <div class="flex items-center gap-3">
      <ShadcnImageRoot styleProfile="rhea" source="/images/base-image/portrait.svg" a11yMode="decorative" fit="cover" radius="md" />
      <span>Alpine Field Notes</span>
    </div>
  </div>
</template>

<script>
import { ShadcnImageRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnImageRoot },
};
</script>
    `),
    'demo-shadcn-image-loading': formatCode(`
<template>
  <div class="flex max-w-lg flex-col gap-4">
    <ShadcnImageRoot styleProfile="rhea" :source="source" a11yMode="informative" alternativeText="Selected scene" fit="cover" @loadingStatusChange="onStatus" />
    <div class="flex flex-wrap gap-2">
      <ShadcnButton styleProfile="rhea" size="sm" @click="source = '/images/base-image/landscape.svg'">Landscape</ShadcnButton>
      <ShadcnButton styleProfile="rhea" size="sm" variant="outline" @click="source = '/images/base-image/portrait.svg'">Portrait</ShadcnButton>
      <ShadcnButton styleProfile="rhea" size="sm" variant="destructive" @click="source = 'data:image/png;base64,invalid'">Broken URL</ShadcnButton>
      <ShadcnButton styleProfile="rhea" size="sm" variant="outline" @click="source = ''">Clear</ShadcnButton>
    </div>
    <p role="status">Status: {{ status }}</p>
  </div>
</template>

<script>
import { ShadcnButton, ShadcnImageRoot } from '../proto-ui/components/vue2';

export default {
  components: { ShadcnButton, ShadcnImageRoot },
  data() {
    return { source: '/images/base-image/landscape.svg', status: 'loaded' };
  },
  methods: {
    onStatus(event) {
      this.status = event.status;
    },
  },
};
</script>
    `),
    'demo-brutalist-image': formatCode(`
<template>
  <BrutalistImage source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Sunlit mountain ridge illustration" fit="cover" />
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { BrutalistImageRoot } from '@proto.ui/prototypes-brutalist/image';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});
const BrutalistImage = adapt(BrutalistImageRoot);

export default {
  components: { BrutalistImage },
};
</script>
    `),
    'demo-brutalist-image-fit': formatCode(`
<template>
  <div class="grid max-w-2xl grid-cols-3 gap-4">
    <BrutalistImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (contain)" fit="contain" />
    <BrutalistImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (cover)" fit="cover" />
    <BrutalistImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (fill)" fit="fill" />
  </div>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { BrutalistImageRoot } from '@proto.ui/prototypes-brutalist/image';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});
const BrutalistImage = adapt(BrutalistImageRoot);

export default {
  components: { BrutalistImage },
};
</script>
    `),
    'demo-brutalist-image-card': formatCode(`
<template>
  <figure class="flex max-w-xl flex-col gap-3">
    <BrutalistImage source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Mountain ridge bathed in daylight" fit="cover" />
    <figcaption>Field Edition #04 — High-contrast framed photo surface</figcaption>
  </figure>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { BrutalistImageRoot } from '@proto.ui/prototypes-brutalist/image';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});
const BrutalistImage = adapt(BrutalistImageRoot);

export default {
  components: { BrutalistImage },
};
</script>
    `),
    'demo-brutalist-image-loading': formatCode(`
<template>
  <div class="flex max-w-lg flex-col gap-4">
    <BrutalistImage source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Selected scene" fit="cover" @loadingStatusChange="onStatus" />
    <p role="status">Status: {{ status }}</p>
  </div>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { BrutalistImageRoot } from '@proto.ui/prototypes-brutalist/image';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});
const BrutalistImage = adapt(BrutalistImageRoot);

export default {
  components: { BrutalistImage },
  data() {
    return { status: 'loaded' };
  },
  methods: {
    onStatus(event) {
      this.status = event.status;
    },
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-image': formatCode(`
<template>
  <div class="grid max-w-2xl grid-cols-4 gap-4">
    <BootstrapImage source="/images/base-image/portrait.svg" alternativeText="Default" fit="cover" appearance="default" />
    <BootstrapImage source="/images/base-image/portrait.svg" alternativeText="Rounded" fit="cover" appearance="rounded" />
    <BootstrapImage source="/images/base-image/portrait.svg" alternativeText="Polaroid" fit="cover" appearance="polaroid" />
    <BootstrapImage source="/images/base-image/portrait.svg" alternativeText="Circle" fit="cover" appearance="circle" />
  </div>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { bootstrap232ImageRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/image';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});
const BootstrapImage = adapt(bootstrap232ImageRoot);

export default {
  components: { BootstrapImage },
};
</script>
    `),
    'demo-bootstrap-2-3-2-image-fit': formatCode(`
<template>
  <div class="grid max-w-2xl grid-cols-3 gap-4">
    <BootstrapImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (contain)" fit="contain" appearance="rounded" />
    <BootstrapImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (cover)" fit="cover" appearance="rounded" />
    <BootstrapImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (fill)" fit="fill" appearance="rounded" />
  </div>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { bootstrap232ImageRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/image';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});
const BootstrapImage = adapt(bootstrap232ImageRoot);

export default {
  components: { BootstrapImage },
};
</script>
    `),
    'demo-bootstrap-2-3-2-image-a11y': formatCode(`
<template>
  <div class="flex max-w-xl flex-col gap-4">
    <BootstrapImage source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Sunlit mountain ridge" fit="cover" appearance="polaroid" />
    <BootstrapImage source="/images/base-image/portrait.svg" a11yMode="decorative" fit="cover" appearance="circle" />
  </div>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { bootstrap232ImageRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/image';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});
const BootstrapImage = adapt(bootstrap232ImageRoot);

export default {
  components: { BootstrapImage },
};
</script>
    `),
    'demo-bootstrap-2-3-2-image-loading': formatCode(`
<template>
  <div class="flex max-w-lg flex-col gap-4">
    <BootstrapImage source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Selected scene" fit="cover" appearance="polaroid" @loadingStatusChange="onStatus" />
    <p role="status">Status: {{ status }}</p>
  </div>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { bootstrap232ImageRoot } from '@proto.ui/prototypes-bootstrap-2-3-2/image';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});
const BootstrapImage = adapt(bootstrap232ImageRoot);

export default {
  components: { BootstrapImage },
  data() {
    return { status: 'loaded' };
  },
  methods: {
    onStatus(event) {
      this.status = event.status;
    },
  },
};
</script>
    `),
    'demo-liquid-glass-image': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <div class="relative overflow-hidden rounded-xl">
      <GlassImage :source="source" a11yMode="informative" alternativeText="Alpine ridge landscape" fit="cover" radius="xl" />
      <div class="absolute inset-x-0 bottom-0 flex justify-end gap-2 p-3">
        <GlassButton variant="regular" @click="source = '/images/base-image/portrait.svg'">Switch Photo</GlassButton>
        <GlassButton variant="prominent" @click="source = '/images/base-image/landscape.svg'">Featured</GlassButton>
      </div>
    </div>
  </div>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { liquidGlassImageRoot } from '@proto.ui/prototypes-liquid-glass/image';
import { liquidGlassButton } from '@proto.ui/prototypes-liquid-glass/button';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});
const GlassImage = adapt(liquidGlassImageRoot);
const GlassButton = adapt(liquidGlassButton);

export default {
  components: { GlassImage, GlassButton },
  data() {
    return { source: '/images/base-image/landscape.svg' };
  },
};
</script>
    `),
    'demo-liquid-glass-image-fit': formatCode(`
<template>
  <div class="grid max-w-2xl grid-cols-3 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <GlassImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (contain)" fit="contain" radius="lg" />
    <GlassImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (cover)" fit="cover" radius="lg" />
    <GlassImage source="/images/base-image/landscape.svg" alternativeText="Mountain ridge (fill)" fit="fill" radius="lg" />
  </div>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { liquidGlassImageRoot } from '@proto.ui/prototypes-liquid-glass/image';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});
const GlassImage = adapt(liquidGlassImageRoot);

export default {
  components: { GlassImage },
};
</script>
    `),
    'demo-liquid-glass-image-a11y': formatCode(`
<template>
  <div class="flex max-w-xl flex-col gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <GlassImage source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Sunlit mountain ridge" fit="cover" radius="lg" />
    <GlassImage source="/images/base-image/portrait.svg" a11yMode="decorative" fit="cover" radius="lg" />
  </div>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { liquidGlassImageRoot } from '@proto.ui/prototypes-liquid-glass/image';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});
const GlassImage = adapt(liquidGlassImageRoot);

export default {
  components: { GlassImage },
};
</script>
    `),
    'demo-liquid-glass-image-loading': formatCode(`
<template>
  <div class="flex max-w-lg flex-col gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <GlassImage source="/images/base-image/landscape.svg" a11yMode="informative" alternativeText="Selected scene" fit="cover" radius="lg" @loadingStatusChange="onStatus" />
    <p role="status">Status: {{ status }}</p>
  </div>
</template>

<script>
import Vue from 'vue';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { liquidGlassImageRoot } from '@proto.ui/prototypes-liquid-glass/image';

const adapt = createVue2Adapter({
  extend: Vue.extend.bind(Vue),
  nextTick: Vue.nextTick.bind(Vue),
  set: Vue.set.bind(Vue),
  delete: Vue.delete.bind(Vue),
});
const GlassImage = adapt(liquidGlassImageRoot);

export default {
  components: { GlassImage },
  data() {
    return { status: 'loaded' };
  },
  methods: {
    onStatus(event) {
      this.status = event.status;
    },
  },
};
</script>
    `),
  },
};
