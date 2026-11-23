import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, version as esbuildVersion } from 'esbuild';
import {
  PROTOCOL,
  PLAN,
  DPRS,
  PIXEL_CASES,
  STAGE_CASES,
  LIFETIME_REQUIREMENTS,
  CONTROL_IDS,
  analyzeReceipt,
} from '../../experiments/liquid-canvas-transport/protocol.mjs';

const ENTRY = 'experiments/liquid-canvas-transport/browser.mjs';
const HARNESS = 'apps/www/src/content/docs/zh-cn/browser-harness.ts';
const PROGRAM = 'packages/adapters/base/src/material/program.ts';
const IMAGE = 'packages/adapters/base/src/material/image-prepare.ts';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (root, args, encoding = 'utf8') =>
  execFileSync('git', args, { cwd: root, encoding, maxBuffer: 20 * 1024 * 1024 });
const snapshot = (root) => ({
  sha: git(root, ['rev-parse', 'HEAD']).trim(),
  tree: git(root, ['rev-parse', 'HEAD^{tree}']).trim(),
  status: git(root, ['status', '--porcelain=v1', '--untracked-files=all']).trim(),
});
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return (
    relative !== '' &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== '..' &&
    !path.isAbsolute(relative)
  );
};
const safeArtifactPath = (value) =>
  typeof value === 'string' &&
  /^[a-zA-Z0-9_./-]+$/.test(value) &&
  !path.isAbsolute(value) &&
  !value.split('/').some((part) => part === '..' || part === '' || part === '.');

