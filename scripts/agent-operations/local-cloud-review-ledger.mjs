// Local bare-Git test adapter. Deliberately contains no remote transport or POST.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { realpathSync } from 'node:fs';
import {
  emptyCloudReviewLedger,
  reduceCloudReviewLedger,
  LEDGER_PRINCIPAL,
  LEDGER_REPOSITORY,
} from './cloud-review-ledger.mjs';

export const LOCAL_LEDGER_REF = 'refs/heads/proto-ui-review-ledger-candidate';
const SHA = /^[a-f0-9]{40}$/;
const ROOT = {
  schemaVersion: 1,
  kind: 'proto-ui.inactive-review-ledger',
  publicationEnabled: false,
};
const LIMIT = 2048;
const MAX_BYTES = 8 * 1024 * 1024;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function genesisPayload(publicationEnabled, principal = LEDGER_PRINCIPAL) {
  assert(typeof publicationEnabled === 'boolean', 'explicit ledger mode required');
  const legacy = publicationEnabled
    ? { ...ROOT, kind: 'proto-ui.owner-review-ledger', publicationEnabled: true }
    : ROOT;
  if (principal === null) return legacy; // Explicit historical fixture; never admitted by the owner remote adapter.
  assert(
    principal &&
      Object.keys(principal).sort().join(',') === 'id,login' &&
      typeof principal.id === 'string' &&
      /^[1-9][0-9]*$/.test(principal.id) &&
      typeof principal.login === 'string' &&
      /^[a-z0-9-]{1,39}$/i.test(principal.login),
    'invalid genesis principal'
  );
  return {
    ...legacy,
    schemaVersion: 2,
    repositoryId: LEDGER_REPOSITORY,
    principal: { id: principal.id, login: principal.login },
  };
}

export class LocalCloudReviewLedger {
  #repo;
  #genesis;
  #floor;
  #owner = randomBytes(16).toString('hex');
  #claimed = false;
  #uncertain = false;
  #simulationAttempts = new Set();
  #runner;
  #prepared = null;

