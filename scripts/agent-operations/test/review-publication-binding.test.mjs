import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  constants,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPublishedReviewPacket } from '../published-review-packet.mjs';

import {
  MAX_PUBLISHED_REVIEW_PACKET_BYTES,
  agentEvidenceMarker,
  authorizePullRequestMerge,
  authorizeReviewSubmission,
  computeReviewInputDigest,
  computeReviewPacketDigest,
  renderReviewBody,
  reviewPacketMarker,
  validatePublishedReviewPacket,
  validateReviewPacket,
} from '../review-runtime.mjs';
import {
  publicationRoundTrip,
  publishReview,
  refreshPacket,
  reviewSnapshot,
  reviewPacket,
  reviewerPermission,
  sha,
} from './fixtures/review-publication.mjs';

function merge({ input, packet, publishedPacket, ...overrides }) {
  return authorizePullRequestMerge({
    packet,
    publishedPacket,
    input,
    liveInput: structuredClone(input),
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    authorizationId: 'explicit-current-user',
    policy: {},
    credentialCanMerge: true,
    credentialPermission: 'WRITE',
    credentialCanBypass: false,
    actor: 'contributor',
    ciConclusion: 'success',
    dcoConclusion: 'success',
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    ...overrides,
  });
}

function submit(input, packet, priorPacket) {
  return authorizeReviewSubmission({
    packet,
    input,
    liveInput: structuredClone(input),
    priorPacket,
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    authorizationId: 'explicit-current-user',
    policy: {},
    credentialCanReview: true,
    reviewer: 'independent-reviewer',
    ciConclusion: 'success',
    dcoConclusion: 'success',
  });
}

function target(options) {
  const { before, reviewed, collected, mergePacket, body } = publicationRoundTrip(options);
  return { before, publishedPacket: reviewed, input: collected, packet: mergePacket, body };
}

// Model an attacker rebuilding a structurally valid current packet after a
// drift. The original published artifact and live receipt remain untouched.
function resealCurrentPacket(target) {
  target.packet = refreshPacket(target.publishedPacket, target.input, {
    repositoryId: target.input.repositoryId,
    pullRequest: target.input.pullRequest,
    baseSha: target.input.baseSha,
    headSha: target.input.headSha,
    agentEvidence: { ...target.publishedPacket.agentEvidence, headSha: target.input.headSha },
  });
  validateReviewPacket(target.packet, target.input);
}

for (const existingApproval of [false, true]) {
  test(`collect → render → submit → recollect → merge, existing reviewer permission=${existingApproval}`, () => {
    const fixture = target({ existingApproval });
    const beforePacket = structuredClone(fixture.publishedPacket);
    assert.equal(fixture.before.reviewerPermissions.length, existingApproval ? 1 : 0);
    assert.equal(fixture.input.reviewerPermissions.length, 1);
    assert.notEqual(fixture.packet.reviewInputDigest, fixture.publishedPacket.reviewInputDigest);
    assert.notEqual(
      reviewPacketMarker(fixture.packet),
      reviewPacketMarker(fixture.publishedPacket)
    );
    assert.equal(agentEvidenceMarker(fixture.packet), agentEvidenceMarker(fixture.publishedPacket));
    assert.ok(fixture.body.includes(reviewPacketMarker(fixture.publishedPacket)));
    assert.ok(!fixture.body.includes(reviewPacketMarker(fixture.packet)));
    assert.equal(merge(fixture).allowed, true);
    assert.deepEqual(fixture.publishedPacket, beforePacket);
  });
}

test('v2 renders the exact reviewed base while legacy v1 rendering stays unchanged', () => {
  const { publishedPacket } = target();
  assert.ok(
    renderReviewBody(publishedPacket).includes(
      `Reviewed exact base \`${publishedPacket.baseSha}\`.`
    )
  );
  const legacy = { ...publishedPacket, schemaVersion: 1 };
  delete legacy.agentEvidence;
  assert.ok(!renderReviewBody(legacy).includes('Reviewed exact base'));
});