async function saveArtifact(output, relative, bytes, artifacts) {
  assert.ok(safeArtifactPath(relative), `Unsafe artifact path: ${relative}`);
  assert.ok(!artifacts.some((entry) => entry.path === relative), `Duplicate artifact: ${relative}`);
  const target = path.join(output, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  const entry = { path: relative, bytes: bytes.length, sha256: sha256(bytes) };
  artifacts.push(entry);
  return entry;
}

async function materializeContext(output, context, artifacts) {
  for (const group of ['pixels', 'stages', 'lifetime', 'controls'])
    for (const row of context[group] ?? []) {
      if (row.planes)
        for (const [name, value] of Object.entries(row.planes)) {
          assert.ok(
            /^[a-zA-Z0-9-]+$/.test(row.id) && /^[a-zA-Z0-9]+$/.test(name),
            'Unsafe plane identity'
          );
          assert.equal(typeof value.base64, 'string', 'Full original readback is missing');
          const bytes = Buffer.from(value.base64, 'base64');
          row.planes[name] = {
            width: value.width,
            height: value.height,
            ...(await saveArtifact(output, `raw/${row.id}/${name}.rgba`, bytes, artifacts)),
          };
        }
      if (row.png) {
        assert.ok(row.png.startsWith('data:image/png;base64,'), 'Invalid original PNG result');
        assert.equal(sha256(row.png), row.pngSha256, 'Original PNG string digest mismatch');
        row.pngArtifact = await saveArtifact(
          output,
          `png/${row.id}.png`,
          Buffer.from(row.png.slice('data:image/png;base64,'.length), 'base64'),
          artifacts
        );
        delete row.png;
      }
    }
}

export async function analyzeFromDisk(reportPath, write = true) {
  const reportBytes = await readFile(reportPath),
    report = JSON.parse(reportBytes),
    root = await realpath(path.dirname(reportPath));
  const artifactFailures = [],
    verified = new Map(),
    seen = new Set();
  for (const entry of report.artifacts ?? []) {
    try {
      assert.ok(safeArtifactPath(entry.path), 'Unsafe path');
      assert.ok(!seen.has(entry.path), 'Duplicate artifact');
      seen.add(entry.path);
      const file = await realpath(path.join(root, entry.path));
      assert.ok(inside(root, file), 'Artifact escapes its receipt directory');
      const bytes = await readFile(file);
      assert.equal(bytes.length, entry.bytes, 'Artifact length changed');
      assert.equal(sha256(bytes), entry.sha256, 'Artifact digest changed');
      verified.set(entry.path, { ...entry, data: bytes });
    } catch (fault) {
      artifactFailures.push({ path: entry.path, error: String(fault) });
    }
  }
  const readPlane = async (descriptor) => {
    assert.ok(
      descriptor && verified.has(descriptor.path),
      'Unverified or missing full pixel plane'
    );
    const found = verified.get(descriptor.path);
    assert.equal(
      found.sha256,
      descriptor.sha256,
      'Plane descriptor digest does not match artifact'
    );
    assert.equal(
      found.data.length,
      descriptor.bytes,
      'Plane descriptor length does not match artifact'
    );
    return { width: descriptor.width, height: descriptor.height, pixels: found.data };
  };
  const analysis = await analyzeReceipt(report, readPlane);
  const requireArtifact = (label, descriptor) => {
    const found = descriptor && verified.get(descriptor.path);
    if (!found || found.sha256 !== descriptor.sha256)
      artifactFailures.push({ path: descriptor?.path ?? label, error: `Missing/invalid ${label}` });
    return found;
  };
  const bundle = requireArtifact('native bundle', report.source?.bundle);
  const workload = requireArtifact('workload', report.source?.workload);
  if (workload && workload.data.toString('utf8') !== `${JSON.stringify(PLAN, null, 2)}\n`)
    artifactFailures.push({
      path: workload.path,
      error: 'Frozen reader inventory differs from recorded workload',
    });
  for (const [source, entry] of Object.entries(report.source?.closure ?? {})) {
    const found = requireArtifact(`source ${source}`, entry.artifact);
    if (
      found &&
      (found.sha256 !== entry.sha256 ||
        createHash('sha1')
          .update(`blob ${found.data.length}\0`)
          .update(found.data)
          .digest('hex') !== entry.gitBlob)
    )
      artifactFailures.push({
        path: source,
        error: 'Source archive differs from its HEAD blob binding',
      });
  }
  if (!report.source?.closure?.[PROGRAM] || !report.source?.closure?.[IMAGE] || !bundle)
    artifactFailures.push({
      path: 'source-closure',
      error: 'Actual production renderer and image decoder are not bound',
    });
  for (const context of report.contexts ?? [])
    for (const group of ['pixels', 'stages'])
      for (const row of context[group] ?? []) {
        if (row.status !== 'ok') continue;
        const png = requireArtifact(`${row.id} same-render PNG`, row.pngArtifact);
        if (png && sha256(`data:image/png;base64,${png.data.toString('base64')}`) !== row.pngSha256)
          artifactFailures.push({
            path: png.path,
            error: 'PNG artifact differs from actual encoder return string',
          });
      }
  analysis.receiptSha256 = sha256(reportBytes);
  analysis.readerSha256 = sha256(await readFile(fileURLToPath(import.meta.url)));
  analysis.protocolSha256 = sha256(
    await readFile(
      new URL('../../experiments/liquid-canvas-transport/protocol.mjs', import.meta.url)
    )
  );
  analysis.artifactFailures = artifactFailures;
  analysis.verifiedArtifacts = verified.size;
  analysis.accepted &&= artifactFailures.length === 0;
  if (write) {
    await writeFile(path.join(root, 'analysis.json'), `${JSON.stringify(analysis, null, 2)}\n`);
    await writeFile(path.join(root, 'analysis.md'), renderAnalysis(analysis));
  }
  return analysis;
}

function renderAnalysis(analysis) {
  const lines = [
    '# Owned Canvas2D transport observation',
    '',
    `Native experiment acceptance: **${analysis.accepted ? 'passed' : 'failed'}**. Product 10 ms acceptance: **not evaluated**.`,
    '',
    analysis.interpretation,
    '',
    '| Inventory | Planned | Recorded | Attempted | Completed collection | Failed collection | Unattempted |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const [key, row] of Object.entries(analysis.inventory))
    lines.push(
      `| ${key} | ${row.planned} | ${row.recorded} | ${row.attempted} | ${row.completed} | ${row.failed} | ${row.unattempted} |`
    );
  lines.push(
    '',
    'Completed collection is not fidelity acceptance; every exact mismatch remains below and in the JSON.',
    '',
    '| Workload | Capture order | Metric (ms) | Samples | p50 | p95 | Max | >10 ms |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |'
  );
  const format = (value) => (value === null ? 'unavailable' : value.toFixed(4));
  for (const group of analysis.groups)
    for (const [metric, row] of Object.entries(group.metrics))
      lines.push(
        `| ${group.workload} | ${group.order} | ${metric} | ${row.samples} | ${format(row.p50)} | ${format(row.p95)} | ${format(row.max)} | ${row.over10} |`
      );
  lines.push(
    '',
    'Quantiles use linear interpolation at (n − 1) × p. All samples and all >10 ms rows remain in analysis.json; none is a product input-to-photon observation.',
    '',
    '## Failures',
    ''
  );
  if (!analysis.failures.length && !analysis.artifactFailures.length)
    lines.push('No experiment reader failures.');
  else {
    for (const row of analysis.failures)
      lines.push(`- ${row.id}: ${JSON.stringify(row.detail ?? null)}`);
    for (const row of analysis.artifactFailures) lines.push(`- artifact ${row.path}: ${row.error}`);
  }
  return `${lines.join('\n')}\n`;
}

export async function observe(output, expectedSha) {
  const root = await realpath(process.cwd());
  assert.ok(/^[a-f0-9]{40}$/.test(expectedSha), 'Expected SHA must be a full immutable commit');
  assert.ok(
    !inside(root, path.resolve(output)) && path.resolve(output) !== root,
    'Write evidence outside the source checkout'
  );
  await mkdir(output, { recursive: true });
  const report = {
    protocol: PROTOCOL,
    started: new Date().toISOString(),
    source: { expectedSha, closure: {}, closureStable: false, headBound: false },
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      cpuModel: os.cpus()[0]?.model,
      esbuild: esbuildVersion,
      headless: true,
      sandboxPolicy: 'unchanged existing launchBrowser',
      githubActionsObserved: process.env.GITHUB_ACTIONS ?? null,
    },
    contexts: [],
    artifacts: [],
    failures: [],
  };
  let browser;
  try {
    report.source.start = snapshot(root);
    assert.equal(
      report.source.start.sha,
      expectedSha,
      'Checkout does not match explicit expected SHA'
    );
    assert.equal(
      report.source.start.status,
      '',
      'Native observation requires a clean committed checkout'
    );
    assert.equal(
      Number(process.versions.node.split('.')[0]),
      24,
      'Use the repository Node 24 baseline'
    );
    const compiled = await build({
      absWorkingDir: root,
      entryPoints: [ENTRY],
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'esm',
      target: 'es2022',
      metafile: true,
    });
    const code = compiled.outputFiles[0].contents;
    report.source.bundle = await saveArtifact(output, 'native-bundle.mjs', code, report.artifacts);
    report.source.bundleMetafile = await saveArtifact(
      output,
      'bundle-metafile.json',
      Buffer.from(`${JSON.stringify(compiled.metafile, null, 2)}\n`),
      report.artifacts
    );
    report.source.workload = await saveArtifact(
      output,
      'workload.json',
      Buffer.from(`${JSON.stringify(PLAN, null, 2)}\n`),
      report.artifacts
    );
    const files = [
      ...new Set([
        ...Object.keys(compiled.metafile.inputs),
        HARNESS,
        'scripts/test/server-readiness.mjs',
        'scripts/analysis/liquid-canvas-transport.mjs',
        'package.json',
        'apps/www/package.json',
        'pnpm-lock.yaml',
      ]),
    ].sort();
    for (const relative of files) {
      assert.ok(safeArtifactPath(relative), `Bundle input escaped checkout: ${relative}`);
      const file = path.join(root, relative),
        bytes = await readFile(file);
      assert.ok(inside(root, await realpath(file)), 'Source dependency escaped checkout');
      const headBytes = git(root, ['show', `${expectedSha}:${relative}`], 'buffer');
      assert.equal(sha256(bytes), sha256(headBytes), `Source is not bound to HEAD: ${relative}`);
      report.source.closure[relative] = {
        sha256: sha256(bytes),
        bytes: bytes.length,
        gitBlob: git(root, ['rev-parse', `${expectedSha}:${relative}`]).trim(),
        artifact: await saveArtifact(output, `source/${relative}`, bytes, report.artifacts),
      };
    }
    assert.ok(
      report.source.closure[PROGRAM] && report.source.closure[IMAGE],
      'Production source modules missing from actual bundle'
    );
    report.source.headBound = true;
    report.environment.playwright = createRequire(path.join(root, HARNESS))(
      'playwright-core/package.json'
    ).version;
    const { launchBrowser } = await import(pathToFileURL(path.join(root, HARNESS)).href);
    // Do not alter GITHUB_ACTIONS, sandbox settings, launch arguments or renderer.
    browser = await launchBrowser();
    report.environment.browser = browser.version();
    const session = await browser.newBrowserCDPSession();
    report.environment.gpu = (await session.send('SystemInfo.getInfo')).gpu;
    await session.detach();
    for (const dpr of DPRS) {
      const context = await browser.newContext({
        viewport: { width: 1024, height: 1024 },
        deviceScaleFactor: dpr,
        serviceWorkers: 'block',
      });
      const page = await context.newPage(),
        pageErrors = [],
        consoleMessages = [],
        unexpectedRequests = [];
      const url = 'https://liquid-canvas-transport.test/';
      page.on('pageerror', (fault) => pageErrors.push(String(fault)));
      page.on('console', (entry) =>
        consoleMessages.push({ type: entry.type(), text: entry.text() })
      );
      await context.route('**/*', (route) => {
        if (route.request().url() === url)
          return route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>Owned canvas transport experiment</title><style>body{margin:0}</style>',
          });
        unexpectedRequests.push({ method: route.request().method(), url: route.request().url() });
        return route.abort();
      });
      let evidence;
      try {
        await page.goto(url, { waitUntil: 'load' });
        const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
        evidence = await page.evaluate(
          `import(${JSON.stringify(moduleUrl)}).then(module => module.collectCanvasTransport(${dpr}))`
        );
      } catch (fault) {
        pageErrors.push(String(fault));
        try {
          evidence = await page.evaluate('globalThis.__puiOwnedCanvasTransportEvidence ?? null');
        } catch {
          /* Real page loss leaves its inventory unexecuted. */
        }
      } finally {
        await context.close();
      }
      evidence ??= {
        dpr,
        environment: {},
        errors: [],
        cleanup: {},
        pixels: PIXEL_CASES.filter((row) => row.dpr === dpr).map((row) => ({
          ...row,
          status: 'unattempted',
        })),
        stages: dpr === 1 ? STAGE_CASES.map((row) => ({ ...row, status: 'unattempted' })) : [],
        lifetime:
          dpr === 1
            ? Object.keys(LIFETIME_REQUIREMENTS).map((id) => ({ id, status: 'unattempted' }))
            : [],
        controls: dpr === 1 ? CONTROL_IDS.map((id) => ({ id, status: 'unattempted' })) : [],
      };
      evidence.errors.push(
        ...pageErrors.map((text) => ({ stage: 'page', message: text })),
        ...unexpectedRequests.map((request) => ({ stage: 'unexpected-request', ...request }))
      );
      evidence.console = consoleMessages;
      report.contexts.push(evidence);
      await materializeContext(output, evidence, report.artifacts);
    }
  } catch (fault) {
    report.failures.push(String(fault));
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (fault) {
        report.failures.push(`browser-retire: ${String(fault)}`);
      }
    }
    try {
      report.source.end = snapshot(root);
      let stable = true;
      for (const [file, expected] of Object.entries(report.source.closure)) {
        if (sha256(await readFile(path.join(root, file))) !== expected.sha256) {
          stable = false;
          report.failures.push(`Source changed during native observation: ${file}`);
        }
      }
      report.source.closureStable = report.source.headBound && stable;
    } catch (fault) {
      report.failures.push(`source-end: ${String(fault)}`);
    }
    report.finished = new Date().toISOString();
    await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  return analyzeFromDisk(path.join(output, 'report.json'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let result;
  if (args.length === 2 && args[0] === '--analyze')
    result = await analyzeFromDisk(path.resolve(args[1]));
  else {
    assert.ok(
      args.length === 3 && args[1] === '--expected-sha',
      'Usage: node --import tsx scripts/analysis/liquid-canvas-transport.mjs OUTPUT --expected-sha EXACT_HEAD; or --analyze OUTPUT/report.json'
    );
    result = await observe(path.resolve(args[0]), args[2]);
  }
  process.stdout.write(
    `${JSON.stringify({
      accepted: result.accepted,
      productBudget: result.productBudget,
      inventory: result.inventory,
      failures: result.failures.length,
      artifactFailures: result.artifactFailures.length,
    })}\n`
  );
  if (!result.accepted) process.exitCode = 1;
}
