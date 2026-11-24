import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const DEPLOYMENTS = [
  ['iad1', 'US East (Virginia)', 'v1.2.0-beta.50', '18 ms', 'Healthy'],
  ['sfo1', 'US West (San Francisco)', 'v1.2.0-beta.50', '24 ms', 'Healthy'],
  ['fra1', 'EU Central (Frankfurt)', 'v1.2.0-beta.50', '31 ms', 'Healthy'],
  ['lhr1', 'EU West (London)', 'v1.2.0-beta.49', '29 ms', 'Draining'],
  ['sin1', 'Asia Pacific (Singapore)', 'v1.2.0-beta.50', '42 ms', 'Healthy'],
  ['hnd1', 'Asia East (Tokyo)', 'v1.2.0-beta.50', '38 ms', 'Healthy'],
  ['syd1', 'Oceania (Sydney)', 'v1.2.0-beta.50', '51 ms', 'Healthy'],
  ['gru1', 'South America (Sao Paulo)', 'v1.2.0-beta.49', '64 ms', 'Syncing'],
  ['arn1', 'EU North (Stockholm)', 'v1.2.0-beta.50', '35 ms', 'Healthy'],
  ['bom1', 'Asia South (Mumbai)', 'v1.2.0-beta.50', '47 ms', 'Healthy'],
] as const;

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-96',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-scroll-area-root',
        className: 'h-56 w-full rounded-md border bg-background',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-scroll-area-viewport',
            ref: 'scrollViewport',
            children: [
              {
                kind: 'box',
                className: 'flex w-[540px] flex-col p-4 text-xs',
                children: [
                  {
                    kind: 'box',
                    className:
                      'grid grid-cols-5 gap-3 border-b pb-2 font-medium text-muted-foreground',
                    children: [
                      { kind: 'box', children: ['Region'] },
                      { kind: 'box', children: ['Location'] },
                      { kind: 'box', children: ['Build'] },
                      { kind: 'box', children: ['Latency'] },
                      { kind: 'box', children: ['Status'] },
                    ],
                  },
                  ...DEPLOYMENTS.map(([code, location, build, latency, status]) => ({
                    kind: 'box' as const,
                    className: 'grid grid-cols-5 gap-3 border-b py-2 whitespace-nowrap',
                    children: [
                      {
                        kind: 'box' as const,
                        className: 'font-mono font-medium',
                        children: [code],
                      },
                      { kind: 'box' as const, children: [location] },
                      {
                        kind: 'box' as const,
                        className: 'font-mono text-muted-foreground',
                        children: [build],
                      },
                      { kind: 'box' as const, className: 'tabular-nums', children: [latency] },
                      { kind: 'box' as const, className: 'font-medium', children: [status] },
                    ],
                  })),
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-scroll-area-scrollbar',
            ref: 'verticalScrollbar',
            props: { orientation: 'vertical' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-scroll-area-thumb',
                ref: 'verticalThumb',
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-scroll-area-scrollbar',
            ref: 'horizontalScrollbar',
            props: { orientation: 'horizontal' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-scroll-area-thumb',
                ref: 'horizontalThumb',
              },
            ],
          },
        ],
      },
    ],
  },
});
