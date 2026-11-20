#!/usr/bin/env node
// CPU-only diagnostic. This does not run a browser, shader or display pipeline.
// Invoke from the repository root; output is explicit and never overwritten.
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const usage = `Usage: node scripts/analysis/liquid-optical-cpu-benchmark.mjs --out DIRECTORY [--base COMMIT] [--repo DIRECTORY]

Defaults: --repo is the current working directory; --base is
543c8a2990239dec7c08458a902da3f5a97b49dd. Use a fresh --out directory.
Writes prefilter-benchmark.json and contrast-benchmark.json with all 31 samples.
The baseline commit must exist locally. Results are CPU diagnostics, not FPS.`;
const options = { repo: process.cwd(), base: '543c8a2990239dec7c08458a902da3f5a97b49dd', out: '' };
for (let index = 2; index < process.argv.length; index++) {
  const flag = process.argv[index];
  if (flag === '--help' || flag === '-h') {
    console.log(usage);
    process.exit(0);
  }
  const key = flag.slice(2);
  if (
    !flag.startsWith('--') ||
    !Object.hasOwn(options, key) ||
    !process.argv[index + 1] ||
    process.argv[index + 1].startsWith('--')
  )
    throw new Error(`Invalid argument: ${flag}\n${usage}`);
  options[key] = process.argv[++index];
}
if (!options.out) throw new Error(`An explicit --out directory is required.\n${usage}`);
const repository = path.resolve(options.repo);
const outputDirectory = path.resolve(options.out);
for (const filename of ['prefilter-benchmark.json', 'contrast-benchmark.json'])
  if (fs.existsSync(path.join(outputDirectory, filename)))
    throw new Error(
      `Refusing to overwrite retained evidence: ${filename}; choose a fresh --out directory.`
    );
const base = cp
  .execFileSync('git', ['rev-parse', '--verify', '--end-of-options', `${options.base}^{commit}`], {
    cwd: repository,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  .trim();
const require = createRequire(path.join(repository, 'package.json'));
const { transformSync } = require('esbuild');
const programPath = 'packages/adapters/base/src/material/program.ts';
const stylePath = 'packages/adapters/base/src/material/style.ts';
const tintPath = 'packages/adapters/base/src/material/style-tint-profile.ts';
const baselineFile = (filename) =>
  cp.execFileSync('git', ['show', `${base}:${filename}`], { cwd: repository, encoding: 'utf8' });
const beforeSource = baselineFile(programPath);
const afterSource = fs.readFileSync(path.join(repository, programPath), 'utf8');
const style = baselineFile(stylePath);
const tint = baselineFile(tintPath);
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');
function chunk(source, start, end) {
  const begin = source.indexOf(start);
  const finish = source.indexOf(end, begin);
  if (begin < 0 || finish < begin) throw new Error(`Source anchor missing: ${start} -> ${end}`);
  return source.slice(begin, finish);
}
function compile(source, resultName) {
  return Function(
    transformSync(source.replaceAll('export function', 'function'), {
      loader: 'ts',
      target: 'es2022',
    }).code + `\nreturn ${resultName}`
  )();
}
function summary(samples) {
  const sorted = samples.slice().sort((a, b) => a - b);
  return { p50: sorted[15], p95: sorted[29], samples };
}
function measure(before, after, args) {
  for (let i = 0; i < 8; i++) {
    before(...args);
    after(...args);
  }
  const samples = { before: [], after: [] };
  for (let i = 0; i < 31; i++) {
    const order =
      i % 2
        ? [
            ['after', after],
            ['before', before],
          ]
        : [
            ['before', before],
            ['after', after],
          ];
    for (const [name, fn] of order) {
      const start = performance.now();
      fn(...args);
      samples[name].push(performance.now() - start);
    }
  }
  return { before: summary(samples.before), after: summary(samples.after) };
}
const metadata = {
  capturedAt: new Date().toISOString(),
  node: process.version,
  v8: process.versions.v8,
  platform: process.platform,
  arch: process.arch,
  kernel: os.release(),
  cpuModels: [...new Set(os.cpus().map((cpu) => cpu.model))],
  logicalCpuCount: os.cpus().length,
  availableParallelism: os.availableParallelism(),
  totalMemoryBytes: os.totalmem(),
  esbuild: require('esbuild/package.json').version,
  base,
  candidateSha256: hash(afterSource),
  baselineSha256: hash(beforeSource),
  scriptSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))),
  method:
    '8 warmup calls per function; 31 paired samples with alternating order; monotonic performance.now; p50 rank16 and p95 rank30. No timing gate.',
  limits:
    'Shared execution environment; no CPU affinity, frequency, thermal or scheduler isolation. No GPU, readPixels transfer, PNG encoding, Image.decode, DOM or display measurement. No environment variables or host/account identifiers collected.',
};
fs.mkdirSync(outputDirectory, { recursive: true });
const beforeFilter = compile(
  beforeSource.slice(beforeSource.indexOf('function prefilter(')),
  'prefilter'
);
const afterFilter = compile(
  afterSource.slice(afterSource.indexOf('function prefilter(')),
  'prefilter'
);
const filterReport = { kind: 'cpu-prefilter-only-not-browser-fps', ...metadata, cases: [] };
let seed = 19;
for (const [width, height] of [
  [128, 64],
  [256, 128],
  [512, 256],
  [1024, 512],
]) {
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    pixels[i] = i % 4 === 3 ? 255 : seed >>> 24;
  }
  const oldResult = beforeFilter(pixels, width, height);
  const newResult = afterFilter(pixels, width, height);
  if (oldResult.some((value, i) => value !== newResult[i]))
    throw new Error('Prefilter bytes differ');
  const result = { width, height, ...measure(beforeFilter, afterFilter, [pixels, width, height]) };
  filterReport.cases.push(result);
  console.log(
    JSON.stringify({
      kind: 'prefilter',
      width,
      height,
      beforeP50: result.before.p50,
      afterP50: result.after.p50,
    })
  );
}
fs.writeFileSync(
  path.join(outputDirectory, 'prefilter-benchmark.json'),
  JSON.stringify(filterReport, null, 2) + '\n',
  { flag: 'wx' }
);