test('published packet validation permits only the two publication transport fields', () => {
  const fixture = target();
  assert.doesNotThrow(() => validatePublishedReviewPacket(fixture.packet, fixture.publishedPacket));
  for (const field of Object.keys(fixture.publishedPacket)) {
    if (['reviewInputDigest', 'observedAt'].includes(field)) continue;
    const changed = structuredClone(fixture.packet);
    changed[field] = field === 'scope' ? ['Caller-widened acceptance scope'] : null;
    assert.throws(
      () => validatePublishedReviewPacket(changed, fixture.publishedPacket),
      /published/,
      field
    );
  }
  const unknown = { ...fixture.publishedPacket, callerApproved: true };
  assert.throws(() => validatePublishedReviewPacket(fixture.packet, unknown), /published/);
});

test('merge requires an original packet even when the live approval is valid', () => {
  const fixture = target();
  assert.equal(merge({ ...fixture, publishedPacket: null }).allowed, false);
  assert.match(
    merge({ ...fixture, publishedPacket: null }).reason,
    /original published review packet/
  );
});

const snapshotChanges = [
  [
    'base',
    (input) => {
      input.baseSha = sha('c');
    },
  ],
  [
    'pull-request body',
    (input) => {
      input.pullRequestBody += '\nNew acceptance requirement';
    },
  ],
  [
    'issue comment',
    (input) => {
      input.comments.push({
        id: 'new-comment',
        author: 'contributor',
        body: 'New review concern',
        updatedAt: '2026-08-27T06:02:00Z',
      });
    },
  ],
  [
    'successful check rerun',
    (input) => {
      input.checks[0].completedAt = '2026-08-27T06:02:00Z';
    },
  ],
  [
    'changed-file path',
    (input) => {
      input.changedFiles[0].path = 'packages/core/src/other.ts';
    },
  ],
  [
    'commit message',
    (input) => {
      input.commits[0].message += '\nAdditional unreviewed context';
    },
  ],
  [
    'resolved thread',
    (input) => {
      input.threads.push({ id: 'new-thread', isResolved: true, updatedAt: '2026-08-27T06:02:00Z' });
    },
  ],
  [
    'thread reply',
    (input) => {
      input.threads.push({ id: 'new-thread', isResolved: true, updatedAt: '2026-08-27T06:02:00Z' });
      input.replies.push({
        id: 'new-reply',
        threadId: 'new-thread',
        author: 'contributor',
        body: 'New concern',
        updatedAt: '2026-08-27T06:02:00Z',
      });
    },
  ],
  [
    'another review',
    (input) => {
      input.reviews.push({
        ...input.reviews[0],
        id: 'other-review',
        author: 'second-reviewer',
        state: 'COMMENTED',
        body: 'Another concern',
      });
    },
  ],
  [
    'head',
    (input) => {
      input.headSha = sha('c');
      input.commits[0].sha = input.headSha;
      input.reviewerPermissions = [];
    },
  ],
  [
    'repository',
    (input) => {
      input.repositoryId = 'github.com:Other/Repo';
      input.reviewerPermissions = input.reviewerPermissions.map((item) =>
        reviewerPermission(input, item.login)
      );
    },
  ],
  [
    'pull request number',
    (input) => {
      input.pullRequest += 1;
    },
  ],
];

for (const [name, mutate] of snapshotChanges) {
  test(`re-sealing the current packet cannot approve unrelated ${name} drift`, () => {
    const fixture = target();
    const originalPacket = structuredClone(fixture.publishedPacket);
    mutate(fixture.input);
    resealCurrentPacket(fixture);
    assert.equal(merge(fixture).allowed, false, name);
    assert.deepEqual(fixture.publishedPacket, originalPacket);
    assert.equal(fixture.input.reviews[0].body, fixture.body);
  });
}

