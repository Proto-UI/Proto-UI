import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, json } from './evidence.mjs';
import {
  exchangeSchemas,
  exchangeScope,
  limits,
  validateExchange,
} from './round0-exchange-schema.mjs';

// This module copies inert bytes. It has no process/model/browser executor, no
// oracle loader and no capability to authorize an evaluation.
const blocked = Object.freeze({
  execution: 'blocked',
  isolation: 'unproven',
  oracle: 'unavailable',
  participant: 'synthetic',
});
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameSource = (a, b) =>
  ['repository', 'revision', 'inventorySha256'].every((key) => a[key] === b[key]);

function separateOutput(output, inputs) {
  const out = path.resolve(output);
  for (const input of inputs) {
    const source = path.resolve(input);
    if (
      out === source ||
      out.startsWith(`${source}${path.sep}`) ||
      source.startsWith(`${out}${path.sep}`)
    )
      throw new Error('Output must be separate from every input');
  }
}

function noLinks(absolute) {
  const resolved = path.resolve(absolute);
  let current = path.parse(resolved).root;
  for (const part of resolved.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink())
      throw new Error('Symbolic links are not exchange inputs or outputs');
  }
  return resolved;
}

function readBounded(filename, maximum) {
  noLinks(filename);
  const before = fs.lstatSync(filename);
  if (!before.isFile() || before.nlink !== 1)
    throw new Error('Exchange input must be a single-link regular file');
  if (before.size > maximum) throw new Error('Input byte limit exceeded');
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const opened = fs.fstatSync(fd);
    if (
      !opened.isFile() ||
      opened.nlink !== 1 ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size !== before.size
    )
      throw new Error('Input changed while opening');
    // Read at most the bounded declared size plus one, even if a writer grows it.
    const buffer = Buffer.alloc(opened.size + 1);
    let count = 0;
    while (count < buffer.length) {
      const read = fs.readSync(fd, buffer, count, buffer.length - count, null);
      if (!read) break;
      count += read;
    }
    const after = fs.fstatSync(fd);
    const current = fs.lstatSync(filename);
    if (
      count !== opened.size ||
      after.size !== opened.size ||
      after.nlink !== 1 ||
      current.ino !== opened.ino ||
      current.dev !== opened.dev ||
      !current.isFile()
    )
      throw new Error('Input changed while reading');
    return buffer.subarray(0, count);
  } finally {
    fs.closeSync(fd);
  }
}

function readDocument(filename, kind) {
  const bytes = readBounded(filename, limits.documentBytes);
  return { value: validateExchange(kind, JSON.parse(bytes.toString('utf8'))), bytes };
}

function inventory(root, expected) {
  noLinks(root);
  if (!fs.lstatSync(root).isDirectory()) throw new Error('Exchange root must be a directory');
  const expectedFiles = new Set(expected);
  const expectedDirs = new Set();
  for (const filename of expected) {
    let dir = path.posix.dirname(filename);
    while (dir !== '.') {
      expectedDirs.add(dir);
      dir = path.posix.dirname(dir);
    }
  }
  const found = [];
  let entries = 0;
  function walk(relative) {
    const dir = fs.opendirSync(path.join(root, relative));
    try {
      let item;
      while ((item = dir.readSync())) {
        if (++entries > limits.files * 4 + 16)
          throw new Error('Directory inventory limit exceeded');
        const name = relative ? `${relative}/${item.name}` : item.name;
        const stat = fs.lstatSync(path.join(root, name));
        if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory()))
          throw new Error('Only regular files and declared directories are allowed');
        if (stat.isDirectory()) {
          if (!expectedDirs.has(name)) throw new Error('Unexpected directory in inventory');
          walk(name);
        } else {
          if (stat.nlink !== 1) throw new Error('Hardlinks are not exchange files');
          if (!expectedFiles.has(name)) throw new Error('Unexpected file in inventory');
          found.push(name);
        }
      }
    } finally {
      dir.closeSync();
    }
  }
  walk('');
  if (!same(found.sort(), [...expectedFiles].sort())) throw new Error('Missing file in inventory');
}

function capture(root, files, prefix = '') {
  const result = [];
  for (const item of files) {
    const data = readBounded(path.join(root, prefix, item.path), limits.fileBytes);
    if (data.length !== item.bytes || sha256(data) !== item.sha256)
      throw new Error(`File bytes/digest mismatch: ${item.path}`);
    result.push({ path: item.path, data });
  }
  return result;
}