  constructor(directory, genesis, { checkpoint = genesis, runner = execFileSync } = {}) {
    this.#repo = realpathSync(directory);
    this.#runner = runner;
    assert(SHA.test(genesis) && SHA.test(checkpoint), 'pinned genesis/checkpoint required');
    this.#genesis = genesis;
    this.#floor = checkpoint;
    assert(
      this.#git(['rev-parse', '--is-bare-repository']).trim() === 'true',
      'only a local bare repository is supported'
    );
    assert(this.#git(['remote']).trim() === '', 'remote-configured repositories are not supported');
    this.read();
  }

  #git(args, input) {
    return this.#runner('git', ['--no-replace-objects', '-C', this.#repo, ...args], {
      encoding: 'utf8',
      input,
      maxBuffer: MAX_BYTES,
      env: {
        PATH: process.env.PATH,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_TERMINAL_PROMPT: '0',
        GIT_AUTHOR_NAME: 'Inactive ledger fixture',
        GIT_AUTHOR_EMAIL: 'ledger@example.invalid',
        GIT_COMMITTER_NAME: 'Inactive ledger fixture',
        GIT_COMMITTER_EMAIL: 'ledger@example.invalid',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  static initialize(directory, { publicationEnabled = false, principal = LEDGER_PRINCIPAL } = {}) {
    assert(typeof publicationEnabled === 'boolean', 'explicit ledger mode required');
    const root = genesisPayload(publicationEnabled, principal);
    // Initialization is explicit and local; callers initialize the empty bare Git
    // repository themselves. No credentials, network or state branch in origin.
    const repo = realpathSync(directory);
    const run = (args, input) =>
      execFileSync('git', ['--no-replace-objects', '-C', repo, ...args], {
        encoding: 'utf8',
        input,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          PATH: process.env.PATH,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_AUTHOR_NAME: 'Inactive ledger fixture',
          GIT_AUTHOR_EMAIL: 'ledger@example.invalid',
          GIT_COMMITTER_NAME: 'Inactive ledger fixture',
          GIT_COMMITTER_EMAIL: 'ledger@example.invalid',
        },
      });
    assert(
      run(['rev-parse', '--is-bare-repository']).trim() === 'true' && run(['remote']).trim() === '',
      'initialization requires a local bare repository without remotes'
    );
    const blob = run(['hash-object', '-w', '--stdin'], JSON.stringify(root)).trim();
    const tree = run(['mktree'], `100644 blob ${blob}\tentry.json\n`).trim();
    const genesis = run(['commit-tree', tree], 'Inactive review ledger genesis\n').trim();
    run(['update-ref', LOCAL_LEDGER_REF, genesis, '0'.repeat(40)]);
    return genesis;
  }

  #history(revision) {
    assert(SHA.test(revision), 'invalid ledger revision');
    const commands = [];
    const revisions = [];
    let cursor = revision;
    let bytes = 0;
    let publicationEnabled = false;
    while (true) {
      assert(revisions.length < LIMIT, 'ledger history budget exceeded');
      revisions.push(cursor);
      const commit = this.#git(['cat-file', 'commit', cursor]);
      const header = commit.split('\n\n')[0];
      const parents = [...header.matchAll(/^parent ([a-f0-9]{40})$/gm)].map((match) => match[1]);
      assert(
        this.#git(['ls-tree', cursor])
          .trim()
          .match(/^100644 blob [a-f0-9]{40}\tentry\.json$/),
        'ledger tree must contain only entry.json'
      );
      const raw = this.#git(['show', `${cursor}:entry.json`]);
      bytes += Buffer.byteLength(raw);
      assert(bytes <= MAX_BYTES, 'ledger byte budget exceeded');
      const entry = JSON.parse(raw);
      if (cursor === this.#genesis) {
        assert(
          parents.length === 0 &&
            (JSON.stringify(entry) === JSON.stringify(ROOT) ||
              JSON.stringify(entry) === JSON.stringify(genesisPayload(true, null)) ||
              (entry.schemaVersion === 2 &&
                JSON.stringify(entry) ===
                  JSON.stringify(genesisPayload(entry.publicationEnabled, entry.principal)))),
          'invalid pinned genesis'
        );
        publicationEnabled = entry.publicationEnabled;
        break;
      }
      assert(parents.length === 1, 'ledger history must be linear and reach the pinned genesis');
      commands.push(entry);
      cursor = parents[0];
    }
    let state = emptyCloudReviewLedger({ publicationEnabled });
    for (const command of commands.reverse()) state = reduceCloudReviewLedger(state, command);
    return { revision, state, revisions };
  }

  read() {
    const revision = this.#git(['rev-parse', '--verify', LOCAL_LEDGER_REF]).trim();
    const snapshot = this.#history(revision);
    assert(
      snapshot.revisions.includes(this.#floor),
      'ledger reset or rewrite below the pinned checkpoint'
    );
    this.#floor = revision;
    return { revision, state: snapshot.state, publicationAllowed: false };
  }

  consumeSimulationAttempt(intentId) {
    return this.#consumeAttempt(intentId, false);
  }
  consumePublicationAttempt(intentId) {
    return this.#consumeAttempt(intentId, true);
  }
  #consumeAttempt(intentId, publishing) {
    const { state } = this.read();
    assert(
      !this.#uncertain && !this.#prepared && this.#claimed && state.slot?.owner === this.#owner,
      'fresh, stopped or restarted process cannot submit a simulation'
    );
    assert(
      state.slot.intent?.id === intentId &&
        (publishing
          ? state.publicationEnabled &&
            state.slot.intent.publicationIntent === true &&
            state.slot.intent.dispatchFenced === true
          : state.slot.intent.simulationOnly === true),
      'owned simulation intent required'
    );
    assert(
      state.pending.find((item) => item.pullRequest === state.slot.pullRequest)?.generation ===
        state.slot.generation,
      'material generation changed before simulation attempt'
    );
    assert(
      !publishing || !state.deferred.some((item) => item.pullRequest === state.slot.pullRequest),
      'material wake-up deferred before publication attempt'
    );
    assert(
      !this.#simulationAttempts.has(intentId),
      'simulation attempt already consumed; never retry'
    );
    this.#simulationAttempts.add(intentId);
  }