for (const [name, change] of [
  ['scope', { scope: ['All repository behavior, including unrelated acceptance'] }],
  ['review class', { reviewClass: 'review-cross-domain-semantics' }],
  ['affected surfaces', { affectedSurfaces: ['A newly accepted public API'] }],
  [
    'validation result',
    {
      validation: {
        commands: [{ command: 'pnpm test', exitCode: 0, result: 'A different claimed result' }],
        checksNotRun: [],
      },
    },
  ],
  [
    'reconciliation',
    {
      reconciliation: {
        priorReviewedHeadSha: sha('b'),
        priorPacketDigest: 'e'.repeat(64),
        resolvedFindingIds: [],
        openFindingIds: [],
        newFindingIds: [],
      },
    },
  ],
]) {
  test(`merge denies unreviewed packet ${name}`, () => {
    const fixture = target();
    Object.assign(fixture.packet, change);
    assert.equal(merge(fixture).allowed, false);
    assert.match(merge(fixture).reason, /changed published review content/);
  });
}

test('a caller-resealed original artifact has no authority without its own live packet token', () => {
  const fixture = target();
  fixture.publishedPacket.scope = ['Caller-widened acceptance scope'];
  fixture.packet.scope = [...fixture.publishedPacket.scope];
  assert.doesNotThrow(() => validatePublishedReviewPacket(fixture.packet, fixture.publishedPacket));
  assert.equal(merge(fixture).allowed, false);
  assert.ok(!fixture.body.includes(reviewPacketMarker(fixture.publishedPacket)));
});

test('a caller cannot re-seal the original input digest to hide body drift', () => {
  const fixture = target();
  fixture.input.pullRequestBody += '\nUnreviewed requirement';
  const forgedBefore = structuredClone(fixture.before);
  forgedBefore.pullRequestBody = fixture.input.pullRequestBody;
  fixture.publishedPacket.reviewInputDigest = computeReviewInputDigest(forgedBefore);
  resealCurrentPacket(fixture);
  assert.equal(merge(fixture).allowed, false);
});

for (const permission of ['read', 'none']) {
  test(`the publication reviewer must retain current write permission: ${permission}`, () => {
    const fixture = target();
    fixture.input.reviewerPermissions[0].permission = permission;
    resealCurrentPacket(fixture);
    assert.equal(merge(fixture).allowed, false);
    assert.match(merge(fixture).reason, /verified current repository write permission/);
  });
}

test('an already observed publisher permission may not change even between eligible levels', () => {
  const fixture = target({ existingApproval: true });
  fixture.input.reviewerPermissions[0].permission = 'admin';
  resealCurrentPacket(fixture);
  assert.equal(merge(fixture).allowed, false);
  assert.match(merge(fixture).reason, /publication delta/);
});

test('publication cannot discard another reviewer permission while reconstructing history', () => {
  const before = reviewSnapshot({
    reviews: [
      {
        id: 'older-approval',
        author: 'second-reviewer',
        state: 'APPROVED',
        commitSha: sha('b'),
        submittedAt: '2026-08-27T06:00:00Z',
        body: 'Earlier approval',
      },
    ],
  });
  const fixture = publishReview(before);
  assert.equal(merge(fixture).allowed, true);
  fixture.input.reviewerPermissions.find((item) => item.login === 'second-reviewer').permission =
    'admin';
  resealCurrentPacket(fixture);
  assert.equal(merge(fixture).allowed, false);
});

for (const reviewer of ['contributor', 'web-flow', null]) {
  test(`a publication attributed to ${reviewer} is not an independent approval`, () => {
    const fixture = target();
    fixture.input.reviews[0].author = reviewer;
    fixture.input.reviewerPermissions =
      reviewer === null ? [] : [reviewerPermission(fixture.input, reviewer)];
    resealCurrentPacket(fixture);
    assert.equal(merge(fixture).allowed, false);
    assert.match(merge(fixture).reason, /independent/);
  });
}