function newOutput(output) {
  const absolute = path.resolve(output);
  noLinks(path.dirname(absolute));
  fs.mkdirSync(absolute); // No reuse, replacement or recursive creation.
  return absolute;
}
function write(output, name, bytes) {
  const target = path.join(output, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes, { flag: 'wx' });
}
function snapshot(output, receiptName, receipt, prefix, captured) {
  const root = newOutput(output);
  try {
    for (const item of captured) write(root, `${prefix}/${item.path}`, item.data);
    // Receipt comes last; an interrupted copy cannot appear complete.
    write(root, receiptName, json(receipt));
  } catch (error) {
    try {
      write(
        root,
        'incomplete.json',
        json({
          schemaVersion: 1,
          kind: 'proto-ui.round0.incomplete-copy',
          scope: exchangeScope,
          ...blocked,
          status: 'incomplete',
          reason: String(error.message).slice(0, 4096),
        })
      );
    } catch {
      /* Preserve partial files even if storage is unavailable. */
    }
    throw error;
  }
  return { receipt, receiptSha256: sha256(Buffer.from(json(receipt))), ...blocked };
}
function packetArchive(root) {
  const { value, bytes } = readDocument(path.join(root, 'packet.json'), 'packet');
  if (!bytes.equals(Buffer.from(json(value)))) throw new Error('Noncanonical packet receipt');
  inventory(root, ['packet.json', ...value.files.map((item) => `participant/${item.path}`)]);
  capture(root, value.files, 'participant');
  return { value, digest: sha256(bytes) };
}
function bindPacket(submission, packet) {
  if (
    submission.packet.packetId !== packet.value.packetId ||
    submission.packet.receiptSha256 !== packet.digest
  )
    throw new Error('Packet binding mismatch');
  if (!sameSource(submission.source, packet.value.source))
    throw new Error('Source binding mismatch');
}
function disposition(submission, captured) {
  if (submission.outcome === 'completed') return;
  const data = captured.find((item) => item.path === 'evidence/disposition.json').data;
  if (data.length > limits.documentBytes) throw new Error('Disposition byte limit exceeded');
  const value = validateExchange('disposition', JSON.parse(data.toString('utf8')));
  if (value.outcome !== submission.outcome) throw new Error('Disposition outcome mismatch');
}

export function pack({ planPath, input, output }) {
  separateOutput(output, [planPath, input]);
  const { value } = readDocument(planPath, 'packet');
  inventory(
    input,
    value.files.map((item) => item.path)
  );
  const captured = capture(input, value.files);
  return snapshot(output, 'packet.json', value, 'participant', captured);
}

export function submit({ planPath, packet, input, output }) {
  separateOutput(output, [planPath, packet, input]);
  const { value } = readDocument(planPath, 'submission');
  bindPacket(value, packetArchive(packet));
  inventory(
    input,
    value.files.map((item) => item.path)
  );
  const captured = capture(input, value.files);
  disposition(value, captured);
  return snapshot(output, 'submission.json', value, 'payload', captured);
}

export function inspect({ expectedPath, packet, submission, output }) {
  separateOutput(output, [expectedPath, packet, submission]);
  const root = newOutput(output);
  const report = {
    schemaVersion: 1,
    kind: 'proto-ui.round0.inspection',
    scope: exchangeScope,
    ...blocked,
    contract: 'rejected',
    outcome: null,
    bindings: null,
    reason: null,
  };
  try {
    const expected = readDocument(expectedPath, 'expected');
    // A validly shaped, wrong expectation is useful rejected-attempt evidence too.
    write(root, 'expected.json', expected.bytes);
    const packed = packetArchive(packet);
    bindPacket(expected.value, packed);
    const received = readDocument(path.join(submission, 'submission.json'), 'submission');
    if (!received.bytes.equals(Buffer.from(json(received.value))))
      throw new Error('Noncanonical submission receipt');
    bindPacket(received.value, packed);
    for (const key of ['submissionId', 'attemptId'])
      if (received.value[key] !== expected.value[key]) throw new Error(`${key} binding mismatch`);
    inventory(submission, [
      'submission.json',
      ...received.value.files.map((item) => `payload/${item.path}`),
    ]);
    const captured = capture(submission, received.value.files, 'payload');
    disposition(received.value, captured);
    report.contract = 'valid';
    report.outcome = received.value.outcome;
    report.bindings = {
      expectedSha256: sha256(expected.bytes),
      packetSha256: packed.digest,
      submissionSha256: sha256(received.bytes),
      submissionId: received.value.submissionId,
      attemptId: received.value.attemptId,
    };
    report.reason =
      'Byte/inventory and coordinator-expected bindings match. No execution, secure-isolation, source-authenticity or behavioral claim.';
  } catch (error) {
    report.reason = String(error.message).slice(0, 4096);
  }
  write(root, 'inspection.json', json(report));
  return report;
}

function options(args, names) {
  if (args.length !== names.length * 2) throw new Error('Missing or unexpected exchange arguments');
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i].replace(/^--/, '');
    if (
      args[i] !== `--${name}` ||
      !names.includes(name) ||
      Object.hasOwn(result, name) ||
      !args[i + 1]
    )
      throw new Error('Missing, duplicate or unexpected exchange argument');
    result[name] = args[i + 1];
  }
  return result;
}
function main() {
  const [command, ...args] = process.argv.slice(2);
  let result;
  if (command === 'schemas' && args.length === 0) result = exchangeSchemas;
  else if (command === 'pack') {
    const o = options(args, ['plan', 'input', 'out']);
    result = pack({ planPath: o.plan, input: o.input, output: o.out });
  } else if (command === 'submit') {
    const o = options(args, ['plan', 'packet', 'input', 'out']);
    result = submit({ planPath: o.plan, packet: o.packet, input: o.input, output: o.out });
  } else if (command === 'inspect') {
    const o = options(args, ['expect', 'packet', 'submission', 'out']);
    result = inspect({
      expectedPath: o.expect,
      packet: o.packet,
      submission: o.submission,
      output: o.out,
    });
    if (result.contract !== 'valid') process.exitCode = 1;
  } else throw new Error('Use schemas, pack, submit or inspect; no execution command exists');
  process.stdout.write(json(result));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      json({
        schemaVersion: 1,
        kind: 'proto-ui.round0.command-failure',
        scope: exchangeScope,
        ...blocked,
        status: 'rejected',
        reason: String(error.message).slice(0, 4096),
      })
    );
    process.exitCode = 1;
  }
}