  prepare(expectedRevision, requested) {
    assert(
      !this.#uncertain,
      'this process has an uncertain update; restart for read-only reconciliation'
    );
    assert(this.#prepared === null, 'an owned candidate is already awaiting confirmation');
    assert(SHA.test(expectedRevision), 'expected revision required');
    assert(
      requested && typeof requested === 'object' && !Object.hasOwn(requested, 'owner'),
      'caller cannot supply an owner nonce'
    );
    this.read();
    if (expectedRevision !== this.#floor) return { status: 'conflict', publicationAllowed: false };
    const command = structuredClone(requested);
    if (command.type === 'cancelPublicationIntent')
      assert(
        !this.#simulationAttempts.has(command.intentId),
        'publication attempt already consumed; cannot cancel an uncertain dispatch'
      );
    if (!['enqueue', 'captureInitialSweep'].includes(command.type)) {
      if (command.type !== 'claim')
        assert(this.#claimed, 'fresh or restarted process does not own the slot');
      command.owner = this.#owner;
    }
    const snapshot = this.#history(expectedRevision);
    const next = reduceCloudReviewLedger(snapshot.state, command);
    if (JSON.stringify(next) === JSON.stringify(snapshot.state))
      return {
        status: 'applied',
        revision: expectedRevision,
        noOp: true,
        publicationAllowed: false,
      };
    const raw = JSON.stringify(command);
    assert(Buffer.byteLength(raw) <= MAX_BYTES, 'entry byte budget exceeded');
    const blob = this.#git(['hash-object', '-w', '--stdin'], raw).trim();
    const tree = this.#git(['mktree'], `100644 blob ${blob}\tentry.json\n`).trim();
    const revision = this.#git(
      ['commit-tree', tree, '-p', expectedRevision],
      'Inactive ledger transition\n'
    ).trim();
    // Validate budgets and the exact candidate before the only ref mutation.
    this.#history(revision);
    // Construct objects only. A speculative remote candidate must not become
    // the cache checkpoint or acquire/release this process ownership yet.
    const token = Object.freeze({
      status: 'prepared',
      revision,
      expectedRevision,
      publicationAllowed: false,
    });
    this.#prepared = { token, type: command.type };
    return token;
  }

  discardPrepared(token) {
    assert(
      !this.#uncertain && this.#prepared?.token === token,
      'no matching owned prepared candidate'
    );
    assert(
      this.#git(['rev-parse', '--verify', LOCAL_LEDGER_REF]).trim() === token.expectedRevision,
      'candidate cache changed; do not discard or roll back'
    );
    this.#prepared = null;
  }

  confirmPrepared(token) {
    assert(
      !this.#uncertain && this.#prepared?.token === token,
      'no matching owned prepared candidate'
    );
    const observed = this.read();
    assert(
      this.#history(observed.revision).revisions.includes(token.revision),
      'acknowledged candidate is missing from the confirmed lineage'
    );
    const type = this.#prepared.type;
    if (type === 'claim') this.#claimed = true;
    if (
      [
        'abandon',
        'finishAnalysis',
        'finalizeSimulation',
        'finalizePublication',
        'cancelPublicationIntent',
      ].includes(type)
    )
      this.#claimed = false;
    this.#prepared = null;
    return { status: 'applied', revision: token.revision, publicationAllowed: false };
  }

  apply(expectedRevision, requested) {
    const candidate = this.prepare(expectedRevision, requested);
    if (candidate.status !== 'prepared') return candidate;
    try {
      this.#git(['update-ref', LOCAL_LEDGER_REF, candidate.revision, expectedRevision]);
      return this.confirmPrepared(candidate);
    } catch {
      // A lost ref acknowledgement or inconsistent readback is never adopted.
      this.#uncertain = true;
      return {
        status: 'unknown',
        attemptedRevision: candidate.revision,
        publicationAllowed: false,
      };
    }
  }
}