const incompletePublicationBodies = [
  [
    'only valid receipts',
    (_body, packet) => `<!-- ${reviewPacketMarker(packet)} ${agentEvidenceMarker(packet)} -->`,
  ],
  [
    'arbitrary prose with valid receipts',
    (_body, packet) =>
      `Looks good.\n\n<!-- ${reviewPacketMarker(packet)} ${agentEvidenceMarker(packet)} -->`,
  ],
  [
    'missing Agent evidence section',
    (body) => body.replace(/## Agent evidence[\s\S]*?(?=### Validation and review limits)/, ''),
  ],
  ['missing publication debt', (body) => body.replace(/^- \[publication\].*\n?/m, '')],
  ['changed validation result', (body) => body.replace('exit 0: passed', 'exit 1: failed')],
  ['entire review hidden in a comment', (body) => `<!-- ${body} -->`],
  [
    'evidence hidden in a comment',
    (body) =>
      body
        .replace('## Agent evidence', '<!-- ## Agent evidence')
        .replace('### Validation and review limits', '-->\n### Validation and review limits'),
  ],
  [
    'mixed prose in a receipt comment',
    (body, packet) => `${body}\n<!-- Extra acceptance claim ${reviewPacketMarker(packet)} -->`,
  ],
  ['unrelated HTML comment', (body) => `${body}\n<!-- Unreviewed addition -->`],
];
for (const [name, changeBody] of incompletePublicationBodies) {
  test(`publication credit and duplicate detection require rendered disclosure: ${name}`, () => {
    const fixture = target();
    const original = structuredClone(fixture.publishedPacket);
    fixture.input.reviews[0].body = changeBody(fixture.body, fixture.publishedPacket);
    assert.notEqual(
      fixture.input.reviews[0].body,
      fixture.body,
      'negative fixture must alter publication'
    );
    resealCurrentPacket(fixture);
    assert.equal(merge(fixture).allowed, false);
    assert.notEqual(submit(fixture.input, fixture.packet, fixture.publishedPacket).duplicate, true);
    assert.deepEqual(fixture.publishedPacket, original);
  });
}

test('rendered publication tolerates CRLF and surrounding whitespace without losing disclosure', () => {
  const fixture = target();
  fixture.input.reviews[0].body = ` \r\n${fixture.body.replaceAll('\n', '\r\n')}\r\n `;
  resealCurrentPacket(fixture);
  assert.equal(merge(fixture).allowed, true);
  assert.equal(submit(fixture.input, fixture.packet, fixture.publishedPacket).duplicate, true);
});

for (const [name, changeBody, duplicate] of [
  ['unchanged', (body) => body, true],
  ['outer whitespace', (body) => ` \n${body}\n `, true],
  ['CRLF', (body) => body.replaceAll('\n', '\r\n'), true],
  [
    'hidden proto-ui prose',
    (body) => `${body}\n<!-- arbitrary hidden proto-ui:warning claim -->`,
    false,
  ],
  [
    'mixed real receipt comment',
    (body) => body.replace('<!-- proto-ui:', '<!-- Important qualification proto-ui:'),
    false,
  ],
  [
    'visible prose between separate comments',
    (body) =>
      body.replace(
        '<!-- proto-ui:',
        '<!-- inert comment -->\nNEW VISIBLE EVIDENCE QUALIFICATION\n<!-- proto-ui:'
      ),
    false,
  ],
  [
    'changed visible evidence',
    (body) => body.replace('No actionable findings', 'Unreviewed findings'),
    false,
  ],
]) {
  test(`COMMENT duplicate detection preserves all non-receipt content: ${name}`, () => {
    const before = reviewSnapshot();
    const original = reviewPacket(before, { recommendedAction: 'COMMENT' });
    const input = structuredClone(before);
    input.reviews.push({
      id: 'PRR_comment',
      author: 'independent-reviewer',
      state: 'COMMENTED',
      commitSha: input.headSha,
      submittedAt: '2026-08-27T08:00:00Z',
      body: changeBody(renderReviewBody(original)),
    });
    const current = refreshPacket(original, input);
    const result = submit(input, current);
    assert.equal(result.duplicate === true, duplicate);
    if (!duplicate) assert.equal(result.allowed, true, result.reason);
  });
}

const corruptReceipt = [
  ['packet token missing', (packetToken, evidenceToken) => `<!-- ${evidenceToken} -->`],
  ['evidence token missing', (packetToken) => `<!-- ${packetToken} -->`],
  [
    'wrong packet digest',
    (packetToken, evidenceToken) =>
      `<!-- proto-ui:review-packet:sha256=${'a'.repeat(64)} ${evidenceToken} -->`,
  ],
  [
    'wrong evidence digest',
    (packetToken) => `<!-- ${packetToken} proto-ui:agent-evidence:sha256=${'a'.repeat(64)} -->`,
  ],
  [
    'packet token prefix',
    (packetToken, evidenceToken) => `<!-- prefix-${packetToken} ${evidenceToken} -->`,
  ],
  [
    'packet token suffix',
    (packetToken, evidenceToken) => `<!-- ${packetToken}-suffix ${evidenceToken} -->`,
  ],
  [
    'evidence token prefix',
    (packetToken, evidenceToken) => `<!-- ${packetToken} prefix-${evidenceToken} -->`,
  ],
  [
    'evidence token suffix',
    (packetToken, evidenceToken) => `<!-- ${packetToken} ${evidenceToken}-suffix -->`,
  ],
  ['prose tokens', (packetToken, evidenceToken) => `${packetToken} ${evidenceToken}`],
  [
    'ambiguous packet tokens',
    (packetToken, evidenceToken) =>
      `<!-- ${packetToken} proto-ui:review-packet:sha256=${'a'.repeat(64)} ${evidenceToken} -->`,
  ],
  [
    'ambiguous evidence tokens',
    (packetToken, evidenceToken) =>
      `<!-- ${packetToken} ${evidenceToken} proto-ui:agent-evidence:sha256=${'a'.repeat(64)} -->`,
  ],
];

for (const [name, body] of corruptReceipt) {
  test(`both full publication tokens must bind the same approved review: ${name}`, () => {
    const fixture = target();
    fixture.input.reviews[0].body = body(
      reviewPacketMarker(fixture.publishedPacket),
      agentEvidenceMarker(fixture.publishedPacket)
    );
    resealCurrentPacket(fixture);
    assert.equal(merge(fixture).allowed, false);
    assert.match(merge(fixture).reason, /published review packet and Agent evidence receipt/);
  });
}

test('repeating the same exact receipt tokens retains one packet and evidence identity', () => {
  const fixture = target();
  fixture.input.reviews[0].body += `\n<!-- ${reviewPacketMarker(fixture.publishedPacket)}\n${agentEvidenceMarker(fixture.publishedPacket)} -->`;
  resealCurrentPacket(fixture);
  assert.equal(merge(fixture).allowed, true);
});

test('packet and evidence tokens in different approved reviews cannot be combined', () => {
  const fixture = target();
  fixture.input.reviews[0].body = `<!-- ${reviewPacketMarker(fixture.publishedPacket)} -->`;
  fixture.input.reviews.push({
    ...fixture.input.reviews[0],
    id: 'second-review',
    author: 'second-reviewer',
    body: `<!-- ${agentEvidenceMarker(fixture.publishedPacket)} -->`,
  });
  fixture.input.reviewerPermissions.push(reviewerPermission(fixture.input, 'second-reviewer'));
  resealCurrentPacket(fixture);
  assert.equal(merge(fixture).allowed, false);
});

test('an untrusted evidence publisher cannot borrow an independent reviewer approval', () => {
  const fixture = target();
  fixture.input.reviews[0].body = 'Independent approval without the governed receipt';
  fixture.input.reviews.push({
    ...fixture.input.reviews[0],
    id: 'outsider-review',
    author: 'outside-reader',
    body: fixture.body,
  });
  fixture.input.reviewerPermissions.push(
    reviewerPermission(fixture.input, 'outside-reader', 'read')
  );
  resealCurrentPacket(fixture);
  assert.equal(merge(fixture).allowed, false);
  assert.match(merge(fixture).reason, /same valid exact-head independent APPROVE review/);
});

for (const existingApproval of [false, true]) {
  test(`publication-only digest refresh is an idempotent disposition, existing permission=${existingApproval}`, () => {
    const fixture = target({ existingApproval });
    const result = submit(fixture.input, fixture.packet, fixture.publishedPacket);
    assert.equal(result.allowed, false);
    assert.equal(result.duplicate, true);
  });
}

for (const [name, mutate] of snapshotChanges.filter(([name]) =>
  [
    'base',
    'pull-request body',
    'issue comment',
    'successful check rerun',
    'changed-file path',
  ].includes(name)
)) {
  test(`${name} drift requires a newly reconciled review rather than a duplicate no-op`, () => {
    const fixture = target();
    mutate(fixture.input);
    resealCurrentPacket(fixture);
    fixture.packet.reconciliation = {
      priorReviewedHeadSha: fixture.publishedPacket.headSha,
      priorPacketDigest: computeReviewPacketDigest(fixture.publishedPacket),
      resolvedFindingIds: [],
      openFindingIds: [],
      newFindingIds: [],
    };
    const result = submit(fixture.input, fixture.packet, fixture.publishedPacket);
    assert.equal(result.allowed, true, result.reason);
    assert.notEqual(result.duplicate, true);
  });
}

test('changed input cannot bypass reconciliation by dropping its original prior packet', () => {
  const fixture = target();
  fixture.input.pullRequestBody += '\nA new acceptance condition';
  resealCurrentPacket(fixture);
  const result = submit(fixture.input, fixture.packet, null);
  assert.equal(result.allowed, false);
  assert.notEqual(result.duplicate, true);
  assert.match(result.reason, /reconcile.*prior review/);
});

test(
  'published packet reader rejects nonregular POSIX files without blocking on open',
  { skip: process.platform === 'win32' || !constants.O_NONBLOCK },
  () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'pui-published-fifo-'));
    try {
      const fifo = path.join(directory, 'packet.fifo');
      const link = path.join(directory, 'packet-link.json');
      const created = spawnSync('mkfifo', [fifo], { encoding: 'utf8' });
      assert.equal(created.status, 0, created.stderr);
      symlinkSync(fifo, link);
      const readerUrl = new URL('../published-review-packet.mjs', import.meta.url).href;
      for (const input of [fifo, link, '/dev/null']) {
        const result = spawnSync(
          process.execPath,
          [
            '--input-type=module',
            '-e',
            `
          import assert from 'node:assert/strict';
          import { readPublishedReviewPacket } from ${JSON.stringify(readerUrl)};
          assert.throws(() => readPublishedReviewPacket(process.argv[1], {}), /regular file/);
        `,
            input,
          ],
          { encoding: 'utf8', timeout: 2000 }
        );
        assert.equal(result.error, undefined, `nonregular open must not wait: ${input}`);
        assert.equal(result.status, 0, result.stderr);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
);

test('published packet reader validates bounded content and rejects missing or oversized originals', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'pui-published-packet-'));
  try {
    const fixture = target();
    const originalPath = path.join(directory, 'published.json');
    writeFileSync(originalPath, JSON.stringify(fixture.publishedPacket));
    assert.deepEqual(
      readPublishedReviewPacket(originalPath, fixture.packet),
      fixture.publishedPacket
    );
    assert.throws(
      () => readPublishedReviewPacket(undefined, fixture.packet),
      /--published-review-packet is required/
    );
    assert.throws(
      () => readPublishedReviewPacket('', fixture.packet),
      /--published-review-packet is required/
    );
    assert.throws(() => readPublishedReviewPacket(directory, fixture.packet), /regular file/);
    const oversizedPath = path.join(directory, 'oversized.json');
    writeFileSync(oversizedPath, '');
    truncateSync(oversizedPath, MAX_PUBLISHED_REVIEW_PACKET_BYTES + 1);
    assert.equal(MAX_PUBLISHED_REVIEW_PACKET_BYTES, 64 * 1024 * 1024);
    assert.throws(
      () => readPublishedReviewPacket(oversizedPath, fixture.packet),
      /67108864-byte bound/
    );
    writeFileSync(originalPath, '{invalid JSON');
    assert.throws(() => readPublishedReviewPacket(originalPath, fixture.packet), /valid JSON/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('merge CLI rejects missing, oversized, and unbound originals before any GitHub call', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'pui-merge-published-packet-'));
  try {
    const fixture = target();
    const root = fileURLToPath(new URL('../../..', import.meta.url));
    const inputPath = path.join(directory, 'input.json');
    const packetPath = path.join(directory, 'packet.json');
    const publishedPath = path.join(directory, 'published.json');
    const oversizedPath = path.join(directory, 'oversized.json');
    const mismatchedPath = path.join(directory, 'mismatched.json');
    const handoffPath = path.join(directory, 'handoff.json');
    const callsPath = path.join(directory, 'calls.jsonl');
    const preloadPath = path.join(directory, 'mock-gh.mjs');
    writeFileSync(inputPath, JSON.stringify(fixture.input));
    writeFileSync(packetPath, JSON.stringify(fixture.packet));
    writeFileSync(publishedPath, JSON.stringify(fixture.publishedPacket));
    writeFileSync(
      mismatchedPath,
      JSON.stringify({ ...fixture.publishedPacket, scope: ['Unreviewed widened scope'] })
    );
    writeFileSync(oversizedPath, '');
    truncateSync(oversizedPath, MAX_PUBLISHED_REVIEW_PACKET_BYTES + 1);
    writeFileSync(
      handoffPath,
      JSON.stringify({
        schemaVersion: 1,
        kind: 'proto-ui.skill-handoff',
        entrypoint: 'development',
        executionMode: 'human-assisted',
        executionModeSource: 'current-user',
        fromId: 'pui-review',
        nextSkillId: 'pui-integrate',
        artifacts: [
          {
            type: 'review-packet',
            reference: packetPath,
            digest: `sha256:${computeReviewPacketDigest(fixture.packet)}`,
          },
          {
            type: 'review-input',
            reference: inputPath,
            digest: `sha256:${computeReviewInputDigest(fixture.input)}`,
          },
          {
            type: 'published-review-packet',
            reference: publishedPath,
            digest: `sha256:${computeReviewPacketDigest(fixture.publishedPacket)}`,
          },
          { type: 'mutation-authorization', reference: 'explicit-current-user' },
        ],
        humanGates: [],
        notes: [],
      })
    );
    writeFileSync(
      preloadPath,
      `
      import cp from 'node:child_process';
      import { appendFileSync } from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      cp.execFileSync = (command, args) => {
        appendFileSync(process.env.PUI_PUBLICATION_TEST_CALLS, JSON.stringify({ command, args }) + '\\n');
        throw new Error('mock network boundary reached');
      };
      syncBuiltinESMExports();
    `
    );
    const invoke = (publicationArgs) => {
      const handoff = JSON.parse(readFileSync(handoffPath, 'utf8'));
      handoff.artifacts.find((artifact) => artifact.type === 'published-review-packet').reference =
        publicationArgs[1] ?? publishedPath;
      writeFileSync(handoffPath, JSON.stringify(handoff));
      writeFileSync(callsPath, '');
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          preloadPath,
          path.join(root, 'scripts/agent-operations/review-packet.mjs'),
          'merge-pull-request',
          '--mode',
          'human-assisted',
          '--mode-source',
          'current-user',
          '--input',
          inputPath,
          '--packet',
          packetPath,
          '--handoff',
          handoffPath,
          '--authorization',
          'explicit-current-user',
          ...publicationArgs,
        ],
        {
          cwd: root,
          encoding: 'utf8',
          env: { ...process.env, PUI_PUBLICATION_TEST_CALLS: callsPath },
        }
      );
      assert.ifError(result.error);
      assert.equal(result.status, 1);
      return { result, calls: readFileSync(callsPath, 'utf8') };
    };
    for (const [publicationArgs, diagnostic] of [
      [[], /--published-review-packet is required/],
      [['--published-review-packet', oversizedPath], /67108864-byte bound/],
      [['--published-review-packet', mismatchedPath], /changed published review content/],
    ]) {
      const { result, calls } = invoke(publicationArgs);
      assert.match(result.stderr, diagnostic);
      assert.equal(calls, '', 'invalid publication evidence must fail before any subprocess call');
    }
    // Control: the same handoff/input/current packet with the authentic
    // original reaches our fake collection boundary, never a real gh process.
    const valid = invoke(['--published-review-packet', publishedPath]);
    assert.match(valid.result.stderr, /mock network boundary reached/);
    assert.match(valid.calls, /"command":"gh"/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
