import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  buildModelTraceRecord,
  computeModelTraceChallengeDigest,
  createModelTraceChallenge,
  loadModelTraceRecord,
  readModelTraceJson,
  renderModelTraceDisclosure,
  validateModelTraceContext,
} from './modeltrace.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OPTIONS = new Map([
  ['challenge', ['--context', '--out']],
  ['challenge-digest', ['--challenge']],
  ['score', ['--challenge', '--response', '--previous', '--out']],
  ['validate', ['--record', '--context']],
  ['disclosure', ['--record', '--context', '--format']],
]);

function assertOutsideRepository(realPath, label) {
  const relative = path.relative(fs.realpathSync(ROOT), realPath);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)))
    throw new Error(`private ModelTrace ${label} must remain outside the repository`);
}

export function runModelTraceCli(argv, { now = new Date(), stdout = process.stdout } = {}) {
  argv = [...argv];
  if (argv[0] === '--') argv.shift();
  const command = argv.shift();
  if (!OPTIONS.has(command) || argv.length % 2 !== 0)
    throw new Error(
      'Usage: pnpm agent:identify -- challenge|challenge-digest|score|validate|disclosure --context|--challenge|--response|--record <file> [--previous <file>] [--format markdown|commit|json]; challenge and score require --out <new-private-file>'
    );
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    if (
      !OPTIONS.get(command).includes(name) ||
      args.has(name) ||
      !argv[index + 1] ||
      argv[index + 1].startsWith('--')
    )
      throw new Error(`invalid or duplicate option: ${name}`);
    args.set(name, argv[index + 1]);
  }
  let output;
  let realOutput;
  if (command === 'challenge' || command === 'score') {
    if (!args.has('--out')) throw new Error('challenge and score require a new private --out file');
    output = path.resolve(args.get('--out'));
    realOutput = path.join(fs.realpathSync(path.dirname(output)), path.basename(output));
    assertOutsideRepository(realOutput, 'challenges/records');
    if (fs.lstatSync(realOutput, { throwIfNoEntry: false }))
      throw new Error('private ModelTrace --out must name a new file');
  }
  let value;
  if (command === 'challenge') {
    assertOutsideRepository(fs.realpathSync(args.get('--context')), 'context');
    value = createModelTraceChallenge(readModelTraceJson(args.get('--context'), 'context'), {
      now,
    });
  } else if (command === 'challenge-digest')
    value = {
      challengeDigest: computeModelTraceChallengeDigest(
        readModelTraceJson(args.get('--challenge'), 'challenge')
      ),
    };
  else if (command === 'score') {
    for (const option of ['--challenge', '--response', '--previous']) {
      if (args.has(option))
        assertOutsideRepository(fs.realpathSync(args.get(option)), option.slice(2));
    }
    const challenge = readModelTraceJson(args.get('--challenge'), 'challenge');
    validateModelTraceContext(challenge.context, { fresh: true });
    const previous = args.has('--previous')
      ? readModelTraceJson(args.get('--previous'), 'previous record')
      : null;
    if (previous !== null) {
      const recomputed = buildModelTraceRecord(previous.challenge, previous.response, {
        previous: previous.previous,
      });
      if (!isDeepStrictEqual(previous.receipt, recomputed.receipt))
        throw new Error('previous local record does not reproduce its fingerprint');
    }
    value = buildModelTraceRecord(
      challenge,
      readModelTraceJson(args.get('--response'), 'response'),
      { previous: previous?.receipt ?? null }
    );
    if (Date.parse(value.receipt.measuredAt) > now.getTime())
      throw new Error('response completedAt is in the future');
  } else {
    const receipt = loadModelTraceRecord({
      recordPath: args.get('--record'),
      contextPath: args.get('--context'),
      now,
    });
    value =
      command === 'validate'
        ? {
            valid: true,
            receiptId: receipt.id,
            result: receipt.result,
            anomalies: receipt.anomalies,
            expiresAt: receipt.expiresAt,
          }
        : renderModelTraceDisclosure(receipt, args.get('--format') ?? 'markdown');
  }
  const text = typeof value === 'string' ? `${value}\n` : `${JSON.stringify(value, null, 2)}\n`;
  if (realOutput) {
    const writeParent = fs.realpathSync(path.dirname(realOutput));
    const writePath = path.join(writeParent, path.basename(realOutput));
    assertOutsideRepository(writePath, 'challenges/records');
    fs.writeFileSync(writePath, text, { flag: 'wx', mode: 0o600 });
    stdout.write(
      `${JSON.stringify({ written: output, kind: value.kind, receiptId: value.receipt?.id ?? null })}\n`
    );
  } else stdout.write(text);
  return value;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runModelTraceCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`[agent:identify] ${error.message}\n`);
    process.exitCode = 1;
  }
}
