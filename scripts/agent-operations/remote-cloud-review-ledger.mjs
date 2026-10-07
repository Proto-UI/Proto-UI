import { LEDGER_PRINCIPAL, LEDGER_REPOSITORY } from './cloud-review-ledger.mjs';
// Remote-state protocol. The default Git transport is read-only.
// The exact-parent owner transport is separately selected; tests use local Git.
import { execFileSync } from 'node:child_process';
import { LocalCloudReviewLedger, LOCAL_LEDGER_REF } from './local-cloud-review-ledger.mjs';

export const REMOTE_LEDGER_REF = 'refs/heads/proto-ui-review-ledger-' + LEDGER_PRINCIPAL.login;
const FETCHED_REF = 'refs/heads/proto-ui-review-ledger-fetched';
const SHA = /^[a-f0-9]{40}$/;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const git = (directory, args) =>
  execFileSync('git', ['--no-replace-objects', '-C', directory, ...args], {
    encoding: 'utf8',
    // Machine-parse local porcelain, never locale-dependent stderr prose.
    env: { ...process.env, LC_ALL: 'C' },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

function isExactStaleLeaseRejection(error, { revision, ref }) {
  if (error?.status !== 1 || error.signal !== null) return false;
  const stdout =
    typeof error.stdout === 'string'
      ? error.stdout
      : Buffer.isBuffer(error.stdout)
        ? error.stdout.toString('utf8')
        : null;
  if (stdout === null) return false;
  const updates = stdout
    .split('\n')
    .map((line) => line.split('\t'))
    .filter((fields) => [' ', '+', '-', '*', '=', '!'].includes(fields[0]));
  return (
    updates.length === 1 &&
    updates[0].length === 3 &&
    updates[0][0] === '!' &&
    updates[0][1] === revision + ':' + ref &&
    updates[0][2] === '[rejected] (stale info)'
  );
}

export function readOnlyGitLedgerTransport() {
  return Object.freeze({
    readInto(directory) {
      // No ref creation, forced fetch, alternate repository, or fallback to an
      // empty ledger. A missing/rewritten ref fails. Git validates fetched objects.
      git(directory, [
        'fetch',
        '--no-tags',
        '--no-write-fetch-head',
        'https://github.com/Proto-UI/Proto-UI.git',
        `${REMOTE_LEDGER_REF}:${FETCHED_REF}`,
      ]);
      return git(directory, ['rev-parse', '--verify', FETCHED_REF]);
    },
  });
}

export class RemoteCloudReviewLedger {
  #directory;
  #genesis;
  #checkpoint;
  #transport;
  #local;
  #stopped = false;
  constructor(directory, genesis, { checkpoint, transport = readOnlyGitLedgerTransport() } = {}) {
    assert(
      SHA.test(genesis) && SHA.test(checkpoint),
      'fresh runs require an explicit trusted checkpoint'
    );
    assert(
      git(directory, ['rev-parse', '--is-bare-repository']) === 'true' &&
        git(directory, ['remote']) === '',
      'remote cache must be a bare repository without configured remotes'
    );
    this.#directory = directory;
    this.#genesis = genesis;
    this.#checkpoint = checkpoint;
    this.#transport = transport;
    const tip = this.#refresh();
    this.#local = new LocalCloudReviewLedger(directory, genesis, { checkpoint });
    this.#checkpoint = tip;
  }
  #refresh() {
    const tip = this.#transport.readInto(this.#directory);
    assert(SHA.test(tip), 'remote transport returned an invalid revision');
    git(this.#directory, ['update-ref', LOCAL_LEDGER_REF, tip]); // local cache only
    const root = JSON.parse(git(this.#directory, ['show', this.#genesis + ':entry.json']));
    assert(
      root.schemaVersion === 2 &&
        root.repositoryId === LEDGER_REPOSITORY &&
        root.principal?.id === LEDGER_PRINCIPAL.id &&
        root.principal?.login === LEDGER_PRINCIPAL.login,
      'remote ledger genesis does not match selected owner principal'
    );
    // A separate verifier may read after a failed push without adopting its
    // process owner or trusting its speculative local candidate as a remote tip.
    new LocalCloudReviewLedger(this.#directory, this.#genesis, { checkpoint: this.#checkpoint });
    return tip;
  }
  read() {
    const revision = this.#refresh();
    const reader = this.#stopped
      ? new LocalCloudReviewLedger(this.#directory, this.#genesis, { checkpoint: this.#checkpoint })
      : this.#local;
    const snapshot = reader.read();
    this.#checkpoint = revision;
    return { ...snapshot, checkpoint: revision, mutationStopped: this.#stopped };
  }
  apply(expectedRevision, command) {
    assert(!this.#stopped, 'remote mutation is stopped; read-only reconciliation only');
    assert(typeof this.#transport.publish === 'function', 'remote state writes are disabled');
    const before = this.read();
    if (before.revision !== expectedRevision)
      return { status: 'conflict', publicationAllowed: false };
    const candidate = this.#local.prepare(expectedRevision, command);
    if (candidate.status === 'conflict') return candidate;
    if (!['prepared', 'applied'].includes(candidate.status)) {
      this.#stopped = true;
      return { ...candidate, mutationStopped: true };
    }
    if (candidate.noOp) return { ...candidate, checkpoint: this.#checkpoint };
    // The local adapter constructed and validated exactly one single-parent
    // child of expectedRevision. The owner transport uses an exact remote-tip
    // lease, so deletion, rollback or a sibling winner cannot be overwritten.
    // Never rebase or retry a candidate after a conflict/error.
    try {
      const result = this.#transport.publish({
        directory: this.#directory,
        ref: REMOTE_LEDGER_REF,
        expectedRevision,
        revision: candidate.revision,
      });
      if (
        result?.status === 'conflict' &&
        result.noWrite === true &&
        result.ref === REMOTE_LEDGER_REF &&
        result.revision === candidate.revision &&
        result.expectedRevision === expectedRevision &&
        result.reason === 'stale-exact-lease'
      ) {
        // This exact ref was not updated. Keep the original process owner;
        // read the current fence before constructing a new candidate. Never
        // replay this rejected commit or the external review POST.
        this.#local.discardPrepared(candidate);
        return {
          status: 'conflict',
          attemptedRevision: candidate.revision,
          checkpoint: this.#checkpoint,
          publicationAllowed: false,
        };
      }
      assert(result?.status === 'accepted', 'remote candidate was not acknowledged');
      const observed = this.read();
      this.#local.confirmPrepared(candidate); // validate actual acknowledgement ancestry
      return {
        status: 'applied',
        revision: observed.revision,
        attemptedRevision: candidate.revision,
        checkpoint: observed.checkpoint,
        publicationAllowed: false,
      };
    } catch {
      this.#stopped = true;
      return {
        status: 'unknown',
        attemptedRevision: candidate.revision,
        checkpoint: this.#checkpoint,
        publicationAllowed: false,
        mutationStopped: true,
      };
    }
  }

  consumePublicationAttempt(intentId) {
    assert(!this.#stopped, 'remote mutation is stopped; no publication attempt');
    this.read();
    this.#local.consumePublicationAttempt(intentId);
  }

  consumeSimulationAttempt(intentId) {
    assert(!this.#stopped, 'remote mutation is stopped; no simulation attempt');
    this.read();
    this.#local.consumeSimulationAttempt(intentId);
  }
}

// Explicit production-state binding, never selected by default or by PR input.
// Parent must authorize/provision the fixed ref and supply its pinned genesis.
export function ownerGitLedgerTransport({ runGit = git } = {}) {
  return {
    ...readOnlyGitLedgerTransport(),
    publish({ directory, ref, revision, expectedRevision }) {
      assert(
        ref === REMOTE_LEDGER_REF && SHA.test(revision) && SHA.test(expectedRevision),
        'invalid state publication target'
      );
      assert(
        runGit(directory, ['show', '-s', '--format=%P', revision]) === expectedRevision,
        'state candidate is not one exact-parent child'
      );
      let output;
      try {
        output = runGit(directory, [
          'push',
          '--porcelain',
          // An explicit lease checks the remote old tip atomically. The exact-parent
          // assertion above still permits only its single-child fast-forward; this
          // cannot restore a deleted/rolled-back ref or overwrite a sibling.
          `--force-with-lease=${ref}:${expectedRevision}`,
          'https://github.com/Proto-UI/Proto-UI.git',
          `${revision}:${ref}`,
        ]);
      } catch (error) {
        if (!isExactStaleLeaseRejection(error, { revision, ref })) throw error;
        return {
          status: 'conflict',
          noWrite: true,
          reason: 'stale-exact-lease',
          ref,
          revision,
          expectedRevision,
        };
      }
      const updates = output
        .split('\n')
        .map((line) => line.split('\t'))
        .filter((fields) => fields[1] === `${revision}:${ref}`);
      // Up-to-date is not our successful CAS: another writer may already have
      // installed this exact object. Never attribute that no-op to this attempt.
      assert(
        updates.length === 1 && updates[0][0] === ' ',
        'remote did not acknowledge one fast-forward transaction'
      );
      return { status: 'accepted' };
    },
  };
}
