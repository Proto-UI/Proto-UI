import type { DemoSpec } from '../../components/PrototypePreviewer/demo-types';

const SERVER_EVENTS = [
  ['09:04:12', 'nginx/1.4', 'Reloaded upstream pool web-east-01 without dropped connections'],
  ['09:05:40', 'worker-02', 'Processed nightly invoice batch (1,284 records completed)'],
  ['09:07:18', 'postgres', 'Checkpoint complete: wrote 412 buffers in 0.84s'],
  ['09:08:55', 'auth-api', 'Rotated session signing key revision #19 cleanly'],
  ['09:10:03', 'cache-01', 'Warm-up finished for catalog index shard 0..7'],
  ['09:11:29', 'mailer', 'Delivered 318 release digest emails via relay-02'],
  ['09:13:10', 'monitor', 'All 12 regional health probes returned HTTP 200 OK'],
  ['09:14:44', 'deploy', 'Promoted build v2.3.2-rc4 to production cluster'],
  ['09:16:02', 'backup', 'Verified incremental archive checksum SHA-256'],
  ['09:17:26', 'audit', 'Exported weekly access summary to operations bucket'],
] as const;

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-80',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-scroll-area-root',
        ref: 'root',
        className: 'h-48 w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-scroll-area-viewport',
            ref: 'scrollViewport',
            children: [
              {
                kind: 'box',
                ref: 'scrollContent',
                className: 'flex w-[500px] flex-col p-3 text-xs leading-5',
                children: [
                  {
                    kind: 'box',
                    className:
                      'mb-2 border-b border-[#e5e5e5] pb-1.5 text-sm font-bold text-[#333]',
                    children: ['Operations Log'],
                  },
                  ...SERVER_EVENTS.map(([time, service, message]) => ({
                    kind: 'box' as const,
                    className:
                      'flex items-baseline gap-2.5 border-b border-[#eee] py-1.5 whitespace-nowrap',
                    children: [
                      {
                        kind: 'box' as const,
                        tag: 'span' as const,
                        className: 'font-mono text-[#666]',
                        children: [time],
                      },
                      {
                        kind: 'box' as const,
                        tag: 'span' as const,
                        className: 'font-bold text-[#005580]',
                        children: [service],
                      },
                      {
                        kind: 'box' as const,
                        tag: 'span' as const,
                        className: 'text-[#333]',
                        children: [message],
                      },
                    ],
                  })),
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-scroll-area-scrollbar',
            ref: 'verticalScrollbar',
            props: { orientation: 'vertical' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-scroll-area-thumb',
                ref: 'verticalThumb',
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-scroll-area-scrollbar',
            ref: 'horizontalScrollbar',
            props: { orientation: 'horizontal' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-scroll-area-thumb',
                ref: 'horizontalThumb',
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