const legacyHelpers =
  chunk(style, 'export function opaqueRgba', 'export function resolvePaletteColor') +
  chunk(style, 'export function colorContrast', '/** Resolves only') +
  chunk(tint, 'const weights', '/** Adapter-private proof inputs');
const legacyLoop = chunk(beforeSource, '      let opaqueSamples = 0;', '      const encoding');
const newHelpers = chunk(afterSource, 'const decodeSrgb', 'export type OpticalGeometry');
const newLoop = chunk(
  afterSource,
  '      const foregroundLuminance =',
  '      const encoding'
).replace('      metrics.contrastMilliseconds += performance.now() - contrastStarted;', '');
const verifier = (helpers, loop) =>
  compile(
    `${helpers}\nfunction validate(pixels, frame, tintEnvelope) {\n${loop}\nreturn opaqueSamples;}`,
    'validate'
  );
const beforeContrast = verifier(legacyHelpers, legacyLoop);
const afterContrast = verifier(newHelpers, newLoop);
const envelope = compile(
  chunk(tint, 'const weights', 'const helpers =') +
    chunk(style, 'export function colorContrast', '/** Resolves only') +
    chunk(style, 'export function opaqueRgba', 'export function resolvePaletteColor'),
  'styleTintEnvelope'
);
const contrastReport = {
  kind: 'cpu-readback-contrast-only-not-browser-fps',
  ...metadata,
  cases: [],
};
for (const [width, height] of [
  [128, 64],
  [256, 128],
])
  for (const tinted of [false, true]) {
    const frame = {
      fill: [0, 0, 0, 1],
      foreground: [1, 1, 1, 1],
      ...(tinted ? { tint: 'style-fill' } : {}),
    };
    const proof = tinted ? envelope(frame.fill, frame.foreground) : null;
    const pixels = new Uint8Array(width * height * 4);
    for (let i = 0; i < pixels.length; i++)
      pixels[i] = i % 4 === 3 ? 250 + ((i >>> 2) % 6) : (i * 29) % 64;
    if (beforeContrast(pixels, frame, proof) !== afterContrast(pixels, frame, proof))
      throw new Error('Coverage counts differ');
    const result = {
      width,
      height,
      tinted,
      ...measure(beforeContrast, afterContrast, [pixels, frame, proof]),
    };
    contrastReport.cases.push(result);
    console.log(
      JSON.stringify({
        kind: 'contrast',
        width,
        height,
        tinted,
        beforeP50: result.before.p50,
        afterP50: result.after.p50,
      })
    );
  }
fs.writeFileSync(
  path.join(outputDirectory, 'contrast-benchmark.json'),
  JSON.stringify(contrastReport, null, 2) + '\n',
  { flag: 'wx' }
);
