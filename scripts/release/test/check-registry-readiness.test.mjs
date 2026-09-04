import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkRegistryReadiness,
  parseRegistryReadinessArgs,
} from '../check-registry-readiness.mjs';

test('registry readiness reports public package identities and encodes scoped names', async () => {
  const requested = [];
  const report = await checkRegistryReadiness(['@proto.ui/core', '@proto.ui/hooks'], {
    registry: 'https://registry.example.test/',
    timeoutMs: 1_000,
    fetchImpl: async (url) => {
      requested.push(url.href);
      return response(200, '', publishedReleaseMetadata());
    },
  });

  assert.deepEqual(report, {
    ready: ['@proto.ui/core', '@proto.ui/hooks'],
    missing: [],
    errors: [],
  });
  assert.deepEqual(requested, [
    'https://registry.example.test/%40proto.ui%2Fcore',
    'https://registry.example.test/%40proto.ui%2Fhooks',
  ]);
});

test('registry readiness permits a sole deprecated bootstrap version to retain latest', async () => {
  const report = await checkRegistryReadiness(['@proto.ui/bootstrap'], {
    timeoutMs: 1_000,
    fetchImpl: async () =>
      response(200, '', {
        'dist-tags': { latest: '0.0.0-bootstrap.0' },
        versions: {
          '0.0.0-bootstrap.0': {
            deprecated:
              'Registry identity bootstrap only; use a published Proto UI release version.',
          },
        },
      }),
  });

  assert.deepEqual(report, {
    ready: ['@proto.ui/bootstrap'],
    missing: [],
    errors: [],
  });
});

test('registry readiness rejects forbidden bootstrap registry states', async () => {
  const cases = [
    {
      name: '@proto.ui/bootstrap-tag',
      metadata: {
        'dist-tags': { bootstrap: '0.0.0-bootstrap.0' },
        versions: { '0.0.0-bootstrap.0': { deprecated: 'bootstrap only' } },
      },
      detail: 'bootstrap dist-tag must be removed',
    },
    {
      name: '@proto.ui/bootstrap-next',
      metadata: {
        'dist-tags': { next: '0.0.0-bootstrap.0' },
        versions: { '0.0.0-bootstrap.0': { deprecated: 'bootstrap only' } },
      },
      detail: 'next must not point to bootstrap version 0.0.0-bootstrap.0',
    },
    {
      name: '@proto.ui/bootstrap-latest-not-deprecated',
      metadata: {
        'dist-tags': { latest: '0.0.0-bootstrap.0' },
        versions: { '0.0.0-bootstrap.0': {} },
      },
      detail: 'latest may retain bootstrap version only when it is the sole deprecated version',
    },
    {
      name: '@proto.ui/bootstrap-latest-not-sole',
      metadata: {
        'dist-tags': { latest: '0.0.0-bootstrap.0' },
        versions: {
          '0.0.0-bootstrap.0': { deprecated: 'bootstrap only' },
          '0.3.0-alpha.0': {},
        },
      },
      detail: 'latest may retain bootstrap version only when it is the sole deprecated version',
    },
  ];

  const report = await checkRegistryReadiness(
    cases.map(({ name }) => name),
    {
      timeoutMs: 1_000,
      fetchImpl: async (url) => {
        const current = cases.find(({ name }) => url.href.endsWith(encodeURIComponent(name)));
        return response(200, '', current.metadata);
      },
    }
  );

  assert.deepEqual(report, {
    ready: [],
    missing: [],
    errors: [...cases]
      .sort(({ name: left }, { name: right }) => left.localeCompare(right))
      .map(({ name, detail }) => ({ name, detail })),
  });
});

test('registry readiness fails closed when public registry metadata cannot establish tag state', async () => {
  const report = await checkRegistryReadiness(['@proto.ui/incomplete'], {
    timeoutMs: 1_000,
    fetchImpl: async () => response(200, '', {}),
  });

  assert.deepEqual(report, {
    ready: [],
    missing: [],
    errors: [
      {
        name: '@proto.ui/incomplete',
        detail: 'registry metadata is missing dist-tags or versions',
      },
    ],
  });
});

test('registry readiness distinguishes missing identities from registry failures', async () => {
  const report = await checkRegistryReadiness(
    ['@proto.ui/ready', '@proto.ui/missing', '@proto.ui/unavailable'],
    {
      timeoutMs: 1_000,
      fetchImpl: async (url) => {
        if (url.href.endsWith('%2Fready')) return response(200, '', publishedReleaseMetadata());
        if (url.href.endsWith('%2Fmissing')) return response(404);
        return response(503, 'Service Unavailable', 'retry later');
      },
    }
  );

  assert.deepEqual(report.ready, ['@proto.ui/ready']);
  assert.deepEqual(report.missing, ['@proto.ui/missing']);
  assert.deepEqual(report.errors, [
    {
      name: '@proto.ui/unavailable',
      detail: 'HTTP 503 Service Unavailable: retry later',
    },
  ]);
});

test('registry readiness records transport failures without treating packages as missing', async () => {
  const report = await checkRegistryReadiness(['@proto.ui/core'], {
    timeoutMs: 1_000,
    fetchImpl: async () => {
      throw new Error('network unavailable');
    },
  });

  assert.deepEqual(report, {
    ready: [],
    missing: [],
    errors: [{ name: '@proto.ui/core', detail: 'network unavailable' }],
  });
});

test('registry readiness arguments validate timeout and registry values', () => {
  assert.deepEqual(
    parseRegistryReadinessArgs([
      '--registry',
      'https://registry.example.test',
      '--timeout-ms',
      '2500',
    ]),
    { registry: 'https://registry.example.test', timeoutMs: 2_500 }
  );
  assert.throws(() => parseRegistryReadinessArgs(['--timeout-ms', '0']), /positive integer/);
  assert.throws(() => parseRegistryReadinessArgs(['--unknown']), /Unknown argument/);
});

function response(status, statusText = '', body = '') {
  return {
    status,
    statusText,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function publishedReleaseMetadata() {
  return {
    'dist-tags': { latest: '0.3.0-alpha.0' },
    versions: { '0.3.0-alpha.0': {} },
  };
}
